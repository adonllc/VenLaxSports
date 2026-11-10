"""VenLax Credit: a per-player balance that never expires and pays for any league entry.

Kept separate from referral credit (users.credits_balance, 12-month expiry). The balance lives on
users.venlax_credit; every change also writes a credit_ledger row so the player can see where it came from.
Grants carry a unique `ref`, so a retry or a second job run never pays the same credit twice.
"""
from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId


def _cents(x) -> float:
    return round(float(x or 0), 2)


async def balance(db, user_id: str) -> float:
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"venlax_credit": 1})
    return _cents((user or {}).get("venlax_credit"))


async def grant(db, user_id: str, amount: float, reason: str, ref: str, league_id: str | None = None) -> float | None:
    """Add credit. Returns the new balance, or None when this `ref` was already granted (no change)."""
    amount = _cents(amount)
    if amount <= 0:
        raise ValueError("Credit amount must be positive")
    if await db.credit_ledger.find_one({"ref": ref}):
        return None
    updated = await db.users.find_one_and_update(
        {"_id": ObjectId(user_id)}, {"$inc": {"venlax_credit": amount}}, return_document=True)
    if not updated:
        raise ValueError("Player not found")
    new_balance = _cents(updated.get("venlax_credit"))
    await db.credit_ledger.insert_one({
        "user_id": user_id, "amount": amount, "balance_after": new_balance, "reason": reason,
        "ref": ref, "league_id": league_id, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return new_balance


async def spend(db, user_id: str, amount: float, reason: str, ref: str, league_id: str | None = None) -> float | None:
    """Use credit. Returns the new balance, or None when the balance is too low or `ref` was already spent."""
    amount = _cents(amount)
    if amount <= 0:
        raise ValueError("Credit amount must be positive")
    if await db.credit_ledger.find_one({"ref": ref}):
        return None
    updated = await db.users.find_one_and_update(
        {"_id": ObjectId(user_id), "venlax_credit": {"$gte": amount}},
        {"$inc": {"venlax_credit": -amount}}, return_document=True)
    if not updated:
        return None
    new_balance = _cents(updated.get("venlax_credit"))
    await db.credit_ledger.insert_one({
        "user_id": user_id, "amount": -amount, "balance_after": new_balance, "reason": reason,
        "ref": ref, "league_id": league_id, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return new_balance


async def history(db, user_id: str, limit: int = 50) -> list[dict]:
    rows = await db.credit_ledger.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return rows


def split_payment(due: float, available: float) -> tuple[float, float]:
    """(credit used, left to pay by card or Zelle). Credit is used first."""
    due, available = _cents(due), _cents(available)
    used = min(due, available)
    return _cents(used), _cents(due - used)
