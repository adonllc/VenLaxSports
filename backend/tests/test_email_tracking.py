"""Email click tracking, per-campaign results and scheduled sends. In-memory fake database."""
import sys
import types
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import bulk_email  # noqa: E402
import email_schedule  # noqa: E402
import email_service  # noqa: E402
import email_tracking  # noqa: E402
from routes import admin_email_routes as routes  # noqa: E402
from test_bulk_email import C, Db as BaseDb  # noqa: E402
from test_league_schedule import run  # noqa: E402


class Db(BaseDb):
    def __init__(self):
        super().__init__()
        for n in ("email_events", "scheduled_emails", "audit_log"):
            setattr(self, n, C())


@pytest.fixture(autouse=True)
def env(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "x" * 40)
    monkeypatch.setenv("API_PUBLIC_URL", "https://api.example.test")


FREE = {"audience": "registered", "subject": "Doubles night", "body": "See you there {name}",
        "cta_label": "Join", "cta_url": "https://venlaxsports.com/leagues"}
DEST = "https://venlaxsports.com/leagues?utm_source=email"


def token_of(url):
    return parse_qs(urlparse(url).query)["t"][0]


def test_click_link_round_trips_and_names_campaign_and_player():
    url = email_tracking.click_url("tpl_x", "u1", DEST)
    assert url.startswith("https://api.example.test/api/email/click?t=")
    assert email_tracking.decode_click(token_of(url)) == {"campaign": "tpl_x", "user_id": "u1", "destination": DEST}


def test_edited_or_foreign_tokens_are_rejected():
    good = token_of(email_tracking.click_url("c", "u", DEST))
    assert email_tracking.decode_click(good[:-3] + "abc") is None
    assert email_tracking.decode_click("garbage") is None
    # a validly signed token that points off-site is still refused (no open redirect)
    evil = token_of(email_tracking.click_url("c", "u", "https://evil.example.com/x"))
    assert email_tracking.decode_click(evil) is None
    evil2 = token_of(email_tracking.click_url("c", "u", "https://venlaxsports.com.evil.com/x"))
    assert email_tracking.decode_click(evil2) is None
    # another kind of signed token (an unsubscribe link) cannot be replayed as a click
    assert email_tracking.decode_click(bulk_email.make_user_unsub_token("u1")) is None


def test_click_route_records_once_per_visit_and_redirects(monkeypatch):
    db = Db()
    req = types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)))
    r = run(routes.click(req, token_of(email_tracking.click_url("c1", "u1", DEST))))
    assert r.status_code == 302 and r.headers["location"] == DEST
    ev = db.email_events.docs[0]
    assert ev["campaign"] == "c1" and ev["user_id"] == "u1" and isinstance(ev["at"], datetime)
    assert set(ev) == {"_id", "type", "campaign", "user_id", "at"}      # no IP, user agent or cookie stored
    bad = run(routes.click(req, "garbage"))
    assert bad.headers["location"] == bulk_email.SITE and len(db.email_events.docs) == 1


def test_real_send_tracks_the_button_but_a_test_send_does_not(monkeypatch):
    db = Db()
    uid = db.user("Ann Lee", "ann@x.com")
    seen = []

    async def fake(to, subject, title, body, label, url, unsub, reason=None):
        seen.append(url); return True
    monkeypatch.setattr(email_service, "send_campaign_email", fake)
    rec = {"id": uid, "email": "ann@x.com", "first_name": "Ann"}
    run(bulk_email.send_to(db, FREE, rec, record=False))
    run(bulk_email.send_to(db, FREE, rec))
    assert seen[0].startswith("https://venlaxsports.com/leagues") and "/api/email/click" in seen[1]
    assert email_tracking.decode_click(token_of(seen[1]))["user_id"] == uid


