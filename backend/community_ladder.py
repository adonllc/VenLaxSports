"""Community ladders: any player creates a ladder, invites friends, and VenLax keeps the ranking.

They are ordinary documents in the `ladders` collection with type "community" (official ladders have no type, so
they behave exactly as before). Challenges, scheduling, score confirmation and disputes are the direct-challenge
engine (direct_challenge.py) with a ladder_id on the challenge; ladder_ranking.py applies each confirmed result.

Ladder status:  draft -> active <-> paused -> completed (time ran out) | closed (creator, admin or inactivity)
Invitation:     invited -> accepted | declined | expired | revoked        (join request: requested -> accepted | declined)
The creator owns the ladder but has no say over scores or ranks: results come only from confirmed challenges.
"""
from __future__ import annotations

import re
import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId

import challenge_config as cfg
import competition
import direct_challenge as dc
import email_service
import ladder_ranking as lr
import notification_center
from direct_challenge import ChallengeError as LadderError
from models import normalize_zip
from phase_config import ACTIVE_SPORTS

DIVISIONS = ("Beginner", "Intermediate", "Advanced", "Competitive")
OPEN_CHALLENGE = ("sent", "scheduling", "scheduled", "result_submitted", "disputed")
LIVE_LADDER = ("active", "paused")
OWNED_LIMIT_STATES = ("draft", "active", "paused")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def is_admin(user: dict | None) -> bool:
    return bool(user) and user.get("role") in ("admin", "city_admin")


def _link(ladder: dict) -> str:
    return f"/community-ladders/{ladder['_id']}"


def _frontend_url() -> str:
    return notification_center._frontend_url()


async def load(db, ladder_id: str) -> dict:
    if not ObjectId.is_valid(ladder_id):
        raise LadderError(404, "Ladder not found")
    ladder = await db.ladders.find_one({"_id": ObjectId(ladder_id)})
    if not ladder or ladder.get("type") != "community":
        raise LadderError(404, "Ladder not found")
    return ladder


async def _user(db, uid: str):
    return await dc._user(db, uid)


def _log(ladder: dict, by, action: str, **detail) -> dict:
    return {"at": _iso(_now()), "by": by, "action": action, "detail": detail}


async def _save(db, ladder: dict, set_: dict, entry: dict | None = None) -> None:
    set_["updated_at"] = _iso(_now())
    update: dict = {"$set": set_}
    if entry:
        update["$push"] = {"history": {"$each": [entry], "$slice": -cfg.HISTORY_MAX}}
    await db.ladders.update_one({"_id": ladder["_id"]}, update)
    ladder.update(set_)


def is_owner(ladder: dict, user: dict) -> bool:
    return ladder["owner_id"] == user["_id"]


def require_owner(ladder: dict, user: dict) -> None:
    if not is_owner(ladder, user) and not is_admin(user):
        raise LadderError(403, "Only the ladder's creator can do that")


def member_entry(ladder: dict, uid: str):
    return lr.entry_of(ladder.get("entries", []), uid)


async def _notify_participants(db, ladder: dict, type_: str, title: str, body: str = "", exclude=(), email: bool = True) -> None:
    ids = [m for e in lr.live(ladder.get("entries", [])) for m in e["members"] if m not in exclude]
    await notification_center.notify(db, ids, type_, title, body, _link(ladder), str(ladder["_id"]), email=email)


# ── Configuration ─────────────────────────────────────────────────────────────

def _clean_config(data: dict, existing: dict | None = None) -> dict:
    """Validate the settings a creator may send. With `existing`, only the given keys are checked."""
    out: dict = {}

    def choose(key, allowed, label):
        if key in data and data[key] is not None:
            if data[key] not in allowed:
                raise LadderError(400, f"{label} must be one of: {', '.join(str(a) for a in allowed)}")
            out[key] = data[key]

    name = data.get("name")
    if name is not None or existing is None:
        name = (name or "").strip()
        if not 3 <= len(name) <= 60:
            raise LadderError(400, "Give the ladder a name of 3 to 60 characters")
        out["name"] = name
    choose("sport", cfg.LADDER_SPORTS, "Sport")
    choose("format", cfg.LADDER_FORMATS, "Format")
    choose("division_label", DIVISIONS, "Skill level")
    choose("max_participants", cfg.LADDER_SIZES, "Maximum participants")
    choose("visibility", cfg.LADDER_VISIBILITY, "Visibility")
    choose("join_mode", cfg.LADDER_JOIN_MODES, "Join mode")
    choose("ranking_method", cfg.LADDER_RANKING_METHODS, "Ranking method")
    choose("duration_days", cfg.LADDER_DURATIONS, "Duration")
    if "sport" in out and out["sport"] not in ACTIVE_SPORTS:
        raise LadderError(400, "That sport is not open yet")
    if "city" in data or existing is None:
        city = (data.get("city") or "").strip()
        if not city:
            raise LadderError(400, "Enter the city")
        out["city"] = city[:80]
    if "zip_code" in data:
        try:
            out["zip_code"] = normalize_zip(data["zip_code"])
        except ValueError as e:
            raise LadderError(400, str(e))
    if "description" in data:
        out["description"] = (data.get("description") or "").strip()[:500]
    if existing is None:
        for key, default in (("format", "singles"), ("visibility", "public"), ("join_mode", "open"),
                             ("ranking_method", "leapfrog"), ("duration_days", 60), ("max_participants", 16)):
            out.setdefault(key, default)
        for key in ("sport", "division_label"):
            if key not in out:
                raise LadderError(400, f"{key.replace('_', ' ').title()} is required")
    return out


