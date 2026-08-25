"""APScheduler configuration for weekly email campaigns"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import asyncio
from email_campaign_scheduler import send_weekly_campaign
import logging

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

def start_scheduler():
    """Start scheduler for weekly campaign (every Monday 9am UTC)"""
    try:
        # Schedule weekly email campaign: every Monday 9:00 AM UTC
        scheduler.add_job(
            send_weekly_campaign,
            trigger=CronTrigger(day_of_week=0, hour=9, minute=0),
            id="weekly_email_campaign",
            name="Weekly Email Campaign (Feedback + Referral)",
            replace_existing=True,
            max_instances=1
        )

        if not scheduler.running:
            scheduler.start()
            logger.info("✅ Scheduler started - weekly email campaign enabled")
        else:
            logger.info("✅ Scheduler already running")

    except Exception as e:
        logger.error(f"❌ Error starting scheduler: {str(e)}")

def stop_scheduler():
    """Stop scheduler"""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("✅ Scheduler stopped")

async def trigger_campaign_now():
    """Manually trigger the campaign (for testing)"""
    logger.info("🔔 Manually triggering weekly campaign...")
    await send_weekly_campaign()
    logger.info("✅ Campaign completed")
