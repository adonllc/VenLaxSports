"""Challenge a person by email, whether or not they are registered.

The sender types an email address. If it belongs to a registered player the challenge goes to them as normal;
if not, they get an invitation email with a private link. Either way the sender sees the same "Challenge sent",
so the form can never be used to find out who has an account.

An invitation waits in `challenge_email_invites` (status waiting) until the person signs up or signs in with the
link, then becomes an ordinary direct challenge (see direct_challenge.py) that they accept or decline.
A claimed invitation from a brand-new account also records the usual pending $5 referral credit.

invite doc: sender_id, sender_name, email, kind ("email" | "user"), token, sport, format, partner_id, message,
            status (waiting | claimed | expired | cancelled), created_at, expires_at, reminded_at, resends,
            claimed_by, challenge_id
"""
from __future__ import annotations

import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId

import challenge_config as cfg
import direct_challenge as dc
import email_service
import notification_center
from direct_challenge import ChallengeError

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_REFERRAL_AMOUNT_FALLBACK = 5


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _frontend_url() -> str:
    return os.environ.get("FRONTEND_URL", "https://venlaxsports.com").rstrip("/")


def _api_url() -> str:
    return os.environ.get("API_PUBLIC_URL", "https://api.venlaxsports.com").rstrip("/")


def _join_link(token: str) -> str:
    return f"{_frontend_url()}/challenges/invite?token={token}"


def _unsub_link(token: str) -> str:
    return f"{_api_url()}/api/challenges/email-invites/unsubscribe?token={token}"


def _label(inv: dict) -> str:
    return f"{inv['sport'].title()} {inv['format']}"


# ── Sending ───────────────────────────────────────────────────────────────────

async def _send_email(db, inv: dict, reminder: bool = False) -> None:
    if await db.email_suppressions.find_one({"email": inv["email"]}):
        return                                           # they asked never to be emailed: say nothing, send nothing
    who = inv["sender_name"] or "A VenLax player"
    subject = f"{who} challenged you to a {_label(inv)} match" if not reminder else f"Reminder: {who}'s {_label(inv)} challenge is waiting"
    note = f'<p style="margin:12px 0;padding:10px 14px;background:#F1F1F1;border:1px solid #E5E7EB">"{_esc(inv["message"])}"</p>' if inv.get("message") else ""
    body = (f"<p><strong>{_esc(who)}</strong> challenged you to a {_label(inv)} match on VenLax Sports.</p>{note}"
            "<p>VenLax Sports is where tennis and pickleball players find opponents at their level, agree a time and keep score. "
            "Create a free account to accept the challenge. It takes about a minute, and you come straight back to it.</p>"
            f"<p style=\"color:#6b7280;font-size:13px\">The challenge is open for {cfg.EMAIL_INVITE_EXPIRY_DAYS} days.</p>")
    await email_service.send_campaign_email(
        inv["email"], subject, "You have been challenged", body, "Accept the challenge", _join_link(inv["token"]),
        _unsub_link(inv["token"]),
        reason=f"{_esc(who)} typed your email address to challenge you. We will not email you again unless you join.")


def _esc(s: str) -> str:
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


