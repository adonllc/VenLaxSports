import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import PlayProfile, User


class TestPlayProfileModel:
    def test_empty_is_valid(self):
        assert PlayProfile().model_dump(exclude_unset=True) == {}

    def test_full_profile_valid(self):
        pp = PlayProfile(
            court_side="left",
            dominant_hand="right",
            backhand="two_hand",
            years_playing=5,
            availability=["weekday_evening", "weekend_morning"],
            looking_for_partner=True,
            play_style={"tennis": "baseline", "pickleball": "dinker"},
        )
        assert pp.play_style.tennis == "baseline"
        assert pp.availability == ["weekday_evening", "weekend_morning"]

    @pytest.mark.parametrize("field,value", [
        ("court_side", "middle"),
        ("dominant_hand", "both"),
        ("backhand", "three_hand"),
        ("years_playing", -1),
        ("years_playing", 61),
        ("availability", ["midnight"]),
        ("play_style", {"tennis": "dinker"}),
        ("play_style", {"pickleball": "baseline"}),
    ])
    def test_invalid_values_rejected(self, field, value):
        with pytest.raises(ValidationError):
            PlayProfile(**{field: value})

    def test_user_has_optional_play_profile(self):
        u = User(email="a@b.co", name="A")
        assert u.play_profile is None
        u2 = User(email="a@b.co", name="A", play_profile={"court_side": "either"})
        assert u2.play_profile.court_side == "either"
