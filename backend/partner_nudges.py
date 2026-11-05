"""Reminders for doubles players who still have no partner.

A waiting team is a doubles_invites row in WAITING status with no partner. The scheduled job nudges each one
7 days and 2 days before the league starts (once each); an admin can also send one by hand.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from bson import ObjectId

import email_service
from partner_assignment import WAITING
from scheduler_jobs import is_job_enabled

logger = logging.getLogger(__name__)

FIRST_NUDGE_DAYS = 7
LAST_NUDGE_DAYS = 2


def days_until_start(league: dict, now: datetime):
    """Whole days from today (UTC) to the league start, or None without a usable start date."""
    start = str(league.get("start_date") or "")[:10]
    try:
        return (datetime.fromisoformat(start).date() - now.date()).days
    except ValueError:
        return None


async def send_nudge(db, invite: dict, league: dict, now: datetime) -> bool:
    """Email the initiator of a waiting team. Returns False when there is nobody to email."""
    try:
        user = await db.users.find_one({"_id": ObjectId(invite["initiator_id"])})
    except Exception:
        user = None
    if not user or not user.get("email"):
        return False
    days = days_until_start(league, now)
    email_service.schedule(email_service.send_partner_nudge(
        user["email"], user.get("name", ""), league.get("name", "the league"), league.get("start_date", ""),
        max(days, 0) if days is not None else None, bool(invite.get("auto_assign_opt_in")),
    ))
    return True


async def nudge_waiting_teams(db, now: datetime | None = None) -> int:
    """Daily job: send the 7-day and 2-day reminders. Off until an admin turns it on. Returns how many were sent."""
    if not await is_job_enabled(db, "nudge_waiting_partners", default=False):
        return 0
    now = now or datetime.now(timezone.utc)
    invites = await db.doubles_invites.find({"status": {"$in": list(WAITING)}}).to_list(1000)
    sent = 0
    for inv in invites:
        if inv.get("partner_user_id"):
            continue
        try:
            league = await db.leagues.find_one({"_id": ObjectId(inv["league_id"])})
        except Exception:
            league = None
        if not league or league.get("status") != "registration":
            continue
        days = days_until_start(league, now)
        if days is None or days < 0 or days > FIRST_NUDGE_DAYS:
            continue
        last = days <= LAST_NUDGE_DAYS
        if last and inv.get("nudge_2_sent_at"):
            continue
        if not last and inv.get("nudge_7_sent_at"):
            continue
        try:
            if not await send_nudge(db, inv, league, now):
                continue
        except Exception as exc:  # noqa: BLE001
            logger.warning("nudge_waiting_teams failed for team %s: %s", str(inv.get("token", ""))[-6:], exc)
            continue
        stamp = now.isoformat()
        fields = {"nudge_2_sent_at": stamp, "nudge_7_sent_at": inv.get("nudge_7_sent_at") or stamp} if last \
            else {"nudge_7_sent_at": stamp}
        await db.doubles_invites.update_one({"token": inv["token"]}, {"$set": fields})
        sent += 1
    if sent:
        logger.info("nudge_waiting_teams: sent %d reminders", sent)
    return sent