def test_results_count_each_person_once_and_never_show_zero_for_no_sends():
    db = Db()
    for u in ("a", "b", "c"):
        db.email_campaigns.docs.append({"user_id": u, "campaign": "k", "sent_at": "2026-10-27T10:00:00+00:00"})
    for u in ("a", "a", "b", "zzz"):          # a clicked twice; zzz was never sent this campaign
        db.email_events.docs.append({"type": "click", "campaign": "k", "user_id": u, "at": datetime.now(timezone.utc)})
    db.email_jobs.docs.append({"campaign_key": "k", "subject": "Hello", "failed": 2, "started_at": "2026-10-27"})
    [row] = run(email_tracking.campaign_results(db))
    assert (row["sent"], row["clicked"], row["click_rate"], row["failed"], row["subject"]) == (3, 2, 66.7, 2, "Hello")
    assert email_tracking.rate(0, 0) is None


# ── scheduling ────────────────────────────────────────────────────────────────

def queue(db, payload=None, confirm=2, minutes=-1, status="scheduled"):
    payload = payload or {"audience": "registered", "template": "season_starts"}
    doc = {"_id": ObjectId(), "payload": payload, "campaign_key": bulk_email.campaign_key(payload), "confirm_count": confirm,
           "run_at": datetime.now(timezone.utc) + timedelta(minutes=minutes), "status": status, "created_by": "adm", "subject": "S"}
    db.scheduled_emails.docs.append(doc)
    return doc


@pytest.fixture
def launched(monkeypatch):
    calls = []

    async def fake_launch(db, payload, recipients, started_by, delay=0.5, scheduled_id=None):
        calls.append([r["email"] for r in recipients])
        return ObjectId(), {}
    monkeypatch.setattr(bulk_email, "launch", fake_launch)
    return calls


def two_users():
    db = Db()
    db.user("Ann", "ann@x.com"); db.user("Di", "di@x.com")
    return db


def test_due_send_rebuilds_audience_so_late_unsubscribes_are_skipped(launched):
    db = two_users()
    doc = queue(db)
    db.users.docs[0]["marketing_unsubscribed_at"] = "2026-10-27"      # unsubscribed after it was queued
    assert run(email_schedule.run_due(db)) == 1
    assert launched == [["di@x.com"]] and doc["status"] == "sent" and doc["recipients"] == 1


def test_not_due_paused_and_cancelled_sends_do_not_run(launched):
    db = two_users()
    queue(db, minutes=30); queue(db, status="paused"); queue(db, status="cancelled")
    assert run(email_schedule.run_due(db)) == 0 and launched == []


def test_an_audience_that_grew_is_held_for_review(launched):
    db = Db()
    for i in range(30):
        db.user(f"U{i}", f"u{i}@x.com")
    doc = queue(db, confirm=5)
    assert run(email_schedule.run_due(db)) == 0
    assert doc["status"] == "needs_review" and "confirmed 5" in doc["held_reason"] and launched == []


def test_a_send_is_claimed_once(launched):
    db = two_users()
    doc = queue(db)
    run(email_schedule.run_due(db))
    doc["status"] = "scheduled"                                         # a second worker saw a stale copy
    db.scheduled_emails.docs[0]["status"] = "sending"
    assert run(email_schedule.run_due(db)) == 0


def test_nobody_left_is_recorded_not_sent(launched):
    db = Db()
    doc = queue(db)
    run(email_schedule.run_due(db))
    assert doc["status"] == "nobody_left" and launched == []


def test_run_time_must_be_a_sensible_future_time():
    soon = (datetime.now(timezone.utc) + timedelta(seconds=30)).isoformat()
    far = (datetime.now(timezone.utc) + timedelta(days=200)).isoformat()
    for bad in (soon, far, "not a date"):
        with pytest.raises(HTTPException) as e:
            routes._parse_run_at(bad)
        assert e.value.status_code == 400
    ok = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat().replace("+00:00", "Z")
    assert routes._parse_run_at(ok).tzinfo is not None
