"""APScheduler configuration for background jobs.

Four jobs, all sharing the app's live db connection:
  - weekly_referral_campaign   every Monday 9:00 UTC
  - auto_status_transitions    daily 00:05 UTC
  - send_match_reminders       every hour
  - auto_forfeit_stale_matches daily 01:00 UTC
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
import logging

from email_campaign_scheduler import send_weekly_campaign
from scheduler_jobs import auto_status_transitions, send_match_reminders, auto_forfeit_stale_matches

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def start_scheduler(db):
    """Register and start all background jobs against the given db connection."""
    try:
        scheduler.add_job(
            send_weekly_campaign,
            trigger=CronTrigger(day_of_week=0, hour=9, minute=0),
            args=[db],
            id="weekly_referral_campaign",
            name="Weekly Referral Campaign",
            replace_existing=True,
            max_instances=1,
        )
        scheduler.add_job(
            auto_status_transitions,
            trigger=CronTrigger(hour=0, minute=5),
            args=[db],
            id="auto_status_transitions",
            name="League Status Auto-Transitions",
            replace_existing=True,
            max_instances=1,
        )
        scheduler.add_job(
            send_match_reminders,
            trigger=IntervalTrigger(hours=1),
            args=[db],
            id="send_match_reminders",
            name="Match Reminders (24h out)",
            replace_existing=True,
            max_instances=1,
        )
        scheduler.add_job(
            auto_forfeit_stale_matches,
            trigger=CronTrigger(hour=1, minute=0),
            args=[db],
            id="auto_forfeit_stale_matches",
            name="Auto-Forfeit Stale Matches",
            replace_existing=True,
            max_instances=1,
        )

        if not scheduler.running:
            scheduler.start()
            logger.info("Scheduler started — 4 background jobs registered")
        else:
            logger.info("Scheduler already running")

    except Exception:
        logger.exception("Error starting scheduler")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


async def trigger_campaign_now(db):
    """Manually trigger the weekly referral campaign (for testing)."""
    logger.info("Manually triggering weekly referral campaign...")
    await send_weekly_campaign(db)
    logger.info("Campaign completed")