async def create_draft(db, owner: dict, data: dict) -> dict:
    cleaned = _clean_config(data)
    owned = await db.ladders.find({"type": "community", "owner_id": owner["_id"], "status": {"$in": list(OWNED_LIMIT_STATES)}}).to_list(50)
    if len(owned) >= cfg.LADDER_MAX_OWNED_ACTIVE:
        raise LadderError(409, f"You can run {cfg.LADDER_MAX_OWNED_ACTIVE} ladders at a time. Close one to start another.")
    now = _now()
    doc = {
        "_id": ObjectId(), "type": "community", "competition_type": competition.PLAYER_COMMUNITY_LADDER, "owner_id": owner["_id"], "owner_name": owner.get("name", ""),
        "scheduling": "flexible", "description": "", "zip_code": None, **cleaned,
        "status": "draft", "is_active": False, "entries": [], "invite_token": None,
        "created_at": _iso(now), "updated_at": _iso(now), "published_at": None, "ends_at": None, "last_match_at": None,
        "history": [_log({}, owner["_id"], "created")],
    }
    await db.ladders.insert_one(doc)
    return doc


# Once a ladder is live these are locked: they decide how everyone is ranked and who is on it.
LOCKED_WHEN_LIVE = ("sport", "format", "division_label", "city", "zip_code", "ranking_method", "duration_days")


async def update_settings(db, ladder: dict, user: dict, data: dict) -> dict:
    require_owner(ladder, user)
    if ladder["status"] in ("completed", "closed", "expired"):
        raise LadderError(409, "This ladder has ended")
    cleaned = _clean_config(data, existing=ladder)
    if ladder["status"] != "draft":
        locked = [k for k in LOCKED_WHEN_LIVE if k in cleaned and cleaned[k] != ladder.get(k)]
        if locked:
            raise LadderError(409, f"After publishing you cannot change: {', '.join(k.replace('_', ' ') for k in locked)}")
        if "max_participants" in cleaned and cleaned["max_participants"] < len(lr.live(ladder["entries"])):
            raise LadderError(409, "The limit cannot go below the number of players already in")
    changed = {k: v for k, v in cleaned.items() if ladder.get(k) != v}
    if not changed:
        return ladder
    await _save(db, ladder, changed, _log(ladder, user["_id"], "settings_changed", fields=sorted(changed)))
    if ladder["status"] != "draft":
        await _notify_participants(db, ladder, "ladder_updated", f"{ladder['name']}: settings updated",
                                   "Changed: " + ", ".join(k.replace("_", " ") for k in sorted(changed)),
                                   exclude=(user["_id"],), email=False)
    return ladder


# ── Teams ─────────────────────────────────────────────────────────────────────

async def _build_entry(db, ladder: dict, user: dict, partner_id: str | None) -> dict:
    entries = ladder.get("entries", [])
    if lr.entry_of(entries, user["_id"]):
        raise LadderError(409, "You are already in this ladder")
    if ladder["format"] == "doubles":
        if not partner_id:
            raise LadderError(400, "Pick your doubles partner")
        if partner_id == user["_id"]:
            raise LadderError(400, "Your partner must be a different player")
        partner = await _user(db, partner_id)
        if not dc._usable(partner):
            raise LadderError(404, "Partner not found")
        if lr.entry_of(entries, partner_id):
            raise LadderError(409, f"{partner.get('name', 'Your partner')} is already in this ladder")
        return lr.new_entry(user["_id"], user.get("name", ""), partner_id, partner.get("name", ""))
    if partner_id:
        raise LadderError(400, "This is a singles ladder")
    return lr.new_entry(user["_id"], user.get("name", ""))


