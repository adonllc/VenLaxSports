"""Doubles: register first, add the partner later (search, email or shared link). In-memory fake database."""
import sys
import types
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import email_service  # noqa: E402
from routes import doubles_routes, league_routes  # noqa: E402
from test_league_schedule import Coll, run  # noqa: E402


class LeagueColl(Coll):
    async def find_one_and_update(self, q, upd):
        d = await self.find_one({k: v for k, v in q.items() if k != "$expr"})
        if d and "$expr" in q and d["current_players"] + 2 > d["max_players"]:
            return None
        if d:
            before = dict(d)
            for k, v in upd.get("$inc", {}).items():
                d[k] = d.get(k, 0) + v
            return before
        return None


class InsertColl(Coll):
    async def insert_one(self, doc):
        doc.setdefault("_id", ObjectId())
        self.docs.append(doc)


class Db:
    def __init__(self, fee=19.99, current=0, start="2026-11-08"):
        self.leagues = LeagueColl()
        self.users, self.player_leagues, self.doubles_invites = InsertColl(), InsertColl(), InsertColl()
        self.lid = ObjectId()
        self.leagues.docs.append({
            "_id": self.lid, "name": "Atlanta Doubles", "sport": "tennis", "format": "doubles", "status": "registration",
            "entry_fee": fee, "currency": "USD", "max_players": 16, "current_players": current, "start_date": start,
        })
        self.p1 = self.add_user("Pat One", "pat@example.com")
        self.p2 = self.add_user("Sam Two", "sam@example.com")

    def add_user(self, name, email, gender=None):
        uid = ObjectId()
        self.users.docs.append({"_id": uid, "name": name, "email": email, "gender": gender})
        return str(uid)


@pytest.fixture
def env(monkeypatch):
    sent = []
    monkeypatch.setattr(email_service, "schedule", lambda coro: (sent.append(coro.cr_frame.f_locals.get("to") or coro.cr_frame.f_locals.get("partner_email")), coro.close()))

    async def city_ok(db, league):
        return None
    monkeypatch.setattr(league_routes, "require_city_open", city_ok)
    return sent


def req(db):
    return types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)), client=None)


def as_user(monkeypatch, db, uid):
    async def fake(request, database):
        u = next(x for x in db.users.docs if str(x["_id"]) == uid)
        return {**u, "_id": uid}
    monkeypatch.setattr(league_routes, "get_current_user", fake)
    monkeypatch.setattr(doubles_routes, "get_current_user", fake)


def join(db, **kw):
    body = league_routes.JoinLeagueRequest(waiver_accepted=True, **kw)
    return run(league_routes.join_league(str(db.lid), body, req(db)))


def add_partner(db, token, **kw):
    return run(doubles_routes.add_partner(token, doubles_routes.AddPartnerRequest(**kw), req(db)))


