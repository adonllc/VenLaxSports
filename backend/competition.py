"""Competition types and per-sport rules: one place to extend when a new competition or sport (cricket) arrives.

Every ladder and every challenge record carries `competition_type`. Records written before this field existed
are classified by `type_of_challenge` / `type_of_ladder` from the markers they already have, so no migration is needed.
"""
from __future__ import annotations

ADMIN_LADDER = "ADMIN_LADDER"
PLAYER_COMMUNITY_LADDER = "PLAYER_COMMUNITY_LADDER"
DIRECT_CHALLENGE = "DIRECT_CHALLENGE"
OPEN_CHALLENGE = "OPEN_CHALLENGE"
ALL_TYPES = (ADMIN_LADDER, PLAYER_COMMUNITY_LADDER, DIRECT_CHALLENGE, OPEN_CHALLENGE)

_BY_SOURCE = {"direct": DIRECT_CHALLENGE, "ladder": PLAYER_COMMUNITY_LADDER, "open_board": OPEN_CHALLENGE}

# Sports that can be played as a challenge or community ladder, with how a result is scored.
# A new sport is a new entry here (plus its own scoring module if it is not set-based, as cricket is not).
SPORT_RULES = {
    "tennis": {"scoring": "sets", "max_sets": 5, "max_games_per_set": 30},
    "pickleball": {"scoring": "sets", "max_sets": 5, "max_games_per_set": 30},
}


def type_of_challenge(ch: dict) -> str:
    return ch.get("competition_type") or _BY_SOURCE.get(ch.get("source"), DIRECT_CHALLENGE)


def type_of_ladder(ladder: dict) -> str:
    return ladder.get("competition_type") or (PLAYER_COMMUNITY_LADDER if ladder.get("type") == "community" else ADMIN_LADDER)


def for_source(source: str) -> str:
    return _BY_SOURCE.get(source, DIRECT_CHALLENGE)