def _check_room(ladder: dict) -> None:
    if len(lr.live(ladder.get("entries", []))) >= ladder["max_participants"]:
        raise LadderError(409, "This ladder is full")


async def _add_entry(db, ladder: dict, entry: dict, how: str) -> None:
    entries = list(ladder.get("entries", [])) + [entry]
    await _save(db, ladder, {"entries": entries}, _log(ladder, entry["player_id"], "joined", via=how))
    if entry.get("partner_id"):
        await notification_center.notify(
            db, [entry["partner_id"]], "ladder_partner", f"{entry['name'].split(' & ')[0]} entered you in {ladder['name']}",
            "You are their doubles partner. Open the ladder to see the standings.", _link(ladder), str(ladder["_id"]))


# ── Publish ───────────────────────────────────────────────────────────────────

async def publish(db, ladder: dict, user: dict, partner_id: str | None = None) -> dict:
    require_owner(ladder, user)
    if ladder["status"] != "draft":
        raise LadderError(409, "This ladder is already published")
    if not is_owner(ladder, user):
        raise LadderError(403, "Only the creator can publish")
    creator_entry = await _build_entry(db, ladder, user, partner_id)   # the creator is registered like anyone else
    now = _now()
    ladder["entries"] = [creator_entry]
    await _save(db, ladder, {
        "entries": [creator_entry], "status": "active", "is_active": True, "published_at": _iso(now),
        "ends_at": _iso(now + timedelta(days=ladder["duration_days"])), "invite_token": secrets.token_urlsafe(16),
    }, _log(ladder, user["_id"], "published"))
    if creator_entry.get("partner_id"):
        await notification_center.notify(
            db, [creator_entry["partner_id"]], "ladder_partner", f"{user.get('name', '')} entered you in {ladder['name']}",
            "You are their doubles partner.", _link(ladder), str(ladder["_id"]))
    return ladder


# ── Invitations ───────────────────────────────────────────────────────────────

def _check_open_for_members(ladder: dict) -> None:
    if ladder["status"] not in LIVE_LADDER:
        raise LadderError(409, "This ladder is not taking players")
    if ladder["status"] == "paused":
        raise LadderError(409, "This ladder is paused")


async def invite_user(db, ladder: dict, user: dict, invitee_id: str) -> dict:
    require_owner(ladder, user)
    _check_open_for_members(ladder)
    invitee = await _user(db, invitee_id)
    if not dc._usable(invitee):
        raise LadderError(404, "Player not found")
    if lr.entry_of(ladder["entries"], invitee_id):
        raise LadderError(409, f"{invitee.get('name', 'That player')} is already in this ladder")
    return await _make_invite(db, ladder, user, "user", invitee_user_id=invitee_id, invitee=invitee)


async def invite_email(db, ladder: dict, user: dict, email: str) -> dict:
    require_owner(ladder, user)
    _check_open_for_members(ladder)
    email = (email or "").strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise LadderError(400, "Enter a valid email address")
    existing = await db.users.find_one({"email": email})
    if existing and dc._usable(existing):
        if lr.entry_of(ladder["entries"], str(existing["_id"])):
            raise LadderError(409, f"{existing.get('name', 'That player')} is already in this ladder")
        return await _make_invite(db, ladder, user, "user", invitee_user_id=str(existing["_id"]), invitee=existing)
    return await _make_invite(db, ladder, user, "email", email=email)


async def _make_invite(db, ladder: dict, owner: dict, kind: str, invitee_user_id: str | None = None,
                       email: str | None = None, invitee: dict | None = None) -> dict:
    for other in await db.ladder_invites.find({"ladder_id": str(ladder["_id"]), "status": "invited"}).to_list(500):
        if (invitee_user_id and other.get("invitee_user_id") == invitee_user_id) or (email and other.get("email") == email):
            raise LadderError(409, "That player already has an open invitation")
    now = _now()
    invite = {
        "_id": ObjectId(), "ladder_id": str(ladder["_id"]), "type": kind, "token": secrets.token_urlsafe(16),
        "invitee_user_id": invitee_user_id, "email": email, "invited_by": owner["_id"], "status": "invited",
        "created_at": _iso(now), "expires_at": _iso(now + timedelta(days=cfg.LADDER_INVITE_EXPIRY_DAYS)), "responded_at": None,
    }
    await db.ladder_invites.insert_one(invite)
    title = f"{owner.get('name', 'A player')} invited you to {ladder['name']}"
    body = f"{ladder['sport'].title()} {ladder['format']} ladder in {ladder['city']}."
    join_link = f"/community-ladders/join?token={invite['token']}"
    if invitee_user_id:
        await notification_center.notify(db, [invitee_user_id], "ladder_invite", title, body, join_link, str(ladder["_id"]))
    else:
        email_service.schedule(email_service.send_generic(
            email, title, f"Hi,\n\n{title}. {body}\n\nJoin here (you will be asked to sign up or log in first): "
                          f"{_frontend_url()}{join_link}\n\n— VENLAX Sports"))
    return invite


