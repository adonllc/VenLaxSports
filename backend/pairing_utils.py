"""Opponent pairing for flex leagues.

A "unit" is one singles player or one doubles team: {"id", "rating", ...}.

pair_units() randomises opponents inside a pool of compatible players: a unit may be paired
with any unit within `band` rating points, and never with a repeat opponent unless that is
impossible.
"""
from __future__ import annotations

import random

DEFAULT_BAND = 0.5      # rating points (NTRP / DUPR-style 2.0-5.0 scale)
ATTEMPTS = 300          # random tries before settling for the best imperfect one


def pair_units(units: list[dict], played: set[frozenset], byes: set[str] | None = None,
               rng: random.Random | None = None, band: float = DEFAULT_BAND):
    """Return (pairs, bye_unit).

    units    list of {"id": str, "rating": float, ...}
    played   set of frozenset({id_a, id_b}) for pairings already made in this league
    byes     ids that already had a bye (avoided when an odd unit must sit out)
    rng      random source (pass a seeded one for a reproducible schedule)
    band     largest rating gap that counts as compatible

    The first random arrangement with no rematches and every pair inside the band is used.
    If none exists, the best of the attempts is used (fewest rematches, then fewest
    out-of-band pairs, then the smallest total rating gap), so every unit still gets a match.
    """
    rng = rng or random.Random()
    byes = byes or set()

    def rating(u: dict) -> float:
        return float(u.get("rating") or 0)

    pool = list(units)
    bye_unit = None
    if len(pool) % 2 == 1:
        candidates = [u for u in pool if u["id"] not in byes] or pool
        bye_unit = rng.choice(candidates)
        pool = [u for u in pool if u["id"] != bye_unit["id"]]

    def attempt():
        order = pool[:]
        rng.shuffle(order)
        free = {u["id"]: u for u in order}
        pairs, rematches, out_of_band, gap = [], 0, 0, 0.0
        for first in order:
            if first["id"] not in free:
                continue
            del free[first["id"]]
            others = list(free.values())
            fresh = [o for o in others if frozenset({first["id"], o["id"]}) not in played]
            usable = fresh or others
            in_band = [o for o in usable if abs(rating(o) - rating(first)) <= band]
            if in_band:
                choice = rng.choice(in_band)
            else:
                choice = min(usable, key=lambda o: (abs(rating(o) - rating(first)), rng.random()))
                out_of_band += 1
            del free[choice["id"]]
            if frozenset({first["id"], choice["id"]}) in played:
                rematches += 1
            gap += abs(rating(choice) - rating(first))
            pairs.append((first, choice))
        return (rematches, out_of_band, gap), pairs

    best_score, best_pairs = None, []
    for _ in range(ATTEMPTS):
        score, pairs = attempt()
        if score[0] == 0 and score[1] == 0:
            return pairs, bye_unit
        if best_score is None or score < best_score:
            best_score, best_pairs = score, pairs
    return best_pairs, bye_unit
