"""Admin can move a league's start and end dates. In-memory fake database."""
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models import LeagueUpdate  # noqa: E402
from routes import admin_routes  # noqa: E402
from test_league_schedule import Coll, run  # noqa: E402


class Db:
    def __init__(self, status="registration", start="2026-12-20", end="2027-02-20"):
        self.leagues = Coll()
        plain_update = self.leagues.update_one

        async def update_one(*a, **k):
            await plain_update(*a, **k)
            return SimpleNamespace(matched_count=1)
        self.leagues.update_one = update_one
        self.lid = ObjectId()
        self.leagues.docs.append({"_id": self.lid, "name": "Atlanta Doubles", "status": status,
                                  "start_date": start, "end_date": end, "max_players": 16, "current_players": 10})
        self.request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(db=self)))

    @property
    def league(self):
        return self.leagues.docs[0]


@pytest.fixture(autouse=True)
def no_auth_or_audit(monkeypatch):
    async def need(request, perm):
        return {"_id": "admin"}

    async def record(*a, **k):
        return None
    monkeypatch.setattr(admin_routes, "_need", need)
    monkeypatch.setattr(admin_routes.audit_log, "record", record)


def update(db, **fields):
    return run(admin_routes.update_league(str(db.lid), LeagueUpdate(**fields), db.request))


def test_extend_the_end_date_of_an_open_league():
    db = Db()
    update(db, end_date="2027-03-20")
    assert db.league["end_date"] == "2027-03-20" and db.league["start_date"] == "2026-12-20"


def test_move_the_start_date_later():
    db = Db()
    update(db, start_date="2027-01-05", end_date="2027-03-20")
    assert (db.league["start_date"], db.league["end_date"]) == ("2027-01-05", "2027-03-20")


def test_end_before_start_is_refused():
    db = Db()
    with pytest.raises(HTTPException) as e:
        update(db, end_date="2026-12-01")
    assert e.value.status_code == 400 and db.league["end_date"] == "2027-02-20"


def test_new_start_after_the_existing_end_is_refused():
    db = Db()
    with pytest.raises(HTTPException) as e:
        update(db, start_date="2027-06-01")
    assert e.value.status_code == 400


def test_bad_date_text_is_refused():
    db = Db()
    with pytest.raises(HTTPException) as e:
        update(db, end_date="next month")
    assert e.value.status_code == 400


def test_finished_leagues_are_locked():
    db = Db(status="completed")
    with pytest.raises(HTTPException) as e:
        update(db, end_date="2027-03-20")
    assert e.value.status_code == 409


def test_edit_text_fee_and_capacity():
    db = Db()
    update(db, name="  Atlanta Doubles Winter ", venue="Piedmont Park", max_players=24, entry_fee=14.99)
    assert db.league["name"] == "Atlanta Doubles Winter" and db.league["venue"] == "Piedmont Park"
    assert db.league["max_players"] == 24 and db.league["entry_fee"] == 14.99


@pytest.mark.parametrize("fields", [{"max_players": 8}, {"entry_fee": -1}, {"name": "   "}])
def test_bad_values_are_refused(fields):
    db = Db()
    with pytest.raises(HTTPException) as e:
        update(db, **fields)
    assert e.value.status_code == 400
