"""Open-cities gate and the admin switches (cities + Google tracking). In-memory fake db, no live Mongo."""
import asyncio
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import launch_city  # noqa: E402
from routes import admin_routes  # noqa: E402


class Flags:
    def __init__(self):
        self.docs = {}

    async def find_one(self, q):
        return self.docs.get(q["_id"])

    async def update_one(self, q, update, upsert=False):
        doc = self.docs.setdefault(q["_id"], {"_id": q["_id"]})
        doc.update(update.get("$set", {}))


class FakeDb:
    def __init__(self):
        self.feature_flags = Flags()
        self.audit_log = Flags()


def run(coro):
    return asyncio.run(coro)


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    monkeypatch.delenv("LAUNCH_CITY", raising=False)
    launch_city.invalidate_cache()
    yield
    launch_city.invalidate_cache()


# ------------------------------------------------------------------ which cities are open
def test_nothing_configured_means_every_city_is_open():
    db = FakeDb()
    assert run(launch_city.get_open_cities(db)) is None
    run(launch_city.require_city_open(db, {"city": "New York"}))  # does not raise


def test_env_fallback_supports_one_or_several_cities(monkeypatch):
    db = FakeDb()
    monkeypatch.setenv("LAUNCH_CITY", "Atlanta, Dallas")
    assert run(launch_city.get_open_cities(db)) == ["Atlanta", "Dallas"]


def test_admin_setting_overrides_env(monkeypatch):
    db = FakeDb()
    monkeypatch.setenv("LAUNCH_CITY", "Atlanta")
    db.feature_flags.docs["open_cities"] = {"_id": "open_cities", "cities": ["Chicago"], "all_open": False}
    assert run(launch_city.get_open_cities(db)) == ["Chicago"]


def test_admin_all_open_means_no_restriction(monkeypatch):
    db = FakeDb()
    monkeypatch.setenv("LAUNCH_CITY", "Atlanta")
    db.feature_flags.docs["open_cities"] = {"_id": "open_cities", "cities": [], "all_open": True}
    assert run(launch_city.get_open_cities(db)) is None


def test_admin_empty_list_closes_every_city():
    db = FakeDb()
    db.feature_flags.docs["open_cities"] = {"_id": "open_cities", "cities": [], "all_open": False}
    with pytest.raises(HTTPException) as e:
        run(launch_city.require_city_open(db, {"city": "Atlanta"}))
    assert e.value.status_code == 403 and "no city yet" in e.value.detail


def test_only_open_cities_pass_case_insensitive_and_message_is_helpful():
    db = FakeDb()
    db.feature_flags.docs["open_cities"] = {"_id": "open_cities", "cities": ["Atlanta"], "all_open": False}
    run(launch_city.require_city_open(db, {"city": " atlanta "}))
    with pytest.raises(HTTPException) as e:
        run(launch_city.require_city_open(db, {"city": "Chicago"}))
    assert e.value.status_code == 403
    assert "Chicago" in e.value.detail and "Atlanta" in e.value.detail and "Notify Me" in e.value.detail
    assert launch_city.city_is_open(["Atlanta"], None) is False


def test_result_is_cached_until_invalidated():
    db = FakeDb()
    assert run(launch_city.get_open_cities(db)) is None
    db.feature_flags.docs["open_cities"] = {"_id": "open_cities", "cities": ["Atlanta"], "all_open": False}
    assert run(launch_city.get_open_cities(db)) is None  # still the cached answer
    launch_city.invalidate_cache()
    assert run(launch_city.get_open_cities(db)) == ["Atlanta"]


# ------------------------------------------------------------------ Google tracking switch
def test_google_tracking_is_on_by_default_and_admin_can_turn_it_off():
    db = FakeDb()
    assert run(launch_city.get_google_analytics_enabled(db)) is True
    db.feature_flags.docs["google_analytics"] = {"_id": "google_analytics", "enabled": False}
    assert run(launch_city.get_google_analytics_enabled(db)) is False


# ------------------------------------------------------------------ admin endpoints
def _admin_request(db):
    return type("Req", (), {"app": type("A", (), {"state": type("S", (), {"db": db})()})()})()


def test_admin_can_save_and_read_back_settings(monkeypatch):
    async def fake_admin(request, db):
        return {"_id": "admin1", "role": "admin"}

    monkeypatch.setattr(admin_routes, "get_current_user", fake_admin)
    monkeypatch.setattr(admin_routes, "require_admin", fake_admin)
    db = FakeDb()
    req = _admin_request(db)

    run(admin_routes.set_site_settings(req, {"open_cities": ["Atlanta", "Dallas"], "all_open": False, "google_analytics": False}))
    got = run(admin_routes.get_site_settings(req))
    assert got == {"all_open": False, "open_cities": ["Atlanta", "Dallas"], "google_analytics": False}

    run(admin_routes.set_site_settings(req, {"open_cities": [], "all_open": True}))
    got = run(admin_routes.get_site_settings(req))
    assert got["all_open"] is True and got["google_analytics"] is False  # untouched by the second save


def test_admin_rejects_a_bad_city_list(monkeypatch):
    async def fake_admin(request, db):
        return {"_id": "admin1", "role": "admin"}

    monkeypatch.setattr(admin_routes, "get_current_user", fake_admin)
    with pytest.raises(HTTPException) as e:
        run(admin_routes.set_site_settings(_admin_request(FakeDb()), {"open_cities": ["Atlanta", 5]}))
    assert e.value.status_code == 400


# ------------------------------------------------------------------ every join path is gated
def test_every_join_entry_point_calls_the_gate():
    root = Path(__file__).resolve().parent.parent / "routes"
    for name in ["league_routes.py", "payment_routes.py", "round_robin_routes.py"]:
        assert "await require_city_open(db, league)" in (root / name).read_text(encoding="utf-8"), name
    rr = (root / "round_robin_routes.py").read_text(encoding="utf-8")
    assert rr.count("await require_city_open(db, league)") == 3  # join, invite-partner, accept-invite