async def send(db, sender: dict, data: dict) -> dict:
    email = (data.get("email") or "").strip().lower()
    if not _EMAIL.match(email):
        raise ChallengeError(400, "Enter a valid email address")
    if email == (sender.get("email") or "").strip().lower():
        raise ChallengeError(400, "That is your own email address")
    sport, fmt = data.get("sport"), data.get("format") or "singles"
    if sport not in cfg.CHALLENGE_SPORTS:
        raise ChallengeError(400, "Challenges are open for tennis and pickleball")
    if fmt not in cfg.CHALLENGE_FORMATS:
        raise ChallengeError(400, "Choose singles or doubles")
    partner_id = data.get("partner_id") or None
    if fmt == "doubles" and not partner_id:
        raise ChallengeError(400, "Pick your partner for a doubles challenge")
    if fmt == "singles":
        partner_id = None
    now = _now()
    sid = sender["_id"]
    sent_today = await db.challenge_email_invites.count_documents({"sender_id": sid, "created_at": {"$gte": _iso(now - timedelta(hours=24))}})
    if sent_today >= cfg.EMAIL_INVITE_DAILY:
        raise ChallengeError(429, f"You can challenge {cfg.EMAIL_INVITE_DAILY} people by email a day. Try again tomorrow.")
    since = _iso(now - timedelta(days=cfg.EMAIL_INVITE_SAME_ADDRESS_DAYS))
    if await db.challenge_email_invites.find_one({"sender_id": sid, "email": email, "created_at": {"$gte": since}}):
        raise ChallengeError(409, f"You already challenged that address in the last {cfg.EMAIL_INVITE_SAME_ADDRESS_DAYS} days.")

    inv = {
        "_id": ObjectId(), "sender_id": sid, "sender_name": sender.get("name", ""), "email": email, "kind": "email",
        "token": secrets.token_urlsafe(18), "sport": sport, "format": fmt, "partner_id": partner_id,
        "message": (data.get("message") or "").strip()[:500], "status": "waiting",
        "created_at": _iso(now), "expires_at": _iso(now + timedelta(days=cfg.EMAIL_INVITE_EXPIRY_DAYS)),
        "reminded_at": None, "resends": 0, "claimed_by": None, "challenge_id": None,
    }
    existing = await db.users.find_one({"email": email})
    if dc._usable(existing):
        # A registered player: a normal challenge. Any problem (open challenge already, ...) is swallowed so that
        # the sender cannot tell this address has an account.
        inv["kind"] = "user"
        inv["status"] = "claimed"
        inv["claimed_by"] = str(existing["_id"])
        try:
            ch = await dc.create(db, sender, {"opponent_id": str(existing["_id"]), "sport": sport, "format": fmt,
                                              "partner_id": partner_id, "message": inv["message"]}, skip_limit=True)
            inv["challenge_id"] = str(ch["_id"])
        except ChallengeError:
            pass
        await db.challenge_email_invites.insert_one(inv)
        return inv
    await db.challenge_email_invites.insert_one(inv)
    email_service.schedule(_send_email(db, inv))
    return inv


# ── What a visitor sees, and claiming ─────────────────────────────────────────

async def _by_token(db, token: str):
    return await db.challenge_email_invites.find_one({"token": token or "", "kind": "email"}) if token else None


def preview(inv: dict | None) -> dict:
    if not inv:
        return {"valid": False, "reason": "This invitation link is not valid."}
    first = (inv["sender_name"] or "A VenLax player").split()[0]
    live = inv["status"] == "waiting" and inv["expires_at"] > _iso(_now())
    out = {"valid": True, "sender_first_name": first, "sport": inv["sport"], "format": inv["format"],
           "message": inv.get("message", ""), "status": inv["status"], "claimable": live, "expires_at": inv["expires_at"]}
    if not live:
        out["reason"] = {"claimed": "This challenge has already been taken up.", "cancelled": "The sender cancelled this challenge."}.get(
            inv["status"], "This challenge has expired.")
    return out


async def preview_by_token(db, token: str) -> dict:
    return preview(await _by_token(db, token))


