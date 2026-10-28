"""Automation workflows: no back-fill, send-time exits, once per player, daily cap, admin controls. Fake database."""
import sys
import types
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import bulk_email  # noqa: E402
import email_automation as auto  # noqa: E402
import email_service  # noqa: E402
from routes import admin_automation_routes as routes  # noqa: E402
from test_bulk_email import C, Db as BaseDb  # noqa: E402
from test_league_schedule import run  # noqa: E402

NOW = datetime(2026, 11, 1, 12, 0, tzinfo=timezone.utc)


class Db(BaseDb):
    def __init__(self):
        super().__init__()
        for n in ("automations", "workflow_runs", "audit_log"):
            setattr(self, n, C())

    def player(self, email, hours_ago, **kw):
        uid = self.user(email.split("@")[0], email, created_at=(NOW - timedelta(hours=hours_ago)).isoformat(), **kw)
        return uid


@pytest.fixture(autouse=True)
def env(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "x" * 40)
    monkeypatch.setenv("API_PUBLIC_URL", "https://api.example.test")


@pytest.fixture
def sent(monkeypatch):
    out = []

    async def fake(to, subject, title, body, label, url, unsub, reason=None):
        out.append(to); return True
    monkeypatch.setattr(email_service, "send_campaign_email", fake)
    return out


DEF = {"name": "Welcome nudge", "trigger": "signup", "delay_hours": 24, "conditions": {"segment": "no_league"},
       "exit_on_league": True, "email": {"template": "season_starts"}}


def workflow(db, enabled_hours_ago=48, **over):
    d = auto.validate_definition({**DEF, **over})
    doc = {**d, "_id": ObjectId(), "enabled": True, "enabled_at": NOW - timedelta(hours=enabled_hours_ago)}
    db.automations.docs.append(doc)
    return doc


def go(db):
    return run(auto.run_pass(db, now=NOW, delay=0))


def test_only_people_who_triggered_after_it_was_turned_on_are_emailed(sent):
    db = Db()
    db.player("old@x.com", 100)        # signed up before the workflow was on: never back-filled
    db.player("new@x.com", 30)         # after, and the 24h delay has passed
    db.player("fresh@x.com", 5)        # after, but still waiting
    workflow(db)
    assert go(db)["sent"] == 1 and sent == ["new@x.com"]
    assert go(db)["sent"] == 0 and sent == ["new@x.com"]       # a second pass never repeats


def test_a_workflow_that_is_off_or_has_no_start_line_does_nothing(sent):
    db = Db()
    db.player("new@x.com", 30)
    wf = workflow(db)
    wf["enabled"] = False
    assert go(db) == {"sent": 0, "failed": 0, "exited": 0, "held": 0} and sent == []
    wf["enabled"], wf["enabled_at"] = True, None
    assert go(db)["sent"] == 0 and sent == []


def test_exit_rules_are_checked_at_send_time(sent):
    db = Db()
    joined = db.player("joined@x.com", 30)
    db.player("optout@x.com", 30, marketing_unsubscribed_at="2026-10-31")
    db.player("susp@x.com", 30, suspended_at="2026-10-31")
    db.player_leagues.docs.append({"player_id": joined, "league_id": "L", "payment_status": "paid"})
    workflow(db)
    c = go(db)
    assert sent == [] and c["exited"] == 3
    why = {r["email"]: r["reason"] for r in db.workflow_runs.docs}
    assert why["joined@x.com"] == "joined a league while waiting"
    assert why["optout@x.com"] == "opted out of marketing email" and why["susp@x.com"].startswith("account suspended")


def test_conditions_filter_by_segment_and_city(sent):
    db = Db()
    db.player("atl@x.com", 30, city="Atlanta")
    db.player("aus@x.com", 30, city="Austin")
    workflow(db, conditions={"segment": "all", "city": " atlanta "}, exit_on_league=False)
    go(db)
    assert sent == ["atl@x.com"]


def test_someone_who_already_got_the_same_email_is_not_sent_it_again(sent):
    db = Db()
    uid = db.player("new@x.com", 30)
    db.email_campaigns.docs.append({"user_id": uid, "campaign": "tpl_season_starts"})
    workflow(db)
    go(db)
    assert sent == [] and db.workflow_runs.docs[0]["reason"] == "already received this email"


def test_league_joined_trigger_uses_the_first_join_time(sent):
    db = Db()
    a = db.player("a@x.com", 500)
    b = db.player("b@x.com", 500)
    db.player_leagues.docs += [
        {"player_id": a, "payment_status": "paid", "joined_at": (NOW - timedelta(hours=30)).isoformat()},
        {"player_id": a, "payment_status": "paid", "joined_at": (NOW - timedelta(hours=2)).isoformat()},
        {"player_id": b, "payment_status": "pending", "joined_at": (NOW - timedelta(hours=30)).isoformat()},   # unpaid: not a join
    ]
    workflow(db, trigger="league_joined", delay_hours=1, conditions={"segment": "in_league"}, exit_on_league=False)
    go(db)
    assert sent == ["a@x.com"]