async def rotate_link(db, ladder: dict, user: dict) -> str:
    require_owner(ladder, user)
    _check_open_for_members(ladder)
    token = secrets.token_urlsafe(16)
    await _save(db, ladder, {"invite_token": token}, _log(ladder, user["_id"], "link_rotated"))
    return token


async def revoke_invite(db, ladder: dict, user: dict, invite_id: str) -> None:
    require_owner(ladder, user)
    invite = await db.ladder_invites.find_one({"_id": ObjectId(invite_id)}) if ObjectId.is_valid(invite_id) else None
    if not invite or invite["ladder_id"] != str(ladder["_id"]) or invite["status"] != "invited":
        raise LadderError(404, "That invitation is no longer open")
    await db.ladder_invites.update_one({"_id": invite["_id"]}, {"$set": {"status": "revoked", "responded_at": _iso(_now())}})


async def resolve_token(db, token: str):
    """What a token points at: ('invite', invite, ladder) or ('link', None, ladder). None when it matches nothing live."""
    if not token:
        return None
    invite = await db.ladder_invites.find_one({"token": token})
    if invite:
        ladder = await db.ladders.find_one({"_id": ObjectId(invite["ladder_id"])})
        return ("invite", invite, ladder) if ladder and ladder.get("type") == "community" else None
    ladder = await db.ladders.find_one({"invite_token": token, "type": "community"})
    return ("link", None, ladder) if ladder else None


def preview(ladder: dict, invite: dict | None = None) -> dict:
    """What a person sees before they sign up: enough to decide, nothing about other players."""
    return {
        "id": str(ladder["_id"]), "name": ladder["name"], "sport": ladder["sport"], "format": ladder["format"],
        "division_label": ladder["division_label"], "city": ladder["city"], "owner_name": ladder.get("owner_name", ""),
        "status": ladder["status"], "ranking_method": ladder["ranking_method"], "ends_at": ladder.get("ends_at"),
        "participants": len(lr.live(ladder.get("entries", []))), "max_participants": ladder["max_participants"],
        "invite": None if not invite else {"status": invite["status"], "type": invite["type"]},
    }


async def join_with_token(db, user: dict, token: str, action: str = "accept", partner_id: str | None = None) -> dict:
    found = await resolve_token(db, token)
    if not found:
        raise LadderError(404, "This invitation is not valid any more")
    kind, invite, ladder = found
    if kind == "invite":
        if invite["status"] != "invited":
            raise LadderError(409, f"This invitation was {invite['status']}")
        if invite["expires_at"] <= _iso(_now()):
            await db.ladder_invites.update_one({"_id": invite["_id"]}, {"$set": {"status": "expired"}})
            raise LadderError(409, "This invitation has expired")
        if invite.get("invitee_user_id") and invite["invitee_user_id"] != user["_id"]:
            raise LadderError(403, "This invitation was sent to someone else")
        if action == "decline":
            await db.ladder_invites.update_one({"_id": invite["_id"]}, {"$set": {"status": "declined", "responded_at": _iso(_now())}})
            await notification_center.notify(
                db, [ladder["owner_id"]], "ladder_invite_declined", f"{user.get('name', '')} declined your invitation to {ladder['name']}",
                "", _link(ladder), str(ladder["_id"]), email=False)
            return ladder
    elif action == "decline":
        return ladder
    _check_open_for_members(ladder)
    _check_room(ladder)
    entry = await _build_entry(db, ladder, user, partner_id)
    await _add_entry(db, ladder, entry, "invite" if kind == "invite" else "link")
    if invite:
        await db.ladder_invites.update_one({"_id": invite["_id"]}, {"$set": {"status": "accepted", "responded_at": _iso(_now())}})
    await _announce_join(db, ladder, user, entry, "accepted your invitation" if invite else "joined with your link")
    return ladder


