"""ELO-style rating deltas for Tennis / Pickleball.

Tennis & Pickleball ratings are on a ~2.0-7.0 scale (NTRP/DUPR-style).
Staged K-factor: aggressive for new players, conservative for veterans.
  - < 10 matches played  → K = 0.30
  - 10–29 matches played → K = 0.15
  - 30+ matches played   → K = 0.08

Cricket ratings stay team-based and are not touched by this helper.
"""
from typing import Tuple

SCALE = 0.5  # +0.5 rating diff ≈ 75% win probability; +1.0 ≈ 90%


def _expected(rating_a: float, rating_b: float) -> float:
    import math
    return 1.0 / (1.0 + math.pow(10.0, (rating_b - rating_a) / SCALE))


def k_factor_for(matches_played: int) -> float:
    """Staged K-factor based on competitive experience."""
    if matches_played < 10:
        return 0.30
    if matches_played < 30:
        return 0.15
    return 0.08


def delta_for(
    winner_rating: float,
    loser_rating: float,
    winner_matches: int = 0,
    loser_matches: int = 0,
) -> Tuple[float, float]:
    """Return (winner_delta, loser_delta).

    Uses the more conservative K of the two players to prevent large swings
    when an established player faces a newcomer.
    """
    expected_w = _expected(winner_rating, loser_rating)
    k = min(k_factor_for(winner_matches), k_factor_for(loser_matches))
    winner_delta = k * (1.0 - expected_w)
    loser_delta = -winner_delta
    return round(winner_delta, 3), round(loser_delta, 3)


def rating_field_for(sport: str) -> str | None:
    """Map sport to the user document's rating field name."""
    return {
        "tennis": "tennis_rating",
        "pickleball": "pickleball_rating",
        "cricket": "cricket_rating",
    }.get(sport)


def clamp(v: float, lo: float = 1.0, hi: float = 7.0) -> float:
    return max(lo, min(hi, round(v, 2)))


def starting_rating_for(skill_level: str | None) -> float | None:
    """Starting rating for a self-reported USTA/USAPA level ("2.0" ... "5.5", "6.0+"), or None if unusable."""
    if not skill_level:
        return None
    try:
        return clamp(float(str(skill_level).strip().rstrip("+")))
    except ValueError:
        return None


async def seed_starting_rating(db, user_id: str, skill_level: str | None) -> bool:
    """Set tennis and pickleball ratings from the self-reported level, but only before the player's first
    rated match. After that the level is just a label and earned ratings are never touched, so editing the
    level cannot reset a rating. Returns True when ratings were changed."""
    from bson import ObjectId

    rating = starting_rating_for(skill_level)
    if rating is None:
        return False
    if await db.rating_history.count_documents({"user_id": user_id}, limit=1) > 0:
        return False
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"tennis_rating": rating, "pickleball_rating": rating}},
    )
    return True
