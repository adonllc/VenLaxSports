"""One-shot pricing normalization migration.

Standardize entry_fee on all USA tennis/pickleball leagues:
  singles → 9.99 USD
  doubles → 19.99 USD
  mixed   → 19.99 USD

Idempotent — only updates leagues whose fee differs from the new tier.
"""
import logging
from pricing_config import fee_for_format

logger = logging.getLogger(__name__)


async def normalize_pricing(db) -> None:
    cursor = db.leagues.find({"sport": {"$in": ["tennis", "pickleball"]}, "country": "USA"})
    updated = 0
    async for l in cursor:
        new_fee = fee_for_format(l.get("format", "singles"))
        if abs(float(l.get("entry_fee", 0)) - new_fee) > 0.001:
            await db.leagues.update_one(
                {"_id": l["_id"]},
                {"$set": {"entry_fee": new_fee, "currency": "USD"}},
            )
            updated += 1
    if updated:
        logger.info(f"Normalized pricing on {updated} existing leagues")
