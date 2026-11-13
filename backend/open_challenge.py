"""Open Challenge Board: a player posts a match request, any eligible player can accept it.

A post lives in `open_challenges`. Accepting it claims the post atomically (one winner, ever) and starts a normal
direct challenge (`direct_challenges`, source "open_board") that is already agreed. Scheduling, proposals, scores,
confirmation, disputes, reminders and head-to-head stats are therefore the existing Direct Challenge engine, not a copy.

Post status      draft -> open -> accepted -> (follows the match) ; open|paused -> cancelled | closed | expired | removed
Shown status     DRAFT OPEN PAUSED SCHEDULING SCHEDULED IN_PROGRESS COMPLETED DISPUTED CANCELLED EXPIRED CLOSED REMOVED
Open matches never touch ladders, league standings or ratings.
"""
from __future__ import annotations

import os
import re
from datetime import datetime, timedelta, timezone

from bson import ObjectId

import challenge_config as cfg
import direct_challenge as dc
import email_service
import notification_center
import partner_matching
from direct_challenge import ChallengeError
from models import normalize_zip
from phase_config import ACTIVE_SPORTS

LIVE = ("draft", "open", "paused")          # posts the owner can still change
EDITABLE_FIELDS = ("sport", "format", "level", "min_level", "max_level", "city", "zip_code", "venue", "court_pref", "date",
                   "time_window", "start_time", "availability", "notes", "visibility", "max_distance_miles", "partner_id")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _frontend_url() -> str:
    return os.environ.get("FRONTEND_URL", "https://venlaxsports.com").rstrip("/")


def _link(post: dict) -> str:
    return f"/find-opponent/{post['_id']}"


def _log(post: dict, by, action: str, **detail) -> dict:
    return {"at": _now().isoformat(), "by": by, "action": action, "detail": detail}


async def _save(db, post: dict, set_: dict, entry: dict) -> None:
    set_["updated_at"] = _now().isoformat()
    await db.open_challenges.update_one(
        {"_id": post["_id"]}, {"$set": set_, "$push": {"history": {"$each": [entry], "$slice": -cfg.HISTORY_MAX}}})
    post.update(set_)


async def load(db, post_id: str) -> dict:
    if not ObjectId.is_valid(post_id):
        raise ChallengeError(404, "Challenge not found")
    post = await db.open_challenges.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise ChallengeError(404, "Challenge not found")
    return post


def require_owner(post: dict, user: dict) -> None:
    if post["owner_id"] != user["_id"]:
        raise ChallengeError(403, "Only the player who posted this challenge can do that")


def is_admin(user: dict | None) -> bool:
    return bool(user) and user.get("role") in ("admin", "city_admin")


async def _user(db, uid):
    return await dc._user(db, uid)


# ── Validation ────────────────────────────────────────────────────────────────

def _level(raw, label: str) -> float:
    try:
        v = partner_matching.snap_half(float(raw))
    except (TypeError, ValueError):
        raise ChallengeError(400, f"{label} must be a number such as 3.5")
    if not cfg.OPEN_LEVEL_MIN <= v <= cfg.OPEN_LEVEL_MAX:
        raise ChallengeError(400, f"{label} must be between {cfg.OPEN_LEVEL_MIN} and {cfg.OPEN_LEVEL_MAX}")
    return v


