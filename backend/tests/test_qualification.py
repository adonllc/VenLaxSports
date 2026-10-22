"""Playoff qualification rules, ranking tie-breaks and the player-facing playoff view."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import playoff_view  # noqa: E402
import qualification as q  # noqa: E402


def row(pid, pts, wins, mp, **kw):
    return {"player_id": pid, "player_name": pid.upper(), "points": pts, "wins": wins, "matches_played": mp, **kw}


RULE = {"mode": "points", "top_n": 2, "min_matches": 0, "min_win_pct": 0.0}


def test_default_rule_is_top_4_or_8_by_points():
    assert q.rule_for({}, 10) == {"mode": "points", "top_n": 4, "min_matches": 0, "min_win_pct": 0.0}
    assert q.rule_for({}, 16)["top_n"] == 8
    assert q.rule_for({"qualification": {"mode": "win_pct", "top_n": 2, "min_matches": 3}}, 16)["mode"] == "win_pct"


def test_validate_rule_rejects_bad_values():
    assert q.validate_rule({"mode": "points", "top_n": 8, "min_matches": 3, "min_win_pct": 50})["top_n"] == 8
    for bad in ({"mode": "x", "top_n": 4}, {"mode": "points", "top_n": 5}, {"mode": "points", "top_n": 4, "min_win_pct": 120}):
        with pytest.raises(ValueError):
            q.validate_rule(bad)


def test_rank_by_points_then_wins_then_head_to_head():
    standings = [row("a", 6, 2, 3), row("b", 6, 2, 3), row("c", 6, 2, 3), row("d", 3, 1, 3)]
    # a beat b, b beat c, c beat a: every tied player has one head-to-head win, so name decides last
    played = [{"status": "completed", "winner_id": "a", "player1_id": "a", "player2_id": "b"},
              {"status": "completed", "winner_id": "b", "player1_id": "b", "player2_id": "c"},
              {"status": "completed", "winner_id": "c", "player1_id": "c", "player2_id": "a"}]
    ranked = q.rank_players(standings, played, {**RULE, "top_n": 4})
    assert [r["player_id"] for r in ranked] == ["a", "b", "c", "d"]
    # now only a beat b and c: a leads the tied group
    played2 = [{"status": "completed", "winner_id": "a", "player1_id": "a", "player2_id": "b"},
               {"status": "completed", "winner_id": "a", "player1_id": "c", "player2_id": "a"}]
    standings2 = [row("b", 6, 2, 3), row("c", 6, 2, 3), row("a", 6, 2, 3)]
    assert [r["player_id"] for r in q.rank_players(standings2, played2, RULE)][0] == "a"


def test_win_percentage_mode_and_minimums_decide_who_qualifies():
    rule = {"mode": "win_pct", "top_n": 2, "min_matches": 3, "min_win_pct": 50.0}
    standings = [row("a", 3, 1, 1), row("b", 6, 2, 3), row("c", 5, 2, 4), row("d", 9, 3, 6)]
    ranked = {r["player_id"]: r for r in q.rank_players(standings, [], rule)}
    assert not ranked["a"]["eligible"] and not ranked["a"]["qualifies"]      # only 1 match played: needs 3
    assert ranked["b"]["qualifies"] and ranked["d"]["qualifies"]             # 67% and 50%
    assert not ranked["c"]["qualifies"]                                      # 50% but out of the top 2
    assert ranked["a"]["rank"] == 1                                          # 100% of 1 match still ranks, it just cannot qualify


def _bracket_league():
    return {"playoffs_status": "round_1", "playoff_top_n": 4}


def _pm(rnd, pos, p1, p2, status="scheduled", winner=None):
    return {"_id": f"m{rnd}{pos}", "bracket_round": rnd, "bracket_position": pos, "status": status,
            "player1_id": p1, "player2_id": p2, "player1_name": p1.upper(), "player2_name": p2.upper(), "winner_id": winner,
            "scheduled_date": "2026-12-20", "venue": "Court 1"}


def test_bracket_shows_next_opponent_and_round_names():
    ms = [_pm(1, 1, "a", "d", "completed", "a"), _pm(1, 2, "b", "c", "completed", "b"), _pm(2, 1, "a", "b")]
    b = playoff_view.build_bracket(_bracket_league(), ms, "a")
    assert [r["label"] for r in b["rounds"]] == ["Semifinal", "Final"]
    assert b["next_match"]["opponent_name"] == "B" and b["next_match"]["round_label"] == "Final"
    assert b["eliminated"] is False
    gone = playoff_view.build_bracket(_bracket_league(), ms, "d")
    assert gone["eliminated"] is True and gone["next_match"] is None


def test_playoff_status_words():
    league = {}
    rule = {**RULE, "top_n": 1}
    ranked = q.rank_players([row("a", 6, 2, 2), row("b", 3, 1, 2), row("z", 0, 0, 0)], [], rule)
    assert playoff_view.playoff_block(league, rule, ranked, "a", False, None)["status"] == "in_position"
    out = playoff_view.playoff_block(league, rule, ranked, "b", True, None)
    assert out["status"] == "outside" and out["gap"] == {"direction": "behind", "amount": 3.0, "unit": "points"} and out["season_complete"] is True
    assert playoff_view.playoff_block(league, rule, ranked, "z", False, None)["status"] == "unranked"
    # finishing every match does not qualify anyone: a player outside the cut stays outside
    done = playoff_view.playoff_block(league, rule, ranked, "b", True, None)
    assert done["status"] != "qualified"
    # once the bracket exists, status is qualified only for players in it
    br = playoff_view.build_bracket(_bracket_league(), [_pm(1, 1, "a", "b")], "a")
    assert playoff_view.playoff_block({"playoffs_status": "round_1"}, rule, ranked, "a", True, br)["status"] == "qualified"
    br_b = playoff_view.build_bracket(_bracket_league(), [_pm(1, 1, "a", "c")], "b")
    assert playoff_view.playoff_block({"playoffs_status": "round_1"}, rule, ranked, "b", True, br_b)["status"] == "not_qualified"
