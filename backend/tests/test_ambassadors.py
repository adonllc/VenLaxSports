"""Ambassadors: memorable referral codes chosen by an admin, results read from the normal referral credits."""
import sys
import types
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from routes import admin_ambassador_routes as amb, auth_routes  # noqa: E402
from test_league_schedule import Coll, run  # noqa: E402


class C(Coll):
    @classmethod
    def _match(cls, doc, q):
        # like MongoDB: a plain value matches an array field that contains it
        q = {k: v for k, v in q.items() if not (isinstance(doc.get(k), list) and not isinstance(v, dict) and v in doc.get(k))}
        return super()._match(doc, q)

    async def insert_one(self, doc):
        doc.setdefault("_id", ObjectId())
        self.docs.append(doc)

    async def update_one(self, q, upd, upsert=False):
        d = await self.find_one(q)
        if d:
            for k, v in upd.get("$set", {}).items():
                d[k] = v
            for k, v in upd.get("$unset", {}).items():
                d.pop(k, None)
            for k, v in upd.get("$addToSet", {}).items():
                d.setdefault(k, [])
                if v not in d[k]:
                    d[k].append(v)
        return types.SimpleNamespace(matched_count=1 if d else 0)


class Db:
    def __init__(self):
        self.users, self.referral_credits = C(), C()

    def user(self, email, **kw):
        uid = ObjectId()
        self.users.docs.append({"_id": uid, "email": email, "name": email.split("@")[0], **kw})
        return str(uid)


def req(db):
    return types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)))


@pytest.fixture
def admin(monkeypatch):
    async def fake(request, database):
        return {"_id": "a", "role": "admin", "email": "admin@x.com"}
    monkeypatch.setattr(amb, "get_current_user", fake)


def make(db, **kw):
    return run(amb.make_ambassador(amb.AmbassadorIn(**kw), req(db)))


def test_admin_gives_a_user_a_memorable_code(admin):
    db = Db()
    uid = db.user("coach@club.com", referral_code="REF_AAAAAA")
    r = make(db, email="Coach@Club.com", code=" atlclub ", label="Peachtree Club")
    assert r["code"] == "ATLCLUB" and "ref=ATLCLUB" in r["link"] and "utm_source=ambassador" in r["link"]
    u = db.users.docs[0]
    assert u["referral_code"] == "ATLCLUB" and u["ambassador"]["label"] == "Peachtree Club"
    assert u["referral_code_aliases"] == ["REF_AAAAAA"]      # links already shared keep working


@pytest.mark.parametrize("code", ["ab", "has space", "x" * 21, "REF_HACK1", "bad-dash", ""])
def test_bad_codes_are_rejected(admin, code):
    db = Db()
    db.user("coach@club.com")
    with pytest.raises(HTTPException) as e:
        make(db, email="coach@club.com", code=code)
    assert e.value.status_code == 400


def test_code_cannot_be_taken_twice_and_account_must_exist(admin):
    db = Db()
    db.user("a@x.com", referral_code="TAKEN1")
    db.user("b@x.com")
    with pytest.raises(HTTPException) as e:
        make(db, email="b@x.com", code="taken1")
    assert e.value.status_code == 409
    with pytest.raises(HTTPException) as e:
        make(db, email="nobody@x.com", code="FREE12")
    assert e.value.status_code == 404
    make(db, email="a@x.com", code="TAKEN1")     # the same person keeping their own code is fine


def test_only_admins(monkeypatch):
    async def fake(request, database):
        return {"_id": "p", "role": "player"}
    monkeypatch.setattr(amb, "get_current_user", fake)
    with pytest.raises(HTTPException) as e:
        run(amb.list_ambassadors(req(Db())))
    assert e.value.status_code == 403


def test_list_counts_signups_from_the_normal_referral_credits(admin):
    db = Db()
    uid = db.user("coach@club.com")
    make(db, email="coach@club.com", code="ATLCLUB", label="Club")
    for status in ("applied", "pending", "pending"):
        db.referral_credits.docs.append({"referrer_id": uid, "status": status, "type": "referral"})
    db.referral_credits.docs.append({"referrer_id": uid, "status": "applied", "type": "tier_bonus"})
    row = run(amb.list_ambassadors(req(db)))["ambassadors"][0]
    assert (row["signups"], row["first_match_played"], row["waiting"], row["code"]) == (3, 1, 2, "ATLCLUB")


def test_signup_with_the_new_or_the_old_code_credits_the_ambassador(admin):
    db = Db()
    uid = db.user("coach@club.com", referral_code="REF_AAAAAA")
    make(db, email="coach@club.com", code="ATLCLUB")
    for code in ("atlclub", "REF_AAAAAA"):
        run(auth_routes._apply_referral_credit(db, code, str(ObjectId())))
    assert [c["referrer_id"] for c in db.referral_credits.docs] == [uid, uid]
    assert {c["status"] for c in db.referral_credits.docs} == {"pending"}   # paid only after a first confirmed match


def test_removing_an_ambassador_keeps_the_code_working(admin):
    db = Db()
    uid = db.user("coach@club.com")
    make(db, email="coach@club.com", code="ATLCLUB")
    run(amb.remove_ambassador(uid, req(db)))
    u = db.users.docs[0]
    assert "ambassador" not in u and u["referral_code"] == "ATLCLUB"
