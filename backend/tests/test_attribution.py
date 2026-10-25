"""Signup source tracking: sanitizing what the browser sends, grouping into channels, and the admin report."""
import asyncio
import sys
from pathlib import Path

from bson import ObjectId

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import attribution as attr  # noqa: E402
from routes import admin_routes  # noqa: E402


# ------------------------------------------------------------------ sanitize
def test_keeps_only_known_keys_and_lowercases_utm_values():
    out = attr.sanitize_attribution({"first": {"source": " Instagram ", "medium": "SOCIAL", "campaign": "Atlanta-Launch",
                                               "ref": "REF_ABC123", "evil": "<script>", "landing": "/leagues"}})
    assert out == {"first": {"source": "instagram", "medium": "social", "campaign": "atlanta-launch",
                             "ref": "REF_ABC123", "landing": "/leagues"}}


def test_truncates_long_values_and_strips_control_characters():
    out = attr.sanitize_attribution({"first": {"source": "x" * 500 + "\x00\n"}})
    assert len(out["first"]["source"]) == attr.MAX_LEN and "\x00" not in out["first"]["source"]


def test_last_touch_is_stored_only_when_it_differs():
    same = attr.sanitize_attribution({"first": {"source": "facebook"}, "last": {"source": "facebook"}})
    assert "last" not in same
    diff = attr.sanitize_attribution({"first": {"source": "facebook"}, "last": {"source": "google"}})
    assert diff["last"] == {"source": "google"}


def test_garbage_input_gives_none():
    for bad in (None, "x", 5, [], {}, {"first": {}}, {"first": {"nope": "1"}}, {"first": "str"}):
        assert attr.sanitize_attribution(bad) is None


def test_last_touch_alone_becomes_first():
    assert attr.sanitize_attribution({"last": {"source": "bing"}}) == {"first": {"source": "bing"}}


# ------------------------------------------------------------------ channel fallbacks
def test_channel_prefers_utm_then_referral_code_then_referring_site_then_direct():
    assert attr.channel_for({"first": {"source": "instagram", "medium": "social", "campaign": "c1"}}) == ("instagram", "social", "c1")
    assert attr.channel_for({"first": {"source": "newsletter"}}) == ("newsletter", "(none)", "(none)")
    assert attr.channel_for({"first": {"ref": "REF_X"}}) == ("referral", "friend", "(none)")
    assert attr.channel_for({"first": {"referrer": "google.com"}}) == ("google.com", "referral", "(none)")
    assert attr.channel_for(None) == ("(direct)", "(none)", "(none)")
    assert attr.channel_for({}) == ("(direct)", "(none)", "(none)")


# ------------------------------------------------------------------ report
def _user(source=None):
    return {"_id": ObjectId(), "attribution": {"first": {"source": source, "medium": "social"}} if source else None}


def test_report_counts_signups_joins_and_players_per_channel():
    a1, a2, a3 = _user("instagram"), _user("instagram"), _user("instagram")
    b1 = _user("facebook")
    d1 = _user()
    joined = {str(a1["_id"]), str(a2["_id"]), str(b1["_id"])}
    played = {str(a1["_id"])}
    rows = attr.build_report([a1, a2, a3, b1, d1], joined, played)
    by = {r["source"]: r for r in rows}
    assert by["instagram"] == {"source": "instagram", "medium": "social", "campaign": "(none)", "signups": 3, "joined": 2, "played": 1, "join_rate": 66.7}
    assert by["facebook"]["signups"] == 1 and by["facebook"]["join_rate"] == 100.0
    assert by["(direct)"]["signups"] == 1 and by["(direct)"]["joined"] == 0
    assert rows[0]["source"] == "instagram"  # biggest channel first


def test_empty_report():
    assert attr.build_report([], set(), set()) == []


# ------------------------------------------------------------------ admin endpoint
class Cursor:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, n=None):
        return list(self.docs)


class Coll:
    def __init__(self, docs):
        self.docs = docs

    def find(self, q=None, projection=None):
        return Cursor(self.docs)


class FakeDb:
    def __init__(self, users, joined_ids, played_ids):
        self.users = Coll(users)
        self.player_leagues = Coll([{"player_id": i} for i in joined_ids])
        self.rating_history = Coll([{"user_id": i} for i in played_ids])


def test_admin_report_endpoint_shapes_the_response(monkeypatch):
    async def fake_admin(request, db):
        return {"_id": "a"}

    monkeypatch.setattr(admin_routes, "require_admin", fake_admin)
    u1, u2, u3 = _user("instagram"), _user("instagram"), _user()
    db = FakeDb([u1, u2, u3], [str(u1["_id"])], [str(u1["_id"])])
    request = type("R", (), {"app": type("A", (), {"state": type("S", (), {"db": db})()})()})()
    out = asyncio.run(admin_routes.marketing_report(request, days=30))
    assert out["days"] == 30 and out["totals"] == {"signups": 3, "joined": 1, "played": 1}
    assert out["untracked"] == 1
    assert out["rows"][0]["source"] == "instagram"


def test_admin_report_clamps_days(monkeypatch):
    async def fake_admin(request, db):
        return {"_id": "a"}

    monkeypatch.setattr(admin_routes, "require_admin", fake_admin)
    db = FakeDb([], [], [])
    request = type("R", (), {"app": type("A", (), {"state": type("S", (), {"db": db})()})()})()
    assert asyncio.run(admin_routes.marketing_report(request, days=99999))["days"] == 365
    assert asyncio.run(admin_routes.marketing_report(request, days=0))["days"] == 1
