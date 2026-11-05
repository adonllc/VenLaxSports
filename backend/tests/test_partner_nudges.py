"""Reminders to doubles players who still have no partner. In-memory fake database."""
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from bson import ObjectId

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import email_service  # noqa: E402
import partner_nudges  # noqa: E402
from test_league_schedule import Coll, run  # noqa: E402

NOW = datetime(2026, 12, 10, 12, 0, tzinfo=timezone.utc)


class Db:
    def __init__(self, start="2026-12-17", status="registration", opted_in=False):
        for n in ("feature_flags", "doubles_invites", "leagues", "users"):
            setattr(self, n, Coll())
        self.lid = ObjectId()
        self.leagues.docs.append({"_id": self.lid, "name": "Atlanta Doubles", "start_date": start, "status": status})
        self.uid = ObjectId()
        self.users.docs.append({"_id": self.uid, "name": "Pat", "email": "pat@example.com"})
        self.invite = {"league_id": str(self.lid), "initiator_id": str(self.uid), "token": "t" * 60, "status": "pending",
                       "partner_user_id": None, "auto_assign_opt_in": opted_in}
        self.doubles_invites.docs.append(self.invite)


@pytest.fixture
def emails(monkeypatch):
    sent = []

    def capture(coro):
        sent.append(dict(coro.cr_frame.f_locals))
        coro.close()
    monkeypatch.setattr(email_service, "schedule", capture)
    return sent


def enable(db):
    db.feature_flags.docs.append({"_id": "nudge_waiting_partners", "enabled": True})


def test_off_by_default(emails):
    db = Db()
    assert run(partner_nudges.nudge_waiting_teams(db, NOW)) == 0 and emails == []


def test_first_nudge_seven_days_out_is_sent_once(emails):
    db = Db(start="2026-12-17")          # 7 days away
    enable(db)
    assert run(partner_nudges.nudge_waiting_teams(db, NOW)) == 1
    assert emails[0]["to"] == "pat@example.com" and emails[0]["days_left"] == 7
    assert db.invite["nudge_7_sent_at"] and not db.invite.get("nudge_2_sent_at")
    assert run(partner_nudges.nudge_waiting_teams(db, NOW)) == 0       # same stage is never repeated


def test_second_nudge_two_days_out_after_the_first(emails):
    db = Db(start="2026-12-17")
    enable(db)
    run(partner_nudges.nudge_waiting_teams(db, NOW))
    later = datetime(2026, 12, 15, 12, 0, tzinfo=timezone.utc)         # 2 days away
    assert run(partner_nudges.nudge_waiting_teams(db, later)) == 1
    assert db.invite["nudge_2_sent_at"] and len(emails) == 2


def test_joining_late_gets_only_the_last_nudge(emails):
    db = Db(start="2026-12-12")           # 2 days away, never nudged before
    enable(db)
    assert run(partner_nudges.nudge_waiting_teams(db, NOW)) == 1
    assert db.invite["nudge_2_sent_at"] and db.invite["nudge_7_sent_at"]
    assert run(partner_nudges.nudge_waiting_teams(db, NOW)) == 0


@pytest.mark.parametrize("start", ["2026-12-25", "2026-12-09"])        # too early, already started
def test_outside_the_window_nothing_is_sent(emails, start):
    db = Db(start=start)
    enable(db)
    assert run(partner_nudges.nudge_waiting_teams(db, NOW)) == 0 and emails == []


def test_skips_teams_with_a_partner_and_closed_leagues(emails):
    db = Db()
    enable(db)
    db.invite["partner_user_id"] = "someone"
    assert run(partner_nudges.nudge_waiting_teams(db, NOW)) == 0
    db2 = Db(status="active")
    enable(db2)
    assert run(partner_nudges.nudge_waiting_teams(db2, NOW)) == 0 and emails == []


def test_email_mentions_opt_in_state(emails):
    db = Db(opted_in=True)
    enable(db)
    run(partner_nudges.nudge_waiting_teams(db, NOW))
    assert emails[0]["opted_in"] is True
