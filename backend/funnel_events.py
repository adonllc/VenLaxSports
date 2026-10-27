"""Website funnel events: the stages that happen before an account exists or between pages.

Only three events are accepted (see dashboard_kpis.CLIENT_EVENTS). A row holds the event name, the time, an optional
sport / league, and the user id when the visitor is signed in. No IP address, user agent, cookie or visitor id is stored,
so an anonymous visitor can be counted but never identified. The browser sends each event at most once per session.
"""
from datetime import datetime, timezone

from bson import ObjectId

from dashboard_kpis import CLIENT_EVENTS

SPORTS = ("tennis", "pickleball", "cricket")


class EventError(ValueError):
    pass


def build(event: str, sport: str = "", league_id: str = "", user_id: str = "") -> dict:
    if event not in CLIENT_EVENTS:
        raise EventError("Unknown event")
    sport = (sport or "").strip().lower()
    if sport and sport not in SPORTS:
        raise EventError("Unknown sport")
    league_id = (league_id or "").strip()
    if league_id and not ObjectId.is_valid(league_id):
        raise EventError("Invalid league")
    return {"event": event, "at": datetime.now(timezone.utc), "sport": sport, "league_id": league_id, "user_id": user_id or ""}
