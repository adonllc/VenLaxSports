"""Scheduling workflow for generated season matches.

Rules (decided with the product owner)
  * The Home player proposes the first time. The Away player confirms, declines with a message,
    or suggests another specific time, which Home then confirms.
  * A proposal is never a booking: the match stays Awaiting Confirmation until the other side
    accepts. Both sides then see the same confirmed time, shown in the league city's time zone.
  * Either player can ask to change a confirmed time, or cancel it, until 24 hours before. The
    existing booking stays in force until the change is accepted. Inside 24 hours only the
    organizer can change it. Cancelling a time never forfeits by itself.
  * A proposal expires after 48 hours (reminder at 24); a time that clashes with another match
    of either side (within an hour) is refused.
  * Everything is recorded in the match's scheduling history.
  * A match with no confirmed time 48 hours before its play-by date is flagged for the organizer,
    who can set the time.
  * If the play-by date passes and Home never proposed a time, the match is forfeited to Away: it
    is recorded as a win for Away in the standings; Home earns 0 points (no rating change). If Home did propose, the
    organizer decides. Other unplayed matches end as walkovers (existing job).

Notifications use the existing email service (and WhatsApp when it is configured).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from bson import ObjectId

import email_service
import tz_utils
from match_view import side_ids

logger = logging.getLogger(__name__)

EXPIRE_HOURS = 48
REMIND_AFTER_HOURS = 24
CHANGE_CUTOFF_HOURS = 24
CONFLICT_WINDOW_HOURS = 1
DUE_SOON_HOURS = 48
HISTORY_MAX = 50


class SchedulingError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _side_of(match: dict, uid: str):
    if uid in side_ids(match, 1):
        return 1
    if uid in side_ids(match, 2):
        return 2
    return None


def _label(match: dict, which: int) -> str:
    names = [match.get("player1_name"), match.get("team1_partner_name")] if which == 1 else [match.get("player2_name"), match.get("team2_partner_name")]
    return " & ".join(n for n in names if n)


async def _users(db, ids: list[str]) -> dict:
    out = {}
    async for u in db.users.find({"_id": {"$in": [ObjectId(i) for i in ids if ObjectId.is_valid(i)]}}):
        out[str(u["_id"])] = u
    return out


async def _wa(db, ids: list[str], text: str) -> None:
    """WhatsApp copy of a notification, only when that service is configured (as for new matches)."""
    try:
        from whatsapp_service import is_configured, schedule_wa
        if not is_configured():
            return
        for i in ids:
            doc = await db.users.find_one({"_id": ObjectId(i)}, {"phone": 1})
            if doc and doc.get("phone"):
                schedule_wa(doc["phone"], text)
    except Exception as exc:  # noqa: BLE001
        logger.warning("WhatsApp scheduling notice failed: %s", exc)


def _history(action: str, uid: str | None, name: str, **detail) -> dict:
    return {"at": _now().isoformat(), "action": action, "by": uid, "by_name": name,
            **{k: v for k, v in detail.items() if v not in (None, "")}}


async def _log(db, match: dict, entry: dict, extra_set: dict | None = None, extra_unset_proposal: bool = False) -> None:
    update = {"$set": {"updated_at": _now().isoformat(), **(extra_set or {})},
              "$push": {"schedule_history": {"$each": [entry], "$slice": -HISTORY_MAX}}}
    await db.matches.update_one({"_id": match["_id"]}, update)


async def _has_conflict(db, match: dict, when: datetime) -> bool:
    ids = side_ids(match, 1) + side_ids(match, 2)
    lo = (when - timedelta(hours=CONFLICT_WINDOW_HOURS)).isoformat()
    hi = (when + timedelta(hours=CONFLICT_WINDOW_HOURS)).isoformat()
    other = await db.matches.find_one({
        "_id": {"$ne": match["_id"]},
        "status": "scheduled",
        "schedule_status": {"$in": ["scheduled", None]},
        "scheduled_date": {"$gte": lo, "$lte": hi},
        "$or": [{"player1_id": {"$in": ids}}, {"player2_id": {"$in": ids}},
                {"team1_partner_id": {"$in": ids}}, {"team2_partner_id": {"$in": ids}}],
    })
    return other is not None


def league_open_error(league: dict, now: datetime | None = None) -> str | None:
    """Why nobody can schedule matches in this league yet, or None when it has officially opened.

    A league is open to play only when its status is "active" (the organizer published the schedule) AND its
    start date has arrived, in the league's own time zone. Before that the match cards exist but are read-only.
    """
    status = league.get("status")
    start_raw = (league.get("start_date") or "")[:10]
    day = _fmt_day(start_raw)
    opens = f" It opens on {day}." if day else ""
    not_yet = f"This league is not open to play yet.{opens} You can schedule matches once it opens."

    if status in ("registration", "upcoming"):
        return not_yet
    if status != "active":
        return "This league is not open for scheduling."
    try:
        start = tz_utils.parse_instant(f"{start_raw}T00:00", tz_utils.league_tz_name(league)) if start_raw else None
    except Exception:
        start = None
    if start and (now or _now()) < start:
        return not_yet
    return None


def _fmt_day(day: str) -> str:
    """"2026-11-08" -> "Nov 8" (no platform-specific strftime flags)."""
    try:
        d = datetime.strptime(day[:10], "%Y-%m-%d")
        return f"{d.strftime('%b')} {d.day}"
    except Exception:
        return ""


def _check_open(match: dict) -> None:
    if match.get("schedule_status") is None:
        raise SchedulingError(400, "This match is not part of a generated schedule")
    if match.get("status") != "scheduled":
        raise SchedulingError(400, "This match is already finished")


def _check_cutoff(match: dict) -> None:
    current = tz_utils.as_utc(match.get("scheduled_date"))
    if current and current - _now() < timedelta(hours=CHANGE_CUTOFF_HOURS):
        raise SchedulingError(400, "Within 24 hours of the match only the organizer can change the time. Email feedback@venlaxsports.com")


# ── Player actions ────────────────────────────────────────────────────────────

async def propose(db, match: dict, league: dict, uid: str, date: str, venue: str, note: str | None) -> dict:
    """Propose (or counter, or ask to change) a time. Returns the stored proposal."""
    _check_open(match)
    closed = league_open_error(league)
    if closed:
        raise SchedulingError(400, closed)
    me = _side_of(match, uid)
    if me is None:
        raise SchedulingError(403, "You are not a player in this match")
    tzname = tz_utils.league_tz_name(league)
    state = match.get("schedule_status")
    pending = match.get("proposal")
    booked = state == "scheduled"

    if booked:
        _check_cutoff(match)
        kind = "counter" if (pending and pending.get("proposer_side") != me) else "reschedule"
    elif state == "proposed":
        kind = "counter" if pending.get("proposer_side") != me else "initial"
    else:
        if me != 1:
            raise SchedulingError(403, "Only the Home player proposes the first time")
        kind = "initial"

    venue = (venue or "").strip()
    if not venue or len(venue) > 120:
        raise SchedulingError(400, "Enter the court or venue (up to 120 characters)")
    try:
        when = tz_utils.parse_instant(date, tzname)
    except Exception:
        raise SchedulingError(400, "Invalid date and time")
    now = _now()
    if when <= now:
        raise SchedulingError(400, "Pick a time in the future")
    last = tz_utils.as_utc(league.get("end_date"))
    if last and when > last + timedelta(days=1):
        raise SchedulingError(400, "That is after the end of the season")
    if await _has_conflict(db, match, when):
        raise SchedulingError(409, "One of the players already has a match within an hour of that time")

    expires = now + timedelta(hours=EXPIRE_HOURS)
    proposal = {
        "proposer_side": me, "proposed_by": uid, "date": when.isoformat(), "venue": venue,
        "note": (note or "").strip()[:300], "kind": kind, "at": now.isoformat(),
        "expires_at": expires.isoformat(), "remind_at": (now + timedelta(hours=REMIND_AFTER_HOURS)).isoformat(),
        "reminded": False,
    }
    users = await _users(db, side_ids(match, 1) + side_ids(match, 2))
    me_name = users.get(uid, {}).get("name", "")
    extra = {"proposal": proposal, "last_decline": None}
    if not booked:
        extra["schedule_status"] = "proposed"
    await _log(db, match, _history({"initial": "proposed", "counter": "countered", "reschedule": "change_requested"}[kind],
                                   uid, me_name, date=when.isoformat(), venue=venue, note=proposal["note"]), extra)

    other = 2 if me == 1 else 1
    when_txt = tz_utils.fmt_local(proposal["date"], tzname)
    for rid in side_ids(match, other):
        u = users.get(rid)
        if u and u.get("email"):
            email_service.schedule(email_service.send_match_proposed(
                u["email"], u.get("name", ""), _label(match, me), league["name"], str(league["_id"]),
                when_txt, venue, proposal["note"], kind, tz_utils.fmt_local(proposal["expires_at"], tzname)))
    await _wa(db, side_ids(match, other), f"{_label(match, me)} proposed {when_txt} at {venue} for your VENLAX match. Open your matches to reply. - VENLAX Sports")
    return proposal


async def respond(db, match: dict, league: dict, uid: str, action: str, message: str | None) -> dict:
    """The other side accepts or declines the pending proposal."""
    closed = league_open_error(league)
    if closed:
        raise SchedulingError(400, closed)
    prop = match.get("proposal")
    if not prop:
        raise SchedulingError(400, "There is no proposal to respond to")
    me = _side_of(match, uid)
    if me is None:
        raise SchedulingError(403, "You are not a player in this match")
    if me == prop.get("proposer_side"):
        raise SchedulingError(403, "Only the other player responds to a proposal")
    if action not in ("confirm", "decline"):
        raise SchedulingError(400, "Action must be confirm or decline")

    tzname = tz_utils.league_tz_name(league)
    booked = match.get("schedule_status") == "scheduled"
    users = await _users(db, side_ids(match, 1) + side_ids(match, 2))
    me_name = users.get(uid, {}).get("name", "")
    proposer = prop["proposer_side"]
    lid = str(league["_id"])

    if action == "confirm":
        when = tz_utils.as_utc(prop["date"])
        if when is None or when <= _now():
            raise SchedulingError(400, "That time has passed. Ask for a new time")
        if await _has_conflict(db, match, when):
            raise SchedulingError(409, "One of the players now has another match within an hour of that time")
        previous = tz_utils.fmt_local(match.get("scheduled_date"), tzname) if booked else None
        await _log(db, match, _history("confirmed", uid, me_name, date=prop["date"], venue=prop["venue"], previous=previous),
                   {"schedule_status": "scheduled", "scheduled_date": prop["date"], "venue": prop["venue"],
                    "proposal": None, "last_decline": None, "needs_help": False})
        when_txt = tz_utils.fmt_local(prop["date"], tzname)
        for who in side_ids(match, 1) + side_ids(match, 2):
            u = users.get(who)
            if u and u.get("email"):
                opp = _label(match, 2 if who in side_ids(match, 1) else 1)
                email_service.schedule(email_service.send_match_confirmed(
                    u["email"], u.get("name", ""), opp, league["name"], lid, when_txt, prop["venue"]))
        await _wa(db, side_ids(match, 1) + side_ids(match, 2), f"Your VENLAX match is confirmed: {when_txt} at {prop['venue']}. - VENLAX Sports")
        return {"schedule_status": "scheduled", "scheduled_date": prop["date"], "venue": prop["venue"]}

    msg = (message or "").strip()[:300]
    if booked:
        booked_txt = tz_utils.fmt_local(match.get("scheduled_date"), tzname)
        await _log(db, match, _history("declined", uid, me_name, message=msg), {"proposal": None})
        for pid in side_ids(match, proposer):
            u = users.get(pid)
            if u and u.get("email"):
                email_service.schedule(email_service.send_reschedule_declined(
                    u["email"], u.get("name", ""), _label(match, me), league["name"], lid, booked_txt, msg))
        return {"schedule_status": "scheduled", "scheduled_date": match.get("scheduled_date")}
    await _log(db, match, _history("declined", uid, me_name, message=msg),
               {"schedule_status": "unscheduled", "proposal": None, "last_decline": {"message": msg, "at": _now().isoformat()}})
    for pid in side_ids(match, proposer):
        u = users.get(pid)
        if u and u.get("email"):
            email_service.schedule(email_service.send_match_declined(
                u["email"], u.get("name", ""), _label(match, me), league["name"], lid, msg))
    return {"schedule_status": "unscheduled"}


async def cancel_time(db, match: dict, league: dict, uid: str) -> dict:
    """Either player cancels a confirmed time (not a forfeit). Back to Not Scheduled."""
    _check_open(match)
    me = _side_of(match, uid)
    if me is None:
        raise SchedulingError(403, "You are not a player in this match")
    if match.get("schedule_status") != "scheduled":
        raise SchedulingError(400, "There is no confirmed time to cancel")
    if not match.get("deadline"):
        raise SchedulingError(400, "This match cannot be cancelled here")
    _check_cutoff(match)
    tzname = tz_utils.league_tz_name(league)
    was = tz_utils.fmt_local(match.get("scheduled_date"), tzname)
    users = await _users(db, side_ids(match, 1) + side_ids(match, 2))
    await _log(db, match, _history("time_cancelled", uid, users.get(uid, {}).get("name", ""), date=match.get("scheduled_date")),
               {"schedule_status": "unscheduled", "scheduled_date": match["deadline"], "venue": None, "proposal": None})
    for who in side_ids(match, 1) + side_ids(match, 2):
        u = users.get(who)
        if u and u.get("email"):
            opp = _label(match, 2 if who in side_ids(match, 1) else 1)
            email_service.schedule(email_service.send_match_cancelled_time(
                u["email"], u.get("name", ""), opp, league["name"], str(league["_id"]), was, who == uid))
    return {"schedule_status": "unscheduled"}


# ── Organizer ─────────────────────────────────────────────────────────────────

async def organizer_set_time(db, match: dict, league: dict, admin_id: str, date: str, venue: str) -> dict:
    """The organizer books the match directly (for matches the players could not agree on)."""
    _check_open(match)
    venue = (venue or "").strip()
    if not venue or len(venue) > 120:
        raise SchedulingError(400, "Enter the court or venue (up to 120 characters)")
    tzname = tz_utils.league_tz_name(league)
    try:
        when = tz_utils.parse_instant(date, tzname)
    except Exception:
        raise SchedulingError(400, "Invalid date and time")
    if when <= _now():
        raise SchedulingError(400, "Pick a time in the future")
    users = await _users(db, side_ids(match, 1) + side_ids(match, 2))
    await _log(db, match, _history("organizer_set", admin_id, "Organizer", date=when.isoformat(), venue=venue),
               {"schedule_status": "scheduled", "scheduled_date": when.isoformat(), "venue": venue,
                "proposal": None, "needs_help": False})
    when_txt = tz_utils.fmt_local(when.isoformat(), tzname)
    for who in side_ids(match, 1) + side_ids(match, 2):
        u = users.get(who)
        if u and u.get("email"):
            opp = _label(match, 2 if who in side_ids(match, 1) else 1)
            email_service.schedule(email_service.send_organizer_set_time(
                u["email"], u.get("name", ""), opp, league["name"], str(league["_id"]), when_txt, venue))
    return {"schedule_status": "scheduled", "scheduled_date": when.isoformat(), "venue": venue}


# ── Background housekeeping (hourly job) ──────────────────────────────────────

async def process_proposals(db, now: datetime | None = None) -> dict:
    """Expire unanswered proposals, remind at 24 hours, flag matches that are running out of time."""
    now = now or _now()
    now_iso = now.isoformat()
    counts = {"expired": 0, "reminded": 0, "flagged": 0, "forfeited": 0}
    league_cache: dict = {}

    async def league_of(m):
        lid = m["league_id"]
        if lid not in league_cache:
            league_cache[lid] = await db.leagues.find_one({"_id": ObjectId(lid)})
        return league_cache[lid]

    expired = await db.matches.find({"proposal.expires_at": {"$lt": now_iso}, "status": "scheduled"}).to_list(500)
    for m in expired:
        league = await league_of(m)
        if not league:
            continue
        booked = m.get("schedule_status") == "scheduled"
        users = await _users(db, side_ids(m, 1) + side_ids(m, 2))
        extra = {"proposal": None}
        if not booked:
            extra["schedule_status"] = "unscheduled"
        await _log(db, m, _history("expired", None, "System"), extra)
        for who in side_ids(m, 1) + side_ids(m, 2):
            u = users.get(who)
            if u and u.get("email"):
                opp = _label(m, 2 if who in side_ids(m, 1) else 1)
                email_service.schedule(email_service.send_proposal_expired(
                    u["email"], u.get("name", ""), opp, league["name"], m["league_id"], booked))
        counts["expired"] += 1

    due = await db.matches.find({"status": "scheduled", "proposal.expires_at": {"$gte": now_iso}, "proposal.remind_at": {"$lte": now_iso},
                                 "proposal.reminded": {"$ne": True}}).to_list(500)
    for m in due:
        league = await league_of(m)
        if not league:
            continue
        tzname = tz_utils.league_tz_name(league)
        prop = m["proposal"]
        users = await _users(db, side_ids(m, 1) + side_ids(m, 2))
        responder = 2 if prop["proposer_side"] == 1 else 1
        for rid in side_ids(m, responder):
            u = users.get(rid)
            if u and u.get("email"):
                email_service.schedule(email_service.send_proposal_reminder(
                    u["email"], u.get("name", ""), _label(m, prop["proposer_side"]), league["name"], m["league_id"],
                    tz_utils.fmt_local(prop["date"], tzname), tz_utils.fmt_local(prop["expires_at"], tzname)))
        await db.matches.update_one({"_id": m["_id"]}, {"$set": {"proposal.reminded": True}})
        counts["reminded"] += 1

    soon = (now + timedelta(hours=DUE_SOON_HOURS)).isoformat()
    at_risk = await db.matches.find({
        "deadline": {"$ne": None, "$lte": soon}, "status": "scheduled",
        "schedule_status": {"$in": ["unscheduled", "proposed"]}, "attention_sent": {"$ne": True},
    }).to_list(500)
    for m in at_risk:
        league = await league_of(m)
        if not league or tz_utils.as_utc(m["deadline"]) < now:
            continue
        tzname = tz_utils.league_tz_name(league)
        users = await _users(db, side_ids(m, 1) + side_ids(m, 2))
        deadline_txt = tz_utils.fmt_local(m["deadline"], tzname)
        for who in side_ids(m, 1) + side_ids(m, 2):
            u = users.get(who)
            if u and u.get("email"):
                opp = _label(m, 2 if who in side_ids(m, 1) else 1)
                email_service.schedule(email_service.send_schedule_attention(
                    u["email"], u.get("name", ""), opp, league["name"], m["league_id"], deadline_txt))
        await db.matches.update_one({"_id": m["_id"]}, {"$set": {"needs_help": True, "attention_sent": True}})
        counts["flagged"] += 1

    counts["forfeited"] = await forfeit_unproposed(db, now, league_of)
    return counts


async def forfeit_unproposed(db, now: datetime, league_of) -> int:
    """Play-by date passed and Home never proposed a time: award the match to Away."""
    from routes.match_routes import _update_standings  # local import: match_routes imports this module

    forfeited = 0
    late = await db.matches.find({
        "deadline": {"$ne": None, "$lt": now.isoformat()}, "status": "scheduled",
        "schedule_status": "unscheduled",
    }).to_list(500)
    for m in late:
        if any(h.get("action") == "proposed" for h in (m.get("schedule_history") or [])):
            continue  # Home did propose a time; the organizer decides
        league = await league_of(m)
        if not league:
            continue
        won = await db.matches.find_one_and_update(
            {"_id": m["_id"], "status": "scheduled"},
            {"$set": {"status": "walkover", "walkover_reason": "home_no_proposal",
                      "winner_id": m["player2_id"], "winner_name": m.get("player2_name"),
                      "needs_help": False, "updated_at": now.isoformat()},
             "$push": {"schedule_history": {"$each": [_history("forfeited", None, "System")], "$slice": -HISTORY_MAX}}},
        )
        if not won:
            continue  # another run already claimed it
        await _update_standings(db, m["league_id"], m, m["player2_id"], None, forfeit=True)
        users = await _users(db, side_ids(m, 1) + side_ids(m, 2))
        for who in side_ids(m, 1) + side_ids(m, 2):
            u = users.get(who)
            if u and u.get("email"):
                email_service.schedule(email_service.send_match_forfeited(
                    u["email"], u.get("name", ""), _label(m, 2 if who in side_ids(m, 1) else 1),
                    league["name"], m["league_id"], who in side_ids(m, 2)))
        forfeited += 1
    return forfeited
