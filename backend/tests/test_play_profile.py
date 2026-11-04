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


from routes.user_routes import (
    UserProfileUpdate, ProfileSetupIn, play_search_fields,
)


class TestRequestModels:
    def test_profile_update_dumps_only_set_nested_keys(self):
        body = UserProfileUpdate(play_profile={"court_side": "left"})
        assert body.model_dump(exclude_unset=True) == {"play_profile": {"court_side": "left"}}

    def test_profile_update_null_clears(self):
        body = UserProfileUpdate(play_profile=None)
        assert body.model_dump(exclude_unset=True) == {"play_profile": None}

    def test_profile_update_rejects_bad_enum(self):
        with pytest.raises(ValidationError):
            UserProfileUpdate(play_profile={"court_side": "middle"})

    def test_setup_accepts_play_profile(self):
        body = ProfileSetupIn(play_profile={"looking_for_partner": True})
        assert body.play_profile.looking_for_partner is True


class TestSearchFields:
    def test_returns_fields_for_public_user(self):
        u = {"profile_public": True, "play_profile": {
            "court_side": "right", "play_style": {"tennis": "baseline"}, "looking_for_partner": True,
            "dominant_hand": "left"}}
        assert play_search_fields(u) == {
            "court_side": "right",
            "play_style": {"tennis": "baseline"},
            "looking_for_partner": True,
        }

    def test_hidden_for_private_user(self):
        u = {"profile_public": False, "play_profile": {"court_side": "right", "looking_for_partner": True}}
        assert play_search_fields(u) == {"court_side": None, "play_style": None, "looking_for_partner": False}

    def test_missing_profile(self):
        assert play_search_fields({}) == {"court_side": None, "play_style": None, "looking_for_partner": False}


from auth_utils import serialize_public_user


class TestPublicSerializer:
    def test_includes_play_profile_when_public(self):
        u = {"_id": "1", "name": "A", "profile_public": True,
             "play_profile": {"court_side": "left"}, "phone": "+1-555"}
        out = serialize_public_user(u)
        assert out["play_profile"] == {"court_side": "left"}
        assert "phone" not in out

    def test_omits_play_profile_when_private(self):
        u = {"_id": "1", "name": "A", "profile_public": False, "play_profile": {"court_side": "left"}}
        assert serialize_public_user(u)["play_profile"] is None

    def test_none_when_unset(self):
        assert serialize_public_user({"_id": "1", "name": "A"})["play_profile"] is None
