"""Pairing waiting doubles players for admin-assisted partner assignment.

Pure functions, no database. A candidate is a dict:
  token, user_id, name, gender, city, zip_code, level, court_side, availability,
  registered_at (iso string), rejected (user ids this player must never be paired with).
"""
from __future__ import annotations

import math

ALLOWED_GAPS = (0.0, 0.5, 1.0)
LEVEL_POINTS = {0.0: 40, 0.5: 25, 1.0: 10}

AVAILABILITY_LABELS = {
    "weekday_morning": "Weekday mornings",
    "weekday_evening": "Weekday evenings",
    "weekend_morning": "Weekend mornings",
    "weekend_afternoon": "Weekend afternoons",
    "weekend_evening": "Weekend evenings",
}


def snap_half(x: float) -> float:
    """Round to the nearest 0.5, halves rounding up."""
    return math.floor(float(x) * 2 + 0.5) / 2


def player_level(user: dict, sport: str) -> float:
    """Declared skill level first (ratings drift every match), else the sport rating, else 3.0."""
    raw = str(user.get("skill_level") or "").strip().rstrip("+")
    try:
        return snap_half(float(raw))
    except ValueError:
        pass
    rating = user.get(f"{sport}_rating")
    if rating is not None:
        try:
            return snap_half(float(rating))
        except (TypeError, ValueError):
            pass
    return 3.0
