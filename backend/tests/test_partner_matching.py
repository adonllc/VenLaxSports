import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from partner_matching import player_level, snap_half  # noqa: E402


def test_snap_half_rounds_to_nearest_half():
    assert snap_half(3.24) == 3.0
    assert snap_half(3.25) == 3.5
    assert snap_half(3.74) == 3.5
    assert snap_half(3.75) == 4.0


def test_level_prefers_declared_skill_level():
    assert player_level({"skill_level": "3.5", "tennis_rating": 4.4}, "tennis") == 3.5


def test_level_accepts_plus_suffix():
    assert player_level({"skill_level": "6.0+"}, "tennis") == 6.0


def test_level_falls_back_to_sport_rating():
    assert player_level({"tennis_rating": 3.76}, "tennis") == 4.0
    assert player_level({"pickleball_rating": 2.6}, "pickleball") == 2.5


def test_level_defaults_to_three():
    assert player_level({}, "tennis") == 3.0
    assert player_level({"skill_level": "abc"}, "tennis") == 3.0


from partner_matching import score_pair, suggest_pairs  # noqa: E402


def cand(uid, level=3.0, **kw):
    base = {
        "token": f"t-{uid}", "user_id": uid, "name": uid, "gender": None, "city": "Atlanta",
        "zip_code": "", "level": level, "court_side": None, "availability": [],
        "registered_at": f"2026-11-0{uid[-1]}", "rejected": [],
    }
    base.update(kw)
    return base


def score(a, b, gap=1.0, mixed=False, location=False, play_profile=False):
    res = score_pair(a, b, gap, mixed, location, play_profile)
    return None if res is None else res[0]


def test_level_gap_is_a_hard_limit_and_scored():
    assert score(cand("u1", 3.0), cand("u2", 3.5), gap=0.0) is None
    assert score(cand("u1", 3.0), cand("u2", 3.0)) == 40      # level only (location, court side and availability are not scored)
    assert score(cand("u1", 3.0), cand("u2", 3.5)) == 25      # 25 level
    assert score(cand("u1", 3.0), cand("u2", 4.0)) == 10      # 10 level


def test_location_zip_beats_city_beats_nothing():
    L = dict(location=True)
    assert score(cand("u1", zip_code="30350"), cand("u2", zip_code="30350"), **L) == 65
    assert score(cand("u1"), cand("u2"), **L) == 55
    assert score(cand("u1"), cand("u2", city="Marietta"), **L) == 40
    _, reasons = score_pair(cand("u1", zip_code="30350"), cand("u2", zip_code="30350"), 0.0, location=True)
    assert "Same zip" in reasons


def test_court_side_opposites_score_highest():
    P = dict(location=True, play_profile=True)
    assert score(cand("u1", court_side="left"), cand("u2", court_side="right"), **P) == 80
    assert score(cand("u1", court_side="left"), cand("u2", court_side="left"), **P) == 60
    assert score(cand("u1", court_side="either"), cand("u2", court_side="left"), **P) == 72


def test_availability_overlap_and_flexible():
    P = dict(location=True, play_profile=True)
    a = cand("u1", availability=["weekend_morning", "weekday_evening"])
    b = cand("u2", availability=["weekend_morning"])
    assert score(a, b, **P) == 76
    assert "Shared: Weekend mornings" in score_pair(a, b, 0.0, play_profile=True)[1]
    flex = cand("u1", availability=["flexible"])
    assert score(flex, cand("u2", availability=["weekday_evening"]), **P) == 76
    assert "Flexible schedule" in score_pair(flex, cand("u2", availability=["weekday_evening"]), 0.0, play_profile=True)[1]
    assert score(cand("u1", availability=["weekday_morning"]), cand("u2", availability=["weekend_evening"]), **P) == 61


def test_never_pair_a_player_with_themselves_or_a_rejected_partner():
    assert score(cand("u1"), cand("u1")) is None
    assert score(cand("u1", rejected=["u2"]), cand("u2")) is None
    assert score(cand("u1"), cand("u2", rejected=["u1"])) is None


def test_mixed_doubles_needs_one_male_and_one_female():
    assert score(cand("u1", gender="male"), cand("u2", gender="male"), mixed=True) is None
    assert score(cand("u1", gender="male"), cand("u2"), mixed=True) is None
    assert score(cand("u1", gender="male"), cand("u2", gender="female"), mixed=True) == 40


def test_suggest_pairs_prefers_exact_levels_and_earlier_registrant_is_a():
    people = [cand("u1", 3.0), cand("u2", 3.5), cand("u3", 3.0), cand("u4", 3.5)]
    pairs, unmatched = suggest_pairs(people, 0.5)
    assert unmatched == []
    got = {(p["a"]["user_id"], p["b"]["user_id"]) for p in pairs}
    assert got == {("u1", "u3"), ("u2", "u4")}


def test_suggest_pairs_ties_go_to_the_longest_waiting_and_odd_one_is_explained():
    pairs, unmatched = suggest_pairs([cand("u1"), cand("u2"), cand("u3")], 0.0)
    assert [(p["a"]["user_id"], p["b"]["user_id"]) for p in pairs] == [("u1", "u2")]
    assert unmatched == [{"candidate": cand("u3"), "reason": "Every compatible player was paired with someone else"}]


def test_unmatched_reasons():
    _, solo = suggest_pairs([cand("u1")], 0.0)
    assert solo[0]["reason"] == "Nobody else opted in"
    _, far = suggest_pairs([cand("u1", 3.0), cand("u2", 3.5)], 0.0)
    assert {u["reason"] for u in far} == {"No one within the chosen level range, try a wider level"}
    pairs, widened = suggest_pairs([cand("u1", 3.0), cand("u2", 3.5)], 0.5)
    assert len(pairs) == 1 and widened == []
    _, men = suggest_pairs([cand("u1", gender="male"), cand("u2", gender="male")], 0.0, mixed=True)
    assert {u["reason"] for u in men} == {"Needs an opposite-gender partner"}


def test_court_side_and_availability_are_not_scored_by_default():
    a = cand("u1", court_side="left", availability=["weekend_morning"])
    b = cand("u2", court_side="right", availability=["weekend_morning"])
    assert score(a, b) == score(cand("u1"), cand("u2")) == 40
    assert score_pair(a, b, 0.0)[1] == ["Levels 3.0 / 3.0"]
