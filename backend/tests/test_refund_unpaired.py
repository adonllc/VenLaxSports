"""Refund choice (VenLax Credit now or card) for doubles players who never got a partner. In-memory fake database."""
import sys
import types
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from bson import ObjectId

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import email_service  # noqa: E402
import scheduler_jobs  # noqa: E402
import unpaired_refunds  # noqa: E402
from test_bulk_email import C  # noqa: E402
from test_league_schedule import run  # noqa: E402


class Users(C):
    async def find_one_and_update(self, q, upd, return_document=False):
        d = await self.find_one(q)
        if not d:
            return None
        before = dict(d)
        for k, v in upd.get("$inc", {}).items():
            d[k] = round(d.get(k, 0) + v, 2)
        return d if return_document else before


class Invites(C):
    async def find_one_and_update(self, q, upd, return_document=False):
        d = await self.find_one(q)
        if not d:
            return None
        before = dict(d)
        d.update(upd.get("$set", {}))
        return d if return_document else before


class Payments(C):
    async def update_one(self, q, upd, upsert=False):
        d = await self.find_one(q)
        if d:
            d.update(upd.get("$set", {}))
        return types.SimpleNamespace(matched_count=1 if d else 0)


class Db:
    def __init__(self, start="2020-01-01"):
        self.feature_flags, self.leagues, self.credit_ledger = C(), C(), C()
        self.doubles_invites, self.payment_transactions, self.users = Invites(), Payments(), Users()
        self.lid = ObjectId()
        self.leagues.docs.append({"_id": self.lid, "name": "Atlanta Doubles", "start_date": start})
        self.uid = ObjectId()
        self.users.docs.append({"_id": self.uid, "name": "Pat", "email": "pat@example.com"})
        self.invite = {"league_id": str(self.lid), "initiator_id": str(self.uid), "token": "t" * 60, "status": "initiator_paid",
                       "partner_user_id": None}
        self.doubles_invites.docs.append(self.invite)
        self.payment_transactions.docs.append({"session_id": "cs_test_1", "payment_status": "paid", "amount": 9.99,
                                               "metadata": {"invite_token": "t" * 60}})

    @property
    def credit(self):
        return self.users.docs[0].get("venlax_credit", 0)


class Calls(list):
    emails: list


@pytest.fixture
def stripe_calls(monkeypatch):
    calls = Calls()

    def fake(session_id, key):
        calls.append((session_id, key))
        return "re_1"
    monkeypatch.setattr(unpaired_refunds, "_stripe_refund", fake)
    emails = []
    monkeypatch.setattr(email_service, "schedule", lambda coro: (emails.append(coro.cr_frame.f_locals.get("to")), coro.close()))
    calls.emails = emails
    return calls


def enable(db):
    db.feature_flags.docs.append({"_id": "refund_unpaired_teams", "enabled": True})


def choose(db, method):
    return run(unpaired_refunds.choose(db, "t" * 60, str(db.uid), method))


def offer(db):
    enable(db)
    run(scheduler_jobs.refund_unpaired_teams(db))


def test_off_by_default_so_nothing_is_offered(stripe_calls):
    db = Db()
    run(scheduler_jobs.refund_unpaired_teams(db))
    assert db.doubles_invites.docs[0]["status"] == "initiator_paid" and stripe_calls.emails == []


def test_enabled_offers_the_choice_once_and_moves_no_money_yet(stripe_calls):
    db = Db()
    offer(db)
    inv = db.doubles_invites.docs[0]
    assert (inv["status"], inv["refund_amount"], inv["card_refundable"]) == ("refund_choice", 9.99, 9.99)
    assert stripe_calls == [] and db.credit == 0 and stripe_calls.emails == ["pat@example.com"]
    run(scheduler_jobs.refund_unpaired_teams(db))      # next day: already offered, no second email
    assert stripe_calls.emails == ["pat@example.com"]


def test_waits_until_the_start_date(stripe_calls):
    db = Db(start="2999-01-01")
    offer(db)
    assert db.doubles_invites.docs[0]["status"] == "initiator_paid"


def test_a_team_with_a_partner_is_never_offered_a_refund(stripe_calls):
    db = Db()
    db.invite["partner_user_id"] = "someone"
    offer(db)
    assert db.doubles_invites.docs[0]["status"] == "initiator_paid"


def test_choosing_credit_adds_it_immediately_and_never_touches_stripe(stripe_calls):
    db = Db()
    offer(db)
    assert choose(db, "credit")["amount"] == 9.99
    assert db.credit == 9.99 and stripe_calls == [] and db.doubles_invites.docs[0]["status"] == "credited"


def test_choosing_the_card_refunds_through_stripe_once(stripe_calls):
    db = Db()
    offer(db)
    assert choose(db, "card")["card_amount"] == 9.99
    assert stripe_calls == [("cs_test_1", "unpaired-team-" + "t" * 60)]
    assert db.credit == 0 and db.doubles_invites.docs[0]["status"] == "refunded" and db.payment_transactions.docs[0]["refunded"]
    with pytest.raises(ValueError):
        choose(db, "card")                              # a second click cannot refund again
    assert len(stripe_calls) == 1


def test_a_zelle_payment_can_only_come_back_as_credit(stripe_calls):
    db = Db()
    db.payment_transactions.docs[0]["session_id"] = "zelle_123"
    offer(db)
    assert db.doubles_invites.docs[0]["card_refundable"] == 0
    with pytest.raises(ValueError):
        choose(db, "card")
    choose(db, "credit")
    assert db.credit == 9.99


def test_the_part_paid_with_credit_goes_back_as_credit_even_on_a_card_refund(stripe_calls):
    db = Db()
    db.payment_transactions.docs[0]["metadata"]["credit_applied"] = 4.0
    offer(db)
    assert db.doubles_invites.docs[0]["refund_amount"] == 13.99      # 9.99 by card + 4.00 credit
    choose(db, "card")
    assert db.credit == 4.0 and len(stripe_calls) == 1


def test_a_failed_card_refund_leaves_the_choice_open(stripe_calls, monkeypatch):
    db = Db()
    offer(db)

    def boom(*a):
        raise RuntimeError("stripe down")
    monkeypatch.setattr(unpaired_refunds, "_stripe_refund", boom)
    with pytest.raises(RuntimeError):
        choose(db, "card")
    assert db.doubles_invites.docs[0]["status"] == "refund_choice" and db.credit == 0


def test_only_the_owner_can_choose(stripe_calls):
    db = Db()
    offer(db)
    with pytest.raises(ValueError):
        run(unpaired_refunds.choose(db, "t" * 60, "someone-else", "credit"))


def test_no_answer_for_a_week_becomes_credit(stripe_calls):
    db = Db()
    offer(db)
    assert run(unpaired_refunds.auto_credit_overdue(db, datetime.now(timezone.utc) + timedelta(days=6))) == 0
    assert run(unpaired_refunds.auto_credit_overdue(db, datetime.now(timezone.utc) + timedelta(days=8))) == 1
    assert db.credit == 9.99 and db.doubles_invites.docs[0]["status"] == "credited"