def _clean(data: dict, user: dict) -> dict:
    sport, fmt = data.get("sport"), data.get("format") or "singles"
    if sport not in cfg.CHALLENGE_SPORTS or sport not in ACTIVE_SPORTS:
        raise ChallengeError(400, "Open challenges are available for tennis and pickleball")
    if fmt not in cfg.CHALLENGE_FORMATS:
        raise ChallengeError(400, "Choose singles or doubles")
    level = _level(data["level"], "Skill level") if data.get("level") not in (None, "") else partner_matching.player_level(user, sport)
    lo = _level(data["min_level"], "Lowest opponent level") if data.get("min_level") not in (None, "") else max(cfg.OPEN_LEVEL_MIN, level - cfg.OPEN_LEVEL_SPREAD)
    hi = _level(data["max_level"], "Highest opponent level") if data.get("max_level") not in (None, "") else min(cfg.OPEN_LEVEL_MAX, level + cfg.OPEN_LEVEL_SPREAD)
    if lo > hi:
        raise ChallengeError(400, "The lowest opponent level is above the highest")
    try:
        zip_code = normalize_zip(data.get("zip_code"))
    except ValueError as e:
        raise ChallengeError(400, str(e))
    city = (data.get("city") or user.get("city") or "").strip()[:80]
    if not city and not zip_code:
        raise ChallengeError(400, "Enter a city or ZIP code")
    venue = (data.get("venue") or "").strip()[:120]
    if not venue:
        raise ChallengeError(400, "Enter where you would like to play")
    try:
        day = datetime.strptime(str(data.get("date") or ""), "%Y-%m-%d").date()
    except ValueError:
        raise ChallengeError(400, "Pick a date")
    today = _now().date()
    if day < today:
        raise ChallengeError(400, "That date has passed")
    if day > today + timedelta(days=cfg.OPEN_MAX_DAYS_AHEAD):
        raise ChallengeError(400, f"Pick a date within the next {cfg.OPEN_MAX_DAYS_AHEAD} days")
    window = data.get("time_window") or "any"
    if window not in cfg.OPEN_WINDOWS:
        raise ChallengeError(400, "Choose morning, afternoon, evening or any time")
    start = (data.get("start_time") or "").strip()
    if start and not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", start):
        raise ChallengeError(400, "Enter the time as HH:MM")
    court = data.get("court_pref") or "any"
    if court not in cfg.OPEN_COURTS:
        raise ChallengeError(400, "Choose indoor, outdoor or no preference")
    visibility = data.get("visibility") or "public"
    if visibility not in cfg.OPEN_VISIBILITY:
        raise ChallengeError(400, "Choose who can see this challenge")
    avail = [a for a in (data.get("availability") or []) if a in partner_matching.AVAILABILITY_LABELS]
    dist = data.get("max_distance_miles")
    if dist not in (None, ""):
        try:
            dist = int(dist)
        except (TypeError, ValueError):
            raise ChallengeError(400, "Distance must be a whole number of miles")
        if not 1 <= dist <= 100:
            raise ChallengeError(400, "Distance must be between 1 and 100 miles")
    else:
        dist = None
    return {
        "sport": sport, "format": fmt, "level": level, "min_level": lo, "max_level": hi, "city": city, "zip_code": zip_code,
        "venue": venue, "court_pref": court, "date": day.isoformat(), "time_window": window, "start_time": start or None,
        "availability": avail, "notes": (data.get("notes") or "").strip()[:500], "visibility": visibility,
        "max_distance_miles": dist, "partner_id": data.get("partner_id") or None,
    }


