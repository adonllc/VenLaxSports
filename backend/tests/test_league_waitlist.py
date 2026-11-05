"""Waitlist for leagues that have already started. In-memory fake database."""
import sys
import types
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import email_service  # noqa: E402
from routes import league_waitlist_routes as wl  # noqa: E402
from test_bulk_email import C  # noqa: E402
from test_league_schedule import run  # noqa: E402


class Leagues(C):
    async def find_one_and_update(self, q, upd):
        d = next((x for x in self.docs if x.get("_id") == q.get("_id")), None)
        if d and d["current_players"] < d["max_players"]:
            before = dict(d)
            d["current_players"] += upd["$inc"].get("current_players", 0)
            return before
        return None

    async def update_one(self, q, upd, upsert=False):
        d = await self.find_one({"_id": q["_id"]}) if "_id" in q else None
        if d:
            for k, v in upd.get("$inc", {}).items():
                d[k] = d.get(k, 0) + v
        return types.SimpleNamespace(matched_count=1 if d else 0)


class Db:
    def __init__(self, status="active", players=10, max_players=16, fee=0):
        self.leagues, self.users = Leagues(), C()
        self.player_leagues, self.league_waitlist = C(), C()
        self.lid = ObjectId()
        self.leagues.docs.append({"_id": self.lid, "name": "Atlanta Singles", "sport": "tennis", "status": status,
                                  "current_players": players, "max_players": max_players, "entry_fee": fee})
        self.uid = ObjectId()
        self.users.docs.append({"_id": self.uid, "name": "Pat", "email": "pat@example.com", "country": "USA"})
        self.request = types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=self)))

    @property
    def league(self):
        return self.leagues.docs[0]


@pytest.fixture(autouse=True)
def fakes(monkeypatch):
    mails, standings = [], []

    async def current_user(request, db):
        return {"_id": str(request.app.state.db.uid), "name": "Pat", "email": "pat@example.com"}

    async def admin(request, db):
        return {"_id": "admin"}

    async def standing(db, league_id, player_id, name, sport, country):
        standings.append(player_id)
    monkeypatch.setattr(wl, "get_current_user", current_user)
    monkeypatch.setattr(wl, "require_admin", admin)
    monkeypatch.setattr(wl, "_upsert_standing", standing)
    monkeypatch.setattr(email_service, "schedule", lambda coro: (mails.append(dict(coro.cr_frame.f_locals)), coro.close()))
    return types.SimpleNamespace(mails=mails, standings=standings)


def join(db):
    return run(wl.join_waitlist(str(db.lid), db.request))


def place(db):
    return run(wl.place_player(str(db.lid), str(db.uid), db.request))


def test_a_player_can_join_the_waitlist_of_a_running_league_once():
    db = Db()
    assert join(db) == {"waitlisted": True} and join(db) == {"waitlisted": True}
    assert len(db.league_waitlist.docs) == 1
    assert run(wl.my_waitlist(db.request)) == {"league_ids": [str(db.lid)]}


@pytest.mark.parametrize("status", ["registration", "completed"])
def test_the_waitlist_is_only_for_leagues_that_have_started(status):
    db = Db(status=status)
    with pytest.raises(HTTPException) as e:
        join(db)
    assert e.value.status_code == 400 and db.league_waitlist.docs == []


def test_a_player_already_in_the_league_cannot_join_the_waitlist():
    db = Db()
    db.player_leagues.docs.append({"league_id": str(db.lid), "player_id": str(db.uid), "payment_status": "paid"})
    with pytest.raises(HTTPException) as e:
        join(db)
    assert e.value.status_code == 409


def test_leaving_removes_them_from_the_list():
    db = Db()
    join(db)
    run(wl.leave_waitlist(str(db.lid), db.request))
    assert run(wl.my_waitlist(db.request)) == {"league_ids": []}


def test_admin_places_a_waitlisted_player_when_there_is_a_spot(fakes):
    db = Db(players=15, fee=9.99)
    join(db)
    assert place(db)["placed"] is True
    assert db.league["current_players"] == 16
    row = db.player_leagues.docs[0]
    assert row["player_id"] == str(db.uid) and row["payment_status"] == "free" and row["placed_from_waitlist"]
    assert db.league_waitlist.docs[0]["status"] == "placed" and fakes.standings == [str(db.uid)]
    assert fakes.mails[0]["to"] == "pat@example.com" and fakes.mails[0]["entry_fee"] == 9.99


def test_placing_into_a_full_league_is_refused_and_nothing_changes(fakes):
    db = Db(players=16)
    join(db)
    with pytest.raises(HTTPException) as e:
        place(db)
    assert e.value.status_code == 409 and db.league["current_players"] == 16
    assert db.player_leagues.docs == [] and db.league_waitlist.docs[0]["status"] == "waiting" and fakes.mails == []


def test_placing_someone_not_on_the_list_is_a_404():
    db = Db()
    with pytest.raises(HTTPException) as e:
        place(db)
    assert e.value.status_code == 404


def test_admin_list_shows_who_is_waiting_and_how_many_spots_are_free():
    db = Db(players=14)
    join(db)
    rows = run(wl.admin_list(db.request))["rows"]
    assert rows[0]["player_name"] == "Pat" and rows[0]["spots_left"] == 2 and rows[0]["league_name"] == "Atlanta Singles"
