"""Direct player challenges: a player invites another VenLax player to a match, no ladder or league needed.

Lifecycle
  sent -> accepted (stored as scheduling) -> scheduled -> result_submitted -> confirmed
  sent -> declined | expired | cancelled        scheduling/scheduled -> cancelled
  result_submitted -> disputed -> confirmed | voided (admin)
"created" is the instant of sending, so a challenge is born "sent". "in_progress" is shown, not stored:
a scheduled match whose time has arrived.

These matches live in their own collection (direct_challenges). They never touch ladders, league matches,
standings or ratings. Only a confirmed result counts, and only in the challenge statistics.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone

from bson import ObjectId

import challenge_config as cfg
import competition
import notification_center
import partner_matching
from phase_config import ACTIVE_SPORTS

OPEN = ("sent", "scheduling", "scheduled", "result_submitted", "disputed")
ACTIVE = ("scheduling", "scheduled", "result_submitted", "disputed")
COMPLETED = ("confirmed", "declined", "expired", "cancelled", "voided")


class ChallengeError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse(iso: str) -> datetime:
    return datetime.fromisoformat(str(iso).replace("Z", "+00:00"))


def _link(ch: dict) -> str:
    return f"/challenges/{ch['_id']}"


def participants(ch: dict) -> list[str]:
    return list(ch.get("side1", [])) + list(ch.get("side2", []))


def side_of(ch: dict, uid: str):
    if uid in ch.get("side1", []):
        return 1
    if uid in ch.get("side2", []):
        return 2
    return None


def _others(ch: dict, uid: str) -> list[str]:
    return [p for p in participants(ch) if p != uid]


def _history(ch: dict, uid, action: str, **detail) -> dict:
    return {"at": _now().isoformat(), "by": uid, "action": action, "detail": detail}


async def _save(db, ch: dict, set_: dict, entry: dict) -> None:
    set_["updated_at"] = _now().isoformat()
    await db.direct_challenges.update_one(
        {"_id": ch["_id"]},
        {"$set": set_, "$push": {"history": {"$each": [entry], "$slice": -cfg.HISTORY_MAX}}},
    )
    ch.update(set_)   # the history entry is stored; routes reload the challenge before building a view


async def load(db, challenge_id: str) -> dict:
    if not ObjectId.is_valid(challenge_id):
        raise ChallengeError(404, "Challenge not found")
    ch = await db.direct_challenges.find_one({"_id": ObjectId(challenge_id)})
    if not ch:
        raise ChallengeError(404, "Challenge not found")
    return ch


def require_participant(ch: dict, user: dict):
    side = side_of(ch, user["_id"])
    if side is None:
        raise ChallengeError(403, "You are not a player in this challenge")
    return side


async def _user(db, uid: str):
    if not ObjectId.is_valid(uid):
        return None
    return await db.users.find_one({"_id": ObjectId(uid)})


def _usable(u) -> bool:
    return bool(u) and u.get("is_active") is not False and not u.get("suspended_at")


# ── Create ────────────────────────────────────────────────────────────────────

async def create(db, challenger: dict, data: dict, ladder: dict | None = None,
                 my_team: list | None = None, their_team: list | None = None, skip_limit: bool = False) -> dict:
    """Send a challenge. For a ladder match (ladder={"id", "name"}) the teams come from the ladder, not from the form."""
    sport, fmt = data["sport"], data["format"]
    if sport not in cfg.CHALLENGE_SPORTS or sport not in ACTIVE_SPORTS:
        raise ChallengeError(400, "Challenges are open for tennis and pickleball")
    if fmt not in cfg.CHALLENGE_FORMATS:
        raise ChallengeError(400, "Choose singles or doubles")
    me, opp_id = challenger["_id"], data["opponent_id"]
    if opp_id == me:
        raise ChallengeError(400, "You cannot challenge yourself")
    opponent = await _user(db, opp_id)
    if not _usable(opponent):
        raise ChallengeError(404, "Player not found")

    partner_id = data.get("partner_id")
    if ladder:
        side1, side2 = list(my_team), list(their_team)
        for uid in side1[1:] + side2[1:]:
            if not _usable(await _user(db, uid)):
                raise ChallengeError(404, "A player on one of the teams can no longer play")
    else:
        side1, side2 = [me], [opp_id]
        if fmt == "doubles":
            if not partner_id:
                raise ChallengeError(400, "Pick your partner for a doubles challenge")
            if partner_id in (me, opp_id):
                raise ChallengeError(400, "Your partner must be a different player")
            if not _usable(await _user(db, partner_id)):
                raise ChallengeError(404, "Partner not found")
            side1.append(partner_id)
        elif partner_id:
            raise ChallengeError(400, "A singles challenge has no partner")

    now = _now()
    sent_today = await db.direct_challenges.count_documents(
        {"challenger_id": me, "created_at": {"$gte": (now - timedelta(hours=24)).isoformat()}})
    if sent_today >= cfg.DAILY_SEND_LIMIT and not skip_limit:
        raise ChallengeError(429, f"You can send {cfg.DAILY_SEND_LIMIT} challenges a day. Try again tomorrow.")

    ladder_id = ladder["id"] if ladder else None
    pair = {me, opp_id}
    for other in await db.direct_challenges.find({"sport": sport, "format": fmt, "status": {"$in": list(OPEN)}}).to_list(500):
        if other.get("ladder_id") == ladder_id and {other["challenger_id"], other["challenged_id"]} == pair:
            raise ChallengeError(409, "You already have an open challenge with this player. Finish or cancel it first.")

    names = {}
    for uid in side1 + side2:
        u = challenger if uid == me else await _user(db, uid)
        names[uid] = (u or {}).get("name", "")
    message = (data.get("message") or "").strip()[:500]
    doc = {
        "_id": ObjectId(), "source": "ladder" if ladder else "direct", "competition_type": competition.PLAYER_COMMUNITY_LADDER if ladder else competition.DIRECT_CHALLENGE, "sport": sport, "format": fmt, "message": message,
        "ladder_id": ladder_id, "ladder_name": ladder["name"] if ladder else None, "ladder_applied_at": None,
        "challenger_id": me, "challenged_id": opp_id, "side1": side1, "side2": side2, "names": names,
        "status": "sent", "created_at": now.isoformat(), "updated_at": now.isoformat(),
        "expires_at": (now + timedelta(hours=cfg.EXPIRY_HOURS)).isoformat(), "expiring_notified_at": None, "reminded_at": None,
        "accepted_at": None, "proposals": [], "scheduled_at": None, "venue": "",
        "result": None, "dispute": None,
        "history": [_history({}, me, "sent", sport=sport, format=fmt)],
    }
    await db.direct_challenges.insert_one(doc)
    label = f"{sport.title()} {fmt}" + (f" ({ladder['name']})" if ladder else "")
    notify_ids = side2 if ladder else [opp_id]
    await notification_center.notify(
        db, notify_ids, "challenge_received", f"{names[me]} challenged you to {label}", message, _link(doc), str(doc["_id"]))
    if partner_id and not ladder:
        await notification_center.notify(
            db, [partner_id], "challenge_partner", f"{names[me]} picked you as their {label} partner",
            f"Against {names[opp_id]}. They will let you know when it is accepted.", _link(doc), str(doc["_id"]))
    return doc


async def create_accepted(db, side1: list, side2: list, sport: str, fmt: str, extra: dict) -> dict:
    """A challenge that starts already agreed (Open Challenge Board): straight into scheduling, nothing to accept."""
    names = {}
    for uid in side1 + side2:
        names[uid] = ((await _user(db, uid)) or {}).get("name", "")
    now = _now()
    doc = {
        "_id": ObjectId(), "source": "open_board", "competition_type": competition.OPEN_CHALLENGE, "sport": sport, "format": fmt, "message": "",
        "ladder_id": None, "ladder_name": None, "ladder_applied_at": None,
        "challenger_id": side1[0], "challenged_id": side2[0], "side1": side1, "side2": side2, "names": names,
        "status": "scheduling", "created_at": now.isoformat(), "updated_at": now.isoformat(),
        "expires_at": (now + timedelta(hours=cfg.EXPIRY_HOURS)).isoformat(), "expiring_notified_at": None, "reminded_at": None,
        "accepted_at": now.isoformat(), "proposals": [], "scheduled_at": None, "venue": "",
        "result": None, "dispute": None,
        "history": [_history({}, side2[0], "accepted_open_challenge", sport=sport, format=fmt)],
        **extra,
    }
    await db.direct_challenges.insert_one(doc)
    return doc


# ── Invitation answer ─────────────────────────────────────────────────────────

def _check_unanswered(ch: dict) -> None:
    if ch["status"] != "sent":
        raise ChallengeError(409, "This challenge is no longer waiting for an answer")
    if ch["expires_at"] <= _now().isoformat():
        raise ChallengeError(409, "This challenge has expired")


async def accept(db, ch: dict, user: dict, partner_id: str | None = None) -> dict:
    if user["_id"] not in ch["side2"]:
        raise ChallengeError(403, "Only the challenged player can answer")
    _check_unanswered(ch)
    side2 = [user["_id"]]
    names = dict(ch["names"])
    if ch.get("ladder_id"):
        side2 = list(ch["side2"])                  # a ladder team is already set: nobody picks a partner here
    elif ch["format"] == "doubles":
        if not partner_id:
            raise ChallengeError(400, "Pick your partner to accept a doubles challenge")
        if partner_id in participants(ch):
            raise ChallengeError(400, "Your partner must be a different player")
        partner = await _user(db, partner_id)
        if not _usable(partner):
            raise ChallengeError(404, "Partner not found")
        side2.append(partner_id)
        names[partner_id] = partner.get("name", "")
    elif partner_id:
        raise ChallengeError(400, "A singles challenge has no partner")
    now = _now().isoformat()
    await _save(db, ch, {"status": "scheduling", "accepted_at": now, "side2": side2, "names": names},
                _history(ch, user["_id"], "accepted"))
    await notification_center.notify(
        db, [ch["challenger_id"]] + [p for p in ch["side1"] if p != ch["challenger_id"]], "challenge_accepted",
        f"{names[user['_id']]} accepted your challenge", "Agree a date, time and court.", _link(ch), str(ch["_id"]))
    if len(side2) > 1 and not ch.get("ladder_id"):
        await notification_center.notify(
            db, [side2[1]], "challenge_partner", f"{names[user['_id']]} picked you as their partner",
            f"Against {names[ch['challenger_id']]}.", _link(ch), str(ch["_id"]))
    return ch


async def decline(db, ch: dict, user: dict) -> dict:
    if user["_id"] not in ch["side2"]:
        raise ChallengeError(403, "Only the challenged player can answer")
    _check_unanswered(ch)
    await _save(db, ch, {"status": "declined"}, _history(ch, user["_id"], "declined"))
    await notification_center.notify(
        db, ch["side1"], "challenge_declined", f"{ch['names'][user['_id']]} declined your challenge", "", _link(ch), str(ch["_id"]))
    return ch


async def cancel(db, ch: dict, user: dict, is_admin: bool = False) -> dict:
    uid = user["_id"]
    side = side_of(ch, uid)
    if ch["status"] == "sent":
        if uid != ch["challenger_id"] and not is_admin:
            raise ChallengeError(403, "Only the challenger can withdraw an invitation. You can decline it instead.")
    elif ch["status"] in ("scheduling", "scheduled"):
        if side is None and not is_admin:
            raise ChallengeError(403, "You are not a player in this challenge")
        if ch["status"] == "scheduled" and not is_admin:
            if _parse(ch["scheduled_at"]) - _now() < timedelta(hours=cfg.CANCEL_CUTOFF_HOURS):
                raise ChallengeError(409, f"Inside {cfg.CANCEL_CUTOFF_HOURS} hours of the match only an admin can cancel it. Write to support.")
    else:
        raise ChallengeError(409, "This challenge can no longer be cancelled")
    await _save(db, ch, {"status": "cancelled", "cancelled_by": uid}, _history(ch, uid, "cancelled"))
    who = ch["names"].get(uid, "An admin")
    await notification_center.notify(
        db, _others(ch, uid), "challenge_cancelled", f"{who} cancelled the challenge", "", _link(ch), str(ch["_id"]))
    return ch


# ── Scheduling ────────────────────────────────────────────────────────────────

def _pending(ch: dict):
    return next((p for p in ch.get("proposals", []) if p["status"] == "pending"), None)


async def propose(db, ch: dict, user: dict, when: str, venue: str, note: str | None) -> dict:
    side = require_participant(ch, user)
    if ch["status"] not in ("scheduling", "scheduled"):
        raise ChallengeError(409, "Times can only be proposed once the challenge is accepted and before a result is entered")
    try:
        at = _parse(when)
    except ValueError:
        raise ChallengeError(400, "Enter a valid date and time")
    if at.tzinfo is None:
        at = at.replace(tzinfo=timezone.utc)
    now = _now()
    if at <= now:
        raise ChallengeError(400, "Pick a time in the future")
    if at > now + timedelta(days=cfg.MAX_SCHEDULE_DAYS_AHEAD):
        raise ChallengeError(400, f"Pick a time within the next {cfg.MAX_SCHEDULE_DAYS_AHEAD} days")
    venue = (venue or "").strip()
    if not venue:
        raise ChallengeError(400, "Say where you will play")
    proposals = list(ch.get("proposals", []))
    for p in proposals:
        if p["status"] == "pending":
            p["status"] = "countered" if p["side"] != side else "replaced"
    proposal = {"id": uuid.uuid4().hex[:12], "by": user["_id"], "side": side, "when": at.isoformat(),
                "venue": venue[:200], "note": (note or "").strip()[:300], "status": "pending", "at": now.isoformat()}
    proposals.append(proposal)
    await _save(db, ch, {"proposals": proposals}, _history(ch, user["_id"], "proposed", when=at.isoformat(), venue=venue[:200]))
    await notification_center.notify(
        db, [p for p in participants(ch) if side_of(ch, p) != side], "schedule_proposed",
        f"{ch['names'][user['_id']]} proposed a time", f"{at.strftime('%a %b %d, %H:%M UTC')} at {venue[:200]}", _link(ch), str(ch["_id"]))
    return ch


async def respond(db, ch: dict, user: dict, proposal_id: str, action: str) -> dict:
    side = require_participant(ch, user)
    if action not in ("accept", "decline"):
        raise ChallengeError(400, "Accept or decline")
    proposals = list(ch.get("proposals", []))
    proposal = next((p for p in proposals if p["id"] == proposal_id and p["status"] == "pending"), None)
    if not proposal:
        raise ChallengeError(404, "That proposal is no longer open")
    if proposal["side"] == side:
        raise ChallengeError(403, "The other player has to answer your proposal")
    if ch["status"] not in ("scheduling", "scheduled"):
        raise ChallengeError(409, "This challenge is no longer being scheduled")
    if action == "accept":
        if _parse(proposal["when"]) <= _now():
            raise ChallengeError(409, "That time has already passed. Ask for a new one.")
        proposal["status"] = "accepted"
        await _save(db, ch, {"proposals": proposals, "status": "scheduled", "scheduled_at": proposal["when"], "venue": proposal["venue"]},
                    _history(ch, user["_id"], "schedule_accepted", when=proposal["when"], venue=proposal["venue"]))
        await notification_center.notify(
            db, _others(ch, user["_id"]), "match_scheduled", "Your match is scheduled",
            f"{_parse(proposal['when']).strftime('%a %b %d, %H:%M UTC')} at {proposal['venue']}", _link(ch), str(ch["_id"]))
    else:
        proposal["status"] = "declined"
        await _save(db, ch, {"proposals": proposals}, _history(ch, user["_id"], "schedule_declined"))
        await notification_center.notify(
            db, [proposal["by"]], "schedule_declined", f"{ch['names'][user['_id']]} cannot make that time", "Propose another.", _link(ch), str(ch["_id"]))
    return ch


# ── Result ────────────────────────────────────────────────────────────────────

def validate_sets(sets) -> tuple[list[dict], int]:
    """Sets are scored from the challenger side's view: a = side 1 games, b = side 2 games. Returns (sets, winner_side)."""
    if not isinstance(sets, list) or not 1 <= len(sets) <= cfg.MAX_SETS:
        raise ChallengeError(400, f"Enter between 1 and {cfg.MAX_SETS} sets")
    clean, a_sets, b_sets = [], 0, 0
    for s in sets:
        try:
            a, b = int(s["a"]), int(s["b"])
        except (KeyError, TypeError, ValueError):
            raise ChallengeError(400, "Every set needs a score for both sides")
        if not (0 <= a <= cfg.MAX_GAMES_PER_SET and 0 <= b <= cfg.MAX_GAMES_PER_SET):
            raise ChallengeError(400, "That score is out of range")
        if a == b:
            raise ChallengeError(400, "A set cannot end level")
        clean.append({"a": a, "b": b})
        a_sets += a > b
        b_sets += b > a
    if a_sets == b_sets:
        raise ChallengeError(400, "The match needs a winner")
    return clean, 1 if a_sets > b_sets else 2


