"""Open to Play: season schedule generation, regenerate/adjust rules, propose/confirm flow.

Runs against an in-memory fake database (no live Mongo needed).
"""
import asyncio
import sys
import types
from collections import Counter
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import email_service  # noqa: E402
import league_schedule  # noqa: E402
from routes import admin_routes, match_routes  # noqa: E402


class Cursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, key, direction=1):
        self.docs = sorted(self.docs, key=lambda d: (d.get(key) is None, d.get(key)), reverse=direction == -1)
        return self

    async def to_list(self, n=None):
        return list(self.docs)

    def __aiter__(self):
        async def gen():
            for d in self.docs:
                yield d
        return gen()


class Coll:
    def __init__(self):
        self.docs = []

    @classmethod
    def _match(cls, doc, q):
        for k, v in q.items():
            if k == "$or":
                if not any(cls._match(doc, sub) for sub in v):
                    return False
            elif isinstance(v, dict):
                if "$in" in v and doc.get(k) not in v["$in"]:
                    return False
                if "$nin" in v and doc.get(k) in v["$nin"]:
                    return False
                if "$ne" in v and doc.get(k) == v["$ne"]:
                    return False
            elif doc.get(k) != v:
                return False
        return True

    async def find_one(self, q=None, *a, **kw):
        return next((d for d in self.docs if self._match(d, q or {})), None)

    def find(self, q=None, *a, **kw):
        return Cursor([d for d in self.docs if self._match(d, q or {})])

    async def insert_many(self, docs):
        for d in docs:
            d.setdefault("_id", ObjectId())
        self.docs.extend(docs)

    async def delete_many(self, q):
        self.docs = [d for d in self.docs if not self._match(d, q)]

    async def update_one(self, q, upd):
        d = await self.find_one(q)
        if d:
            d.update(upd.get("$set", {}))


class FakeDb:
    def __init__(self):
        for n in ("leagues", "users", "player_leagues", "matches"):
            setattr(self, n, Coll())


@pytest.fixture
def sent(monkeypatch):
    out = []
    monkeypatch.setattr(email_service, "schedule", lambda coro: (out.append(coro.cr_frame.f_locals.get("to")), coro.close()))
    return out


def make_league(n, fmt="singles"):
    db = FakeDb()
    lid = ObjectId()
    db.leagues.docs.append({
        "_id": lid, "name": "Atlanta Tennis", "sport": "tennis", "format": fmt, "status": "registration",
        "league_type": "flex", "start_date": "2026-11-08", "end_date": "2027-01-03",
    })
    ids = []
    for i in range(n):
        uid = ObjectId()
        ids.append(str(uid))
        db.users.docs.append({"_id": uid, "name": f"Player {i}", "email": f"p{i}@example.com", "tennis_rating": 4.0 - i * 0.05})
    if fmt == "singles":
        for u in ids:
            db.player_leagues.docs.append({"player_id": u, "player_name": "x", "league_id": str(lid), "payment_status": "paid"})
    else:
        for a, b in zip(ids[::2], ids[1::2]):
            for me, other in ((a, b), (b, a)):
                db.player_leagues.docs.append({"player_id": me, "player_name": "x", "league_id": str(lid),
                                               "payment_status": "paid", "partner_id": other, "partner_name": "y"})
    return db, str(lid), ids


def run(coro):
    return asyncio.run(coro)


def league_of(db):
    return db.leagues.docs[0]


def test_preview_changes_nothing(sent):
    db, lid, ids = make_league(16)
    out = run(league_schedule.open_league_to_play(db, league_of(db), preview=True))
    assert out["preview"] and out["rounds"] == 4 and out["matches"] == 32
    assert db.matches.docs == [] and league_of(db)["status"] == "registration" and sent == []


