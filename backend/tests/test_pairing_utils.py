import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pairing_utils import pair_units  # noqa: E402


def units(n):
    return [{"id": f"p{i}", "rating": 5.0 - i * 0.1} for i in range(n)]


def test_even_league_pairs_everyone_by_rating():
    pairs, bye = pair_units(units(16), set())
    assert bye is None
    assert len(pairs) == 8
    ids = [u["id"] for pair in pairs for u in pair]
    assert sorted(ids) == sorted(u["id"] for u in units(16))
    assert {frozenset({a["id"], b["id"]}) for a, b in pairs} >= {frozenset({"p0", "p1"})}


def test_odd_league_gives_lowest_rated_a_bye_and_next_bye_rotates():
    pairs, bye = pair_units(units(5), set())
    assert bye["id"] == "p4" and len(pairs) == 2
    _, bye2 = pair_units(units(5), set(), byes={"p4"})
    assert bye2["id"] == "p3"


def test_no_rematches_when_avoidable():
    first, _ = pair_units(units(8), set())
    played = {frozenset({a["id"], b["id"]}) for a, b in first}
    second, _ = pair_units(units(8), played)
    assert not ({frozenset({a["id"], b["id"]}) for a, b in second} & played)
    assert len(second) == 4


def test_rematch_only_when_unavoidable():
    played = {frozenset({"p0", "p1"})}
    pairs, _ = pair_units(units(2), played)
    assert len(pairs) == 1
