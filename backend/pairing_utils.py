"""Opponent pairing for flex leagues.

A "unit" is one singles player or one doubles team: {"id", "rating", ...}.
pair_units() pairs units of similar rating and avoids rematches where possible.
"""
from __future__ import annotations


def pair_units(units: list[dict], played: set[frozenset], byes: set[str] | None = None):
    """Return (pairs, bye_unit).

    units   list of {"id": str, "rating": float, ...}
    played  set of frozenset({id_a, id_b}) for matches already played or scheduled
    byes    ids that already had a bye in an earlier round (avoided when choosing the bye)

    pairs is a list of (unit_a, unit_b). bye_unit is None for an even number of units.
    Units are sorted by rating and each is paired with the closest-rated unit it has not
    met; if that is impossible the fewest-rematch option is used.
    """
    byes = byes or set()
    ordered = sorted(units, key=lambda u: (-float(u.get("rating") or 0), u["id"]))

    bye_unit = None
    if len(ordered) % 2 == 1:
        # lowest-rated unit that has not yet had a bye; if all have, the lowest-rated
        candidates = [u for u in ordered if u["id"] not in byes] or ordered
        bye_unit = candidates[-1]
        ordered = [u for u in ordered if u["id"] != bye_unit["id"]]

    best: dict = {"cost": None, "pairs": None}

    def search(remaining: list[dict], pairs: list, cost: int) -> None:
        if best["cost"] is not None and cost >= best["cost"]:
            return
        if not remaining:
            best["cost"], best["pairs"] = cost, list(pairs)
            return
        first, rest = remaining[0], remaining[1:]
        # closest rating first, so the first complete solution is already a good one
        for i, other in enumerate(rest):
            rematch = 1 if frozenset({first["id"], other["id"]}) in played else 0
            search(rest[:i] + rest[i + 1:], pairs + [(first, other)], cost + rematch)
            if best["cost"] == 0:
                return

    if len(ordered) <= 20:
        search(ordered, [], 0)
        pairs = best["pairs"] or []
    else:  # large leagues: simple adjacent pairing keeps this fast
        pairs = [(ordered[i], ordered[i + 1]) for i in range(0, len(ordered) - 1, 2)]
    return pairs, bye_unit