async def _announce_join(db, ladder: dict, user: dict, entry: dict, how: str) -> None:
    await notification_center.notify(
        db, [ladder["owner_id"]], "ladder_invite_accepted", f"{entry['name']} {how}: {ladder['name']}", "", _link(ladder), str(ladder["_id"]))
    await _notify_participants(db, ladder, "ladder_new_participant", f"{entry['name']} joined {ladder['name']}", "",
                               exclude=tuple([ladder["owner_id"]] + entry["members"]), email=False)


# ── Joining a public ladder ───────────────────────────────────────────────────

async def join_public(db, ladder: dict, user: dict, partner_id: str | None = None) -> dict:
    """Join straight away, or ask the creator, depending on the ladder's join mode. Private ladders need an invitation."""
    if ladder["visibility"] != "public":
        raise LadderError(403, "This ladder is private. Ask the creator for an invitation.")
    _check_open_for_members(ladder)
    _check_room(ladder)
    entry = await _build_entry(db, ladder, user, partner_id)
    if ladder["join_mode"] == "open":
        await _add_entry(db, ladder, entry, "public")
        await _announce_join(db, ladder, user, entry, "joined")
        return {"joined": True, "requested": False}
    existing = await db.ladder_invites.find_one({"ladder_id": str(ladder["_id"]), "type": "request",
                                                 "invitee_user_id": user["_id"], "status": "requested"})
    if existing:
        raise LadderError(409, "You already asked to join. The creator will answer soon.")
    now = _now()
    await db.ladder_invites.insert_one({
        "_id": ObjectId(), "ladder_id": str(ladder["_id"]), "type": "request", "token": secrets.token_urlsafe(16),
        "invitee_user_id": user["_id"], "email": None, "partner_id": partner_id, "invited_by": user["_id"],
        "status": "requested", "created_at": _iso(now), "expires_at": _iso(now + timedelta(days=cfg.LADDER_INVITE_EXPIRY_DAYS)),
        "responded_at": None,
    })
    await notification_center.notify(
        db, [ladder["owner_id"]], "ladder_join_request", f"{user.get('name', '')} wants to join {ladder['name']}",
        "Approve or decline in the ladder's people tab.", _link(ladder), str(ladder["_id"]))
    return {"joined": False, "requested": True}


async def answer_request(db, ladder: dict, owner: dict, request_id: str, action: str) -> dict:
    require_owner(ladder, owner)
    req = await db.ladder_invites.find_one({"_id": ObjectId(request_id)}) if ObjectId.is_valid(request_id) else None
    if not req or req["ladder_id"] != str(ladder["_id"]) or req["type"] != "request" or req["status"] != "requested":
        raise LadderError(404, "That request is no longer open")
    if action not in ("approve", "decline"):
        raise LadderError(400, "Approve or decline")
    player = await _user(db, req["invitee_user_id"])
    if action == "decline" or not dc._usable(player):
        await db.ladder_invites.update_one({"_id": req["_id"]}, {"$set": {"status": "declined", "responded_at": _iso(_now())}})
        await notification_center.notify(db, [req["invitee_user_id"]], "ladder_request_declined",
                                         f"Your request to join {ladder['name']} was declined", "", _link(ladder), str(ladder["_id"]), email=False)
        return ladder
    _check_open_for_members(ladder)
    _check_room(ladder)
    player = {**player, "_id": str(player["_id"])}
    entry = await _build_entry(db, ladder, player, req.get("partner_id"))
    await _add_entry(db, ladder, entry, "approved")
    await db.ladder_invites.update_one({"_id": req["_id"]}, {"$set": {"status": "accepted", "responded_at": _iso(_now())}})
    await notification_center.notify(db, [player["_id"]], "ladder_request_approved", f"You are in: {ladder['name']}", "",
                                     _link(ladder), str(ladder["_id"]))
    await _notify_participants(db, ladder, "ladder_new_participant", f"{entry['name']} joined {ladder['name']}", "",
                               exclude=tuple([ladder["owner_id"]] + entry["members"]), email=False)
    return ladder


# ── Leaving, removing, pausing, closing ───────────────────────────────────────

async def _cancel_open_challenges(db, ladder: dict, only_involving: str | None = None, reason: str = "") -> int:
    cancelled = 0
    for ch in await db.direct_challenges.find({"ladder_id": str(ladder["_id"]), "status": {"$in": ["sent", "scheduling", "scheduled"]}}).to_list(500):
        if only_involving and only_involving not in dc.participants(ch):
            continue
        await dc._save(db, ch, {"status": "cancelled", "cancelled_by": None}, dc._history(ch, None, "cancelled", reason=reason))
        await notification_center.notify(db, dc.participants(ch), "challenge_cancelled", f"A ladder challenge was cancelled: {reason}", "",
                                         f"/challenges/{ch['_id']}", str(ch["_id"]), email=False)
        cancelled += 1
    return cancelled


