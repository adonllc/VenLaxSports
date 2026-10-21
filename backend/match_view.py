"""What a player sees on the My Matches page: per-match state, progress and standing.

Pure functions, so the rules are easy to test. match_routes.my_league_matches feeds them.
"""
from __future__ import annotations

from datetime import datetime, timezone

# Group order on the page (the spec's order). "playoffs" is shown first when it exists.
STATES = (
    "not_scheduled", "awaiting_confirmation", "scheduled", "in_progress",
    "awaiting_result", "completed", "disputed", "cancelled",
)
OPEN_DISPUTE = ("pending", "investigating", "appealed")


def side_ids(match: dict, which: int) -> list[str]:
    """User ids on side 1 (Home) or side 2 (Away): the player plus the doubles partner."""
    ids = [match["player1_id"], match.get("team1_partner_id")] if which == 1 else [match["player2_id"], match.get("team2_partner_id")]
    return [i for i in ids if i]


def _parse(iso):
    try:
        d = datetime.fromisoformat((iso or "").replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def match_state(m: dict, now: datetime, disputed_ids: set[str]) -> str:
    """One of STATES.

    Scheduled: confirmed time is in the future. In Progress: the confirmed time is today.
    Awaiting Result: the confirmed time has passed and no score is in. A match with an open
    dispute is Disputed; cancelled and walkover matches are Cancelled.
    """
    if str(m.get("_id")) in disputed_ids or m.get("id") in disputed_ids:
        return "disputed"
    if m.get("status") in ("cancelled", "walkover"):
        return "cancelled"
    if m.get("status") == "completed":
        return "completed"
    sched = m.get("schedule_status")
    if sched == "unscheduled":
        return "not_scheduled"
    if sched == "proposed":
        return "awaiting_confirmation"
    when = _parse(m.get("scheduled_date"))  # "scheduled", or a legacy match with a set date
    if when is None:
        return "not_scheduled"
    if when.date() == now.date():
        return "in_progress"
    return "awaiting_result" if when < now else "scheduled"


def playoff_top_n(player_count: int) -> int:
    """Same rule the playoff generator enforces: up to 12 players top 4, otherwise top 8."""
    return 4 if player_count <= 12 else 8


def standing_rank(sorted_standings: list[dict], user_id: str):
    """1-based rank among everyone with a standings row; None until the player has played."""
    for i, s in enumerate(sorted_standings, start=1):
        if s.get("player_id") == user_id:
            return i if (s.get("matches_played") or 0) > 0 else None
    return None


def playoff_status(rank, top_n: int, league: dict, in_playoff_bracket: bool) -> dict:
    """in_position | outside | unranked during the season; qualified | not_qualified once the bracket exists."""
    if league.get("playoffs_status"):
        return {"status": "qualified" if in_playoff_bracket else "not_qualified", "top_n": top_n}
    if rank is None:
        return {"status": "unranked", "top_n": top_n}
    return {"status": "in_position" if rank <= top_n else "outside", "top_n": top_n}


def build_summary(cards: list[dict], standing: dict | None, rank, playoff: dict) -> dict:
    """Progress numbers for the top of the page. cards are the serialised match cards."""
    league_cards = [c for c in cards if not c.get("is_playoff")]
    total = len(league_cards)
    completed = sum(1 for c in league_cards if c["state"] == "completed")
    cancelled = sum(1 for c in league_cards if c["state"] == "cancelled")
    scheduled = sum(1 for c in league_cards if c["state"] in ("scheduled", "in_progress", "awaiting_result"))
    return {
        "total": total,
        "scheduled": scheduled,
        "completed": completed,
        "remaining": max(0, total - completed - cancelled),
        "wins": sum(1 for c in league_cards if c.get("result") == "won"),
        "losses": sum(1 for c in league_cards if c.get("result") == "lost"),
        "rank": rank,
        "points": round((standing or {}).get("points", 0), 2) if standing else 0,
        "playoff": playoff,
    }
