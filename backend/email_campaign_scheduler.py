"""Weekly referral email campaign — registered users + waitlist, ongoing.

Runs every Monday 9am UTC via scheduler.py. Sends every registered user
(who hasn't opted out) and every waitlist entry a weekly nudge to refer
friends/family/co-players, highlighting the platform and the $5 referral
reward. No cap — this runs indefinitely, once per recipient per week.
"""
from datetime import datetime, timezone, timedelta
import logging

import email_service
from routes.referral_routes import generate_referral_code

logger = logging.getLogger(__name__)


async def send_weekly_campaign(db) -> None:
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()

    # ── Registered users ────────────────────────────────────────────────
    users = await db.users.find(
        {"email_notifications": {"$ne": False}},
        {"email": 1, "name": 1, "referral_code": 1},
    ).to_list(None)

    sent_users = 0
    for user in users:
        email = user.get("email")
        if not email:
            continue
        user_id = str(user["_id"])

        already_sent = await db.email_campaigns.find_one({
            "user_id": user_id,
            "campaign": "weekly_referral",
            "sent_at": {"$gte": week_ago},
        })
        if already_sent:
            continue

        ref_code = user.get("referral_code")
        if not ref_code:
            ref_code = generate_referral_code()
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"referral_code": ref_code}})

        try:
            await email_service.send_weekly_referral_nudge(email, user.get("name", "Player"), ref_code)
            await db.email_campaigns.insert_one({
                "user_id": user_id,
                "user_email": email,
                "campaign": "weekly_referral",
                "audience": "registered",
                "sent_at": now.isoformat(),
            })
            sent_users += 1
        except Exception:
            logger.exception("[CAMPAIGN] failed sending weekly referral nudge to %s", email)

    # ── Waitlist ─────────────────────────────────────────────────────────
    waitlist_entries = await db.waitlist.find({}, {"email": 1}).to_list(None)

    sent_waitlist = 0
    for entry in waitlist_entries:
        email = entry.get("email")
        if not email:
            continue
        entry_id = str(entry["_id"])

        already_sent = await db.email_campaigns.find_one({
            "user_id": entry_id,
            "campaign": "weekly_referral",
            "sent_at": {"$gte": week_ago},
        })
        if already_sent:
            continue

        try:
            await email_service.send_weekly_waitlist_nudge(email)
            await db.email_campaigns.insert_one({
                "user_id": entry_id,
                "user_email": email,
                "campaign": "weekly_referral",
                "audience": "waitlist",
                "sent_at": now.isoformat(),
            })
            sent_waitlist += 1
        except Exception:
            logger.exception("[CAMPAIGN] failed sending weekly waitlist nudge to %s", email)

    logger.info(
        "[CAMPAIGN] weekly_referral complete — %d registered users, %d waitlist entries",
        sent_users, sent_waitlist,
    )
