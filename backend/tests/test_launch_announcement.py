"""Launch announcement: recipient selection, once-only sending, unsubscribe token and email content."""
import sys
from pathlib import Path

import pytest
from bson import ObjectId

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import email_service  # noqa: E402
import launch_announcement as la  # noqa: E402
from test_league_schedule import Coll, run  # noqa: E402


class _Cursor:
    def __init__(self, docs): self.docs = docs
    def sort(self, *a, **k): return self
    async def to_list(self, n): return list(self.docs)


class WlColl(Coll):
    async def insert_one(self, doc):
        self.docs.append(doc)

    def find(self, q=None, proj=None):
        return _Cursor([d for d in self.docs if all(d.get(k) == v for k, v in (q or {}).items())])


class Db:
    def __init__(self):
        self.waitlist, self.users, self.email_campaigns = WlColl(), WlColl(), WlColl()


@pytest.fixture(autouse=True)
def secret(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "x" * 40)
    monkeypatch.setenv("API_PUBLIC_URL", "https://api.example.test")


def make_db():
    db = Db()
    for email in ("a@x.com", "b@x.com", "c@x.com", "d@x.com"):
        db.waitlist.docs.append({"_id": ObjectId(), "email": email.upper() if email == "a@x.com" else email})
    db.waitlist.docs[1]["unsubscribed_at"] = "2026-10-01"          # b opted out
    db.users.docs.append({"_id": ObjectId(), "email": "c@x.com", "name": "Casey Lee"})  # c already registered
    return db


def test_recipients_exclude_unsubscribed_and_already_registered():
    db = make_db()
    r = run(la.build_recipients(db))
    assert [x["email"] for x in r["send"]] == ["a@x.com", "d@x.com"]
    assert r["skipped_unsubscribed"] == 1 and r["skipped_registered"] == 1 and r["send"][0]["first_name"] == ""


def test_each_person_is_emailed_once(monkeypatch):
    db = make_db()
    sent = []

    async def fake(to, name, url):
        sent.append((to, name, url)); return True
    monkeypatch.setattr(email_service, "send_launch_announcement", fake)
    for rec in run(la.build_recipients(db))["send"]:
        assert run(la.send_one(db, rec)) is True
    assert len(sent) == 2 and all("/api/waitlist/unsubscribe?token=" in u for _, _, u in sent)
    again = run(la.build_recipients(db))
    assert again["send"] == [] and again["skipped_already_sent"] == 2


def test_failed_send_is_not_recorded_so_it_can_be_retried(monkeypatch):
    db = make_db()

    async def fake(*a): return False
    monkeypatch.setattr(email_service, "send_launch_announcement", fake)
    rec = run(la.build_recipients(db))["send"][0]
    assert run(la.send_one(db, rec)) is False and db.email_campaigns.docs == []


def test_unsubscribe_token_round_trips_and_rejects_other_tokens():
    wid = str(ObjectId())
    assert la.decode_unsub_token(la.make_unsub_token(wid)) == wid
    assert la.decode_unsub_token("garbage") is None
    import jwt
    assert la.decode_unsub_token(jwt.encode({"sub": wid, "type": "other"}, "x" * 40, algorithm="HS256")) is None


def test_email_wording_and_compliance_footer(monkeypatch):
    out = {}

    async def fake_send(to, subject, html, text=None):
        out.update(to=to, subject=subject, html=html); return True
    monkeypatch.setattr(email_service, "send_email", fake_send)
    run(email_service.send_launch_announcement("a@x.com", "", "https://api.example.test/u?token=1"))
    h = out["html"]
    assert "Hi there," in h and "Sign up free" in h and "$9.99" not in h
    assert "Register FREE" not in h and "early-access" not in h.lower() and "early access" not in h.lower()
    assert "Unsubscribe" in h and "Atlanta, GA 30350, United States" in h
    run(email_service.send_launch_announcement("a@x.com", "Sam", "u"))
    assert "Hi Sam," in out["html"]
