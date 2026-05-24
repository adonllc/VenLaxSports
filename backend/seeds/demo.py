"""Demo seed — NYC Tennis Open with realistic player + match data.

Idempotent: skips if demo players already exist.
Run once against prod to populate city leaderboard.
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone, timedelta
from bson import ObjectId

logger = logging.getLogger(__name__)

DEMO_PLAYERS = [
    {"name": "Marcus Webb",    "email": "marcus.demo@venlaxsports.com",   "tennis_rating": 1680, "city": "New York"},
    {"name": "Priya Nair",     "email": "priya.demo@venlaxsports.com",    "tennis_rating": 1620, "city": "New York"},
    {"name": "Jordan Ellis",   "email": "jordan.demo@venlaxsports.com",   "tennis_rating": 1590, "city": "New York"},
    {"name": "Sofia Mendez",   "email": "sofia.demo@venlaxsports.com",    "tennis_rating": 1555, "city": "New York"},
    {"name": "Tyler Grant",    "email": "tyler.demo@venlaxsports.com",    "tennis_rating": 1510, "city": "New York"},
    {"name": "Amara Osei",     "email": "amara.demo@venlaxsports.com",    "tennis_rating": 1480, "city": "New York"},
    {"name": "Ryan Castillo",  "email": "ryan.demo@venlaxsports.com",     "tennis_rating": 1440, "city": "New York"},
    {"name": "Leila Farooqi",  "email": "leila.demo@venlaxsports.com",    "tennis_rating": 1400, "city": "New York"},
]

# Realistic match results: (player_idx, opponent_idx, score, winner_idx)
DEMO_MATCHES = [
    (0, 1, "6-3 6-4", 0),
    (0, 2, "7-5 6-2", 0),
    (0, 3, "6-4 3-6 6-3", 0),
    (1, 2, "6-4 6-3", 1),
    (1, 3, "7-6 5-7 6-4", 1),
    (1, 4, "6-2 6-1", 1),
    (2, 3, "6-3 6-4", 2),
    (2, 4, "7-5 6-3", 2),
    (2, 5, "6-4 6-2", 2),
    (3, 4, "6-4 6-3", 3),
    (3, 5, "3-6 6-4 6-3", 3),
    (4, 5, "6-3 6-4", 4),
    (4, 6, "6-2 6-4", 4),
    (5, 6, "6-4 7-5", 5),
    (5, 7, "6-3 6-1", 5),
    (6, 7, "6-4 6-3", 6),
    (3, 6, "6-2 6-4", 3),
    (1, 5, "6-4 6-2", 1),
    (0, 4, "6-1 6-3", 0),
    (2, 7, "6-0 6-2", 2),
]


async def seed_demo(db) -> None:
    # Idempotency: check for demo players
    existing = await db.users.find_one({"email": "marcus.demo@venlaxsports.com"})
    if existing:
        logger.info("Demo data already seeded — skipping")
        return

    # Find NYC tennis league
    league = await db.leagues.find_one({"city": "New York", "sport": "tennis"})
    if not league:
        logger.warning("NYC tennis league not found — run seed_leagues first")
        return

    league_id = str(league["_id"])
    now = datetime.now(timezone.utc)

    # Insert demo players
    player_ids = []
    for i, p in enumerate(DEMO_PLAYERS):
        doc = {
            "name": p["name"],
            "email": p["email"],
            "password_hash": "demo_only_no_login",
            "role": "player",
            "city": p["city"],
            "tennis_rating": p["tennis_rating"],
            "profile_public": True,
            "email_notifications": False,
            "created_at": (now - timedelta(days=30 - i)).isoformat(),
            "sport_preferences": ["tennis"],
        }
        result = await db.users.insert_one(doc)
        player_ids.append(str(result.inserted_id))

    # Register all in league
    for pid in player_ids:
        await db.player_leagues.insert_one({
            "player_id": pid,
            "league_id": league_id,
            "payment_status": "paid",
            "joined_at": (now - timedelta(days=25)).isoformat(),
            "promotion_status": None,
        })

    # Insert match results
    for p1_idx, p2_idx, score, winner_idx in DEMO_MATCHES:
        p1_id = player_ids[p1_idx]
        p2_id = player_ids[p2_idx]
        winner_id = player_ids[winner_idx]
        match_date = (now - timedelta(days=20 - (p1_idx + p2_idx))).isoformat()
        await db.matches.insert_one({
            "league_id": league_id,
            "sport": "tennis",
            "player1_id": p1_id,
            "player2_id": p2_id,
            "player1_name": DEMO_PLAYERS[p1_idx]["name"],
            "player2_name": DEMO_PLAYERS[p2_idx]["name"],
            "score": score,
            "winner_id": winner_id,
            "status": "completed",
            "scheduled_date": match_date,
            "played_date": match_date,
            "source": "demo",
            "created_at": match_date,
        })

    # Update league current_players count
    await db.leagues.update_one(
        {"_id": league["_id"]},
        {"$set": {"current_players": len(player_ids), "status": "active"}}
    )

    logger.info(
        "Demo seed complete — %d players, %d matches in NYC tennis league",
        len(player_ids), len(DEMO_MATCHES)
    )