async def submit_score(db, ch: dict, user: dict, sets) -> dict:
    side = require_participant(ch, user)
    if ch["status"] == "result_submitted" and ch["result"]["submitted_side"] != side:
        raise ChallengeError(409, "A score is already waiting for your confirmation")
    if ch["status"] not in ("scheduling", "scheduled", "result_submitted"):
        raise ChallengeError(409, "A score can be entered once the challenge is accepted")
    clean, winner = validate_sets(sets)
    now = _now().isoformat()
    result = {"sets": clean, "winner_side": winner, "submitted_by": user["_id"], "submitted_side": side,
              "submitted_at": now, "confirmed_by": None, "confirmed_at": None}
    await _save(db, ch, {"status": "result_submitted", "result": result}, _history(ch, user["_id"], "score_submitted", sets=clean))
    other = [p for p in participants(ch) if side_of(ch, p) != side]
    await notification_center.notify(
        db, other, "score_confirmation_required", f"{ch['names'][user['_id']]} entered the score",
        "Confirm it, or raise a dispute if it is wrong.", _link(ch), str(ch["_id"]))
    await notification_center.notify(
        db, [p for p in participants(ch) if side_of(ch, p) == side and p != user["_id"]], "score_submitted",
        "A score was entered for your match", "", _link(ch), str(ch["_id"]), email=False)
    return ch


