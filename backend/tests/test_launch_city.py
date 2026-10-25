"""LAUNCH_CITY gate: leagues outside the launch city stay visible but cannot be joined."""
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import launch_city  # noqa: E402


def test_no_launch_city_means_every_city_is_open(monkeypatch):
    monkeypatch.delenv("LAUNCH_CITY", raising=False)
    assert launch_city.city_is_open("New York") is True
    launch_city.require_city_open({"city": "New York"})  # does not raise


def test_only_the_launch_city_is_open_case_insensitive(monkeypatch):
    monkeypatch.setenv("LAUNCH_CITY", "Atlanta")
    assert launch_city.city_is_open("Atlanta") is True
    assert launch_city.city_is_open("atlanta ") is True
    assert launch_city.city_is_open("New York") is False
    assert launch_city.city_is_open(None) is False


def test_require_city_open_raises_403_with_a_helpful_message(monkeypatch):
    monkeypatch.setenv("LAUNCH_CITY", "Atlanta")
    launch_city.require_city_open({"city": "Atlanta"})
    with pytest.raises(HTTPException) as e:
        launch_city.require_city_open({"city": "Chicago"})
    assert e.value.status_code == 403
    assert "Chicago" in e.value.detail and "Atlanta" in e.value.detail and "Notify Me" in e.value.detail


def test_every_join_entry_point_calls_the_gate():
    """Guard against a new join path forgetting the gate: these four files must reference it."""
    root = Path(__file__).resolve().parent.parent / "routes"
    for name in ["league_routes.py", "payment_routes.py", "round_robin_routes.py"]:
        assert "require_city_open(" in (root / name).read_text(encoding="utf-8"), name
    rr = (root / "round_robin_routes.py").read_text(encoding="utf-8")
    assert rr.count("require_city_open(league)") == 3  # join, invite-partner, accept-invite