async def _take_out(db, ladder: dict, entry: dict, status: str, by: str, reason: str) -> None:
    entries = list(ladder["entries"])
    lr.withdraw_from_entries(entries, ladder["ranking_method"], entry["player_id"], status)
    await _save(db, ladder, {"entries": entries}, _log(ladder, by, status, player=entry["player_id"], reason=reason))
    await _cancel_open_challenges(db, ladder, only_involving=entry["player_id"], reason=f"{entry['name']} left the ladder")


async def withdraw(db, ladder: dict, user: dict) -> dict:
    entry = member_entry(ladder, user["_id"])
    if not entry:
        raise LadderError(404, "You are not in this ladder")
    if ladder["owner_id"] in entry["members"]:
        raise LadderError(409, "As the creator you close the ladder instead of leaving it")
    await _take_out(db, ladder, entry, "withdrawn", user["_id"], "withdrew")
    await notification_center.notify(db, [ladder["owner_id"]], "ladder_withdrawal", f"{entry['name']} left {ladder['name']}", "",
                                     _link(ladder), str(ladder["_id"]), email=False)
    return ladder


async def remove_participant(db, ladder: dict, user: dict, player_id: str, reason: str = "") -> dict:
    require_owner(ladder, user)
    entry = member_entry(ladder, player_id)
    if not entry:
        raise LadderError(404, "That player is not in this ladder")
    if ladder["owner_id"] in entry["members"]:
        raise LadderError(409, "The creator cannot be removed. Close the ladder instead.")
    if entry["played"] > 0 and not is_admin(user):
        raise LadderError(409, "A player with verified matches stays on the ladder's record. They can leave on their own, or ask an admin.")
    await _take_out(db, ladder, entry, "removed", user["_id"], reason[:200] or "removed by the creator")
    await notification_center.notify(db, entry["members"], "ladder_removed", f"You were removed from {ladder['name']}", reason[:200],
                                     _link(ladder), str(ladder["_id"]))
    return ladder


async def set_paused(db, ladder: dict, user: dict, paused: bool) -> dict:
    require_owner(ladder, user)
    if paused and ladder["status"] != "active":
        raise LadderError(409, "Only a live ladder can be paused")
    if not paused and ladder["status"] != "paused":
        raise LadderError(409, "This ladder is not paused")
    await _save(db, ladder, {"status": "paused" if paused else "active"}, _log(ladder, user["_id"], "paused" if paused else "resumed"))
    await _notify_participants(db, ladder, "ladder_updated", f"{ladder['name']} was {'paused' if paused else 'resumed'}",
                               "No new challenges while it is paused." if paused else "Challenges are open again.",
                               exclude=(user["_id"],), email=False)
    return ladder


async def close(db, ladder: dict, user: dict, reason: str = "closed by the creator", status: str = "closed") -> dict:
    require_owner(ladder, user) if user else None
    if ladder["status"] in ("completed", "closed", "expired"):
        raise LadderError(409, "This ladder has already ended")
    was_draft = ladder["status"] == "draft"
    await _save(db, ladder, {"status": status, "is_active": False, "closed_at": _iso(_now())},
                _log(ladder, (user or {}).get("_id"), status, reason=reason))
    if not was_draft:
        await _cancel_open_challenges(db, ladder, reason=reason)
        await _notify_participants(db, ladder, "ladder_closed", f"{ladder['name']} has ended", reason,
                                   exclude=((user or {}).get("_id"),), email=False)
    return ladder


# ── Challenges ────────────────────────────────────────────────────────────────

def challenge_rule_error(ladder: dict, me: dict, target: dict) -> str | None:
    """Rules that depend only on the standings. Returns the reason a challenge is not allowed, or None."""
    if ladder["status"] != "active":
        return "This ladder is not accepting challenges right now"
    if me["player_id"] == target["player_id"]:
        return "You cannot challenge yourself"
    if ladder["ranking_method"] == "leapfrog" and me.get("rank") and target.get("rank"):
        gap = me["rank"] - target["rank"]
        if gap <= 0:
            return "You can only challenge players ranked above you"
        if gap > cfg.LADDER_CHALLENGE_RANK_RANGE:
            return f"You can challenge up to {cfg.LADDER_CHALLENGE_RANK_RANGE} places above you"
    return None