async def confirm_score(db, ch: dict, user: dict) -> dict:
    side = require_participant(ch, user)
    if ch["status"] != "result_submitted":
        raise ChallengeError(409, "There is no score waiting for confirmation")
    if ch["result"]["submitted_side"] == side:
        raise ChallengeError(403, "The other side has to confirm your score")
    now = _now().isoformat()
    result = {**ch["result"], "confirmed_by": user["_id"], "confirmed_at": now}
    await _save(db, ch, {"status": "confirmed", "result": result}, _history(ch, user["_id"], "score_confirmed"))
    await _apply_to_ladder(db, ch)
    await notification_center.notify(
        db, participants(ch), "match_completed", "Match complete: the result is confirmed", "", _link(ch), str(ch["_id"]))
    return ch


async def dispute_score(db, ch: dict, user: dict, reason: str) -> dict:
    side = require_participant(ch, user)
    if ch["status"] != "result_submitted":
        raise ChallengeError(409, "There is no score to dispute")
    if ch["result"]["submitted_side"] == side:
        raise ChallengeError(403, "You entered this score. Enter a corrected one instead.")
    reason = (reason or "").strip()
    if len(reason) < 5:
        raise ChallengeError(400, "Tell us what is wrong with the score")
    dispute = {"by": user["_id"], "reason": reason[:1000], "at": _now().isoformat(), "resolved_by": None, "resolution": None}
    await _save(db, ch, {"status": "disputed", "dispute": dispute}, _history(ch, user["_id"], "score_disputed", reason=reason[:300]))
    await notification_center.notify(
        db, [p for p in participants(ch) if p != user["_id"]], "score_disputed",
        f"{ch['names'][user['_id']]} disputed the score", reason[:300], _link(ch), str(ch["_id"]))
    return ch


