import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import User, normalize_zip  # noqa: E402
from routes.user_routes import ProfileSetupIn, UserProfileUpdate  # noqa: E402


def test_normalize_zip_trims_and_uppercases():
    assert normalize_zip(" 30350 ") == "30350"
    assert normalize_zip("sw1a 1aa") == "SW1A 1AA"
    assert normalize_zip("30350-1234") == "30350-1234"


def test_normalize_zip_blank_means_unset():
    assert normalize_zip(None) is None
    assert normalize_zip("   ") is None


@pytest.mark.parametrize("bad", ["12", "!!!!!", "30350 30350 30350", "<script>"])
def test_normalize_zip_rejects_junk(bad):
    with pytest.raises(ValueError):
        normalize_zip(bad)


def test_profile_update_normalizes_and_rejects():
    assert UserProfileUpdate(zip_code=" 30350 ").zip_code == "30350"
    assert UserProfileUpdate(zip_code="").model_dump(exclude_unset=True) == {"zip_code": None}
    with pytest.raises(ValidationError):
        UserProfileUpdate(zip_code="!!")


def test_setup_accepts_zip_and_user_has_field():
    assert ProfileSetupIn(zip_code="30350").zip_code == "30350"
    assert User(email="a@b.co", name="A").zip_code is None
