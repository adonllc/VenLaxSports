"""Which cities are open for joining, switchable at runtime from the admin Feature Flags tab.

Source of truth, in order:
  1. db.feature_flags {_id: "open_cities", cities: [...], all_open: bool}   (set by an admin, no deploy)
  2. env LAUNCH_CITY, comma separated ("Atlanta" or "Atlanta,Dallas")        (fallback until an admin saves)
  3. nothing set -> every city is open (local development, staging)

A city that is not open keeps its leagues visible ("Opens soon" + Notify Me) but nobody can join:
league join, checkout, and the round-robin join / invite / accept paths all call require_city_open.
The result is cached for a few seconds so a join request does not hit the database twice.
"""
import os
import time

from fastapi import HTTPException

_TTL_SECONDS = 10
_cache = {"at": 0.0, "value": None, "loaded": False}


def _env_cities():
    return [c.strip() for c in os.environ.get("LAUNCH_CITY", "").split(",") if c.strip()]


def invalidate_cache() -> None:
    _cache["loaded"] = False


async def get_open_cities(db):
    """List of open city names, or None when every city is open."""
    if _cache["loaded"] and time.monotonic() - _cache["at"] < _TTL_SECONDS:
        return _cache["value"]

    doc = await db.feature_flags.find_one({"_id": "open_cities"})
    if doc is not None:
        value = None if doc.get("all_open") else [str(c) for c in (doc.get("cities") or [])]
    else:
        env = _env_cities()
        value = env or None

    _cache.update(at=time.monotonic(), value=value, loaded=True)
    return value


def city_is_open(open_cities, city) -> bool:
    if open_cities is None:
        return True
    wanted = str(city or "").strip().lower()
    return any(wanted == str(c).strip().lower() for c in open_cities)


async def require_city_open(db, league: dict) -> None:
    """Raise 403 when this league's city is not open yet. Call right after the league is loaded, before any payment."""
    open_cities = await get_open_cities(db)
    city = (league or {}).get("city")
    if city_is_open(open_cities, city):
        return
    where = ", ".join(open_cities) if open_cities else "no city yet"
    raise HTTPException(
        status_code=403,
        detail=f"Leagues in {city} are not open yet. We are starting in {where}. Use Notify Me and we will tell you when {city} opens.",
    )


async def get_google_analytics_enabled(db) -> bool:
    """Admin switch for Google Tag Manager / Analytics. On unless an admin turned it off."""
    doc = await db.feature_flags.find_one({"_id": "google_analytics"})
    return True if doc is None else bool(doc.get("enabled"))
