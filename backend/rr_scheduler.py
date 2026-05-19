"""
Circle-method round-robin schedule generator.

generate_schedule(players) -> list of rounds.
Each round is a list of (player_a, player_b) tuples.
If len(players) is odd, a BYE slot is inserted so every player
gets exactly one BYE per season.
"""
from __future__ import annotations
from typing import Any


def generate_schedule(players: list[Any]) -> list[list[tuple[Any, Any]]]:
    """Return N-1 rounds for N players (BYE-padded if odd).

    Each entry in a round is (player_a, player_b).
    BYE is represented as None — callers must skip match creation for it.
    """
    ps = list(players)
    if len(ps) % 2 == 1:
        ps.append(None)                     # BYE slot
    n = len(ps)
    rounds = []
    rotation = ps[1:]                       # ps[0] is fixed
    for _ in range(n - 1):
        round_pairs = [(ps[0], rotation[0])]
        for i in range(1, n // 2):
            round_pairs.append((rotation[n - 1 - i], rotation[i]))
        rounds.append(round_pairs)
        rotation = [rotation[-1]] + rotation[:-1]   # rotate right by 1
    return rounds


def scoring_format_for(sport: str) -> str:
    return "fast4" if sport == "tennis" else "to_11"
