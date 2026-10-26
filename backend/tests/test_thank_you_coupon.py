"""Thank-you email with a personal one-time $10 coupon valid for 12 months."""
import sys
import types
from datetime import datetime, timezone
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import bulk_email  # noqa: E402
import email_service  # noqa: E402
import thank_you_coupon as ty  # noqa: E402
from routes import payment_routes  # noqa: E402
from test_league_schedule import Coll, run  # noqa: E402


class C(Coll):
    async def insert_one(self, doc):
        doc.setdefault("_id", ObjectId())
        self.docs.append(doc)

    async def update_one(self, q, upd, upsert=False):
        d = await self.find_one(q)
        if d is not None:
            for k, v in upd.get("$set", {}).items():
                d[k] = v
            for k, v in upd.get("$inc", {}).items():
                d[k] = d.get(k, 0) + v
        return types.SimpleNamespace(matched_count=1 if d else 0)

    async def count_documents(self, q=None):
        return len([d for d in self.docs if self._match(d, q or {})])


class Db:
    def __init__(self):
        for n in ("users", "player_leagues", "email_campaigns", "promo_codes", "promo_uses"):
            setattr(self, n, C())

    def user(self, name, email, **kw):
        uid = ObjectId()
        self.users.docs.append({"_id": uid, "name": name, "email": email, **kw})
        return str(uid)


@pytest.fixture(autouse=True)
def secret(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "x" * 40)


NOW = datetime(2026, 10, 25, 12, 0, tzinfo=timezone.utc)
THANKS = {"audience": "registered", "template": "thank_you"}


def test_twelve_months_later_handles_leap_days_and_month_ends():
    assert ty.add_months(NOW, 12).date().isoformat() == "2027-10-25"
    assert ty.add_months(datetime(2028, 2, 29, tzinfo=timezone.utc), 12).date().isoformat() == "2029-02-28"
    assert ty.add_months(datetime(2026, 12, 31, tzinfo=timezone.utc), 12).date().isoformat() == "2027-12-31"
    assert ty.expiry_text("2027-10-05T12:00:00+00:00") == "October 5, 2027"


def test_coupon_is_personal_single_use_and_expires_in_a_year():
    db = Db()
    uid = db.user("Ann", "ann@x.com")
    c = run(ty.get_or_create(db, uid, "tpl_thank_you", "admin1", NOW))
    promo = db.promo_codes.docs[0]
    assert c["code"].startswith("THANKS-") and len(c["code"]) == 15 and promo["code"] == c["code"]
    assert (promo["type"], promo["value"], promo["max_uses"], promo["per_user_limit"]) == ("amount_off", 10, 1, 1)
    assert promo["restricted_user_id"] == uid and promo["expires_at"].startswith("2027-10-25") and promo["active"]
    assert c["expires_text"] == "October 25, 2027"
    assert run(ty.get_or_create(db, uid, "tpl_thank_you", "admin1", NOW))["code"] == c["code"] and len(db.promo_codes.docs) == 1   # a retry reuses it
    other = run(ty.get_or_create(db, db.user("Bo", "bo@x.com"), "tpl_thank_you", "admin1", NOW))
    assert other["code"] != c["code"]


def test_only_the_owner_can_use_it_and_only_once_and_not_after_it_expires():
    db = Db()
    uid, other = db.user("Ann", "ann@x.com"), db.user("Bo", "bo@x.com")
    code = run(ty.get_or_create(db, uid, "tpl_thank_you", "", NOW))["code"]
    league = {"sport": "tennis", "format": "singles"}
    check = lambda user: run(payment_routes._validate_promo(db, code, user, league))
    assert check(other) is None                                    # someone else's coupon
    assert check(uid) is not None
    db.promo_codes.docs[0]["used_count"] = 1                       # used once (recorded at registration)
    assert check(uid) is None
    db.promo_codes.docs[0]["used_count"] = 0
    db.promo_codes.docs[0]["expires_at"] = "2020-01-01T00:00:00+00:00"
    assert check(uid) is None                                      # expired


def test_ten_dollars_off_covers_singles_and_leaves_a_doubles_team_a_balance():
    f = payment_routes.amount_off_fee
    assert f(9.99, 10) == 0.0 and f(9.99, 10, is_doubles=True) == 0.50      # singles free; a team never skips payment
    assert f(19.99, 10) == 9.99 and f(19.99, 10, is_doubles=True) == 9.99
    assert f(10.20, 10) == 0.0                                              # 20 cents is below Stripe's $0.50 minimum
    assert f(10.50, 10) == 0.50


