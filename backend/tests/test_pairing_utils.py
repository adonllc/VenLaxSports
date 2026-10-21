import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pairing_utils import pair_units  # noqa: E402


def units(n, step=0.1):
    return [{"id": f"p{i}", "rating": 5.0 - i * step} for i in range(n)]


def keys(pairs):
    return {frozenset({a["id"], b["id"]}) for a, b in pairs}


def test_everyone_is_paired_once_and_inside_the_rating_band():
    for seed in range(20):
        pairs, bye = pair_units(units(16), set(), rng=random.Random(seed), band=0.5)
        assert bye is None and len(pairs) == 8
        ids = [u["id"] for pair in pairs for u in pair]
        assert sorted(ids) == sorted(u["id"] for u in units(16))
        assert all(abs(a["rating"] - b["rating"]) <= 0.5 + 1e-9 for a, b in pairs)


def test_opponents_are_random_not_always_the_nearest_rating():
    seen = {frozenset(k) for seed in range(30)
            for k in keys(pair_units(units(16), set(), rng=random.Random(seed))[0])}
    assert len(seen) > 20  # many different pairings across seeds, not one fixed list


def test_same_seed_gives_the_same_schedule():
    a, _ = pair_units(units(12), set(), rng=random.Random(7))
    b, _ = pair_units(units(12), set(), rng=random.Random(7))
    assert keys(a) == keys(b)


def test_odd_league_gives_a_bye_to_someone_new_each_time():
    byes = set()
    for _ in range(5):
        pairs, bye = pair_units(units(5), set(), byes=byes, rng=random.Random())
        assert len(pairs) == 2 and bye["id"] not in byes
        byes.add(bye["id"])
    assert len(byes) == 5


def test_no_rematches_over_several_rounds_when_avoidable():
    played, rng = set(), random.Random(3)
    for _ in range(4):
        pairs, _ = pair_units(units(16), played, rng=rng)
        assert not (keys(pairs) & played)
        played |= keys(pairs)


def test_rematch_only_when_unavoidable():
    pairs, _ = pair_units(units(2), {frozenset({"p0", "p1"})}, rng=random.Random(1))
    assert len(pairs) == 1


def test_far_apart_ratings_still_get_a_match():
    far = [{"id": "a", "rating": 2.0}, {"id": "b", "rating": 5.0}]
    pairs, _ = pair_units(far, set(), rng=random.Random(1), band=0.5)
    assert len(pairs) == 1
