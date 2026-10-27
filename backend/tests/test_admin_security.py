"""Admin roles (server-side permission checks) and the append-only audit log. In-memory fake database."""
import sys
import types
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import audit_log  # noqa: E402
import permissions  # noqa: E402
from routes import admin_routes, admin_team_routes  # noqa: E402
from test_league_schedule import Coll, Cursor, run  # noqa: E402


class Cur(Cursor):
    def skip(self, n):
        self.docs = self.docs[n:]
        return self

    def limit(self, n):
        self.docs = self.docs[:n]
        return self


class C(Coll):
    def find(self, q=None, *a, **kw):
        return Cur([d for d in self.docs if self._match(d, q or {})])

    async def insert_one(self, doc):
        doc.setdefault("_id", ObjectId())
        self.docs.append(doc)
        return types.SimpleNamespace(inserted_id=doc["_id"])

    async def delete_one(self, q):
        d = await self.find_one(q)
        if d:
            self.docs.remove(d)
        return types.SimpleNamespace(deleted_count=1 if d else 0)


class Db:
    def __init__(self):
        for n in ("users", "audit_log", "leagues", "player_leagues", "matches", "rating_history", "payment_transactions",
                  "challenges", "referral_credits", "ladder_challenges", "feature_flags"):
            setattr(self, n, C())

    def user(self, email, **kw):
        uid = ObjectId()
        self.users.docs.append({"_id": uid, "email": email, "name": email.split("@")[0].title(), "role": "player", **kw})
        return str(uid)


def request_as(db, monkeypatch, user_id):
    async def fake(request, database):
        return {**next(u for u in db.users.docs if str(u["_id"]) == user_id), "_id": user_id}
    for mod in (admin_routes, admin_team_routes):
        monkeypatch.setattr(mod, "get_current_user", fake)
    return types.SimpleNamespace(
        app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)),
        headers={"x-forwarded-for": "203.0.113.9, 10.0.0.1"}, client=None,
    )


# ── roles ─────────────────────────────────────────────────────────────────────

def test_an_existing_admin_without_a_role_is_still_a_super_administrator():
    assert permissions.effective_role({"role": "admin"}) == "super_admin"
    assert all(permissions.has({"role": "admin"}, p) for p in permissions.ALL_PERMISSIONS)


def test_players_have_no_admin_permissions_and_city_admins_are_league_only():
    assert permissions.effective_role({"role": "player"}) is None
    assert permissions.permissions_for({"role": "player"}) == set()
    city = {"role": "city_admin"}
    assert permissions.has(city, "leagues.write") and permissions.has(city, "payments.write")
    assert not any(permissions.has(city, p) for p in ("players.read", "players.export", "marketing.send", "settings.write", "audit.read"))


def test_an_unknown_role_name_fails_closed_to_read_only():
    user = {"role": "admin", "admin_role": "typo"}
    assert permissions.effective_role(user) == "read_only"
    assert permissions.has(user, "players.read") and not permissions.has(user, "players.delete")


def test_each_role_gets_only_what_it_needs():
    marketing = {"role": "admin", "admin_role": "marketing"}
    assert permissions.has(marketing, "marketing.send") and not permissions.has(marketing, "players.delete")
    analytics = {"role": "admin", "admin_role": "analytics_viewer"}
    assert permissions.has(analytics, "reports.read") and not permissions.has(analytics, "players.read")
    support = {"role": "admin", "admin_role": "support"}
    assert permissions.has(support, "players.write") and not permissions.has(support, "players.export")
    ops = {"role": "admin", "admin_role": "operations"}
    assert not permissions.has(ops, "roles.manage") and not permissions.has(ops, "audit.read")


def test_ensure_raises_403_with_the_role_name():
    with pytest.raises(HTTPException) as e:
        permissions.ensure({"role": "admin", "admin_role": "read_only"}, "players.delete")
    assert e.value.status_code == 403 and "Read-only" in e.value.detail
    with pytest.raises(HTTPException) as e:
        permissions.ensure({"role": "player"}, "dashboard.read")
    assert e.value.status_code == 403


# ── audit log ─────────────────────────────────────────────────────────────────

def test_record_stores_who_what_and_redacts_secrets():
    db = Db()
    admin = {"_id": ObjectId(), "email": "a@x.com", "role": "admin"}
    run(audit_log.record(db, admin, "player.delete", "user", "u1", "p@x.com",
                         before={"email": "p@x.com", "password_hash": "abc", "nested": {"token": "t", "ok": 1}},
                         request=types.SimpleNamespace(headers={"x-forwarded-for": "203.0.113.9, 10.0.0.1"}, client=None)))
    row = db.audit_log.docs[0]
    assert row["action"] == "player.delete" and row["admin_email"] == "a@x.com" and row["admin_role"] == "super_admin"
    assert row["before"]["password_hash"] == "[redacted]" and row["before"]["nested"] == {"token": "[redacted]", "ok": 1}
    assert row["ip"] == "203.0.113.9" and row["at"]


