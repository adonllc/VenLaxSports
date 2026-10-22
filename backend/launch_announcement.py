"""One-time "VenLax Sports is live" announcement to the waitlist.

Recipients: every waitlist entry that has not unsubscribed and has no registered account yet
(someone who already has an account does not need a "sign up" email).
The waitlist stores no names, so the email opens with "Hi there,". Each person is emailed at most once (recorded in email_campaigns).
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

import jwt as pyjwt

import email_service
from auth_utils import JWT_ALGORITHM, get_jwt_secret

logger = logging.getLogger(__name__)

CAMPAIGN = "launch_announcement"
UNSUB_TYPE = "waitlist_unsub"


def make_unsub_token(waitlist_id: str) -> str:
    return pyjwt.encode({"sub": waitlist_id, "type": UNSUB_TYPE}, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_unsub_token(token: str) -> str | None:
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except pyjwt.InvalidTokenError:
        return None
    return payload.get("sub") if payload.get("type") == UNSUB_TYPE else None


def unsub_url(waitlist_id: str) -> str:
    base = os.environ.get("API_PUBLIC_URL", "https://api.venlaxsports.com").rstrip("/")
    return f"{base}/api/waitlist/unsubscribe?token={make_unsub_token(waitlist_id)}"


async def build_recipients(db) -> dict:
    """Return {"send": [...], "skipped_registered": n, "skipped_unsubscribed": n, "skipped_already_sent": n}."""
    send, reg, unsub, done = [], 0, 0, 0
    entries = await db.waitlist.find({}).sort("created_at", 1).to_list(None)
    for e in entries:
        email = (e.get("email") or "").strip().lower()
        if not email:
            continue
        wid = str(e["_id"])
        if e.get("unsubscribed_at"):
            unsub += 1
            continue
        if await db.email_campaigns.find_one({"user_id": wid, "campaign": CAMPAIGN}):
            done += 1
            continue
        user = await db.users.find_one({"email": email}, {"name": 1})
        if user:
            reg += 1  # already signed up; the "sign up" email would only confuse them
            continue
        send.append({"id": wid, "email": email, "first_name": ""})
    return {"send": send, "skipped_registered": reg, "skipped_unsubscribed": unsub, "skipped_already_sent": done}


async def send_one(db, rec: dict) -> bool:
    ok = await email_service.send_launch_announcement(rec["email"], rec["first_name"], unsub_url(rec["id"]))
    if ok:
        await db.email_campaigns.insert_one({
            "user_id": rec["id"], "user_email": rec["email"], "campaign": CAMPAIGN,
            "audience": "waitlist", "sent_at": datetime.now(timezone.utc).isoformat(),
        })
    return bool(ok)
