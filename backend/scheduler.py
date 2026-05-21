"""APScheduler setup for VENLAX Sports background jobs."""
from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

_scheduler = AsyncIOScheduler(timezone="UTC")


def start(db) -> None:
    from scheduler_jobs import (
        auto_status_transitions,
        send_match_reminders,
        auto_forfeit_stale_matches,
    )
    _scheduler.add_job(
        auto_status_transitions,
        CronTrigger(hour=0, minute=5),
        args=[db],
        id="status_transitions",
        replace_existing=True,
    )
    _scheduler.add_job(
        send_match_reminders,
        IntervalTrigger(hours=1),
        args=[db],
        id="match_reminders",
        replace_existing=True,
    )
    _scheduler.add_job(
        auto_forfeit_stale_matches,
        CronTrigger(hour=1, minute=0),
        args=[db],
        id="auto_forfeit",
        replace_existing=True,
    )
    _scheduler.start()


def stop() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
