"""Runs queued marketing sends when they are due (called every minute by the scheduler).

The audience is rebuilt at send time, so anyone who unsubscribed, was suspended or already got the email since the
admin queued it is left out. If the audience has grown well past the count the admin confirmed, the send is held as
`needs_review` instead of going out to people the admin never saw counted.
"""
import logging
from datetime import datetime, timezone

import bulk_email

logger = logging.getLogger(__name__)

GROWTH_FACTOR = 1.25
GROWTH_SLACK = 10


def allowed_count(confirmed: int) -> int:
    return int(confirmed * GROWTH_FACTOR) + GROWTH_SLACK


async def run_due(db, now: datetime | None = None, delay: float = 0.5) -> int:
    """Start every due scheduled send. Returns how many were started."""
    now = now or datetime.now(timezone.utc)
    due = await db.scheduled_emails.find({"status": "scheduled", "run_at": {"$lte": now}}).to_list(20)
    started = 0
    for doc in due:
        # claim it first: if another worker already did, matched_count is 0 and we skip
        claim = await db.scheduled_emails.update_one({"_id": doc["_id"], "status": "scheduled"}, {"$set": {"status": "sending"}})
        if not claim.matched_count:
            continue
        try:
            audience = await bulk_email.build_audience(db, doc["payload"])
            people = audience["send"]
            if not people:
                await db.scheduled_emails.update_one({"_id": doc["_id"]}, {"$set": {"status": "nobody_left", "finished_at": now}})
            elif len(people) > bulk_email.MAX_RECIPIENTS or len(people) > allowed_count(doc.get("confirm_count", 0)):
                await db.scheduled_emails.update_one({"_id": doc["_id"]}, {"$set": {
                    "status": "needs_review", "held_reason": f"The audience is now {len(people)} people, you confirmed {doc.get('confirm_count', 0)}."}})
            else:
                job_id, _ = await bulk_email.launch(db, doc["payload"], people, doc.get("created_by", ""), delay=delay, scheduled_id=doc["_id"])
                await db.scheduled_emails.update_one({"_id": doc["_id"]}, {"$set": {
                    "status": "sent", "job_id": str(job_id), "recipients": len(people), "finished_at": now}})
                started += 1
        except Exception:  # noqa: BLE001
            logger.exception("scheduled email %s failed to start", doc.get("_id"))
            await db.scheduled_emails.update_one({"_id": doc["_id"]}, {"$set": {"status": "failed"}})
    return started
