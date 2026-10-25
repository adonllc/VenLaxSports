"""Conversion emails to the old early list: recipient selection, once-only sending, unsubscribe token, copy rules."""
import re
import sys
from pathlib import Path

import pytest
from bson import ObjectId

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import conversion_campaign as cc  # noqa: E402
import email_service  # noqa: E402
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
    r = run(cc.build_recipients(make_db(), 1))
    assert [x["email"] for x in r["send"]] == ["a@x.com", "d@x.com"]
    assert r["skipped_unsubscribed"] == 1 and r["skipped_registered"] == 1


def test_each_person_is_emailed_once_per_step(monkeypatch):
    db = make_db()
    sent = []

    async def fake(to, subject, title, body, label, url, unsub):
        sent.append((to, unsub)); return True
    monkeypatch.setattr(email_service, "send_campaign_email", fake)
    for rec in run(cc.build_recipients(db, 1))["send"]:
        assert run(cc.send_one(db, 1, rec)) is True
    assert len(sent) == 2 and all("/api/waitlist/unsubscribe?token=" in u for _, u in sent)
    again = run(cc.build_recipients(db, 1))
    assert again["send"] == [] and again["skipped_already_sent"] == 2
    assert len(run(cc.build_recipients(db, 2))["send"]) == 2   # a later step is a separate send


def test_failed_send_is_not_recorded_so_it_can_be_retried(monkeypatch):
    db = make_db()

    async def fake(*a): return False
    monkeypatch.setattr(email_service, "send_campaign_email", fake)
    rec = run(cc.build_recipients(db, 1))["send"][0]
    assert run(cc.send_one(db, 1, rec)) is False and db.email_campaigns.docs == []


def test_unsubscribe_token_round_trips_and_rejects_other_tokens():
    cid = str(ObjectId())
    assert cc.decode_unsub_token(cc.make_unsub_token(cid)) == cid
    assert cc.decode_unsub_token("garbage") is None
    import jwt
    assert cc.decode_unsub_token(jwt.encode({"sub": cid, "type": "other"}, "x" * 40, algorithm="HS256")) is None
    # a token from an email sent before this change (same type, same secret) must still work
    old = jwt.encode({"sub": cid, "type": "waitlist_unsub"}, "x" * 40, algorithm="HS256")
    assert cc.decode_unsub_token(old) == cid


@pytest.mark.parametrize("step", [1, 2, 3])
def test_copy_rules(step):
    r = cc.render(step, str(ObjectId()))
    text = (r["subject"] + r["title"] + r["body"] + r["cta_label"]).lower()
    assert "waitlist" not in text and "wait list" not in text and "early access" not in text
    assert "hi there," in text
    assert "8 players" not in text and "founding" not in text and "spots" not in text   # no minimum, perk or capacity claims
    assert f"utm_campaign=atlanta-winter-2026-{step}" in r["cta_url"] and "utm_source=early-list" in r["cta_url"]
    assert r["cta_url"].startswith("https://venlaxsports.com/")
    assert not re.search(r"\b\d+ (players|spots) (left|remaining)", text)


def test_prices_are_exact_where_shown():
    body = cc.render(1, "x")["body"]
    assert "Singles $9.99 per player" in body and "Doubles $19.99 per team" in body


def test_footer_has_unsubscribe_and_address(monkeypatch):
    out = {}

    async def fake_send(to, subject, html, text=None):
        out.update(html=html); return True
    monkeypatch.setattr(email_service, "send_email", fake_send)
    r = cc.render(1, str(ObjectId()))
    run(email_service.send_campaign_email("a@x.com", r["subject"], r["title"], r["body"], r["cta_label"], r["cta_url"], r["unsubscribe_url"]))
    assert "Unsubscribe" in out["html"] and "Atlanta, GA 30350, United States" in out["html"]
    assert "waitlist" not in re.sub(r'href="[^"]*"', "", out["html"]).lower()   # the link path is kept for old emails
