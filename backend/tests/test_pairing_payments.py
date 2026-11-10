"""Half-fee payment for players VenLax pairs, credit on pairing, and credit-first checkout. In-memory fake database."""
import sys
import types
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import partner_assignment  # noqa: E402
import venlax_credit  # noqa: E402
from routes import doubles_routes, payment_routes  # noqa: E402
from test_auto_assign_partners import assign, inv, make_waiting  # noqa: E402,F401
from test_bulk_email import C  # noqa: E402
from test_league_schedule import run  # noqa: E402
from test_partner_later import Db, as_user, env, join, req  # noqa: E402,F401  (env is a fixture)


def credit_of(db, uid):
    return next(u for u in db.users.docs if str(u["_id"]) == uid).get("venlax_credit", 0)


def test_joining_to_be_paired_by_venlax_charges_half_the_team_fee(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    out = join(db, partner_later=True, auto_assign_partner=True)
    assert out["requires_payment"] and out["entry_fee"] == 9.99   # half of 19.99, rounded down to the cent
    assert db.doubles_invites.docs[0]["pair_by_venlax"] is True


def test_joining_with_a_partner_later_still_costs_the_full_team_fee(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    out = join(db, partner_later=True)
    assert out["entry_fee"] == 19.99 and db.doubles_invites.docs[0]["pair_by_venlax"] is False


def test_amount_due_is_half_only_for_the_initiators_own_unpaired_invite():
    db = Db()
    db.doubles_invites.docs.append({"token": "t", "initiator_id": db.p1, "pair_by_venlax": True})
    league = db.leagues.docs[0]
    assert run(payment_routes.invite_amount_due(db, league, db.p1, "t")) == 9.99
    assert run(payment_routes.invite_amount_due(db, league, db.p2, "t")) == 19.99   # someone else's token gives no discount
    assert run(payment_routes.invite_amount_due(db, league, db.p1, None)) == 19.99
    db.doubles_invites.docs[0]["partner_user_id"] = db.p2
    assert run(payment_routes.invite_amount_due(db, league, db.p1, "t")) == 19.99   # a known partner: one full payment


def test_two_players_who_each_paid_half_become_a_team_with_no_credit(env):
    db = Db()
    a_uid, ta = make_waiting(db, "Ann")
    b_uid, tb = make_waiting(db, "Bea")
    for t in (ta, tb):
        inv(db, t).update(paid_amount=9.99, pair_by_venlax=True)
    out = assign(db, ta, tb)
    assert out["credited"] == [] and credit_of(db, a_uid) == 0 and credit_of(db, b_uid) == 0


def test_a_full_payer_paired_with_a_half_payer_gets_only_their_extra_back(env):
    db = Db()
    a_uid, ta = make_waiting(db, "Ann")
    b_uid, tb = make_waiting(db, "Bea")
    inv(db, ta).update(paid_amount=19.99)
    inv(db, tb).update(paid_amount=9.99, pair_by_venlax=True)
    out = assign(db, ta, tb)
    assert [(c["name"], c["amount"]) for c in out["credited"]] == [("Ann", 10.0)]   # 19.99 paid, 9.99 owed
    assert credit_of(db, a_uid) == 10.0 and credit_of(db, b_uid) == 0
    assert [r["reason"] for r in db.credit_ledger.docs] == ["Paired by VenLax: Atlanta Doubles"]


def test_a_second_assignment_attempt_never_credits_twice(env):
    db = Db()
    a_uid, ta = make_waiting(db, "Ann")
    _, tb = make_waiting(db, "Bea")
    assign(db, ta, tb)
    assert run(venlax_credit.grant(db, a_uid, 10.0, "again", ref=f"pair:{ta}")) is None   # same ref as the pairing grant
    assert credit_of(db, a_uid) == 10.0


def test_a_half_paid_player_cannot_bring_their_own_partner(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    token = join(db, partner_later=True, auto_assign_partner=True)["invite_token"]
    inv(db, token).update(status="initiator_paid", paid_amount=9.99)
    with pytest.raises(HTTPException) as e:
        run(doubles_routes.add_partner(token, doubles_routes.AddPartnerRequest(partner_email="x@y.com"), req(db)))
    assert e.value.status_code == 409 and "paid your half" in e.value.detail
    with pytest.raises(HTTPException) as e:
        run(doubles_routes.set_auto_assign(token, doubles_routes.AutoAssignRequest(enabled=False), req(db)))
    assert e.value.status_code == 409


@pytest.mark.parametrize("due,available,expected", [
    (19.99, 0, (0, 19.99)),
    (19.99, 5, (5, 14.99)),
    (19.99, 19.99, (19.99, 0)),
    (19.99, 19.80, (19.49, 0.5)),     # the card is never asked for less than Stripe's $0.50 minimum
    (9.99, 50, (9.99, 0)),
])
def test_credit_split_keeps_the_card_charge_chargeable(due, available, expected):
    assert payment_routes._credit_split(due, available) == expected


class Users(C):
    async def find_one_and_update(self, q, upd, return_document=False):
        d = await self.find_one(q)
        if not d:
            return None
        before = dict(d)
        for k, v in upd.get("$inc", {}).items():
            d[k] = round(d.get(k, 0) + v, 2)
        return d if return_document else before


class Leagues(C):
    async def update_one(self, q, upd, upsert=False):
        d = await self.find_one(q)
        for k, v in upd.get("$inc", {}).items():
            d[k] = d.get(k, 0) + v
        return types.SimpleNamespace(matched_count=1)


def checkout_env(monkeypatch, credit, fee=9.99):
    lid, uid = ObjectId(), ObjectId()
    db = types.SimpleNamespace(
        leagues=Leagues(), users=Users(), player_leagues=C(), standings=C(), waiver_consents=C(),
        payment_transactions=C(), credit_ledger=C(), doubles_invites=C(), promo_codes=C(), promo_uses=C())
    db.leagues.docs.append({"_id": lid, "name": "Atlanta Singles", "sport": "tennis", "entry_fee": fee, "current_players": 0})
    db.users.docs.append({"_id": uid, "name": "Pat", "email": "pat@x.com", "venlax_credit": credit})

    async def user(request, database):
        return {"_id": str(uid), "name": "Pat", "email": "pat@x.com"}

    async def city_ok(database, league):
        return None
    monkeypatch.setattr(payment_routes, "get_current_user", user)
    monkeypatch.setattr(payment_routes, "require_city_open", city_ok)
    monkeypatch.setattr(payment_routes.email_service, "schedule", lambda coro: coro.close())
    request = types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)))
    return db, str(lid), str(uid), request