def _expiry(date_iso: str, now: datetime) -> str:
    end_of_day = datetime.strptime(date_iso, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
    return min(now + timedelta(days=cfg.OPEN_MAX_LIFE_DAYS), end_of_day).isoformat()


async def _check_partner(db, user: dict, clean: dict) -> None:
    if clean["format"] == "doubles":
        pid = clean["partner_id"]
        if not pid:
            raise ChallengeError(400, "Pick your partner for a doubles challenge")
        if pid == user["_id"]:
            raise ChallengeError(400, "Your partner must be a different player")
        if not dc._usable(await _user(db, pid)):
            raise ChallengeError(404, "Partner not found")
    else:
        clean["partner_id"] = None


async def _check_limits(db, user: dict, clean: dict, exclude_id=None) -> None:
    mine = await db.open_challenges.find({"owner_id": user["_id"], "status": {"$in": list(LIVE)}}).to_list(100)
    mine = [p for p in mine if p["_id"] != exclude_id]
    if any(p["sport"] == clean["sport"] and p["format"] == clean["format"] and p["date"] == clean["date"] for p in mine):
        raise ChallengeError(409, "You already have a challenge posted for that sport, format and date")
    if len(mine) >= cfg.OPEN_MAX_ACTIVE:
        raise ChallengeError(429, f"You can have {cfg.OPEN_MAX_ACTIVE} challenges posted at once. Close one first.")


# ── Owner actions ─────────────────────────────────────────────────────────────

async def create(db, user: dict, data: dict, publish: bool = True) -> dict:
    clean = _clean(data, user)
    await _check_partner(db, user, clean)
    await _check_limits(db, user, clean)
    now = _now()
    post = {
        "_id": ObjectId(), "owner_id": user["_id"], "owner_name": user.get("name", ""), **clean,
        "status": "draft", "acceptor_id": None, "acceptor_partner_id": None, "challenge_id": None, "accepted_at": None,
        "created_at": now.isoformat(), "updated_at": now.isoformat(), "expires_at": _expiry(clean["date"], now),
        "history": [_log({}, user["_id"], "created", sport=clean["sport"], format=clean["format"])],
    }
    await db.open_challenges.insert_one(post)
    if publish:
        await go_live(db, post, user)
    return post


async def go_live(db, post: dict, user: dict) -> dict:
    require_owner(post, user)
    if post["status"] != "draft":
        raise ChallengeError(409, "Only a draft can be published")
    if post["expires_at"] <= _now().isoformat():
        raise ChallengeError(409, "That date has passed. Edit the challenge first.")
    await _save(db, post, {"status": "open"}, _log(post, user["_id"], "published"))
    await notification_center.notify(
        db, [user["_id"]], "open_challenge_published", "Your open challenge is live",
        f"{post['sport'].title()} {post['format']} on {post['date']}. We will tell you when someone accepts.",
        _link(post), str(post["_id"]), email=False)
    await _announce_to_nearby(db, post)
    return post


async def _announce_to_nearby(db, post: dict) -> None:
    """Tell nearby players in the level range, in-app only (no email), capped."""
    if post["visibility"] != "public" or not post.get("city"):
        return
    blocked = await blocked_ids(db, post["owner_id"])
    sent = []
    query = {"is_active": {"$ne": False}, "city": {"$regex": f"^{re.escape(post['city'])}$", "$options": "i"}}
    async for u in db.users.find(query, {"password_hash": 0}).limit(300):
        uid = str(u["_id"])
        if uid == post["owner_id"] or uid in blocked or not dc._usable(u) or u.get("profile_public") is False:
            continue
        prefs = u.get("sport_preferences") or []
        if prefs and post["sport"] not in prefs:
            continue
        if not post["min_level"] <= partner_matching.player_level(u, post["sport"]) <= post["max_level"]:
            continue
        sent.append(uid)
        if len(sent) >= cfg.OPEN_NOTIFY_MAX:
            break
    await notification_center.notify(
        db, sent, "open_challenge_match", f"A {post['sport'].title()} {post['format']} match near you",
        f"{post['owner_name']} is looking for an opponent on {post['date']} in {post['city']}.",
        _link(post), str(post["_id"]), email=False)


async def edit(db, post: dict, user: dict, data: dict) -> dict:
    require_owner(post, user)
    if post["status"] not in LIVE:
        raise ChallengeError(409, "This challenge can no longer be edited")
    merged = {k: post.get(k) for k in EDITABLE_FIELDS}
    merged.update({k: v for k, v in data.items() if k in EDITABLE_FIELDS})
    if "level" in data and "min_level" not in data and "max_level" not in data:
        merged["min_level"] = merged["max_level"] = None       # a new level re-centres the range
    clean = _clean(merged, user)
    await _check_partner(db, user, clean)
    await _check_limits(db, user, clean, exclude_id=post["_id"])
    clean["expires_at"] = _expiry(clean["date"], _now())
    await _save(db, post, clean, _log(post, user["_id"], "edited"))
    return post


async def set_paused(db, post: dict, user: dict, paused: bool) -> dict:
    require_owner(post, user)
    if paused and post["status"] != "open":
        raise ChallengeError(409, "Only an open challenge can be paused")
    if not paused and post["status"] != "paused":
        raise ChallengeError(409, "This challenge is not paused")
    await _save(db, post, {"status": "paused" if paused else "open"}, _log(post, user["_id"], "paused" if paused else "resumed"))
    return post


async def withdraw(db, post: dict, user: dict, final: str = "cancelled") -> dict:
    """Owner cancels (or closes) a post. Once accepted, the match itself is cancelled through the challenge engine."""
    require_owner(post, user)
    if post["status"] == "accepted":
        ch = await db.direct_challenges.find_one({"_id": ObjectId(post["challenge_id"])}) if post.get("challenge_id") else None
        if not ch:
            raise ChallengeError(409, "This challenge cannot be withdrawn right now")
        await dc.cancel(db, ch, user)
        await notification_center.notify(
            db, [post["acceptor_id"]], "open_challenge_withdrawn", f"{post['owner_name']} withdrew their open challenge", "",
            f"/challenges/{ch['_id']}", str(post["_id"]))
        return post
    if post["status"] not in LIVE:
        raise ChallengeError(409, "This challenge is already finished")
    await _save(db, post, {"status": final}, _log(post, user["_id"], final))
    return post


# ── Accepting (the concurrency-critical part) ─────────────────────────────────

def eligibility_error(post: dict, viewer: dict) -> str | None:
    """Why `viewer` cannot accept `post`, or None."""
    if post["owner_id"] == viewer["_id"]:
        return "This is your own challenge"
    level = partner_matching.player_level(viewer, post["sport"])
    if not post["min_level"] <= level <= post["max_level"]:
        return f"Your level ({level}) is outside the {post['min_level']} to {post['max_level']} range this player asked for"
    return None


async def accept(db, post: dict, user: dict, partner_id: str | None = None) -> tuple[dict, dict]:
    """Reserve the post for `user` and start the match. Exactly one accept can ever succeed per post."""
    uid = user["_id"]
    reason = eligibility_error(post, user)
    if reason:
        raise ChallengeError(403, reason)
    if post["owner_id"] in await blocked_ids(db, uid):
        raise ChallengeError(404, "Challenge not found")
    if post["format"] == "doubles":
        if not partner_id:
            raise ChallengeError(400, "Pick your partner to accept a doubles challenge")
        if partner_id in (uid, post["owner_id"], post.get("partner_id")):
            raise ChallengeError(400, "Your partner must be a different player")
        if not dc._usable(await _user(db, partner_id)):
            raise ChallengeError(404, "Partner not found")
    elif partner_id:
        raise ChallengeError(400, "A singles challenge has no partner")

    now = _now().isoformat()
    # One atomic conditional update is the lock: only the request that still sees status "open" gets the document back.
    claimed = await db.open_challenges.find_one_and_update(
        {"_id": post["_id"], "status": "open", "expires_at": {"$gt": now}},
        {"$set": {"status": "accepted", "acceptor_id": uid, "acceptor_partner_id": partner_id or None,
                  "accepted_at": now, "updated_at": now}})
    if not claimed:
        raise ChallengeError(409, "Sorry, this challenge was just taken or is no longer available")
    side1 = [post["owner_id"]] + ([post["partner_id"]] if post["format"] == "doubles" else [])
    side2 = [uid] + ([partner_id] if post["format"] == "doubles" else [])
    try:
        ch = await dc.create_accepted(db, side1, side2, post["sport"], post["format"],
                                      {"open_id": str(post["_id"]), "message": post.get("notes", "")})
    except Exception:
        await db.open_challenges.update_one(
            {"_id": post["_id"]}, {"$set": {"status": "open", "acceptor_id": None, "acceptor_partner_id": None, "accepted_at": None}})
        raise
    await _save(db, post, {"status": "accepted", "acceptor_id": uid, "acceptor_partner_id": partner_id or None,
                           "accepted_at": now, "challenge_id": str(ch["_id"])},
                _log(post, uid, "accepted", acceptor=ch["names"].get(uid, "")))
    link = f"/challenges/{ch['_id']}"
    who = ch["names"].get(uid, "A player")
    await notification_center.notify(
        db, side1, "open_challenge_accepted", f"{who} accepted your open challenge",
        "Agree a date, time and court.", link, str(post["_id"]))
    if partner_id:
        await notification_center.notify(
            db, [partner_id], "challenge_partner", f"{who} picked you as their partner",
            f"Against {ch['names'].get(post['owner_id'], '')}.", link, str(post["_id"]))
    return post, ch


# ── Blocks and reports ────────────────────────────────────────────────────────

async def blocked_ids(db, uid: str) -> set:
    """Everyone who blocked `uid` or whom `uid` blocked: neither side sees the other's challenges."""
    rows = await db.open_challenge_blocks.find({"$or": [{"user_id": uid}, {"blocked_id": uid}]}).to_list(1000)
    return {r["blocked_id"] if r["user_id"] == uid else r["user_id"] for r in rows}


async def block(db, user: dict, other_id: str) -> None:
    if other_id == user["_id"]:
        raise ChallengeError(400, "You cannot block yourself")
    if not await _user(db, other_id):
        raise ChallengeError(404, "Player not found")
    if not await db.open_challenge_blocks.find_one({"user_id": user["_id"], "blocked_id": other_id}):
        await db.open_challenge_blocks.insert_one(
            {"user_id": user["_id"], "blocked_id": other_id, "created_at": _now().isoformat()})


async def unblock(db, user: dict, other_id: str) -> None:
    await db.open_challenge_blocks.delete_many({"user_id": user["_id"], "blocked_id": other_id})


async def my_blocks(db, user: dict) -> list:
    out = []
    for r in await db.open_challenge_blocks.find({"user_id": user["_id"]}).to_list(200):
        u = await _user(db, r["blocked_id"])
        out.append({"id": r["blocked_id"], "name": (u or {}).get("name", "Former player")})
    return out


async def report(db, user: dict, post: dict, reason: str) -> None:
    reason = (reason or "").strip()[:500]
    if len(reason) < 3:
        raise ChallengeError(400, "Tell us what is wrong")
    if post["owner_id"] == user["_id"]:
        raise ChallengeError(400, "You cannot report your own challenge")
    if await db.open_challenge_reports.find_one({"post_id": str(post["_id"]), "reporter_id": user["_id"]}):
        raise ChallengeError(409, "You already reported this challenge")
    await db.open_challenge_reports.insert_one({
        "post_id": str(post["_id"]), "reporter_id": user["_id"], "reason": reason,
        "status": "open", "created_at": _now().isoformat()})


async def admin_remove(db, post: dict, admin: dict, reason: str) -> dict:
    """Moderation: take a post down. An accepted match is cancelled through the engine."""
    reason = (reason or "").strip()[:300] or "Removed by an administrator"
    if post["status"] == "accepted" and post.get("challenge_id"):
        ch = await db.direct_challenges.find_one({"_id": ObjectId(post["challenge_id"])})
        if ch and ch["status"] in ("scheduling", "scheduled"):
            await dc.cancel(db, ch, admin, is_admin=True)
    elif post["status"] not in LIVE:
        raise ChallengeError(409, "This challenge is already finished")
    await _save(db, post, {"status": "removed", "removed_reason": reason}, _log(post, admin["_id"], "removed", reason=reason))
    await db.open_challenge_reports.update_many({"post_id": str(post["_id"])}, {"$set": {"status": "actioned"}})
    await notification_center.notify(
        db, [post["owner_id"]], "open_challenge_removed", "An open challenge of yours was removed", reason, "/find-opponent", str(post["_id"]))
    return post


async def admin_dismiss(db, post: dict) -> None:
    await db.open_challenge_reports.update_many({"post_id": str(post["_id"])}, {"$set": {"status": "dismissed"}})


async def admin_list(db) -> list:
    reports = await db.open_challenge_reports.find({"status": "open"}).to_list(1000)
    counts: dict = {}
    for r in reports:
        counts.setdefault(r["post_id"], []).append(r["reason"])
    rows = await db.open_challenges.find({}).sort("created_at", -1).to_list(300)
    out = []
    for p in rows:
        reasons = counts.get(str(p["_id"]), [])
        out.append({
            "id": str(p["_id"]), "owner_id": p["owner_id"], "owner_name": p.get("owner_name"), "sport": p["sport"],
            "format": p["format"], "city": p.get("city"), "date": p["date"], "status": p["status"],
            "notes": p.get("notes", ""), "reports": len(reasons), "report_reasons": reasons[:5],
        })
    out.sort(key=lambda r: (-r["reports"],))
    return out


# ── Sharing ───────────────────────────────────────────────────────────────────

async def share_by_email(db, post: dict, user: dict, emails: list) -> int:
    require_owner(post, user)
    if post["status"] != "open":
        raise ChallengeError(409, "Only an open challenge can be shared")
    cleaned = list(dict.fromkeys(e.strip().lower() for e in emails if e and _EMAIL.match(e.strip())))[:cfg.OPEN_SHARE_MAX_PER_CALL]
    if not cleaned:
        raise ChallengeError(400, "Enter at least one valid email address")
    since = (_now() - timedelta(hours=24)).isoformat()
    sent_today = await db.open_challenge_shares.count_documents({"user_id": user["_id"], "created_at": {"$gte": since}})
    if sent_today + len(cleaned) > cfg.OPEN_SHARE_DAILY:
        raise ChallengeError(429, f"You can email {cfg.OPEN_SHARE_DAILY} invitations a day")
    url = f"{_frontend_url()}{_link(post)}"
    subject = f"{user.get('name', 'A VENLAX player')} wants to play {post['sport']} with you"
    body = (f"{user.get('name', 'A player')} posted an open {post['sport']} {post['format']} challenge in {post.get('city') or post.get('zip_code')} "
            f"for {post['date']}.\n\nSee it and accept it here: {url}\n\n"
            "New to VENLAX Sports? Sign up free and you will land right back on this challenge.")
    for e in cleaned:
        email_service.schedule(email_service.send_generic(e, subject, body))
        await db.open_challenge_shares.insert_one({"user_id": user["_id"], "post_id": str(post["_id"]), "created_at": _now().isoformat()})
    return len(cleaned)


# ── Expiry (scheduler) ────────────────────────────────────────────────────────

async def process(db, now: datetime | None = None) -> dict:
    now = now or _now()
    expired = 0
    for p in await db.open_challenges.find({"status": {"$in": list(LIVE)}}).to_list(1000):
        if p["expires_at"] <= now.isoformat():
            await _save(db, p, {"status": "expired"}, _log(p, None, "expired"))
            await notification_center.notify(
                db, [p["owner_id"]], "open_challenge_expired", "Your open challenge expired",
                "Nobody took it in time. Post it again for a new date.", "/find-opponent", str(p["_id"]), email=False)
            expired += 1
    return {"expired": expired}


# ── Views ─────────────────────────────────────────────────────────────────────

def effective_status(post: dict, ch: dict | None) -> str:
    """The status a player sees: once accepted, the post simply follows its match."""
    if post["status"] != "accepted" or not ch:
        return post["status"]
    s = ch["status"]
    if s == "scheduling":
        return "scheduling"
    if s == "scheduled":
        return "in_progress" if ch.get("scheduled_at") and dc._parse(ch["scheduled_at"]) <= _now() else "scheduled"
    if s == "result_submitted":
        return "in_progress"
    if s == "confirmed":
        return "completed"
    if s == "disputed":
        return "disputed"
    return "cancelled"


def proximity(post: dict, viewer: dict) -> str:
    vz, pz = (viewer.get("zip_code") or "").strip().upper(), (post.get("zip_code") or "").strip().upper()
    if vz and pz and vz == pz:
        return "same_zip"
    vc, pc = (viewer.get("city") or "").strip().lower(), (post.get("city") or "").strip().lower()
    return "same_city" if vc and pc and vc == pc else "other"


async def _owner_card(db, owner_id: str, cache: dict) -> dict:
    if owner_id not in cache:
        u = await _user(db, owner_id) or {}
        shown = u.get("profile_public") is not False
        cache[owner_id] = {"id": owner_id, "name": u.get("name", "VENLAX player"), "avatar": u.get("avatar") if shown else None}
    return cache[owner_id]


async def view(db, post: dict, viewer: dict, ch: dict | None = None, cache: dict | None = None) -> dict:
    """A post as `viewer` may see it. Never includes email or phone."""
    cache = cache if cache is not None else {}
    uid = viewer["_id"]
    mine = post["owner_id"] == uid
    acceptor = post.get("acceptor_id") == uid
    status = effective_status(post, ch)
    why = None if mine or post["status"] != "open" else eligibility_error(post, viewer)
    open_now = post["status"] == "open" and post["expires_at"] > _now().isoformat()
    out = {
        "id": str(post["_id"]), "owner": await _owner_card(db, post["owner_id"], cache), "sport": post["sport"],
        "format": post["format"], "level": post["level"], "min_level": post["min_level"], "max_level": post["max_level"],
        "city": post.get("city"), "zip_code": post.get("zip_code"), "venue": post["venue"], "court_pref": post["court_pref"],
        "date": post["date"], "time_window": post["time_window"], "start_time": post.get("start_time"),
        "availability": post.get("availability", []), "notes": post.get("notes", ""), "visibility": post["visibility"],
        "max_distance_miles": post.get("max_distance_miles"), "status": status, "stored_status": post["status"],
        "expires_at": post["expires_at"], "created_at": post["created_at"], "is_mine": mine, "is_acceptor": acceptor,
        "proximity": proximity(post, viewer), "distance_miles": None,   # users carry no coordinates yet: same ZIP / same city only
        "ineligible_reason": why, "challenge_id": post.get("challenge_id") if (mine or acceptor or is_admin(viewer)) else None,
        "partner_name": None,
        "can": {
            "accept": open_now and not mine and why is None,
            "edit": mine and post["status"] in LIVE, "publish": mine and post["status"] == "draft",
            "pause": mine and post["status"] == "open", "resume": mine and post["status"] == "paused",
            "cancel": mine and post["status"] in LIVE + ("accepted",) and status not in ("completed", "cancelled", "disputed"),
            "share": mine and post["status"] == "open",
            "report": not mine, "block": not mine,
        },
    }
    if mine or acceptor or is_admin(viewer):
        out["accepted_by"] = (await _owner_card(db, post["acceptor_id"], cache))["name"] if post.get("acceptor_id") else None
    if ch is not None:
        out["needs_my_action"] = dc.view(ch, uid)["needs_my_action"] if dc.side_of(ch, uid) else False
        out["scheduled_at"] = ch.get("scheduled_at")
        out["match_venue"] = ch.get("venue", "")
    return out


def public_preview(post: dict, owner: dict) -> dict:
    """What a visitor who is not signed in may see. No venue, no notes, no last name."""
    first = (owner.get("name") or "A VENLAX player").split()[0]
    shown = owner.get("profile_public") is not False
    return {
        "id": str(post["_id"]), "owner_first_name": first, "avatar": owner.get("avatar") if shown else None,
        "sport": post["sport"], "format": post["format"], "min_level": post["min_level"], "max_level": post["max_level"],
        "city": post.get("city"), "date": post["date"], "time_window": post["time_window"],
        "available": post["status"] == "open" and post["expires_at"] > _now().isoformat(),
    }


# ── Browse and dashboard ──────────────────────────────────────────────────────

_PROX_ORDER = {"same_zip": 0, "same_city": 1, "other": 2}


async def browse(db, viewer: dict, f: dict) -> list:
    """Open challenges the viewer may accept: public, open, not expired, level fits, not blocked, not their own."""
    now = _now().isoformat()
    query: dict = {"status": "open", "visibility": "public", "expires_at": {"$gt": now}}
    for k in ("sport", "format", "date"):
        if f.get(k):
            query[k] = f[k]
    if f.get("zip_code"):
        query["zip_code"] = f["zip_code"].strip().upper()
    if f.get("city"):
        query["city"] = {"$regex": f"^{re.escape(f['city'].strip())}$", "$options": "i"}
    blocked = await blocked_ids(db, viewer["_id"])
    cache: dict = {}
    rows = []
    for p in await db.open_challenges.find(query).sort("date", 1).to_list(500):
        if p["owner_id"] == viewer["_id"] or p["owner_id"] in blocked:
            continue
        if eligibility_error(p, viewer):
            continue                                   # players only see what they are allowed to accept
        if f.get("time_window") and f["time_window"] != "any" and p["time_window"] not in (f["time_window"], "any"):
            continue
        if f.get("min_level") is not None and p["level"] < f["min_level"]:
            continue
        if f.get("max_level") is not None and p["level"] > f["max_level"]:
            continue
        if f.get("near") == "zip" and proximity(p, viewer) != "same_zip":
            continue
        if f.get("near") == "city" and proximity(p, viewer) == "other":
            continue
        rows.append(p)
    rows.sort(key=lambda p: (_PROX_ORDER[proximity(p, viewer)], p["date"]))
    return [await view(db, p, viewer, cache=cache) for p in rows[:cfg.SEARCH_LIMIT_MAX]]


async def mine(db, user: dict) -> dict:
    uid = user["_id"]
    posts = await db.open_challenges.find({"$or": [{"owner_id": uid}, {"acceptor_id": uid}]}).sort("updated_at", -1).to_list(300)
    ids = [str(p["_id"]) for p in posts]
    challenges = {c["open_id"]: c for c in await db.direct_challenges.find({"open_id": {"$in": ids}}).to_list(500)}
    cache: dict = {}
    out = {"published": [], "accepted": [], "completed": [], "expired": []}
    summary = {"active": 0, "pending_responses": 0, "upcoming": 0, "completed": 0, "expired": 0}
    for p in posts:
        ch = challenges.get(str(p["_id"]))
        v = await view(db, p, user, ch=ch, cache=cache)
        s = v["status"]
        if s in LIVE:
            if p["owner_id"] == uid:
                out["published"].append(v)
                summary["active"] += 1
        elif s in ("scheduling", "scheduled", "in_progress", "disputed"):
            out["accepted"].append(v)
            summary["active"] += 1
            summary["pending_responses"] += 1 if v.get("needs_my_action") else 0
            summary["upcoming"] += 1 if s == "scheduled" else 0
        elif s == "completed":
            out["completed"].append(v)
            summary["completed"] += 1
        else:                                          # expired, cancelled, closed, removed
            out["expired"].append(v)
            summary["expired"] += 1
    out["summary"] = summary
    return out
