"""ELO-style rating deltas for Tennis / Pickleball.

Tennis & Pickleball ratings are on a ~2.0-7.0 scale (NTRP/DUPR-style).
We apply a small delta on each completed match so ratings evolve gradually.

Cricket ratings stay team-based and are not touched by this helper.
"""
from typing import Tuple

# K-factor in NTRP points; small so a single upset doesn't shake the rating.
K_FACTOR = 0.05
# Maps rating difference (points) to expected win probability using logistic.
# +0.5 rating difference ≈ 75% win probability; +1.0 ≈ 90%.
SCALE = 0.5


def _expected(rating_a: float, rating_b: float) -> float:
    import math
    return 1.0 / (1.0 + math.pow(10.0, (rating_b - rating_a) / SCALE))


def delta_for(winner_rating: float, loser_rating: float) -> Tuple[float, float]:
    """Return (winner_delta, loser_delta) — positive and negative respectively."""
    expected_w = _expected(winner_rating, loser_rating)
    winner_delta = K_FACTOR * (1.0 - expected_w)
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