async def admin_resolve(db, ch: dict, admin: dict, action: str, sets=None) -> dict:
    if ch["status"] != "disputed":
        raise ChallengeError(409, "Only a disputed challenge can be resolved")
    now = _now().isoformat()
    dispute = {**ch["dispute"], "resolved_by": admin["_id"], "resolution": action, "resolved_at": now}
    if action == "void":
        await _save(db, ch, {"status": "voided", "dispute": dispute}, _history(ch, admin["_id"], "admin_voided"))
        note = "An admin voided this match. It will not count."
    elif action in ("confirm", "set_score"):
        result = dict(ch["result"])
        if action == "set_score":
            clean, winner = validate_sets(sets)
            result.update(sets=clean, winner_side=winner)
        result.update(confirmed_by=admin["_id"], confirmed_at=now)
        await _save(db, ch, {"status": "confirmed", "result": result, "dispute": dispute}, _history(ch, admin["_id"], "admin_" + action))
        await _apply_to_ladder(db, ch)
        note = "An admin settled the dispute and the result is final."
    else:
        raise ChallengeError(400, "Choose confirm, set_score or void")
    await notification_center.notify(db, participants(ch), "match_completed", note, "", _link(ch), str(ch["_id"]))
    return ch


async def _apply_to_ladder(db, ch: dict) -> None:
    """A confirmed ladder match updates the ladder. A failure must not undo the confirmation: the reconcile job retries it."""
    if not ch.get("ladder_id"):
        return
    import logging
    import ladder_ranking
    try:
        await ladder_ranking.apply_result(db, ch)
    except Exception:
        logging.getLogger(__name__).exception("ladder ranking failed: challenge=%s", ch.get("_id"))


