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
