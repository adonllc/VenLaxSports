"""Launch-city gate: while LAUNCH_CITY is set, only that city's leagues can be joined.

    LAUNCH_CITY=Atlanta   -> other cities' leagues stay visible ("Opens soon") but cannot be joined
    LAUNCH_CITY unset     -> no restriction (local development, staging)

Read at call time, so changing the Coolify env var and restarting is all it takes to open a new city.
The frontend shows "Opens soon" from frontend/src/config/cities.json (launchCity); keep the two in step.
"""
import os

from fastapi import HTTPException


def launch_city() -> str:
    return os.environ.get("LAUNCH_CITY", "").strip()


def city_is_open(city) -> bool:
    lc = launch_city()
    return not lc or str(city or "").strip().lower() == lc.lower()


def require_city_open(league: dict) -> None:
    """Raise 403 when this league's city is not open yet. Call right after the league is loaded, before any payment."""
    city = (league or {}).get("city")
    if not city_is_open(city):
        raise HTTPException(
            status_code=403,
            detail=f"Leagues in {city} are not open yet. We are starting in {launch_city()}. Use Notify Me and we will tell you when {city} opens.",
        )
