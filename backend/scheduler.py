"""APScheduler configuration for background jobs.

Seven jobs, all sharing the app's live db connection:
  - weekly_referral_campaign   every Monday 9:00 UTC
  - auto_status_transitions    daily 00:05 UTC
  - send_match_reminders       every hour
  - auto_forfeit_stale_matches daily 01:00 UTC
  - send_credit_expiry_reminders daily 10:00 UTC
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
import logging

import email_automation
import email_schedule
from email_campaign_scheduler import send_weekly_campaign
from scheduler_jobs import (
    auto_status_transitions,
    auto_open_leagues,
    schedule_housekeeping,
    send_match_reminders,
    auto_forfeit_stale_matches,
    send_credit_expiry_reminders,
    refund_unpaired_teams,
)

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
            auto_open_leagues,
            trigger=CronTrigger(hour=0, minute=10),
            args=[db],
            id="auto_open_leagues",
            name="Open leagues to play on their start date",
            replace_existing=True,
            max_instances=1,
        )
        scheduler.add_job(
            schedule_housekeeping,
            trigger=IntervalTrigger(hours=1),
            args=[db],
            id="schedule_housekeeping",
            name="Match scheduling housekeeping",
            replace_existing=True,
            max_instances=1,
        )
        scheduler.add_job(
            refund_unpaired_teams,
            trigger=CronTrigger(hour=0, minute=20),
            args=[db],
            id="refund_unpaired_teams",
            name="Refund Doubles Teams Without a Partner",
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
        scheduler.add_job(
            send_credit_expiry_reminders,
            trigger=CronTrigger(hour=10, minute=0),
            args=[db],
            id="send_credit_expiry_reminders",
            name="Credit Expiry Reminders",
            replace_existing=True,
            max_instances=1,
        )

        scheduler.add_job(
            email_schedule.run_due,
            trigger=IntervalTrigger(minutes=1),
            args=[db],
            id="run_scheduled_emails",
            name="Send scheduled marketing emails",
            replace_existing=True,
            max_instances=1,
        )

        scheduler.add_job(
            email_automation.run_pass,
            trigger=IntervalTrigger(minutes=10),
            args=[db],
            id="run_email_automations",
            name="Run email automation workflows",
            replace_existing=True,
            max_instances=1,
        )

        if not scheduler.running:
            scheduler.start()
            logger.info("Scheduler started — 10 background jobs registered")
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
