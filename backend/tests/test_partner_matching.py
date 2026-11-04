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
