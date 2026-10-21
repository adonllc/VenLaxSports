"""Admin round pairings: preview, create, byes, doubles teams, rematch avoidance (no live Mongo)."""
import asyncio
import sys
import types
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import email_service  # noqa: E402

@pytest.fixture
def SENT(monkeypatch):
    sent = []
    monkeypatch.setattr(email_service, "schedule", lambda coro: (sent.append(coro.cr_frame.f_locals.get("to")), coro.close()))
    return sent


from routes import admin_routes  # noqa: E402


async def _admin(request, db):
    return {"_id": "admin"}


admin_routes.require_admin = _admin


class Cursor:
    def __init__(self, docs):
        self.docs = docs

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

    @staticmethod
    def _match(doc, q):
        for k, v in q.items():
            if isinstance(v, dict):
                if "$in" in v and doc.get(k) not in v["$in"]:
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
        self.docs.extend(docs)

    async def update_one(self, q, upd):
        d = await self.find_one(q)
        if d:
            d.update(upd.get("$set", {}))
            for k, v in upd.get("$addToSet", {}).items():
                d.setdefault(k, [])
                if v not in d[k]:
                    d[k].append(v)


class FakeDb:
    def __init__(self):
        for n in ("leagues", "users", "player_leagues", "matches"):
            setattr(self, n, Coll())


def make_request(db):
    return types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)))


def seed(n, fmt="singles", status="registration"):
    db = FakeDb()
    lid = ObjectId()
    db.leagues.docs.append({"_id": lid, "name": "Atlanta Tennis", "sport": "tennis", "format": fmt, "status": status, "league_type": "flex"})
    ids = []
    for i in range(n):
        uid = ObjectId()
        ids.append(str(uid))
        db.users.docs.append({"_id": uid, "name": f"Player {i}", "email": f"p{i}@example.com", "tennis_rating": 5.0 - i * 0.1})
    return db, str(lid), ids


def reg(db, lid, uid, partner=None):
    db.player_leagues.docs.append({
        "player_id": uid, "player_name": "x", "league_id": lid, "payment_status": "paid",
        "partner_id": partner, "partner_name": "y" if partner else None,
    })


def run(db, lid, body):
    return asyncio.run(admin_routes.create_round_pairings(lid, make_request(db), body))


def test_preview_changes_nothing(SENT):
    db, lid, ids = seed(4)
    for u in ids:
        reg(db, lid, u)
    out = run(db, lid, {"confirm": False})
    assert out["preview"] is True and out["round"] == 1 and len(out["matches"]) == 2
    assert db.matches.docs == [] and db.leagues.docs[0]["status"] == "registration"


def test_create_round_activates_league_creates_matches_and_emails_everyone(SENT):
    db, lid, ids = seed(5)
    for u in ids:
        reg(db, lid, u)
    out = run(db, lid, {"confirm": True})
    assert out["created"] == 2 and out["bye"] == "Player 4"
    assert db.leagues.docs[0]["status"] == "active" and db.leagues.docs[0]["byes"] == [ids[4]]
    assert all(m["round"] == 1 and m["scheduled_date"] for m in db.matches.docs)
    assert len(SENT) == 5  # 4 opponents + 1 bye


def test_second_round_blocked_until_first_is_played_then_avoids_rematches(SENT):
    db, lid, ids = seed(4)
    for u in ids:
        reg(db, lid, u)
    run(db, lid, {"confirm": True})
    with pytest.raises(HTTPException) as e:
        run(db, lid, {"confirm": True})
    assert e.value.status_code == 409
    for m in db.matches.docs:
        m["status"] = "completed"
    run(db, lid, {"confirm": True})
    r1 = {frozenset({m["player1_id"], m["player2_id"]}) for m in db.matches.docs if m["round"] == 1}
    r2 = {frozenset({m["player1_id"], m["player2_id"]}) for m in db.matches.docs if m["round"] == 2}
    assert len(r2) == 2 and not (r1 & r2)


def test_doubles_pairs_teams_and_emails_all_four_members(SENT):
    db, lid, ids = seed(8, fmt="doubles")
    for a, b in ((0, 1), (2, 3), (4, 5), (6, 7)):
        reg(db, lid, ids[a], ids[b])
        reg(db, lid, ids[b], ids[a])
    out = run(db, lid, {"confirm": True})
    assert out["created"] == 2 and out["bye"] is None
    assert all(m["team1_partner_id"] and m["team2_partner_id"] for m in db.matches.docs)
    assert len(SENT) == 8


def test_rejects_non_flex_and_too_few_players(SENT):
    db, lid, ids = seed(1)
    reg(db, lid, ids[0])
    with pytest.raises(HTTPException) as e:
        run(db, lid, {"confirm": False})
    assert e.value.status_code == 400
    db.leagues.docs[0]["league_type"] = "round_robin"
    with pytest.raises(HTTPException) as e:
        run(db, lid, {"confirm": False})
    assert e.value.status_code == 400
