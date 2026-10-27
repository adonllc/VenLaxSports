"""Admin player CRM: profile, tags, private notes, account status, saved segments, duplicate report.
Mounted under /api/admin/players. Static paths are declared before /{player_id} so they are never read as an id.

Every change is checked against a permission on the server and written to the audit log. Admin accounts are never
the target of these routes: they are managed under Team.
"""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

import audit_log
import permissions
import player_crm as crm
from auth_utils import get_current_user

router = APIRouter()
MAX_BULK = 500
SEGMENT_KEYS = ("segment", "q", "city", "league_id", "not_in_league", "tag", "status")


async def _need(request: Request, permission: str) -> dict:
    return permissions.ensure(await get_current_user(request, request.app.state.db), permission)


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")


async def _player(db, player_id: str) -> dict:
    user = await db.users.find_one({"_id": _oid(player_id)})
    if not user or user.get("role") in ("admin", "city_admin"):
        raise HTTPException(status_code=404, detail="Player not found")
    return user


def _crm_error(e: crm.CrmError):
    return HTTPException(status_code=400, detail=str(e))


class TagChange(BaseModel):
    add: list[str] = []
    remove: list[str] = []


class BulkTagChange(TagChange):
    user_ids: list[str]


class NoteIn(BaseModel):
    text: str


class ReasonIn(BaseModel):
    reason: str = ""


class SegmentIn(BaseModel):
    name: str
    filters: dict = {}


# ── lists that are not about one player ───────────────────────────────────────

@router.get("/duplicates")
async def duplicates(request: Request):
    await _need(request, "players.read")
    users = await request.app.state.db.users.find(
        {"role": {"$nin": ["admin", "city_admin"]}, "is_active": {"$ne": False}}, {"name": 1, "email": 1, "phone": 1, "city": 1, "created_at": 1, "suspended_at": 1, "role": 1, "is_active": 1},
    ).to_list(20000)
    groups = crm.find_duplicates(users)
    return {"groups": groups[:200], "total_groups": len(groups)}


@router.get("/tags")
async def all_tags(request: Request):
    await _need(request, "players.read")
    counts: dict[str, int] = {}
    for u in await request.app.state.db.users.find({"tags": {"$exists": True}}, {"tags": 1}).to_list(20000):
        for t in u.get("tags") or []:
            counts[t] = counts.get(t, 0) + 1
    return {"tags": [{"tag": t, "count": n} for t, n in sorted(counts.items())]}


@router.post("/bulk/tags")
async def bulk_tags(body: BulkTagChange, request: Request):
    admin = await _need(request, "players.write")
    db = request.app.state.db
    ids = list(dict.fromkeys(body.user_ids))
    if not 1 <= len(ids) <= MAX_BULK:
        raise HTTPException(status_code=400, detail=f"Pick between 1 and {MAX_BULK} players")
    if not (body.add or body.remove):
        raise HTTPException(status_code=400, detail="Nothing to add or remove")
    changed = 0
    try:
        for pid in ids:
            user = await db.users.find_one({"_id": _oid(pid)})
            if not user or user.get("role") in ("admin", "city_admin"):
                continue
            new = crm.apply_tags(user.get("tags"), body.add, body.remove)
            if new != sorted(user.get("tags") or []):
                await db.users.update_one({"_id": user["_id"]}, {"$set": {"tags": new}})
                changed += 1
    except crm.CrmError as e:
        raise _crm_error(e)
    await audit_log.record(db, admin, "player.bulk_tags", "players", "", f"{len(ids)} players",
                           after={"add": body.add, "remove": body.remove}, meta={"selected": len(ids), "changed": changed, "sample_ids": ids[:20]}, request=request)
    return {"selected": len(ids), "changed": changed}


@router.get("/segments")
async def list_segments(request: Request):
    await _need(request, "players.read")
    rows = await request.app.state.db.saved_segments.find({}).sort("name", 1).to_list(200)
    return {"segments": [{"id": str(r["_id"]), "name": r["name"], "filters": r.get("filters", {}), "created_by": r.get("created_by_email", "")} for r in rows]}


@router.post("/segments", status_code=201)
async def create_segment(body: SegmentIn, request: Request):
    admin = await _need(request, "players.read")
    db = request.app.state.db
    name = body.name.strip()
    if not 1 <= len(name) <= 60:
        raise HTTPException(status_code=400, detail="Name the segment (up to 60 characters)")
    filters = {k: str(v)[:100] for k, v in body.filters.items() if k in SEGMENT_KEYS and v not in (None, "", "all")}
    if await db.saved_segments.count_documents({}) >= 100:
        raise HTTPException(status_code=409, detail="Too many saved segments. Delete one first.")
    doc = {"name": name, "filters": filters, "created_by": str(admin["_id"]), "created_by_email": admin.get("email", ""),
           "created_at": datetime.now(timezone.utc).isoformat()}
    res = await db.saved_segments.insert_one(doc)
    await audit_log.record(db, admin, "segment.create", "segment", str(res.inserted_id), name, after=filters, request=request)
    return {"id": str(res.inserted_id), "name": name, "filters": filters}


