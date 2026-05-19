import pytest
from rr_scheduler import generate_schedule, scoring_format_for


def _all_pairs(players):
    """Return set of frozensets for every possible pairing."""
    return {frozenset([a, b]) for a in players for b in players if a != b}


def test_even_players_round_count():
    players = ["A", "B", "C", "D"]
    rounds = generate_schedule(players)
    assert len(rounds) == 3                 # N-1 rounds


def test_even_players_each_plays_once_per_round():
    players = ["A", "B", "C", "D"]
    rounds = generate_schedule(players)
    for r in rounds:
        seen = set()
        for a, b in r:
            assert a not in seen and b not in seen
            seen.update([a, b])


def test_even_players_all_pairs_covered():
    players = ["A", "B", "C", "D"]
    rounds = generate_schedule(players)
    played = set()
    for r in rounds:
        for a, b in r:
            played.add(frozenset([a, b]))
    expected = _all_pairs(players)
    assert played == expected


def test_odd_players_bye_once_each():
    players = ["A", "B", "C"]
    rounds = generate_schedule(players)
    # 4 players after BYE insertion → 3 rounds
    assert len(rounds) == 3
    bye_counts = {p: 0 for p in players}
    for r in rounds:
        for a, b in r:
            if a is None:
                bye_counts[b] += 1
            elif b is None:
                bye_counts[a] += 1
    # every player gets exactly one BYE
    assert all(v == 1 for v in bye_counts.values())


def test_scoring_format():
    assert scoring_format_for("tennis") == "fast4"
    assert scoring_format_for("pickleball") == "to_11"
    assert scoring_format_for("cricket") == "to_11"     # fallback
