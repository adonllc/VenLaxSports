"""Admin marketing emails: audiences, rendering safety, once-only sending, admin-only routes. In-memory fake database."""
import re
import sys
import types
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import bulk_email  # noqa: E402
import email_service  # noqa: E402
from routes import admin_email_routes as routes  # noqa: E402
from test_league_schedule import Coll, run  # noqa: E402


class C(Coll):
    async def insert_one(self, doc):
        doc.setdefault("_id", ObjectId())
        self.docs.append(doc)
        return types.SimpleNamespace(inserted_id=doc["_id"])

    async def update_one(self, q, upd, upsert=False):
        d = await self.find_one(q)
        if d:
            for k, v in upd.get("$set", {}).items():
                d[k] = v
        return types.SimpleNamespace(matched_count=1 if d else 0)


class Db:
    def __init__(self):
        for n in ("users", "player_leagues", "email_campaigns", "email_jobs", "waitlist"):
            setattr(self, n, C())

    def user(self, name, email, **kw):
        uid = ObjectId()
        self.users.docs.append({"_id": uid, "name": name, "email": email, **kw})
        return str(uid)


@pytest.fixture(autouse=True)
def secret(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "x" * 40)
    monkeypatch.setenv("API_PUBLIC_URL", "https://api.example.test")


def db_with_users():
    db = Db()
    db.a = db.user("Ann Lee", "ann@x.com", city="Atlanta")
    db.b = db.user("Bo Ray", "bo@x.com", city="Atlanta", email_notifications=False)
    db.c = db.user("Cy Poe", "cy@x.com", city="Austin", marketing_unsubscribed_at="2026-10-01")
    db.d = db.user("Di Fox", "di@x.com", city="Atlanta")
    db.e = db.user("Ed Kim", "ed@x.com", is_active=False)
    db.player_leagues.docs.append({"player_id": db.d, "league_id": "L", "payment_status": "paid"})
    return db


REG = {"audience": "registered", "template": "season_starts"}


def emails(r):
    return [x["email"] for x in r["send"]]


def test_registered_audience_skips_opted_out_inactive_and_filters():
    db = db_with_users()
    assert emails(run(bulk_email.build_audience(db, REG))) == ["ann@x.com", "di@x.com"]
    assert emails(run(bulk_email.build_audience(db, {**REG, "segment": "no_league"}))) == ["ann@x.com"]
    assert emails(run(bulk_email.build_audience(db, {**REG, "segment": "in_league"}))) == ["di@x.com"]
    assert emails(run(bulk_email.build_audience(db, {**REG, "city": " atlanta "}))) == ["ann@x.com", "di@x.com"]
    assert emails(run(bulk_email.build_audience(db, {**REG, "city": "Austin"}))) == []   # the Austin user opted out


def test_each_person_gets_a_campaign_once(monkeypatch):
    db = db_with_users()
    sent = []

    async def fake(to, subject, title, body, label, url, unsub, reason=None):
        sent.append(to); return True
    monkeypatch.setattr(email_service, "send_campaign_email", fake)
    for rec in run(bulk_email.build_audience(db, REG))["send"]:
        assert run(bulk_email.send_to(db, REG, rec))
    again = run(bulk_email.build_audience(db, REG))
    assert sent == ["ann@x.com", "di@x.com"] and again["send"] == [] and again["skipped"]["already sent"] == 2


def test_failed_send_is_not_recorded(monkeypatch):
    db = db_with_users()

    async def fake(*a, **k): return False
    monkeypatch.setattr(email_service, "send_campaign_email", fake)
    rec = run(bulk_email.build_audience(db, REG))["send"][0]
    assert run(bulk_email.send_to(db, REG, rec)) is False and db.email_campaigns.docs == []


def test_early_list_audience_uses_the_conversion_rules():
    db = Db()
    db.waitlist.docs.append({"_id": ObjectId(), "email": "w@x.com"})
    db.user("Reg", "reg@x.com")
    db.waitlist.docs.append({"_id": ObjectId(), "email": "reg@x.com"})
    r = run(bulk_email.build_audience(db, {"audience": "early_list", "step": 1}))
    assert emails(r) == ["w@x.com"] and r["skipped"]["already registered"] == 1


FREE = {"audience": "registered", "subject": "Doubles night", "body": "Hi all\n\nSee <b>you</b> there {name}!",
        "cta_label": "Join", "cta_url": "https://venlaxsports.com/leagues"}


def test_free_form_text_is_escaped_personalised_and_links_are_tagged():
    m = bulk_email.render(FREE, {"id": "u1", "email": "a@x.com", "first_name": "Ann"})
    assert "<b>" not in m["body"] and "&lt;b&gt;you&lt;/b&gt;" in m["body"] and "Ann!" in m["body"] and "Hi Ann," in m["body"]
    assert re.search(r"utm_source=email&utm_medium=email&utm_campaign=custom_[0-9a-f]{10}$", m["cta_url"])
    assert "/api/email/unsubscribe?token=" in m["unsubscribe_url"]


@pytest.mark.parametrize("patch,msg", [
    ({"cta_url": "https://evil.example.com/x"}, "venlaxsports.com"),
    ({"cta_url": "https://venlaxsports.com.evil.com/x"}, "venlaxsports.com"),
    ({"cta_url": "javascript:alert(1)"}, "venlaxsports.com"),
    ({"subject": "Hi"}, "Subject"),
    ({"body": "short"}, "Message"),
    ({"cta_label": ""}, "button"),
    ({"segment": "everyone"}, "segment"),
    ({"audience": "all_the_things"}, "audience"),
])
def test_validation_rejects_unsafe_or_incomplete_messages(patch, msg):
    with pytest.raises(bulk_email.PayloadError) as e:
        bulk_email.validate({**FREE, **patch})
    assert msg.lower() in str(e.value).lower()