@router.delete("/segments/{segment_id}")
async def delete_segment(segment_id: str, request: Request):
    admin = await _need(request, "players.read")
    db = request.app.state.db
    seg = await db.saved_segments.find_one({"_id": _oid(segment_id)})
    if not seg:
        raise HTTPException(status_code=404, detail="Segment not found")
    if seg.get("created_by") != str(admin["_id"]) and not permissions.has(admin, "roles.manage"):
        raise HTTPException(status_code=403, detail="Only the person who saved a segment, or a super administrator, can delete it")
    await db.saved_segments.delete_one({"_id": seg["_id"]})
    await audit_log.record(db, admin, "segment.delete", "segment", segment_id, seg["name"], before=seg.get("filters"), request=request)
    return {"deleted": True}


# ── one player ────────────────────────────────────────────────────────────────

@router.get("/{player_id}")
async def profile(player_id: str, request: Request):
    admin = await _need(request, "players.read")
    db = request.app.state.db
    u = await _player(db, player_id)
    uid = str(u["_id"])

    regs = await db.player_leagues.find({"player_id": uid}).to_list(200)
    league_docs = {str(lg["_id"]): lg for lg in await db.leagues.find({"_id": {"$in": [ObjectId(r["league_id"]) for r in regs if ObjectId.is_valid(r.get("league_id", ""))]}}).to_list(200)}
    leagues = [{"league_id": r["league_id"], "name": league_docs.get(r["league_id"], {}).get("name", "(deleted league)"),
                "sport": r.get("sport", ""), "payment_status": r.get("payment_status", ""), "joined_at": r.get("joined_at") or r.get("registered_at") or "",
                "partner": r.get("partner_name") or ""} for r in regs]

    matches = await db.matches.find({"$or": [{"player1_id": uid}, {"player2_id": uid}]}).sort("scheduled_date", -1).to_list(30)
    match_rows = [{
        "id": str(m["_id"]), "league_id": m.get("league_id"), "date": m.get("scheduled_date") or "", "status": m.get("status", ""),
        "opponent": m.get("player2_name") if m.get("player1_id") == uid else m.get("player1_name"),
        "result": "" if not m.get("winner_id") else ("won" if m.get("winner_id") == uid else "lost"),
    } for m in matches]

    credits = await db.referral_credits.find({"$or": [{"referrer_id": u["_id"]}, {"referee_id": u["_id"]}, {"referrer_id": uid}, {"referee_id": uid}]}).to_list(100)
    referral = {
        "code": u.get("referral_code", ""),
        "referred_by_code": (((u.get("attribution") or {}).get("first")) or {}).get("ref", ""),
        "players_referred": sum(1 for c in credits if str(c.get("referrer_id")) == uid),
        "was_referred": any(str(c.get("referee_id")) == uid for c in credits),
    }
    comms = await db.email_campaigns.find({"user_id": uid}).sort("sent_at", -1).to_list(50)

    out = {
        "id": uid, "name": u.get("name", ""), "email": u.get("email", ""), "phone": u.get("phone", ""), "city": u.get("city") or "",
        "country": u.get("country", ""), "created_at": u.get("created_at", ""), "email_verified": bool(u.get("email_verified")),
        "profile_complete": bool(u.get("profile_complete")), "sport_preferences": u.get("sport_preferences", []),
        "ratings": {"tennis": u.get("tennis_rating"), "pickleball": u.get("pickleball_rating")},
        "attribution": u.get("attribution"), "tags": sorted(u.get("tags") or []),
        "status": crm.status_of(u), "suspended_at": u.get("suspended_at"), "suspended_reason": u.get("suspended_reason"),
        "marketing": {"email_notifications": u.get("email_notifications", True) is not False,
                      "unsubscribed_at": u.get("marketing_unsubscribed_at")},
        "leagues": leagues, "matches": match_rows, "referral": referral,
        "communications": [{"campaign": c.get("campaign"), "sent_at": c.get("sent_at")} for c in comms],
        "notes": None, "history": None,
        "can": {k: permissions.has(admin, p) for k, p in (("tag", "players.write"), ("note", "players.notes"), ("suspend", "players.suspend"))},
    }
    if permissions.has(admin, "players.notes"):
        notes = await db.player_notes.find({"player_id": uid}).sort("at", -1).to_list(200)
        out["notes"] = [{"id": str(n["_id"]), "text": n["text"], "by": n.get("admin_email", ""), "at": n.get("at", "")} for n in notes]
    if permissions.has(admin, "audit.read"):
        hist = await db.audit_log.find({"target_type": "user", "target_id": uid}).sort("at", -1).to_list(30)
        out["history"] = [{"action": h["action"], "by": h.get("admin_email", ""), "at": h.get("at", ""), "after": h.get("after")} for h in hist]
    return out