def eligible_targets(ladder: dict, me: dict | None) -> list[str]:
    if not me:
        return []
    return [e["player_id"] for e in lr.live(ladder["entries"]) if challenge_rule_error(ladder, me, e) is None]


async def challenge(db, ladder: dict, user: dict, target_id: str, message: str | None = None) -> dict:
    me = member_entry(ladder, user["_id"])
    if not me:
        raise LadderError(403, "Only players in this ladder can challenge each other")
    target = member_entry(ladder, target_id)
    if not target:
        raise LadderError(400, "That player is not in this ladder")
    error = challenge_rule_error(ladder, me, target)
    if error:
        raise LadderError(400, error)
    lid = str(ladder["_id"])
    mine_open = [c for c in await db.direct_challenges.find({"ladder_id": lid, "status": {"$in": list(OPEN_CHALLENGE)}}).to_list(500)
                 if c["challenger_id"] in me["members"]]
    if len(mine_open) >= cfg.LADDER_MAX_OPEN_OUTGOING:
        raise LadderError(409, f"You can have {cfg.LADDER_MAX_OPEN_OUTGOING} open challenges at a time in this ladder")
    cutoff = _iso(_now() - timedelta(hours=cfg.LADDER_REMATCH_COOLDOWN_HOURS))
    for c in await db.direct_challenges.find({"ladder_id": lid, "status": "confirmed"}).to_list(500):
        if c["updated_at"] >= cutoff and {c["challenger_id"], c["challenged_id"]} == {me["player_id"], target["player_id"]}:
            raise LadderError(409, f"You played this opponent in the last {cfg.LADDER_REMATCH_COOLDOWN_HOURS} hours. Give it a day.")
    # The team order puts the challenger first so they are the one who sent it
    my_team = [user["_id"]] + [m for m in me["members"] if m != user["_id"]]
    return await dc.create(
        db, user, {"opponent_id": target["player_id"], "sport": ladder["sport"], "format": ladder["format"], "message": message},
        ladder={"id": lid, "name": ladder["name"]}, my_team=my_team, their_team=list(target["members"]))


# ── Dashboard ─────────────────────────────────────────────────────────────────

def can_view(ladder: dict, user: dict | None, token_ok: bool = False) -> bool:
    if is_admin(user):
        return True
    uid = user["_id"] if user else None
    if ladder["status"] == "draft":
        return uid == ladder["owner_id"]
    if ladder["visibility"] == "public":
        return True
    return token_ok or bool(uid and (uid == ladder["owner_id"] or member_entry(ladder, uid)))


