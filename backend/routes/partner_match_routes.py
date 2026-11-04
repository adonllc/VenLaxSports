"""Admin: suggest and assign doubles partners, track refunds, resolve partner change requests."""
from datetime import datetime, timezone
from typing import List, Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

import email_service
import partner_assignment
import partner_matching
from auth_utils import require_admin

router = APIRouter()


def _person(c: dict) -> dict:
    return {"token": c["token"], "name": c["name"], "email": c["email"], "city": c["city"],
            "zip_code": c["zip_code"], "level": c["level"], "paid": c["paid"]}


async def _league(db, league_id: str):
    try:
        return await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        return None


@router.get("/partner-matches")
async def find_matches(request: Request, league_id: Optional[str] = None, max_gap: float = 0.0):
    """Suggest partner pairs for opted-in waiting teams. Read-only. Level tolerance: 0, 0.5 or 1.0."""
    db = request.app.state.db
    await require_admin(request, db)
    if max_gap not in partner_matching.ALLOWED_GAPS:
        raise HTTPException(status_code=400, detail="max_gap must be 0, 0.5 or 1.0")

    if league_id:
        league_ids = [league_id]
    else:
        waiting = await db.doubles_invites.find(
            {"status": {"$in": list(partner_assignment.WAITING)}, "auto_assign_opt_in": True}
        ).to_list(2000)
        league_ids = list(dict.fromkeys(i["league_id"] for i in waiting))

    leagues = []
    for lid in league_ids:
        league = await _league(db, lid)
        if not league or league.get("status") != "registration":
            continue
        candidates, skipped = await partner_assignment.waiting_candidates(db, league)
        if not candidates and not skipped:
            continue
        pairs, unmatched = partner_matching.suggest_pairs(
            candidates, max_gap, mixed=league.get("format") == "mixed_doubles")
        leagues.append({
            "league_id": lid,
            "league_name": league.get("name", ""),
            "start_date": league.get("start_date", ""),
            "spots_left": int(league.get("max_players", 0)) - int(league.get("current_players", 0)),
            "pairs": [{
                "token_a": p["a"]["token"], "token_b": p["b"]["token"], "score": p["score"],
                "reasons": p["reasons"], "gap": p["gap"], "a": _person(p["a"]), "b": _person(p["b"]),
            } for p in pairs],
            "unmatched": [{**_person(u["candidate"]), "reason": u["reason"]} for u in unmatched],
            "skipped": skipped,
        })
    return {"max_gap": max_gap, "leagues": leagues}


class PairIn(BaseModel):
    token_a: str
    token_b: str


class AssignIn(BaseModel):
    pairs: List[PairIn] = Field(min_length=1, max_length=100)


@router.post("/partner-matches/assign")
async def assign_matches(body: AssignIn, request: Request):
    """Assign the chosen pairs. Each pair is re-checked; one failure does not stop the others."""
    db = request.app.state.db
    await require_admin(request, db)
    results = []
    for p in body.pairs:
        try:
            info = await partner_assignment.assign_pair(db, p.token_a, p.token_b)
        except ValueError as e:
            results.append({"token_a": p.token_a, "token_b": p.token_b, "ok": False, "error": str(e)})
        else:
            results.append({"token_a": p.token_a, "token_b": p.token_b, "ok": True,
                            "refund_due": info["refund_due"], "players": info["players"]})
    return {"results": results}


@router.get("/partner-matches/refund-due")
async def refund_due(request: Request):
    """Paid players absorbed into a team by an assignment: their payment is owed back (refunded by hand)."""
    db = request.app.state.db
    await require_admin(request, db)
    invites = await db.doubles_invites.find({"status": "merged", "refund_due": True}).to_list(500)
    rows = []
    for inv in invites:
        league = await _league(db, inv.get("league_id", "")) or {}
        try:
            user = await db.users.find_one({"_id": ObjectId(inv["initiator_id"])})
        except Exception:
            user = None
        team = await db.doubles_invites.find_one({"token": inv.get("merged_into")})
        rows.append({
            "token": inv["token"],
            "player_name": inv.get("initiator_name", ""),
            "player_email": (user or {}).get("email", ""),
            "league_name": league.get("name", ""),
            "amount": float(league.get("entry_fee") or 0),
            "currency": league.get("currency", "USD"),
            "team_with": (team or {}).get("initiator_name", ""),
        })
    return {"rows": rows}