@router.put("/{player_id}/tags")
async def set_tags(player_id: str, body: TagChange, request: Request):
    admin = await _need(request, "players.write")
    db = request.app.state.db
    u = await _player(db, player_id)
    try:
        new = crm.apply_tags(u.get("tags"), body.add, body.remove)
    except crm.CrmError as e:
        raise _crm_error(e)
    before = sorted(u.get("tags") or [])
    if new != before:
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"tags": new}})
        await audit_log.record(db, admin, "player.tags", "user", player_id, u.get("email", ""), before={"tags": before}, after={"tags": new}, request=request)
    return {"tags": new}


@router.post("/{player_id}/notes", status_code=201)
async def add_note(player_id: str, body: NoteIn, request: Request):
    admin = await _need(request, "players.notes")
    db = request.app.state.db
    u = await _player(db, player_id)
    try:
        text = crm.clean_note(body.text)
    except crm.CrmError as e:
        raise _crm_error(e)
    note = {"player_id": player_id, "text": text, "admin_id": str(admin["_id"]), "admin_email": admin.get("email", ""),
            "at": datetime.now(timezone.utc).isoformat()}
    res = await db.player_notes.insert_one(note)
    await audit_log.record(db, admin, "player.note_add", "user", player_id, u.get("email", ""), meta={"note_id": str(res.inserted_id), "length": len(text)}, request=request)
    return {"id": str(res.inserted_id), "text": text, "by": note["admin_email"], "at": note["at"]}


@router.delete("/{player_id}/notes/{note_id}")
async def delete_note(player_id: str, note_id: str, request: Request):
    """Notes are append-only for everyone except a super administrator, and a deletion leaves the old text in the audit log."""
    admin = await _need(request, "roles.manage")
    db = request.app.state.db
    note = await db.player_notes.find_one({"_id": _oid(note_id), "player_id": player_id})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await audit_log.record(db, admin, "player.note_delete", "user", player_id, before={"text": note["text"], "by": note.get("admin_email"), "at": note.get("at")}, request=request)
    await db.player_notes.delete_one({"_id": note["_id"]})
    return {"deleted": True}


async def _set_status(player_id: str, request: Request, action: str, reason: str):
    admin = await _need(request, "players.suspend")
    db = request.app.state.db
    u = await _player(db, player_id)
    if str(u["_id"]) == str(admin["_id"]):
        raise HTTPException(status_code=400, detail="You cannot change your own account")
    before = crm.status_of(u)
    now = datetime.now(timezone.utc).isoformat()
    if action == "suspend":
        if before != "active":
            raise HTTPException(status_code=409, detail=f"This account is already {before}")
        try:
            reason = crm.clean_reason(reason)
        except crm.CrmError as e:
            raise _crm_error(e)
        update = {"$set": {"suspended_at": now, "suspended_reason": reason, "suspended_by": str(admin["_id"])}}
    elif action == "deactivate":
        if before == "deactivated":
            raise HTTPException(status_code=409, detail="This account is already deactivated")
        try:
            reason = crm.clean_reason(reason)
        except crm.CrmError as e:
            raise _crm_error(e)
        update = {"$set": {"is_active": False, "deactivated_at": now, "deactivated_reason": reason, "deactivated_by": str(admin["_id"])}}
    else:   # reactivate
        if before == "active":
            raise HTTPException(status_code=409, detail="This account is already active")
        update = {"$set": {"is_active": True}, "$unset": {"suspended_at": "", "suspended_reason": "", "suspended_by": "", "deactivated_at": "", "deactivated_reason": "", "deactivated_by": ""}}
    await db.users.update_one({"_id": u["_id"]}, update)
    after = {"suspend": "suspended", "deactivate": "deactivated", "reactivate": "active"}[action]
    await audit_log.record(db, admin, f"player.{action}", "user", player_id, u.get("email", ""),
                           before={"status": before}, after={"status": after, "reason": reason or None}, request=request)
    return {"status": after}


@router.post("/{player_id}/suspend")
async def suspend(player_id: str, body: ReasonIn, request: Request):
    return await _set_status(player_id, request, "suspend", body.reason)


@router.post("/{player_id}/deactivate")
async def deactivate(player_id: str, body: ReasonIn, request: Request):
    return await _set_status(player_id, request, "deactivate", body.reason)


@router.post("/{player_id}/reactivate")
async def reactivate(player_id: str, request: Request):
    return await _set_status(player_id, request, "reactivate", "")