def test_credit_that_covers_the_fee_registers_the_player_without_a_card(monkeypatch):
    db, lid, uid, request = checkout_env(monkeypatch, credit=25.0)
    out = run(payment_routes.create_checkout(
        payment_routes.CheckoutRequest(league_id=lid, origin_url="https://x.test", use_credit=True), request))
    assert out["free"] and out["paid_with_credit"] and out["credit_used"] == 9.99
    assert credit_of(db, uid) == 15.01
    assert [p["payment_status"] for p in db.player_leagues.docs] == ["paid"]
    assert len([r for r in db.credit_ledger.docs if r["amount"] < 0]) == 1      # taken once, not once per step
    assert db.leagues.docs[0]["current_players"] == 1


def test_credit_is_not_touched_unless_the_player_asks_for_it(monkeypatch):
    db, lid, uid, request = checkout_env(monkeypatch, credit=25.0)
    monkeypatch.setitem(sys.modules, "stripe", types.SimpleNamespace(checkout=None))
    monkeypatch.delenv("STRIPE_API_KEY", raising=False)
    with pytest.raises(HTTPException) as e:        # no card configured in the test, so this stops at Stripe
        run(payment_routes.create_checkout(payment_routes.CheckoutRequest(league_id=lid, origin_url="https://x.test"), request))
    assert e.value.status_code == 503 and credit_of(db, uid) == 25.0 and not db.credit_ledger.docs


def test_quote_shows_what_credit_covers_and_what_is_left(monkeypatch):
    db, lid, uid, request = checkout_env(monkeypatch, credit=4.0)
    q = run(payment_routes.payment_quote(lid, request))
    assert q == {"due": 9.99, "credit_available": 4.0, "credit_used": 4.0, "to_pay": 5.99}


def test_zelle_intent_asks_only_for_what_credit_does_not_cover(monkeypatch):
    db, lid, uid, request = checkout_env(monkeypatch, credit=4.0)
    out = run(payment_routes.zelle_intent(payment_routes.ZelleIntentIn(league_id=lid, use_credit=True), request))
    assert out["amount"] == 5.99
    assert db.payment_transactions.docs[0]["metadata"] == {"credit_applied": 4.0}
    assert credit_of(db, uid) == 4.0          # credit is taken when the admin approves the deposit, not before


def test_zelle_intent_refuses_when_credit_already_covers_the_fee(monkeypatch):
    db, lid, uid, request = checkout_env(monkeypatch, credit=50.0)
    with pytest.raises(HTTPException) as e:
        run(payment_routes.zelle_intent(payment_routes.ZelleIntentIn(league_id=lid, use_credit=True), request))
    assert e.value.status_code == 400