def test_one_automation_email_per_player_per_day_and_the_rest_wait(sent):
    db = Db()
    db.player("new@x.com", 30)
    workflow(db)
    workflow(db, name="Second nudge", email={"template": "thank_you"}, delay_hours=1)
    c = go(db)
    assert c["sent"] == 1 and c["held"] == 1 and len(sent) == 1
    assert len(db.workflow_runs.docs) == 1                       # the held one is not recorded, so it is retried


def test_failed_send_is_recorded_and_not_retried_forever(monkeypatch):
    db = Db()
    db.player("new@x.com", 30)

    async def fake(*a, **k): return False
    monkeypatch.setattr(email_service, "send_campaign_email", fake)
    workflow(db)
    assert go(db)["failed"] == 1 and go(db)["failed"] == 0
    assert db.workflow_runs.docs[0]["status"] == "failed"


def test_per_pass_cap(sent, monkeypatch):
    monkeypatch.setattr(auto, "MAX_PER_PASS", 2)
    db = Db()
    for i in range(5):
        db.player(f"p{i}@x.com", 30)
    workflow(db)
    assert go(db)["sent"] == 2


def test_admins_are_never_enrolled(sent):
    db = Db()
    db.player("boss@x.com", 30, role="admin")
    workflow(db)
    go(db)
    assert sent == []


@pytest.mark.parametrize("patch,msg", [
    ({"name": "x"}, "name"), ({"trigger": "birthday"}, "trigger"), ({"delay_hours": -1}, "Delay"),
    ({"delay_hours": 24 * 31}, "Delay"), ({"delay_hours": 1.5}, "Delay"), ({"conditions": {"segment": "vip"}}, "condition"),
    ({"email": {"template": "nope"}}, "template"), ({"email": {"subject": "Hi", "body": "short"}}, "Subject"),
    ({"email": {"subject": "Hello there", "body": "A long enough body here", "cta_label": "Go", "cta_url": "https://evil.example.com"}}, "venlaxsports.com"),
])
def test_definitions_are_validated(patch, msg):
    with pytest.raises(auto.WorkflowError) as e:
        auto.validate_definition({**DEF, **patch})
    assert msg.lower() in str(e.value).lower()


# ── admin routes ──────────────────────────────────────────────────────────────

def req(db):
    return types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)), headers={}, client=None, cookies={})


@pytest.fixture
def as_admin(monkeypatch):
    admin = {"_id": ObjectId(), "role": "admin", "email": "a@x.com", "name": "A"}

    async def fake_user(request, db): return admin
    monkeypatch.setattr(routes, "get_current_user", fake_user)
    return admin


def body(**over):
    return routes.WorkflowIn(**{**DEF, "conditions": routes.ConditionsIn(**DEF["conditions"]), "email": routes.EmailIn(**DEF["email"]), **over})


def test_new_workflows_start_off_and_enabling_sets_the_start_line(as_admin):
    db = Db()
    r = req(db)
    wid = run(routes.create_workflow(body(), r))["id"]
    doc = db.automations.docs[0]
    assert doc["enabled"] is False and doc["enabled_at"] is None
    run(routes.switch(wid, "enable", r))
    assert doc["enabled"] is True and doc["enabled_at"] is not None
    first = doc["enabled_at"]
    run(routes.switch(wid, "disable", r))
    run(routes.switch(wid, "enable", r))
    assert doc["enabled_at"] >= first                               # re-enabling moves the line forward, never back
    assert [a["action"] for a in db.audit_log.docs] == ["automation.create", "automation.enable", "automation.disable", "automation.enable"]


def test_cannot_edit_while_on_and_bad_input_is_a_400(as_admin):
    db = Db()
    r = req(db)
    wid = run(routes.create_workflow(body(), r))["id"]
    run(routes.switch(wid, "enable", r))
    with pytest.raises(HTTPException) as e:
        run(routes.update_workflow(wid, body(name="Renamed flow"), r))
    assert e.value.status_code == 409
    run(routes.switch(wid, "disable", r))
    run(routes.update_workflow(wid, body(name="Renamed flow"), r))
    assert db.automations.docs[0]["name"] == "Renamed flow"
    with pytest.raises(HTTPException) as e:
        run(routes.create_workflow(body(delay_hours=-5), r))
    assert e.value.status_code == 400


def test_non_marketing_roles_cannot_use_automations(monkeypatch):
    db = Db()

    async def league_admin(request, d): return {"_id": ObjectId(), "role": "city_admin"}
    monkeypatch.setattr(routes, "get_current_user", league_admin)
    for call in (routes.list_workflows(req(db)), routes.create_workflow(body(), req(db))):
        with pytest.raises(HTTPException) as e:
            run(call)
        assert e.value.status_code == 403


def test_history_and_list_show_what_happened(as_admin, sent):
    db = Db()
    db.player("new@x.com", 30)
    db.player("opt@x.com", 30, marketing_unsubscribed_at="2026-10-31")
    wf = workflow(db)
    go(db)
    h = run(routes.history(str(wf["_id"]), req(db)))["runs"]
    assert {(r["email"], r["status"]) for r in h} == {("new@x.com", "sent"), ("opt@x.com", "exited")}
    row = run(routes.list_workflows(req(db)))["workflows"][0]
    assert row["stats"] == {"sent": 1, "failed": 0, "exited": 1} and "payload" not in row