def test_everyone_gets_four_matches_no_repeats_balanced_home_away(sent):
    db, lid, ids = make_league(16)
    out = run(league_schedule.open_league_to_play(db, league_of(db)))
    assert out["created"] == 32 and league_of(db)["status"] == "active"
    per_player = Counter(i for m in db.matches.docs for i in (m["player1_id"], m["player2_id"]))
    assert set(per_player.values()) == {4} and len(per_player) == 16
    pairs = [frozenset({m["player1_id"], m["player2_id"]}) for m in db.matches.docs]
    assert len(pairs) == len(set(pairs))  # nobody plays the same opponent twice
    home = Counter(m["player1_id"] for m in db.matches.docs)
    assert all(1 <= home[i] <= 3 for i in ids)
    assert all(m["schedule_status"] == "unscheduled" and m["deadline"] for m in db.matches.docs)
    assert len(sent) == 16  # one email per player listing all four opponents


def test_odd_league_and_small_league_cap_rounds(sent):
    db, lid, ids = make_league(3)
    out = run(league_schedule.open_league_to_play(db, league_of(db)))
    assert out["rounds"] == 2  # 3 players: at most 2 different opponents
    db2, _, _ = make_league(9)
    out2 = run(league_schedule.open_league_to_play(db2, league_of(db2)))
    assert out2["rounds"] == 4 and len(out2["byes"]) == 4


def test_doubles_teams_each_get_four_matches(sent):
    db, lid, ids = make_league(16, fmt="doubles")
    out = run(league_schedule.open_league_to_play(db, league_of(db)))
    assert out["players"] == 8 and out["rounds"] == 4
    teams = Counter(i for m in db.matches.docs for i in (m["player1_id"], m["player2_id"]))
    assert set(teams.values()) == {4}
    assert all(m["team1_partner_id"] and m["team2_partner_id"] for m in db.matches.docs)
    assert len(sent) == 16  # every one of the 16 players is told


def test_cannot_open_twice_but_can_regenerate_before_play_starts(sent):
    db, lid, ids = make_league(8)
    run(league_schedule.open_league_to_play(db, league_of(db)))
    with pytest.raises(ValueError):
        run(league_schedule.open_league_to_play(db, league_of(db)))
    before = sorted(str(m["_id"]) for m in db.matches.docs)
    out = run(league_schedule.open_league_to_play(db, league_of(db), regenerate=True))
    assert out["regenerating"] and league_of(db)["schedule_generation"] == 2
    assert sorted(str(m["_id"]) for m in db.matches.docs) != before and len(db.matches.docs) == 16


def test_regenerate_and_adjust_locked_once_a_match_is_scheduled(sent):
    db, lid, ids = make_league(8)
    run(league_schedule.open_league_to_play(db, league_of(db)))
    m = db.matches.docs[0]
    m["schedule_status"] = "proposed"
    with pytest.raises(league_schedule.ScheduleLocked):
        run(league_schedule.open_league_to_play(db, league_of(db), regenerate=True))
    with pytest.raises(league_schedule.ScheduleLocked):
        run(league_schedule.adjust_match(db, league_of(db), m, m["player2_id"], m["player1_id"]))


def test_adjust_swaps_home_away_and_blocks_duplicate_pairings(sent):
    db, lid, ids = make_league(8)
    run(league_schedule.open_league_to_play(db, league_of(db)))
    m = db.matches.docs[0]
    home, away = m["player1_id"], m["player2_id"]
    out = run(league_schedule.adjust_match(db, league_of(db), m, away, home))
    assert m["player1_id"] == away and m["player2_id"] == home and out["home"]
    other = next(x for x in db.matches.docs if x is not m and x["player1_id"] != home and x["player2_id"] != home)
    # moving this match onto a pair that already meets elsewhere is refused
    with pytest.raises(ValueError):
        run(league_schedule.adjust_match(db, league_of(db), m, other["player1_id"], other["player2_id"]))


def request_for(db):
    return types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)))


def as_user(monkeypatch, db, uid):
    async def fake(request, _db):
        return next(u for u in db.users.docs if str(u["_id"]) == uid) | {"_id": uid}
    monkeypatch.setattr(match_routes, "get_current_user", fake)


