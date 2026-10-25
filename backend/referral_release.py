"""Referral credit lifecycle.

  signup with a code ──▶ credit row written as "pending"   (no balance changes)
                                │
        referred player's first CONFIRMED match (not a forfeit)
                                │
                                ▼
  release_pending_referral_credit ──▶ status "applied", both balances credited,
                                      tier bonus checked for the referrer

Why: crediting at signup let throwaway accounts earn money. Credit now only moves once a real
player has played a real match. The pending -> applied flip is one atomic update, so a double
submit (or two matches confirmed at once) pays a credit exactly once.
"""
import logging
from datetime import datetime, timedelta, timezone

from bson import ObjectId

import email_service

logger = logging.getLogger(__name__)

REFERRAL_CREDIT_AMOUNT = 5.0
TIER_BONUS_EVERY = 3
TIER_BONUS_AMOUNT = 10.0
CREDIT_VALID_DAYS = 365


async def release_pending_referral_credit(db, user_id: str) -> int:
    """Release every pending credit where `user_id` is the referred player. Returns how many were released."""
    try:
        oid = ObjectId(user_id)
    except Exception:
        return 0

    referee = await db.users.find_one({"_id": oid})
    if not referee or not referee.get("email_verified"):
        return 0  # stays pending until the email is verified and a later match completes

    released = 0
    pending = await db.referral_credits.find(
        {"referee_id": user_id, "status": "pending", "type": "referral"}
    ).to_list(20)

    for credit in pending:
        now = datetime.now(timezone.utc)
        expires_at = (now + timedelta(days=CREDIT_VALID_DAYS)).isoformat()
        # Atomic claim: only one caller gets the document back, everyone else gets None.
        claimed = await db.referral_credits.find_one_and_update(
            {"_id": credit["_id"], "status": "pending"},
            {"$set": {"status": "applied", "applied_at": now.isoformat(), "expires_at": expires_at}},
        )
        if not claimed:
            continue

        amount = claimed.get("credit_amount", REFERRAL_CREDIT_AMOUNT)
        referrer_id = claimed["referrer_id"]
        for uid in (referrer_id, user_id):
            await db.users.update_one(
                {"_id": ObjectId(uid)},
                {"$inc": {"credits_balance": amount}, "$set": {"credits_expiry": expires_at}},
            )
        released += 1
        logger.info("referral credit released referrer=%s referee=%s amount=%s", referrer_id, user_id, amount)

        await _maybe_pay_tier_bonus(db, referrer_id, claimed["referral_code"], expires_at, now)

    return released


async def _maybe_pay_tier_bonus(db, referrer_id: str, code: str, expires_at: str, now: datetime) -> None:
    """Every Nth RELEASED referral earns the referrer a bonus (counting released credits, not signups)."""
    applied = await db.referral_credits.count_documents(
        {"referrer_id": referrer_id, "status": "applied", "type": "referral"}
    )
    if applied == 0 or applied % TIER_BONUS_EVERY != 0:
        return
    await db.referral_credits.insert_one({
        "referrer_id": referrer_id,
        "referee_id": None,
        "referral_code": code,
        "credit_amount": TIER_BONUS_AMOUNT,
        "type": "tier_bonus",
        "status": "applied",
        "applied_at": now.isoformat(),
        "expires_at": expires_at,
        "created_at": now.isoformat(),
    })
    await db.users.update_one({"_id": ObjectId(referrer_id)}, {"$inc": {"credits_balance": TIER_BONUS_AMOUNT}})
    referrer = await db.users.find_one({"_id": ObjectId(referrer_id)})
    if referrer and referrer.get("email"):
        email_service.schedule(email_service.send_referral_tier_bonus(
            referrer["email"], referrer.get("name", "Player"), applied, TIER_BONUS_AMOUNT, TIER_BONUS_EVERY
        ))