# ── Expiry (scheduler) ────────────────────────────────────────────────────────

async def process_expiries(db, now: datetime | None = None) -> dict:
    now = now or _now()
    expired = warned = 0
    for ch in await db.direct_challenges.find({"status": "sent"}).to_list(1000):
        if ch["expires_at"] <= now.isoformat():
            await _save(db, ch, {"status": "expired"}, _history(ch, None, "expired"))
            await notification_center.notify(
                db, ch["side1"] + ch["side2"], "challenge_expired", "A challenge expired unanswered", "", _link(ch), str(ch["_id"]), email=False)
            expired += 1
        elif not ch.get("expiring_notified_at") and _parse(ch["expires_at"]) - now <= timedelta(hours=cfg.EXPIRING_WARN_HOURS):
            await db.direct_challenges.update_one({"_id": ch["_id"]}, {"$set": {"expiring_notified_at": now.isoformat()}})
            await notification_center.notify(
                db, ch["side2"], "challenge_expiring", f"{ch['names'][ch['challenger_id']]}'s challenge expires soon",
                "Accept or decline before it lapses.", _link(ch), str(ch["_id"]))
            warned += 1
    reminded = 0
    horizon = (now + timedelta(hours=cfg.MATCH_REMINDER_HOURS)).isoformat()
    for ch in await db.direct_challenges.find({"status": "scheduled"}).to_list(1000):
        if not ch.get("reminded_at") and now.isoformat() < ch["scheduled_at"] <= horizon:
            await db.direct_challenges.update_one({"_id": ch["_id"]}, {"$set": {"reminded_at": now.isoformat()}})
            when = _parse(ch["scheduled_at"]).strftime("%a %b %d, %H:%M UTC")
            await notification_center.notify(
                db, participants(ch), "match_reminder", "Match reminder",
                f"{ch['names'][ch['challenger_id']]} vs {ch['names'][ch['challenged_id']]}: {when} at {ch['venue']}",
                _link(ch), str(ch["_id"]))
            reminded += 1
    return {"expired": expired, "warned": warned, "reminded": reminded}


