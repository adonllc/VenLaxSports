"""Auto-refund of doubles teams whose first player paid but never got a partner. In-memory fake database."""
import sys
from pathlib import Path

import pytest
from bson import ObjectId

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import email_service  # noqa: E402
import scheduler_jobs  # noqa: E402
from test_league_schedule import Coll, run  # noqa: E402


class Db:
    def __init__(self, start="2020-01-01"):
        for n in ("feature_flags", "doubles_invites", "leagues", "payment_transactions", "users"):
            setattr(self, n, Coll())
        self.lid = ObjectId()
        self.leagues.docs.append({"_id": self.lid, "name": "Atlanta Doubles", "start_date": start})
        self.uid = ObjectId()
        self.users.docs.append({"_id": self.uid, "name": "Pat", "email": "pat@example.com"})
        self.invite = {"league_id": str(self.lid), "initiator_id": str(self.uid), "token": "t" * 60, "status": "initiator_paid",
                       "partner_user_id": None}
        self.doubles_invites.docs.append(self.invite)
        self.payment_transactions.docs.append({"session_id": "cs_test_1", "payment_status": "paid", "amount": 19.99,
                                               "metadata": {"invite_token": "t" * 60}})


class Calls(list):
    emails: list


@pytest.fixture
def stripe_calls(monkeypatch):
    calls = Calls()

    def fake(session_id, key):
        calls.append((session_id, key))
        return "re_1"
    monkeypatch.setattr(scheduler_jobs, "_stripe_refund", fake)
    emails = []
    monkeypatch.setattr(email_service, "schedule", lambda coro: (emails.append(coro.cr_frame.f_locals.get("to")), coro.close()))
    calls.emails = emails
    return calls


def enable(db):
    db.feature_flags.docs.append({"_id": "refund_unpaired_teams", "enabled": True})


def test_off_by_default_so_nothing_is_refunded(stripe_calls):
    db = Db()
    run(scheduler_jobs.refund_unpaired_teams(db))
    assert stripe_calls == [] and db.doubles_invites.docs[0]["status"] == "initiator_paid"


def test_enabled_refunds_a_paid_unpaired_team_once(stripe_calls):
    db = Db()
    enable(db)
    run(scheduler_jobs.refund_unpaired_teams(db))
    assert stripe_calls == [("cs_test_1", "unpaired-team-" + "t" * 60)]
    assert db.doubles_invites.docs[0]["status"] == "refunded" and db.payment_transactions.docs[0]["refunded"]
    assert stripe_calls.emails == ["pat@example.com"]
    run(scheduler_jobs.refund_unpaired_teams(db))      # next day: nothing left to refund
    assert len(stripe_calls) == 1


def test_waits_until_the_start_date(stripe_calls):
    db = Db(start="2999-01-01")
    enable(db)
    run(scheduler_jobs.refund_unpaired_teams(db))
    assert stripe_calls == [] and db.doubles_invites.docs[0]["status"] == "initiator_paid"


def test_a_team_with_a_partner_is_never_refunded(stripe_calls):
    db = Db()
    enable(db)
    db.invite["partner_user_id"] = "someone"
    run(scheduler_jobs.refund_unpaired_teams(db))
    assert stripe_calls == []


def test_non_stripe_payments_are_left_for_the_admin(stripe_calls):
    db = Db()
    enable(db)
    db.payment_transactions.docs[0]["session_id"] = "zelle_123"
    run(scheduler_jobs.refund_unpaired_teams(db))
    assert stripe_calls == [] and db.doubles_invites.docs[0]["status"] == "initiator_paid"


def test_a_failed_refund_is_not_marked_and_is_retried(stripe_calls, monkeypatch):
    db = Db()
    enable(db)

    def boom(session_id, key):
        raise RuntimeError("stripe down")
    monkeypatch.setattr(scheduler_jobs, "_stripe_refund", boom)
    run(scheduler_jobs.refund_unpaired_teams(db))
    assert db.doubles_invites.docs[0]["status"] == "initiator_paid" and "refunded" not in db.payment_transactions.docs[0]
    monkeypatch.setattr(scheduler_jobs, "_stripe_refund", lambda s, k: "re_2")
    run(scheduler_jobs.refund_unpaired_teams(db))
    assert db.doubles_invites.docs[0]["status"] == "refunded"


def test_admin_flag_defaults_to_off():
    from routes.admin_routes import JOB_FLAGS
    assert JOB_FLAGS["refund_unpaired_teams"]["default"] is False