def test_both_dashboards_show_the_same_match_and_roles(sent, monkeypatch):
    db, lid, ids = make_league(8)
    run(league_schedule.open_league_to_play(db, league_of(db)))
    m = db.matches.docs[0]
    home, away = m["player1_id"], m["player2_id"]

    as_user(monkeypatch, db, home)
    mine_home = run(match_routes.my_league_matches(lid, request_for(db)))
    as_user(monkeypatch, db, away)
    mine_away = run(match_routes.my_league_matches(lid, request_for(db)))

    h = next(x for x in mine_home["matches"] if x["id"] == str(m["_id"]))
    a = next(x for x in mine_away["matches"] if x["id"] == str(m["_id"]))
    assert h["role"] == "home" and a["role"] == "away"
    assert h["opponent"]["name"] == m["player2_name"] and a["opponent"]["name"] == m["player1_name"]
    assert len(mine_home["matches"]) == 4 and len(mine_away["matches"]) == 4


def test_home_proposes_away_confirms_or_declines(sent, monkeypatch):
    db, lid, ids = make_league(8)
    run(league_schedule.open_league_to_play(db, league_of(db)))
    m = db.matches.docs[0]
    mid, home, away = str(m["_id"]), m["player1_id"], m["player2_id"]
    when = "2026-12-01T18:00:00+00:00"

    as_user(monkeypatch, db, away)  # Away may not propose
    with pytest.raises(HTTPException) as e:
        run(match_routes.propose_match_time(mid, match_routes.ProposeIn(date=when, venue="Court 3"), request_for(db)))
    assert e.value.status_code == 403

    as_user(monkeypatch, db, home)
    run(match_routes.propose_match_time(mid, match_routes.ProposeIn(date=when, venue="Court 3", note="bring balls"), request_for(db)))
    assert m["schedule_status"] == "proposed" and m["proposal"]["venue"] == "Court 3"

    as_user(monkeypatch, db, home)  # Home may not answer its own proposal
    with pytest.raises(HTTPException) as e:
        run(match_routes.respond_to_proposal(mid, match_routes.RespondIn(action="confirm"), request_for(db)))
    assert e.value.status_code == 403

    as_user(monkeypatch, db, away)
    run(match_routes.respond_to_proposal(mid, match_routes.RespondIn(action="decline", message="work that day"), request_for(db)))
    assert m["schedule_status"] == "unscheduled" and m["last_decline"]["message"] == "work that day"

    as_user(monkeypatch, db, home)
    run(match_routes.propose_match_time(mid, match_routes.ProposeIn(date="2026-12-02T18:00:00+00:00", venue="Court 4"), request_for(db)))
    as_user(monkeypatch, db, away)
    run(match_routes.respond_to_proposal(mid, match_routes.RespondIn(action="confirm"), request_for(db)))
    assert m["schedule_status"] == "scheduled" and m["scheduled_date"].startswith("2026-12-02") and m["venue"] == "Court 4"


def test_propose_rejects_past_and_out_of_season_times(sent, monkeypatch):
    db, lid, ids = make_league(8)
    run(league_schedule.open_league_to_play(db, league_of(db)))
    m = db.matches.docs[0]
    as_user(monkeypatch, db, m["player1_id"])
    for bad in ("2020-01-01T10:00:00+00:00", "2030-01-01T10:00:00+00:00"):
        with pytest.raises(HTTPException) as e:
            run(match_routes.propose_match_time(str(m["_id"]), match_routes.ProposeIn(date=bad, venue="Court 1"), request_for(db)))
        assert e.value.status_code == 400


def test_admin_open_to_play_rejects_non_flex(sent, monkeypatch):
    db, lid, ids = make_league(8)
    league_of(db)["league_type"] = "round_robin"

    async def admin(request, _db):
        return {"_id": "admin"}
    monkeypatch.setattr(admin_routes, "require_admin", admin)
    with pytest.raises(HTTPException) as e:
        run(admin_routes.open_to_play(lid, request_for(db), {"confirm": True}))
    assert e.value.status_code == 400