def test_paying_for_a_doubles_team_with_a_coupon_records_its_use(monkeypatch):
    calls = []

    async def record(db, code, user_id, league_id):
        calls.append((code, user_id, league_id))
    monkeypatch.setattr(payment_routes, "_record_promo_use", record)

    class D:
        def __init__(self):
            self.doubles_invites = C()
            self.doubles_invites.docs.append({"token": "t", "league_id": str(ObjectId()), "status": "pending", "partner_user_id": None})
            self.leagues = C()
    db = D()
    txn = {"league_id": "L1", "user_id": "U1", "metadata": {"is_doubles": "true", "invite_token": "t", "promo_code": "THANKS-ABC"}}
    out = run(payment_routes._register_paid_player(db, txn, "cs_1", {}))
    assert out["invite_pending"] and calls == [("THANKS-ABC", "U1", "L1")]


# ── the email ─────────────────────────────────────────────────────────────────

def test_preview_shows_an_example_code_and_creates_nothing():
    db = Db()
    m = bulk_email.render(THANKS, {"id": "u", "email": "a@x.com", "first_name": "Ann"})
    assert "THANKS-EXAMPLE" in m["body"] and "Hi Ann," in m["body"] and "$10 credit" in m["body"]
    assert db.promo_codes.docs == []


def test_a_real_send_makes_each_player_their_own_coupon_and_a_referral_link(monkeypatch):
    db = Db()
    a = db.user("Ann Lee", "ann@x.com", referral_code="REF_AAAAAA")
    b = db.user("Bo Ray", "bo@x.com")                                # no referral code yet
    sent = {}

    async def fake(to, subject, title, body, label, url, unsub, reason=None):
        sent[to] = (body, label, url)
        return True
    monkeypatch.setattr(email_service, "send_campaign_email", fake)
    for rec in run(bulk_email.build_audience(db, THANKS))["send"]:
        assert run(bulk_email.send_to(db, THANKS, rec, admin_id="adm"))
    codes = {d["restricted_user_id"]: d["code"] for d in db.promo_codes.docs}
    assert len(codes) == 2 and codes[a] != codes[b]
    assert codes[a] in sent["ann@x.com"][0] and codes[b] in sent["bo@x.com"][0]
    assert "https://venlaxsports.com/auth?ref=REF_AAAAAA" in sent["ann@x.com"][0]
    assert sent["ann@x.com"][1] == "Share your referral link" and "/rewards" in sent["ann@x.com"][2]
    assert next(u for u in db.users.docs if str(u["_id"]) == b)["referral_code"].startswith("REF_")     # created and saved
    assert "ref=REF_" in sent["bo@x.com"][0]
    assert run(bulk_email.build_audience(db, THANKS))["send"] == []                                   # nobody gets a second coupon


def test_a_test_email_uses_the_example_code_and_makes_no_coupon(monkeypatch):
    db = Db()
    uid = db.user("Admin", "admin@x.com")
    out = []

    async def fake(to, subject, title, body, *a, **k):
        out.append(body); return True
    monkeypatch.setattr(email_service, "send_campaign_email", fake)
    assert run(bulk_email.send_to(db, THANKS, {"id": uid, "email": "admin@x.com", "first_name": "Admin"}, record=False))
    assert "THANKS-EXAMPLE" in out[0] and db.promo_codes.docs == [] and db.email_campaigns.docs == []


def test_pick_one_several_or_everyone():
    db = Db()
    a, b, c = (db.user(n, f"{n}@x.com") for n in ("ann", "bo", "cy"))
    emails = lambda payload: sorted(r["email"] for r in run(bulk_email.build_audience(db, payload))["send"])
    assert emails({**THANKS, "user_ids": [a]}) == ["ann@x.com"]
    assert emails({**THANKS, "user_ids": [a, c]}) == ["ann@x.com", "cy@x.com"]
    assert emails(THANKS) == ["ann@x.com", "bo@x.com", "cy@x.com"]
    db.users.docs[0]["marketing_unsubscribed_at"] = "2026-10-01"
    assert emails({**THANKS, "user_ids": [a, b]}) == ["bo@x.com"]       # picking someone never overrides an opt-out


@pytest.mark.parametrize("ids", [[], ["not-an-id"], [str(ObjectId())] * 501])
def test_bad_selections_are_rejected(ids):
    with pytest.raises(bulk_email.PayloadError):
        bulk_email.validate({**THANKS, "user_ids": ids})