async def view(db, ladder: dict, viewer: dict | None) -> dict:
    lid = str(ladder["_id"])
    uid = viewer["_id"] if viewer else None
    entries = ladder.get("entries", [])
    me = member_entry(ladder, uid) if uid else None
    owner = bool(uid and uid == ladder["owner_id"])
    admin = is_admin(viewer)
    rows = await db.direct_challenges.find({"ladder_id": lid}).sort("updated_at", -1).to_list(300)
    mine = [c for c in rows if uid and dc.side_of(c, uid)]
    done = [c for c in rows if c["status"] == "confirmed"]
    standing = lr.standings(entries)
    live_count = len(lr.live(entries))
    out = {
        "id": lid, "name": ladder["name"], "description": ladder.get("description", ""), "sport": ladder["sport"],
        "format": ladder["format"], "division_label": ladder["division_label"], "city": ladder["city"],
        "zip_code": ladder.get("zip_code"), "status": ladder["status"], "visibility": ladder["visibility"],
        "join_mode": ladder["join_mode"], "ranking_method": ladder["ranking_method"], "duration_days": ladder["duration_days"],
        "max_participants": ladder["max_participants"], "participant_count": live_count, "owner_name": ladder.get("owner_name", ""),
        "published_at": ladder.get("published_at"), "ends_at": ladder.get("ends_at"), "scheduling": ladder.get("scheduling", "flexible"),
        "matches_played": len(done),
        "recommendation": None if live_count >= cfg.LADDER_RECOMMENDED_PARTICIPANTS or ladder["status"] == "draft"
        else f"A ladder works best with {cfg.LADDER_RECOMMENDED_PARTICIPANTS}+ players. Invite a few more.",
        "standings": [{
            "player_id": e["player_id"], "name": e["name"], "members": e["members"], "rank": e.get("rank"), "status": e["status"],
            "wins": e["wins"], "losses": e["losses"], "played": e["played"], "win_pct": e["win_pct"],
            "points": e.get("points", 0), "elo": e.get("elo"), "is_me": bool(me and e["player_id"] == me["player_id"]),
        } for e in standing],
        "my_entry": None if not me else {"player_id": me["player_id"], "rank": me.get("rank"), "status": me["status"]},
        "is_owner": owner, "is_admin": admin,
        "eligible_targets": eligible_targets(ladder, me),
        "can": {
            "join": bool(viewer and not me and ladder["status"] == "active" and ladder["visibility"] == "public" and live_count < ladder["max_participants"]),
            "withdraw": bool(me and ladder["owner_id"] not in me["members"] and ladder["status"] in LIVE_LADDER),
            "edit": (owner or admin) and ladder["status"] in ("draft", "active", "paused"),
            "publish": owner and ladder["status"] == "draft",
            "pause": (owner or admin) and ladder["status"] == "active",
            "resume": (owner or admin) and ladder["status"] == "paused",
            "close": (owner or admin) and ladder["status"] in ("draft", "active", "paused"),
            "invite": (owner or admin) and ladder["status"] == "active",
        },
        "pending": [dc.view(c, uid) for c in mine if c["status"] == "sent"],
        "upcoming": [dc.view(c, uid) for c in rows if c["status"] in ("scheduling", "scheduled", "result_submitted", "disputed")][:20],
        "recent": [{
            "id": str(c["_id"]), "sides": [[{"id": p, "name": c["names"].get(p, "")} for p in c[k]] for k in ("side1", "side2")],
            "winner_side": c["result"]["winner_side"], "sets": c["result"]["sets"], "at": c["result"]["confirmed_at"],
        } for c in done[:10]],
        "ranking_history": [] if not me and not admin else [],
    }
    if owner or admin:
        out["invite_link"] = f"/community-ladders/join?token={ladder['invite_token']}" if ladder.get("invite_token") else None
        invites = await db.ladder_invites.find({"ladder_id": lid}).sort("created_at", -1).to_list(200)
        out["invites"] = [{"id": str(i["_id"]), "type": i["type"], "status": i["status"], "email": i.get("email"),
                           "player": (await _name(db, i.get("invitee_user_id"))), "created_at": i["created_at"],
                           "expires_at": i["expires_at"]} for i in invites if i["type"] != "request" or i["status"] == "requested"]
        out["activity"] = [{"player_id": e["player_id"], "name": e["name"], "joined_at": e["joined_at"], "last_played_at": e.get("last_played_at"),
                            "played": e["played"], "can_remove": e["played"] == 0 and ladder["owner_id"] not in e["members"]}
                           for e in lr.live(entries)]
    return out


async def _name(db, uid):
    if not uid:
        return None
    u = await _user(db, uid)
    return (u or {}).get("name")


async def history(db, ladder: dict, limit: int = 50) -> list[dict]:
    rows = await db.ladder_results.find({"ladder_id": str(ladder["_id"])}).sort("at", -1).to_list(limit)
    return [{"at": r["at"], "method": r["method"], "challenge_id": r["challenge_id"], "winner": r["winner"], "loser": r["loser"],
             "before": r["before"], "after": r["after"]} for r in rows]


# ── Housekeeping (scheduler) ──────────────────────────────────────────────────

async def process(db, now: datetime | None = None) -> dict:
    now = now or _now()
    now_iso = _iso(now)
    done = {"completed": 0, "inactive": 0, "drafts_expired": 0, "invites_expired": 0}
    for ladder in await db.ladders.find({"type": "community", "status": {"$in": ["draft", "active", "paused"]}}).to_list(1000):
        if ladder["status"] == "draft":
            if ladder["created_at"] <= _iso(now - timedelta(days=cfg.LADDER_DRAFT_EXPIRY_DAYS)):
                await close(db, ladder, None, "draft expired", status="expired")
                done["drafts_expired"] += 1
        elif ladder.get("ends_at") and ladder["ends_at"] <= now_iso:
            await close(db, ladder, None, "The competition period is over. Final standings are kept.", status="completed")
            done["completed"] += 1
        elif (ladder.get("last_match_at") or ladder.get("published_at") or ladder["created_at"]) <= _iso(now - timedelta(days=cfg.LADDER_INACTIVE_DAYS)):
            await close(db, ladder, None, f"No verified match for {cfg.LADDER_INACTIVE_DAYS} days.", status="closed")
            done["inactive"] += 1
    for invite in await db.ladder_invites.find({"status": {"$in": ["invited", "requested"]}}).to_list(2000):
        if invite["expires_at"] <= now_iso:
            await db.ladder_invites.update_one({"_id": invite["_id"]}, {"$set": {"status": "expired"}})
            done["invites_expired"] += 1
    return done
