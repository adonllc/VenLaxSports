"""Doubles players who paid but never got a partner by the league's start date.

The daily job offers them a choice (offer_refund). The player picks:
  - VenLax Credit: added to their balance at once, never expires, pays for any league
  - Card refund: sent back to the card through Stripe; the bank sets the timeline (usually a few business days)
Anything not chosen within AUTO_CREDIT_DAYS becomes VenLax Credit. A payment made with credit always goes back as credit.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from bson import ObjectId

import email_service
import venlax_credit

logger = logging.getLogger(__name__)

AUTO_CREDIT_DAYS = 7


def _stripe_refund(session_id: str, idempotency_key: str) -> str:
    from scheduler_jobs import _stripe_refund as refund
    return refund(session_id, idempotency_key)


async def _payment(db, invite: dict):
    """(total paid, part that went through Stripe and can go back to the card, Stripe session id)."""
    txn = await db.payment_transactions.find_one({"metadata.invite_token": invite["token"], "payment_status": "paid"}) or {}
    stripe_part = float(txn.get("amount") or 0)
    credit_part = float((txn.get("metadata") or {}).get("credit_applied") or 0)
    total = float(invite.get("paid_amount") or 0) or round(stripe_part + credit_part, 2)
    sid = str(txn.get("session_id", ""))
    card = stripe_part if sid.startswith("cs_") else 0.0
    return round(total, 2), round(card, 2), sid


async def offer_refund(db, invite: dict, league: dict, now: datetime) -> bool:
    """Move a paid, unpaired invite to 'refund_choice' and tell the player. False when there is nothing to refund."""
    total, card, _ = await _payment(db, invite)
    if total <= 0:
        return False
    claimed = await db.doubles_invites.find_one_and_update(
        {"token": invite["token"], "status": "initiator_paid"},
        {"$set": {"status": "refund_choice", "refund_amount": total, "card_refundable": card,
                  "refund_offered_at": now.isoformat()}})
    if not claimed:
        return False
    user = await db.users.find_one({"_id": ObjectId(invite["initiator_id"])}, {"email": 1, "name": 1})
    if user and user.get("email"):
        email_service.schedule(email_service.send_refund_choice(
            user["email"], user.get("name", ""), league.get("name", "the league"), total, card > 0))
    return True


async def choose(db, token: str, user_id: str, method: str) -> dict:
    """Carry out the player's choice. Raises ValueError(message) when it is not allowed."""
    if method not in ("credit", "card"):
        raise ValueError("Choose VenLax Credit or a card refund")
    invite = await db.doubles_invites.find_one({"token": token})
    if not invite or invite.get("initiator_id") != user_id:
        raise ValueError("Refund not found")
    if invite.get("status") != "refund_choice":
        raise ValueError("This refund was already handled")
    total = float(invite.get("refund_amount") or 0)
    card = float(invite.get("card_refundable") or 0)
    if method == "card" and card <= 0:
        raise ValueError("This payment can only be returned as VenLax Credit")

    claimed = await db.doubles_invites.find_one_and_update(
        {"token": token, "status": "refund_choice"}, {"$set": {"status": "refund_processing"}})
    if not claimed:
        raise ValueError("This refund was already handled")
    now = datetime.now(timezone.utc).isoformat()
    try:
        league = await db.leagues.find_one({"_id": ObjectId(invite["league_id"])}) or {}
        league_name = league.get("name", "the league")
        if method == "card":
            _, _, sid = await _payment(db, invite)
            refund_id = _stripe_refund(sid, f"unpaired-team-{token}")
            await db.payment_transactions.update_one({"session_id": sid}, {"$set": {"refunded": True, "refunded_at": now, "refund_id": refund_id}})
            credit_part = round(total - card, 2)
            if credit_part > 0:   # the part paid with credit goes back as credit
                await venlax_credit.grant(db, user_id, credit_part, f"Refund: {league_name}", ref=f"refund:{token}", league_id=invite["league_id"])
            outcome = {"status": "refunded", "refund_id": refund_id, "refunded_at": now}
        else:
            await venlax_credit.grant(db, user_id, total, f"Refund: {league_name}", ref=f"refund:{token}", league_id=invite["league_id"])
            outcome = {"status": "credited", "credited_at": now}
    except Exception:
        await db.doubles_invites.update_one({"token": token}, {"$set": {"status": "refund_choice"}})
        raise
    await db.doubles_invites.update_one({"token": token}, {"$set": outcome})
    return {"method": method, "amount": total, "card_amount": card if method == "card" else 0.0}


async def auto_credit_overdue(db, now: datetime) -> int:
    """Players who did not choose within AUTO_CREDIT_DAYS get VenLax Credit. Returns how many."""
    cutoff = (now - timedelta(days=AUTO_CREDIT_DAYS)).isoformat()
    waiting = await db.doubles_invites.find({"status": "refund_choice", "refund_offered_at": {"$lt": cutoff}}).to_list(500)
    done = 0
    for invite in waiting:
        try:
            await choose(db, invite["token"], invite["initiator_id"], "credit")
            done += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("auto credit failed for team %s: %s", str(invite.get("token", ""))[-6:], exc)
    return done
