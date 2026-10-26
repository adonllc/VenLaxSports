"""The $10 thank-you coupon: one personal code per player, usable once, valid for 12 months from the day it is made.

It is an ordinary promo code (type amount_off) that only the person it was made for can use, so it is applied at
checkout like any other promo and is recorded in the same places (promo_codes, promo_uses).
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone

AMOUNT = 10
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"   # no 0/O/1/I so a code can be read aloud or typed from an email


def new_code() -> str:
    return "THANKS-" + "".join(secrets.choice(ALPHABET) for _ in range(8))


def add_months(moment: datetime, months: int) -> datetime:
    """The same day `months` later; a day that does not exist there (Feb 29, the 31st) becomes the month's last day."""
    y, m = divmod(moment.month - 1 + months, 12)
    year, month = moment.year + y, m + 1
    for day in (moment.day, 30, 29, 28):
        try:
            return moment.replace(year=year, month=month, day=day)
        except ValueError:
            continue
    raise ValueError("unreachable")


def expiry_text(expires_at: str) -> str:
    return datetime.fromisoformat(expires_at).strftime("%B %d, %Y").replace(" 0", " ")


def example(now: datetime | None = None) -> dict:
    """What a coupon looks like, for previews and test emails. Nothing is saved and the code works nowhere."""
    now = now or datetime.now(timezone.utc)
    exp = add_months(now, 12).isoformat()
    return {"code": "THANKS-EXAMPLE", "amount": AMOUNT, "expires_at": exp, "expires_text": expiry_text(exp)}


async def get_or_create(db, user_id: str, campaign_key: str, admin_id: str = "", now: datetime | None = None) -> dict:
    """The player's coupon for this campaign. Asking twice (a retry after a failed email) returns the same one."""
    existing = await db.promo_codes.find_one({"restricted_user_id": user_id, "campaign_key": campaign_key})
    if existing:
        return {"code": existing["code"], "amount": AMOUNT, "expires_at": existing["expires_at"], "expires_text": expiry_text(existing["expires_at"])}
    now = now or datetime.now(timezone.utc)
    expires = add_months(now, 12).isoformat()
    code = new_code()
    while await db.promo_codes.find_one({"code": code}):
        code = new_code()
    await db.promo_codes.insert_one({
        "code": code, "type": "amount_off", "value": AMOUNT, "active": True, "max_uses": 1, "used_count": 0,
        "per_user_limit": 1, "expires_at": expires, "restricted_user_id": user_id, "campaign_key": campaign_key,
        "description": f"${AMOUNT} thank-you credit", "created_by": admin_id, "created_at": now.isoformat(),
    })
    return {"code": code, "amount": AMOUNT, "expires_at": expires, "expires_text": expiry_text(expires)}
