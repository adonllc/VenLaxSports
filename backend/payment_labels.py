"""What a payment was for, in words an admin can read: singles, a full doubles team, or one half of a VenLax-paired team."""
from __future__ import annotations

from bson import ObjectId

DOUBLES_FORMATS = ("doubles", "mixed", "mixed_doubles")


async def describe(db, txn: dict, leagues: dict | None = None) -> dict:
    """entry_type, entry_label, amount_paid (card or Zelle), credit_applied and total for one payment_transactions row."""
    leagues = leagues if leagues is not None else {}
    lid = txn.get("league_id", "")
    if lid not in leagues:
        try:
            leagues[lid] = await db.leagues.find_one({"_id": ObjectId(lid)}) or {}
        except Exception:
            leagues[lid] = {}
    league = leagues[lid]
    meta = txn.get("metadata") or {}
    invite = None
    if meta.get("invite_token"):
        invite = await db.doubles_invites.find_one({"token": meta["invite_token"]})

    if league.get("format") not in DOUBLES_FORMATS:
        kind, label = "singles", "Singles player"
    elif invite and invite.get("pair_by_venlax") and not invite.get("partner_user_id"):
        kind, label = "doubles_half", "Doubles team (half): VenLax finds the partner"
    elif invite and invite.get("pair_by_venlax"):
        kind, label = "doubles_half", "Doubles team (half): paired by VenLax"
    else:
        kind, label = "doubles_team", "Doubles team (full fee)"

    paid = round(float(txn.get("amount") or 0), 2)
    credit = round(float(meta.get("credit_applied") or 0), 2)
    return {"entry_type": kind, "entry_label": label, "amount_paid": paid, "credit_applied": credit,
            "total": round(paid + credit, 2)}