# ── Views ─────────────────────────────────────────────────────────────────────

def view(ch: dict, viewer_id: str, is_admin: bool = False) -> dict:
    side = side_of(ch, viewer_id)
    status, now = ch["status"], _now()
    pending = _pending(ch)
    result = ch.get("result")
    in_play = status == "scheduled" and _parse(ch["scheduled_at"]) <= now
    near_cutoff = status == "scheduled" and _parse(ch["scheduled_at"]) - now < timedelta(hours=cfg.CANCEL_CUTOFF_HOURS)
    can = {
        "accept": status == "sent" and viewer_id in ch["side2"] and ch["expires_at"] > now.isoformat(),
        "decline": status == "sent" and viewer_id in ch["side2"] and ch["expires_at"] > now.isoformat(),
        "cancel": (status == "sent" and viewer_id == ch["challenger_id"])
                  or (status in ("scheduling", "scheduled") and side is not None and not near_cutoff),
        "propose": status in ("scheduling", "scheduled") and side is not None,
        "respond": bool(pending) and side is not None and pending["side"] != side and status in ("scheduling", "scheduled"),
        "submit_score": side is not None and (status in ("scheduling", "scheduled")
                                              or (status == "result_submitted" and result["submitted_side"] == side)),
        "confirm": status == "result_submitted" and side is not None and result["submitted_side"] != side,
        "dispute": status == "result_submitted" and side is not None and result["submitted_side"] != side,
        "resolve": is_admin and status == "disputed",
    }
    sides = [[{"id": p, "name": ch["names"].get(p, "")} for p in ch.get(k, [])] for k in ("side1", "side2")]
    return {
        "id": str(ch["_id"]), "sport": ch["sport"], "format": ch["format"], "message": ch.get("message", ""),
        "ladder_id": ch.get("ladder_id"), "ladder_name": ch.get("ladder_name"), "open_id": ch.get("open_id"), "competition_type": competition.type_of_challenge(ch),
        "status": status, "phase": "in_progress" if in_play else status,
        "sides": sides, "my_side": side, "created_at": ch["created_at"], "expires_at": ch["expires_at"],
        "scheduled_at": ch.get("scheduled_at"), "venue": ch.get("venue", ""),
        "proposals": ch.get("proposals", []), "pending_proposal": pending,
        "result": result, "dispute": ch.get("dispute"), "can": can, "needs_my_action": _needs_action(ch, can, viewer_id),
        "history": [{"at": h["at"], "by": ch["names"].get(h["by"], "VenLax" if h["by"] is None else "Admin"),
                     "action": h["action"]} for h in ch.get("history", [])],
    }