async def _record_referral(db, inv: dict, user: dict) -> None:
    """A brand-new account that came in through a challenge counts as the sender's referral (pending, like any code)."""
    try:
        created = user.get("created_at")
        created = created.isoformat() if hasattr(created, "isoformat") else (str(created) if created else "")
        if not created or created < inv["created_at"]:
            return                                       # an existing account is not a new referral
        if await db.referral_credits.find_one({"referee_id": str(user["_id"]), "type": "referral"}):
            return
        sender = await db.users.find_one({"_id": ObjectId(inv["sender_id"])}) if ObjectId.is_valid(inv["sender_id"]) else None
        if not sender or str(sender["_id"]) == str(user["_id"]):
            return
        code = sender.get("referral_code")
        if not code:
            from routes.referral_routes import generate_referral_code
            code = generate_referral_code()
            await db.users.update_one({"_id": sender["_id"]}, {"$set": {"referral_code": code}})
        from models import ReferralCredit
        from referral_release import REFERRAL_CREDIT_AMOUNT
        credit = ReferralCredit(referrer_id=str(sender["_id"]), referee_id=str(user["_id"]), referral_code=code,
                                credit_amount=REFERRAL_CREDIT_AMOUNT, status="pending",
                                expires_at=(_now() + timedelta(days=365)).isoformat())
        await db.referral_credits.insert_one(credit.to_mongo())
    except Exception:
        import logging
        logging.getLogger(__name__).exception("challenge referral not recorded: invite=%s", inv.get("_id"))


async def claim(db, user: dict, token: str) -> dict:
    """The invited person is signed in: turn the waiting invitation into a real challenge to them."""
    inv = await _by_token(db, token)
    if not inv:
        raise ChallengeError(404, "This invitation link is not valid")
    if inv["status"] == "claimed" and inv.get("claimed_by") == user["_id"] and inv.get("challenge_id"):
        return inv                                       # opened twice: same result
    if inv["status"] == "cancelled":
        raise ChallengeError(410, "The sender cancelled this challenge")
    if inv["status"] != "waiting" or inv["expires_at"] <= _iso(_now()):
        raise ChallengeError(410, "This challenge has expired or was already taken up")
    if inv["sender_id"] == user["_id"]:
        raise ChallengeError(400, "This is your own challenge")
    sender = await db.users.find_one({"_id": ObjectId(inv["sender_id"])}) if ObjectId.is_valid(inv["sender_id"]) else None
    if not dc._usable(sender):
        raise ChallengeError(410, "The player who sent this challenge is no longer on VenLax")
    sender = {**sender, "_id": str(sender["_id"])}
    # Claimed first, so two quick opens cannot create two challenges.
    won = await db.challenge_email_invites.find_one_and_update(
        {"_id": inv["_id"], "status": "waiting"}, {"$set": {"status": "claimed", "claimed_by": user["_id"]}})
    if not won:
        raise ChallengeError(409, "This challenge was just taken up")
    try:
        ch = await dc.create(db, sender, {"opponent_id": user["_id"], "sport": inv["sport"], "format": inv["format"],
                                          "partner_id": inv.get("partner_id"), "message": inv.get("message", "")}, skip_limit=True)
    except Exception:
        await db.challenge_email_invites.update_one({"_id": inv["_id"]}, {"$set": {"status": "waiting", "claimed_by": None}})
        raise
    await db.challenge_email_invites.update_one({"_id": inv["_id"]}, {"$set": {"challenge_id": str(ch["_id"])}})
    inv.update({"status": "claimed", "claimed_by": user["_id"], "challenge_id": str(ch["_id"])})
    await _record_referral(db, inv, user)
    await notification_center.notify(
        db, [inv["sender_id"]], "challenge_invite_claimed", f"{user.get('name', 'Your opponent')} joined VenLax and got your challenge",
        "They can now accept it.", f"/challenges/{ch['_id']}", str(ch["_id"]))
    return inv


async def attach_for_user(db, user: dict) -> int:
    """After a verified sign-up: waiting invitations addressed to this email attach themselves, link or no link."""
    email = (user.get("email") or "").strip().lower()
    if not email:
        return 0
    n = 0
    for inv in await db.challenge_email_invites.find({"email": email, "kind": "email", "status": "waiting"}).to_list(20):
        try:
            await claim(db, {**user, "_id": str(user["_id"])}, inv["token"])
            n += 1
        except ChallengeError:
            continue
    return n