def test_join_without_partner_is_rejected_unless_later_chosen(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    with pytest.raises(HTTPException) as e:
        join(db)
    assert e.value.status_code == 400


def test_register_now_add_partner_later_creates_paid_pending_team(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    r = join(db, partner_later=True)
    assert r["partner_later"] and r["requires_payment"] and r["entry_fee"] == 19.99 and r["invite_token"]
    inv = db.doubles_invites.docs[0]
    assert inv["partner_later"] and inv["status"] == "pending" and inv["partner_email"] == ""
    assert inv["expires_at"] > "2026-11-08"           # waits at least until the league starts
    assert db.player_leagues.docs == [] and db.leagues.docs[0]["current_players"] == 0
    assert env == []                                     # no email: nobody was invited yet


def test_retry_resumes_the_same_team_and_does_not_charge_again_after_payment(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    first = join(db, partner_later=True)
    again = join(db, partner_later=True)
    assert again["has_pending_invite"] and again["invite_token"] == first["invite_token"] and again["requires_payment"]
    db.doubles_invites.docs[0]["status"] = "initiator_paid"
    paid = join(db, partner_later=True)
    assert paid["has_pending_invite"] and "requires_payment" not in paid
    assert len(db.doubles_invites.docs) == 1


def test_adding_a_venlax_player_after_payment_completes_the_team(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    token = join(db, partner_later=True)["invite_token"]
    db.doubles_invites.docs[0]["status"] = "initiator_paid"
    r = add_partner(db, token, partner_id=db.p2)
    assert r["registered"]
    assert {p["player_id"] for p in db.player_leagues.docs} == {db.p1, db.p2}
    assert all(p["payment_status"] == "paid" for p in db.player_leagues.docs)
    assert db.leagues.docs[0]["current_players"] == 2
    assert db.doubles_invites.docs[0]["status"] == "accepted"


def test_paid_league_requires_payment_before_a_partner_is_added(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    token = join(db, partner_later=True)["invite_token"]
    with pytest.raises(HTTPException) as e:
        add_partner(db, token, partner_id=db.p2)
    assert e.value.status_code == 400 and db.player_leagues.docs == []


def test_free_league_completes_without_payment(env, monkeypatch):
    db = Db(fee=0)
    as_user(monkeypatch, db, db.p1)
    r = join(db, partner_later=True)
    assert "requires_payment" not in r
    assert add_partner(db, r["invite_token"], partner_id=db.p2)["registered"]
    assert {p["payment_status"] for p in db.player_leagues.docs} == {"free"}


def test_adding_by_email_sends_the_invite_and_keeps_the_team_open(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    token = join(db, partner_later=True)["invite_token"]
    r = add_partner(db, token, partner_email=" Friend@Example.com ")
    assert r == {"invited": True, "partner_email": "friend@example.com"}
    assert db.doubles_invites.docs[0]["partner_email"] == "friend@example.com" and env == ["friend@example.com"]
    with pytest.raises(HTTPException):
        add_partner(db, token, partner_email="pat@example.com")   # cannot invite yourself


def test_only_the_initiator_can_add_a_partner_and_not_after_close_or_full(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    token = join(db, partner_later=True)["invite_token"]
    db.doubles_invites.docs[0]["status"] = "initiator_paid"
    as_user(monkeypatch, db, db.p2)
    with pytest.raises(HTTPException) as e:
        add_partner(db, token, partner_id=db.p2)
    assert e.value.status_code == 403
    as_user(monkeypatch, db, db.p1)
    db.leagues.docs[0]["current_players"] = 15
    with pytest.raises(HTTPException) as e:
        add_partner(db, token, partner_id=db.p2)
    assert e.value.status_code == 409
    db.leagues.docs[0]["current_players"] = 0
    db.leagues.docs[0]["status"] = "active"
    with pytest.raises(HTTPException) as e:
        add_partner(db, token, partner_id=db.p2)
    assert e.value.status_code == 400


def test_partner_already_in_the_league_is_rejected(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    token = join(db, partner_later=True)["invite_token"]
    db.doubles_invites.docs[0]["status"] = "initiator_paid"
    db.player_leagues.docs.append({"league_id": str(db.lid), "player_id": db.p2})
    with pytest.raises(HTTPException) as e:
        add_partner(db, token, partner_id=db.p2)
    assert e.value.status_code == 409


def mixed_db(g1="male", g2="female"):
    db = Db()
    db.leagues.docs[0]["format"] = "mixed_doubles"
    next(u for u in db.users.docs if str(u["_id"]) == db.p1)["gender"] = g1
    next(u for u in db.users.docs if str(u["_id"]) == db.p2)["gender"] = g2
    return db


def test_mixed_doubles_uses_the_doubles_flow(env, monkeypatch):
    db = mixed_db()
    as_user(monkeypatch, db, db.p1)
    assert join(db, partner_later=True)["partner_later"]


def test_mixed_join_needs_the_players_own_gender(env, monkeypatch):
    db = mixed_db(g1=None)
    as_user(monkeypatch, db, db.p1)
    with pytest.raises(HTTPException) as e:
        join(db, partner_later=True)
    assert e.value.status_code == 400 and "gender" in e.value.detail.lower()


@pytest.mark.parametrize("g1,g2", [("male", "male"), ("female", "female"), ("male", None)])
def test_mixed_rejects_same_or_missing_partner_gender_at_join_and_at_add(env, monkeypatch, g1, g2):
    db = mixed_db(g1, g2)
    as_user(monkeypatch, db, db.p1)
    with pytest.raises(HTTPException) as e:
        join(db, partner_id=db.p2)
    assert e.value.status_code == 400 and db.leagues.docs[0]["current_players"] == 0
    token = join(db, partner_later=True)["invite_token"]
    db.doubles_invites.docs[0]["status"] = "initiator_paid"
    with pytest.raises(HTTPException) as e:
        add_partner(db, token, partner_id=db.p2)
    assert e.value.status_code == 400 and db.player_leagues.docs == [] and db.leagues.docs[0]["current_players"] == 0


def test_mixed_with_one_male_and_one_female_completes(env, monkeypatch):
    db = mixed_db("female", "male")
    as_user(monkeypatch, db, db.p1)
    token = join(db, partner_later=True)["invite_token"]
    db.doubles_invites.docs[0]["status"] = "initiator_paid"
    assert add_partner(db, token, partner_id=db.p2)["registered"]


def test_partner_accepting_a_mixed_invite_must_be_the_other_gender(env, monkeypatch):
    db = mixed_db("male", "male")
    as_user(monkeypatch, db, db.p1)
    token = join(db, partner_later=True)["invite_token"]
    db.doubles_invites.docs[0]["status"] = "initiator_paid"
    as_user(monkeypatch, db, db.p2)

    async def p2_user(request, database):
        return {**next(u for u in db.users.docs if str(u["_id"]) == db.p2), "_id": db.p2}
    monkeypatch.setattr(doubles_routes, "get_current_user", p2_user)
    body = types.SimpleNamespace(token=token, action="accept", waiver_accepted=True)
    with pytest.raises(HTTPException) as e:
        run(doubles_routes.confirm_doubles_invite(body, req(db)))
    assert e.value.status_code == 400 and db.leagues.docs[0]["current_players"] == 0   # no spot taken


def test_every_new_doubles_invite_stays_open_until_the_league_starts(env, monkeypatch):
    db = Db(start="2026-11-08")
    as_user(monkeypatch, db, db.p1)
    join(db, partner_email="friend@example.com")
    assert db.doubles_invites.docs[0]["expires_at"] > "2026-11-08"


def test_declined_invite_of_a_paid_team_keeps_the_team_open(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    token = join(db, partner_email="friend@example.com")["invite_token"]
    db.doubles_invites.docs[0]["status"] = "initiator_paid"

    async def p2_user(request, database):
        return {**next(u for u in db.users.docs if str(u["_id"]) == db.p2), "_id": db.p2}
    monkeypatch.setattr(doubles_routes, "get_current_user", p2_user)
    body = types.SimpleNamespace(token=token, action="decline", waiver_accepted=False)
    assert run(doubles_routes.confirm_doubles_invite(body, req(db))) == {"declined": True}
    inv = db.doubles_invites.docs[0]
    assert inv["status"] == "initiator_paid" and inv["partner_email"] == ""


def test_my_invites_lists_paid_waiting_teams(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    join(db, partner_later=True)
    db.doubles_invites.docs[0]["status"] = "initiator_paid"

    class C(InsertColl):
        def find(self, q=None, *a, **k):
            out = super().find(q)
            out.sort = lambda *a, **k: out
            return out
    db.doubles_invites.__class__ = C
    r = run(doubles_routes.my_doubles_invites(req(db)))
    assert r["invites"][0]["paid"] and r["invites"][0]["partner_later"] and r["invites"][0]["league_name"] == "Atlanta Doubles"
