import os
import bcrypt
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


async def seed_admin(db) -> None:
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@leaguepro.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt()).decode()
        await db.users.insert_one({
            "email": admin_email,
            "name": "Admin",
            "password_hash": hashed,
            "role": "admin",
            "country": "USA",
            "city": "New York",
            "sport_preferences": ["tennis", "cricket", "pickleball"],
            "tennis_rating": 5.0,
            "cricket_rating": 100.0,
            "pickleball_rating": 5.0,
            "email_notifications": True,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin seeded: {admin_email}")
    elif not bcrypt.checkpw(admin_password.encode(), existing["password_hash"].encode()):
        hashed = bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt()).decode()
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hashed}})
