"""Admin changes to who is in a league: mark a registration paid, remove a player (with a refund choice), move a player.

Each function does its checks first and only then changes anything, and raises RosterError(status, message) for a
request that cannot be done. The caller writes the audit entry.
"""
from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId

import venlax_credit

REFUND_CHOICES = ("none", "credit", "card")
ACTIVE_STATUSES = ("registration", "active")


class RosterError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status, self.message = status, message


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise RosterError(400, "Invalid id")


async def _registration(db, league_id: str, player_id: str) -> dict:
    pl = await db.player_leagues.find_one({"league_id": league_id, "player_id": player_id})
    if not pl:
        raise RosterError(404, "That player is not registered in this league")
    return pl


async def _guard_no_team_or_matches(db, league_id: str, pl: dict) -> None:
    if pl.get("partner_id"):
        raise RosterError(409, "This player is on a paired doubles team. Removing or moving one half would break the team, so handle the team through Partner matching.")
    pid = pl["player_id"]
    for m in await db.matches.find({"league_id": league_id}).to_list(None):
        if m.get("status") != "cancelled" and pid in (m.get("player1_id"), m.get("player2_id")):
            raise RosterError(409, "This player already has matches in the league. Cancel or reassign them first.")


async def _paid_txn(db, league_id: str, player_id: str) -> dict | None:
    txns = await db.payment_transactions.find({"league_id": league_id, "user_id": player_id}).to_list(None)
    paid = [t for t in txns if t.get("status") in ("complete", "paid") or t.get("payment_status") == "paid"]
    return sorted(paid, key=lambda t: str(t.get("created_at") or ""))[-1] if paid else None


async def mark_paid(db, league: dict, player_id: str, amount: float | None, note: str) -> dict:
    lid = str(league["_id"])
    pl = await _registration(db, lid, player_id)
    if pl.get("payment_status") in ("paid", "free"):
        raise RosterError(409, "This player is already marked paid")
    fee = round(float(league.get("entry_fee") or 0), 2)
    paid = round(float(fee if amount is None else amount), 2)
    if paid < 0:
        raise RosterError(400, "The amount cannot be negative")
    await db.player_leagues.update_one({"_id": pl["_id"]}, {"$set": {"payment_status": "paid"}})
    user = await db.users.find_one({"_id": _oid(player_id)}) or {}
    await db.payment_transactions.insert_one({
        "user_id": player_id, "user_email": user.get("email", ""), "league_id": lid, "league_name": league.get("name"),
        "session_id": f"manual_{ObjectId()}", "amount": paid, "currency": "USD", "status": "complete",
        "payment_status": "paid", "metadata": {"method": "manual", "note": (note or "")[:300]},
        "created_at": _now(),
    })
    return {"player_id": player_id, "amount": paid}


async def remove_player(db, league: dict, player_id: str, refund: str) -> dict:
    """Take a player out of the league. refund: none | credit (VenLax Credit) | card (full Stripe refund)."""
    if refund not in REFUND_CHOICES:
        raise RosterError(400, "Refund must be none, credit or card")
    lid = str(league["_id"])
    pl = await _registration(db, lid, player_id)
    await _guard_no_team_or_matches(db, lid, pl)
    txn = await _paid_txn(db, lid, player_id)
    meta = (txn or {}).get("metadata") or {}
    paid = round(float((txn or {}).get("amount") or 0), 2)
    credit_used = round(float(meta.get("credit_applied") or 0), 2)
    refund_id, credited = None, 0.0

    if refund == "card":
        sid = str((txn or {}).get("session_id") or "")
        if not txn or not sid.startswith("cs_") or paid <= 0:
            raise RosterError(409, "There is no card payment to refund for this player (Zelle, coupon and credit payments cannot be refunded to a card).")
        if txn.get("refunded_at"):
            raise RosterError(409, "This payment was already refunded")
        import scheduler_jobs
        try:
            refund_id = scheduler_jobs._stripe_refund(sid, f"admin-remove-{lid}-{player_id}")
        except Exception as exc:
            raise RosterError(502, f"The card refund failed, so nobody was removed: {exc}")
        await db.payment_transactions.update_one({"_id": txn["_id"]}, {"$set": {"refunded_at": _now(), "refund_id": refund_id}})
        if credit_used > 0:   # the part paid with credit goes back as credit
            await venlax_credit.grant(db, player_id, credit_used, f"Removed from {league.get('name')}", ref=f"admin-remove-credit:{lid}:{player_id}", league_id=lid)
            credited = credit_used
    elif refund == "credit":
        total = round(paid + credit_used, 2)
        if total <= 0:
            raise RosterError(409, "This player paid nothing, so there is nothing to credit")
        await venlax_credit.grant(db, player_id, total, f"Removed from {league.get('name')}", ref=f"admin-remove-credit:{lid}:{player_id}", league_id=lid)
        credited = total
        if txn:
            await db.payment_transactions.update_one({"_id": txn["_id"]}, {"$set": {"refunded_at": _now(), "refund_as": "credit"}})

    await db.player_leagues.delete_many({"league_id": lid, "player_id": player_id})
    await db.standings.delete_many({"league_id": lid, "player_id": player_id})
    await db.leagues.update_one({"_id": league["_id"], "current_players": {"$gt": 0}}, {"$inc": {"current_players": -1}})
    return {"player_id": player_id, "refund": refund, "credited": credited, "stripe_refund_id": refund_id}


async def move_player(db, league: dict, player_id: str, to_league_id: str) -> dict:
    lid = str(league["_id"])
    if to_league_id == lid:
        raise RosterError(400, "Pick a different league")
    pl = await _registration(db, lid, player_id)
    target = await db.leagues.find_one({"_id": _oid(to_league_id)})
    if not target:
        raise RosterError(404, "Target league not found")
    if target.get("status") not in ACTIVE_STATUSES:
        raise RosterError(409, "The target league is not open")
    if target.get("sport") != league.get("sport") or target.get("format") != league.get("format"):
        raise RosterError(409, "A player can only move to a league of the same sport and format")
    if int(target.get("current_players") or 0) >= int(target.get("max_players") or 0):
        raise RosterError(409, "The target league is full")
    if await db.player_leagues.find_one({"league_id": to_league_id, "player_id": player_id}):
        raise RosterError(409, "This player is already in the target league")
    await _guard_no_team_or_matches(db, lid, pl)

    await db.player_leagues.update_one({"_id": pl["_id"]}, {"$set": {"league_id": to_league_id}})
    await db.standings.update_one({"league_id": lid, "player_id": player_id}, {"$set": {"league_id": to_league_id}})
    await db.payment_transactions.update_many(
        {"league_id": lid, "user_id": player_id},
        {"$set": {"league_id": to_league_id, "league_name": target.get("name")}})
    await db.leagues.update_one({"_id": league["_id"], "current_players": {"$gt": 0}}, {"$inc": {"current_players": -1}})
    await db.leagues.update_one({"_id": target["_id"]}, {"$inc": {"current_players": 1}})
    return {"player_id": player_id, "to_league": target.get("name"), "fee_changed": float(target.get("entry_fee") or 0) != float(league.get("entry_fee") or 0),
            "from_fee": float(league.get("entry_fee") or 0), "to_fee": float(target.get("entry_fee") or 0)}