def test_campaign_key_is_stable_per_content():
    assert bulk_email.campaign_key(FREE) == bulk_email.campaign_key(dict(FREE))
    assert bulk_email.campaign_key(FREE) != bulk_email.campaign_key({**FREE, "body": FREE["body"] + " more"})
    assert bulk_email.campaign_key(REG) == "tpl_season_starts"
    assert bulk_email.campaign_key({"audience": "early_list", "step": 2}) == "conversion_2"


@pytest.mark.parametrize("tid", list(bulk_email.TEMPLATES))
def test_template_copy_rules(tid):
    m = bulk_email.render({"audience": "registered", "template": tid}, {"id": "u1", "email": "a@x.com", "first_name": "Ann"})
    text = (m["subject"] + m["body"]).lower()
    assert "hi ann," in text and "waitlist" not in text and "early access" not in text
    assert "8 players" not in text and not re.search(r"\b\d+ (spots|players) (left|remaining)", text)
    assert "utm_campaign=tpl_" + tid in m["cta_url"]


def test_users_unsubscribe_link_round_trips_and_stops_marketing():
    db = db_with_users()
    token = bulk_email.make_user_unsub_token(db.a)
    assert bulk_email.decode_user_unsub_token(token) == db.a
    assert bulk_email.decode_user_unsub_token(bulk_email.cc.make_unsub_token(db.a)) is None   # other token types are refused
    req = types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)))
    page = run(routes.unsubscribe_user(req, token))
    assert b"unsubscribed from VenLax" in page.body
    assert emails(run(bulk_email.build_audience(db, REG))) == ["di@x.com"]
    assert b"not valid" in run(routes.unsubscribe_user(req, "garbage")).body


# ── routes ────────────────────────────────────────────────────────────────────

def request_as(db, monkeypatch, role="admin"):
    admin_id = db.user("Admin", "admin@x.com", role=role)

    async def fake(request, database):
        return {**next(u for u in db.users.docs if str(u["_id"]) == admin_id), "_id": admin_id}
    monkeypatch.setattr(routes, "get_current_user", fake)
    return types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)))


def test_only_admins_may_use_the_routes(monkeypatch):
    db = db_with_users()
    for role in ("player", "city_admin"):
        req = request_as(db, monkeypatch, role)
        with pytest.raises(HTTPException) as e:
            run(routes.preview(routes.EmailPayload(**REG), req))
        assert e.value.status_code == 403


def test_preview_counts_and_shows_the_real_email(monkeypatch):
    db = db_with_users()
    req = request_as(db, monkeypatch)
    r = run(routes.preview(routes.EmailPayload(**REG), req))
    assert r["recipients"] == 3 and r["sample_emails"][0] == "ann@x.com"   # ann, di and the admin themselves
    assert "Unsubscribe" in r["html"] and "Atlanta, GA 30350" in r["html"] and r["skipped"]["opted out"] == 2
    with pytest.raises(HTTPException) as e:
        run(routes.preview(routes.EmailPayload(audience="registered", subject="x", body="y"), req))
    assert e.value.status_code == 400


def test_test_send_goes_only_to_the_admin_and_is_not_recorded(monkeypatch):
    db = db_with_users()
    req = request_as(db, monkeypatch)
    sent = []

    async def fake(to, *a, **k):
        sent.append(to); return True
    monkeypatch.setattr(email_service, "send_campaign_email", fake)
    assert run(routes.test_send(routes.EmailPayload(**REG), req)) == {"sent_to": "admin@x.com"}
    assert sent == ["admin@x.com"] and db.email_campaigns.docs == []


def test_send_needs_the_confirmed_count_and_starts_one_job(monkeypatch):
    db = db_with_users()
    req = request_as(db, monkeypatch)
    started = []

    async def fake_job(database, job_id, payload, recipients, delay=0.5):
        started.append(len(recipients))
    monkeypatch.setattr(bulk_email, "run_job", fake_job)
    body = dict(REG)

    async def go(confirm):
        out = await routes.send(routes.SendRequest(**body, confirm_count=confirm), req)
        await asyncio.sleep(0)
        return out
    import asyncio
    with pytest.raises(HTTPException) as e:
        run(go(99))
    assert e.value.status_code == 409 and started == []
    out = run(go(3))
    assert out["total"] == 3 and started == [3]
    assert db.email_jobs.docs[0]["status"] == "running" and db.email_jobs.docs[0]["campaign_key"] == "tpl_season_starts"
    with pytest.raises(HTTPException) as e:                      # same email already running
        run(go(3))
    assert e.value.status_code == 409


def test_run_job_counts_sent_and_failed(monkeypatch):
    db = db_with_users()
    job_id = ObjectId()
    db.email_jobs.docs.append({"_id": job_id, "status": "running"})

    async def fake(to, *a, **k): return to != "di@x.com"
    monkeypatch.setattr(email_service, "send_campaign_email", fake)
    recs = run(bulk_email.build_audience(db, REG))["send"]
    run(bulk_email.run_job(db, job_id, REG, recs, delay=0))
    job = db.email_jobs.docs[0]
    assert job["status"] == "done" and job["sent"] == 1 and job["failed"] == 1
