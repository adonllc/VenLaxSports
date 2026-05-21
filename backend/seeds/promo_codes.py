"""Seed launch promo codes. Idempotent — skips existing codes."""
from datetime import datetime, timezone, timedelta


LAUNCH_PROMOS = [
    {
        "code": "PLAY1FREE",
        "description": "First league free — new player launch offer",
        "type": "free_entry",       # free_entry | percent_off | amount_off
        "value": 100,               # 100% off (used for display)
        "per_user_limit": 1,        # one use per player
        "max_uses": None,           # unlimited global uses
        "applicable_formats": [],   # [] = all formats
        "applicable_sports": [],    # [] = all sports
        "active": True,
        "expires_at": None,         # no expiry
    },
    {
        "code": "FOUNDER50",
        "description": "Founding member 50% off — first 200 signups",
        "type": "percent_off",
        "value": 50,
        "per_user_limit": 1,
        "max_uses": 200,
        "applicable_formats": [],
        "applicable_sports": [],
        "active": True,
        "expires_at": None,
    },
]


async def seed_promo_codes(db) -> None:
    now = datetime.now(timezone.utc).isoformat()
    for promo in LAUNCH_PROMOS:
        existing = await db.promo_codes.find_one({"code": promo["code"]})
        if existing:
            continue
        await db.promo_codes.insert_one({
            **promo,
            "used_count": 0,
            "created_at": now,
        })