def _needs_action(ch: dict, can: dict, viewer_id: str) -> bool:
    return bool(can["accept"] or can["respond"] or can["confirm"])


def bucket_of(ch: dict, viewer_id: str) -> str:
    if ch["status"] in COMPLETED:
        return "completed"
    if ch["status"] == "sent":
        return "received" if viewer_id in ch["side2"] else "sent"
    return "active"


async def mine(db, user: dict) -> dict:
    uid = user["_id"]
    rows = await db.direct_challenges.find({"$or": [{"side1": uid}, {"side2": uid}]}).sort("updated_at", -1).to_list(300)
    out = {"received": [], "sent": [], "active": [], "completed": []}
    for ch in rows:
        out[bucket_of(ch, uid)].append(view(ch, uid))
    return out


# ── Statistics ────────────────────────────────────────────────────────────────

async def _confirmed(db, uid: str) -> list[dict]:
    return await db.direct_challenges.find(
        {"status": "confirmed", "$or": [{"side1": uid}, {"side2": uid}]}).sort("updated_at", -1).to_list(500)


def _won(ch: dict, uid: str) -> bool:
    return side_of(ch, uid) == ch["result"]["winner_side"]


async def stats(db, uid: str, vs: str | None = None) -> dict:
    # Ladder matches are ranked matches with their own standings: they are not part of the friendly-challenge record
    mine_all = [c for c in await db.direct_challenges.find({"$or": [{"side1": uid}, {"side2": uid}]}).to_list(1000) if not c.get("ladder_id")]
    done = [c for c in mine_all if c["status"] == "confirmed"]
    wins = sum(1 for c in done if _won(c, uid))
    out = {
        "total_challenges": len(mine_all),
        "accepted": sum(1 for c in mine_all if c.get("accepted_at")),
        "completed": len(done), "wins": wins, "losses": len(done) - wins,
        "win_pct": round(100 * wins / len(done)) if done else None,
        "recent": [{
            "id": str(c["_id"]), "sport": c["sport"], "format": c["format"], "won": _won(c, uid),
            "opponents": [c["names"].get(p, "") for p in c["side2" if side_of(c, uid) == 1 else "side1"]],
            "sets": c["result"]["sets"], "my_side": side_of(c, uid), "at": c["result"]["confirmed_at"],
        } for c in sorted(done, key=lambda c: c["result"]["confirmed_at"] or "", reverse=True)[:10]],
    }
    if vs:
        h2h = [c for c in done if side_of(c, vs) is not None and side_of(c, vs) != side_of(c, uid)]
        w = sum(1 for c in h2h if _won(c, uid))
        out["head_to_head"] = {"matches": len(h2h), "wins": w, "losses": len(h2h) - w}
    return out