# ── Sender's list, resend, cancel ─────────────────────────────────────────────

def view(inv: dict) -> dict:
    return {
        "id": str(inv["_id"]), "email": inv["email"], "sport": inv["sport"], "format": inv["format"],
        "message": inv.get("message", ""), "status": "waiting_to_join", "created_at": inv["created_at"],
        "expires_at": inv["expires_at"], "can_resend": inv.get("resends", 0) < cfg.EMAIL_INVITE_MAX_RESENDS,
    }


async def list_waiting(db, sender: dict) -> list:
    rows = await db.challenge_email_invites.find(
        {"sender_id": sender["_id"], "kind": "email", "status": "waiting"}).sort("created_at", -1).to_list(100)
    return [view(r) for r in rows if r["expires_at"] > _iso(_now())]


async def _own(db, sender: dict, invite_id: str) -> dict:
    inv = await db.challenge_email_invites.find_one({"_id": ObjectId(invite_id)}) if ObjectId.is_valid(invite_id) else None
    if not inv or inv["sender_id"] != sender["_id"] or inv["kind"] != "email":
        raise ChallengeError(404, "Invitation not found")
    return inv


async def cancel(db, sender: dict, invite_id: str) -> None:
    inv = await _own(db, sender, invite_id)
    if inv["status"] != "waiting":
        raise ChallengeError(409, "This challenge is no longer waiting")
    await db.challenge_email_invites.update_one({"_id": inv["_id"]}, {"$set": {"status": "cancelled"}})


async def resend(db, sender: dict, invite_id: str) -> dict:
    inv = await _own(db, sender, invite_id)
    if inv["status"] != "waiting" or inv["expires_at"] <= _iso(_now()):
        raise ChallengeError(409, "This challenge is no longer waiting")
    if inv.get("resends", 0) >= cfg.EMAIL_INVITE_MAX_RESENDS:
        raise ChallengeError(409, "You can resend an invitation once")
    await db.challenge_email_invites.update_one({"_id": inv["_id"]}, {"$set": {"resends": inv.get("resends", 0) + 1}})
    inv["resends"] = inv.get("resends", 0) + 1
    email_service.schedule(_send_email(db, inv, reminder=True))
    return inv


async def unsubscribe(db, token: str) -> bool:
    """One click from the email: never email this address again about challenges, and drop what is waiting."""
    inv = await _by_token(db, token)
    if not inv:
        return False
    if not await db.email_suppressions.find_one({"email": inv["email"]}):
        await db.email_suppressions.insert_one({"email": inv["email"], "at": _iso(_now()), "source": "challenge_invite"})
    await db.challenge_email_invites.update_many({"email": inv["email"], "status": "waiting"}, {"$set": {"status": "cancelled"}})
    return True


# ── Scheduler: one reminder, then expiry ──────────────────────────────────────

async def process(db, now: datetime | None = None) -> dict:
    now = now or _now()
    expired = reminded = 0
    for inv in await db.challenge_email_invites.find({"kind": "email", "status": "waiting"}).to_list(2000):
        if inv["expires_at"] <= _iso(now):
            await db.challenge_email_invites.update_one({"_id": inv["_id"]}, {"$set": {"status": "expired"}})
            await notification_center.notify(
                db, [inv["sender_id"]], "challenge_invite_expired", f"Your challenge to {inv['email']} expired",
                "They did not sign up in time. You can send a new one.", "/challenges?tab=sent", str(inv["_id"]), email=False)
            expired += 1
        elif not inv.get("reminded_at") and inv["created_at"] <= _iso(now - timedelta(days=cfg.EMAIL_INVITE_REMIND_DAYS)):
            await db.challenge_email_invites.update_one({"_id": inv["_id"]}, {"$set": {"reminded_at": _iso(now)}})
            email_service.schedule(_send_email(db, inv, reminder=True))
            reminded += 1
    return {"expired": expired, "reminded": reminded}
