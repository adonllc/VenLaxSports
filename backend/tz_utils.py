"""Time zones for match scheduling.

Match times are stored as UTC instants. They are entered and shown in the league city's time
zone so both players read the same clock time, in the app and in emails.
"""
from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

DEFAULT_TZ = "America/New_York"
CITY_TZ = {
    "Atlanta": "America/New_York",
    "New York": "America/New_York",
    "Charlotte": "America/New_York",
    "Chicago": "America/Chicago",
    "Houston": "America/Chicago",
    "Dallas": "America/Chicago",
    "Los Angeles": "America/Los_Angeles",
    "San Francisco": "America/Los_Angeles",
    "Seattle": "America/Los_Angeles",
    "Phoenix": "America/Phoenix",
}


def league_tz_name(league: dict) -> str:
    return CITY_TZ.get((league or {}).get("city") or "", DEFAULT_TZ)


def parse_instant(value: str, tz_name: str) -> datetime:
    """Parse a date-time into a UTC instant.

    A value with an offset ("...Z", "...+00:00") is taken as given. A bare wall-clock value
    ("2026-11-02T19:00") is read in the league's time zone.
    """
    d = datetime.fromisoformat((value or "").replace("Z", "+00:00"))
    if d.tzinfo is None:
        d = d.replace(tzinfo=ZoneInfo(tz_name))
    return d.astimezone(timezone.utc)


def as_utc(iso: str) -> datetime | None:
    try:
        d = datetime.fromisoformat((iso or "").replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def tz_abbr(tz_name: str, when: datetime | None = None) -> str:
    return (when or datetime.now(timezone.utc)).astimezone(ZoneInfo(tz_name)).strftime("%Z")


def fmt_local(iso: str, tz_name: str) -> str:
    """"Mon, Nov 02, 2026 at 07:00 PM EST" in the league's time zone."""
    d = as_utc(iso)
    if d is None:
        return iso or ""
    return d.astimezone(ZoneInfo(tz_name)).strftime("%a, %b %d, %Y at %I:%M %p %Z")