# ── Player search ─────────────────────────────────────────────────────────────

async def search_players(db, viewer: dict, q: str = "", sport: str | None = None, fmt: str | None = None,
                         city: str | None = None, min_level: float | None = None, max_level: float | None = None,
                         limit: int = 20) -> list[dict]:
    from routes.user_routes import play_search_fields
    sport = sport if sport in cfg.CHALLENGE_SPORTS else "tennis"
    limit = max(1, min(int(limit), cfg.SEARCH_LIMIT_MAX))
    if not (q or "").strip() and not (city or "").strip() and min_level is None and max_level is None:
        return []        # nobody can list every player: search by name, city or level range
    query: dict = {"is_active": {"$ne": False}, "profile_public": {"$ne": False}, "_id": {"$ne": ObjectId(viewer["_id"])}}
    q = (q or "").strip()
    if q:
        if len(q) < 2:
            return []
        query["name"] = {"$regex": re.escape(q), "$options": "i"}
    if city and city.strip():
        query["city"] = {"$regex": f"^{re.escape(city.strip())}$", "$options": "i"}
    results = []
    async for u in db.users.find(query, {"password_hash": 0}).limit(400):
        if u.get("suspended_at"):
            continue
        prefs = u.get("sport_preferences") or []
        if prefs and sport not in prefs:
            continue
        level = partner_matching.player_level(u, sport)
        if min_level is not None and level < min_level:
            continue
        if max_level is not None and level > max_level:
            continue
        results.append((u, level))
        if len(results) >= limit:
            break
    cards = []
    for u, level in results:
        uid = str(u["_id"])
        s = await stats(db, uid, vs=viewer["_id"])
        cards.append({
            "id": uid, "name": u.get("name"), "city": u.get("city"), "level": level, "sport": sport,
            "rating": u.get(f"{sport}_rating"), "gender": u.get("gender"), **play_search_fields(u),
            "wins": s["wins"], "losses": s["losses"], "completed": s["completed"],
            "head_to_head": s["head_to_head"],
        })
    return cards
