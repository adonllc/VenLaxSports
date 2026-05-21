"""Background scheduler jobs for VENLAX Sports.

Three jobs registered in scheduler.py:
  - auto_status_transitions  daily 00:05 UTC
  - send_match_reminders     every hour
  - auto_forfeit_stale_matches daily 01:00 UTC
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)


async def auto_status_transitions(db) -> None:
    """Flip league status: upcoming→active on start_date, active→completed on end_date."""
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()

    result = await db.leagues.update_many(
        {"status": "upcoming", "start_date": {"$lte": today}},
        {"$set": {"status": "active", "activated_at": now.isoformat()}},
    )
    if result.modified_count:
        logger.info("auto_status_transitions: %d leagues → active", result.modified_count)

    result = await db.leagues.update_many(
        {"status": "active", "end_date": {"$lt": today}},
        {"$set": {"status": "completed", "completed_at": now.isoformat()}},
    )
    if result.modified_count:
        logger.info("auto_status_transitions: %d leagues → completed", result.modified_count)


async def send_match_reminders(db) -> None:
    """Send email + WA reminder for matches starting in ~24 h (window: 23–25 h out).

    Sets reminder_sent=True on each match so the job is idempotent across hourly runs.
    """
    import email_service

    now = datetime.now(timezone.utc)
    window_start = (now + timedelta(hours=23)).isoformat()
    window_end = (now + timedelta(hours=25)).isoformat()

    matches = await db.matches.find({
        "status": "scheduled",
        "scheduled_date": {"$gte": window_start, "$lte": window_end},
        "reminder_sent": {"$ne": True},
    }).to_list(500)

    reminded = 0
    for match in matches:
        pairs = [
            (match.get("player1_id"), match.get("player1_name"), match.get("player2_name")),
            (match.get("player2_id"), match.get("player2_name"), match.get("player1_name")),
        ]

        for pid, pname, oname in pairs:
            if not pid or not pname:
                continue
            try:
                from bson import ObjectId
                player = await db.users.find_one({"_id": ObjectId(pid)})
                if player and player.get("email") and player.get("email_notifications", True):
                    email_service.schedule(email_service.send_generic(
                        player["email"],
                        f"Match Reminder: {pname} vs {oname} — tomorrow",
                        f"Hi {pname},\n\n"
                        f"Reminder: your match against {oname} is scheduled for "
                        f"{match.get('scheduled_date', 'tomorrow')}.\n\n"
                        f"Log in to submit your score after the match.\n\n"
                        f"Good luck!\n— VENLAX Sports",
                    ))
            except Exception as exc:
                logger.warning("Reminder email failed for player %s: %s", pid, exc)

        try:
            from whatsapp_service import schedule_wa, is_configured
            if is_configured():
                from bson import ObjectId
                for pid, pname, oname in pairs:
                    if not pid:
                        continue
                    player_doc = await db.users.find_one({"_id": ObjectId(pid)}, {"phone": 1})
                    if player_doc and player_doc.get("phone"):
                        schedule_wa(
                            player_doc["phone"],
                            f"Hi {pname}! Reminder: match vs {oname} is tomorrow on VENLAX Sports. "
                            f"Submit your score after playing. Good luck! — VENLAX Sports",
                        )
        except Exception as exc:
            logger.warning("WA reminder failed: %s", exc)

        await db.matches.update_one(
            {"_id": match["_id"]},
            {"$set": {"reminder_sent": True}},
        )
        reminded += 1

    if reminded:
        logger.info("send_match_reminders: reminded %d matches", reminded)


async def auto_forfeit_stale_matches(db) -> None:
    """Mark matches with no score submitted STALE_DAYS past scheduled_date as 'walkover'.

    Runs daily. If the match is part of a round-robin, also checks for playoff triggers.
    """
    STALE_DAYS = 7
    cutoff = (datetime.now(timezone.utc) - timedelta(days=STALE_DAYS)).isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    matches = await db.matches.find({
        "status": "scheduled",
        "scheduled_date": {"$lt": cutoff},
    }).to_list(500)

    forfeited = 0
    for match in matches:
        await db.matches.update_one(
            {"_id": match["_id"]},
            {"$set": {
                "status": "walkover",
                "walkover_reason": "no_score_submitted",
                "updated_at": now_iso,
            }},
        )
        forfeited += 1

        if match.get("is_rr") and match.get("league_id"):
            try:
                from routes.round_robin_routes import _run_check_playoffs
                await _run_check_playoffs(db, match["league_id"])
            except Exception as exc:
                logger.warning("Playoff check after walkover failed for league %s: %s",
                               match.get("league_id"), exc)

    if forfeited:
        logger.info("auto_forfeit_stale_matches: marked %d matches as walkover", forfeited)