def test_a_failing_audit_write_never_blocks_the_admin_action():
    class Broken:
        class audit_log:
            @staticmethod
            async def insert_one(doc):
                raise RuntimeError("db down")
    run(audit_log.record(Broken, {"_id": "1", "role": "admin"}, "x.y"))   # must not raise


def test_diff_keeps_only_changed_fields():
    assert audit_log.diff({"a": 1, "b": 2}, {"a": 1, "b": 3}) == ({"b": 2}, {"b": 3})


def test_search_filters_pages_and_newest_first():
    db = Db()
    for i in range(5):
        db.audit_log.docs.append({"_id": ObjectId(), "at": f"2026-10-0{i + 1}", "action": "league.update", "admin_id": "a"})
    r = run(audit_log.search(db, admin_id="a", limit=2))
    assert r["total"] == 5 and [x["at"] for x in r["items"]] == ["2026-10-05", "2026-10-04"] and "id" in r["items"][0]


# ── routes ────────────────────────────────────────────────────────────────────

def test_a_marketing_admin_cannot_delete_a_player(monkeypatch):
    db = Db()
    marketer = db.user("m@x.com", role="admin", admin_role="marketing")
    victim = db.user("v@x.com")
    req = request_as(db, monkeypatch, marketer)
    with pytest.raises(HTTPException) as e:
        run(admin_routes.delete_user(victim, req))
    assert e.value.status_code == 403
    assert len(db.users.docs) == 2 and db.audit_log.docs == []


def test_deleting_a_player_is_audited_and_you_cannot_delete_yourself(monkeypatch):
    db = Db()
    boss = db.user("boss@x.com", role="admin")
    victim = db.user("v@x.com", city="Atlanta", password_hash="secret")
    req = request_as(db, monkeypatch, boss)
    with pytest.raises(HTTPException) as e:
        run(admin_routes.delete_user(boss, req))
    assert e.value.status_code == 400
    run(admin_routes.delete_user(victim, req))
    row = db.audit_log.docs[0]
    assert row["action"] == "player.delete" and row["target_id"] == victim and row["admin_email"] == "boss@x.com"
    assert row["before"]["email"] == "v@x.com" and "secret" not in str(row)
    assert all(str(u["_id"]) != victim for u in db.users.docs)


def test_site_settings_need_the_settings_permission_and_are_audited(monkeypatch):
    db = Db()
    support = db.user("s@x.com", role="admin", admin_role="support")
    boss = db.user("boss@x.com", role="admin")
    with pytest.raises(HTTPException) as e:
        run(admin_routes.set_site_settings(request_as(db, monkeypatch, support), {"open_cities": ["Atlanta"]}))
    assert e.value.status_code == 403
    run(admin_routes.set_site_settings(request_as(db, monkeypatch, boss), {"open_cities": ["Atlanta"]}))
    assert db.audit_log.docs[0]["action"] == "settings.site" and db.audit_log.docs[0]["after"] == {"open_cities": ["Atlanta"]}


def test_only_a_super_administrator_reads_the_audit_log_and_manages_roles(monkeypatch):
    db = Db()
    ops = db.user("ops@x.com", role="admin", admin_role="operations")
    for call in (lambda r: admin_team_routes.get_audit_log(r), lambda r: admin_team_routes.team(r)):
        with pytest.raises(HTTPException) as e:
            run(call(request_as(db, monkeypatch, ops)))
        assert e.value.status_code == 403
    me = run(admin_team_routes.my_permissions(request_as(db, monkeypatch, ops)))
    assert me["role"] == "operations" and "audit.read" not in me["permissions"]


def test_role_change_is_audited_and_the_last_super_admin_is_protected(monkeypatch):
    db = Db()
    boss = db.user("boss@x.com", role="admin")
    other = db.user("other@x.com", role="admin")
    player = db.user("p@x.com")
    req = request_as(db, monkeypatch, boss)

    run(admin_team_routes.set_role(other, admin_team_routes.RoleChange(admin_role="marketing"), req))
    assert permissions.effective_role(next(u for u in db.users.docs if str(u["_id"]) == other)) == "marketing"
    row = db.audit_log.docs[-1]
    assert row["action"] == "admin.role_change" and row["before"] == {"admin_role": "super_admin"} and row["after"] == {"admin_role": "marketing"}

    with pytest.raises(HTTPException) as e:                       # boss is now the only super administrator
        run(admin_team_routes.set_role(boss, admin_team_routes.RoleChange(admin_role="read_only"), req))
    assert e.value.status_code == 409
    with pytest.raises(HTTPException) as e:
        run(admin_team_routes.set_role(other, admin_team_routes.RoleChange(admin_role="god"), req))
    assert e.value.status_code == 400
    with pytest.raises(HTTPException) as e:                       # a player is not an administrator
        run(admin_team_routes.set_role(player, admin_team_routes.RoleChange(admin_role="marketing"), req))
    assert e.value.status_code == 404

    listing = run(admin_team_routes.get_audit_log(req))
    assert listing["total"] == 1