@router.post("/partner-matches/{token_b}/mark-refunded")
async def mark_refunded(token_b: str, request: Request):
    db = request.app.state.db
    await require_admin(request, db)
    invite = await db.doubles_invites.find_one({"token": token_b})
    if not invite:
        raise HTTPException(status_code=404, detail="Not found")
    if invite.get("status") != "merged" or not invite.get("refund_due"):
        raise HTTPException(status_code=409, detail="No refund is due for this player")
    await db.doubles_invites.update_one({"token": token_b}, {"$set": {
        "refund_due": False, "refunded_at": datetime.now(timezone.utc).isoformat()}})
    return {"refunded": True}


@router.get("/partner-change-requests")
async def list_change_requests(request: Request):
    db = request.app.state.db
    await require_admin(request, db)
    invites = await db.doubles_invites.find({"partner_change_request.status": "pending"}).to_list(200)
    rows = []
    for inv in invites:
        league = await _league(db, inv.get("league_id", "")) or {}
        change = inv["partner_change_request"]
        users = {}
        for key, uid in (("by", change.get("by_user_id")), ("partner", inv.get("partner_user_id"))):
            try:
                users[key] = await db.users.find_one({"_id": ObjectId(uid)}) or {}
            except Exception:
                users[key] = {}
        rows.append({
            "token": inv["token"],
            "league_name": league.get("name", ""),
            "start_date": league.get("start_date", ""),
            "player_a": inv.get("initiator_name", ""),
            "player_b": users["partner"].get("name", ""),
            "requested_by": users["by"].get("name", ""),
            "reason": change.get("reason", ""),
            "requested_at": change.get("requested_at", ""),
        })
    return {"rows": rows}


class ResolveIn(BaseModel):
    action: Literal["approve", "decline"]


@router.post("/partner-change-requests/{token}/resolve")
async def resolve_change_request(token: str, body: ResolveIn, request: Request):
    """Approve (the team is dissolved, both players wait for new partners) or decline a change request."""
    db = request.app.state.db
    await require_admin(request, db)
    invite = await db.doubles_invites.find_one({"token": token})
    change = (invite or {}).get("partner_change_request") or {}
    if not invite or change.get("status") != "pending":
        raise HTTPException(status_code=409, detail="No pending request for this team")
    league = await _league(db, invite["league_id"]) or {}
    league_name = league.get("name", "the league")
    now = datetime.now(timezone.utc).isoformat()

    async def players():
        out = []
        for uid in (invite["initiator_id"], invite.get("partner_user_id")):
            try:
                u = await db.users.find_one({"_id": ObjectId(uid)})
            except Exception:
                u = None
            if u:
                out.append(u)
        return out

    if body.action == "decline":
        await db.doubles_invites.update_one({"token": token}, {"$set": {
            "partner_change_request": {**change, "status": "declined", "resolved_at": now}}})
        for u in await players():
            if str(u["_id"]) == change.get("by_user_id") and u.get("email"):
                email_service.schedule(email_service.send_partner_change_resolved(
                    u["email"], u.get("name", ""), league_name, False))
        return {"resolved": "declined"}

    team_players = await players()
    try:
        info = await partner_assignment.dissolve_team(db, league, invite)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    await db.doubles_invites.update_one({"token": token}, {"$set": {
        "partner_change_request": {**change, "status": "approved", "resolved_at": now}}})
    for u in team_players:
        if u.get("email"):
            email_service.schedule(email_service.send_partner_change_resolved(
                u["email"], u.get("name", ""), league_name, True))
    return {"resolved": "approved", "repay_required": info["repay_required"]}
