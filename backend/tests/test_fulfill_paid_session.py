"""fulfill_paid_session registers a paid player exactly once (no live Mongo needed)."""
import asyncio
import sys
import types
from pathlib import Path

from bson import ObjectId

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# routes.payment_routes imports email_service; stub its sender so no mail goes out
import email_service  # noqa: E402

SENT = []
email_service.schedule = lambda coro: (SENT.append(1), coro.close())

from routes import payment_routes  # noqa: E402


class Coll:
    def __init__(self):
        self.docs = []

    @staticmethod
    def _match(doc, q):
        for k, v in q.items():
            if isinstance(v, dict) and "$ne" in v:
                if doc.get(k) == v["$ne"]:
                    return False
            elif doc.get(k) != v:
                return False
        return True

    async def find_one(self, q=None, *a, **kw):
        return next((d for d in self.docs if self._match(d, q or {})), None)

    async def find_one_and_update(self, q, upd):
        d = await self.find_one(q)
        if d:
            before = dict(d)
            d.update(upd.get("$set", {}))
            return before
        return None

    async def update_one(self, q, upd):
        d = await self.find_one(q)
        if d:
            d.update(upd.get("$set", {}))
            for k, v in upd.get("$inc", {}).items():
                d[k] = d.get(k, 0) + v

    async def insert_one(self, doc):
        self.docs.append(doc)


class FakeDb:
    def __init__(self):
        for n in ("payment_transactions", "player_leagues", "leagues", "users", "waiver_consents", "standings"):
            setattr(self, n, Coll())


def test_paid_session_registers_once_and_is_idempotent():
    db = FakeDb()
    uid, lid = str(ObjectId()), str(ObjectId())
    db.users.docs.append({"_id": ObjectId(uid), "name": "Pat", "email": "pat@example.com", "country": "USA"})
    db.leagues.docs.append({"_id": ObjectId(lid), "name": "Atlanta Tennis Singles", "sport": "tennis", "current_players": 0})
    db.payment_transactions.docs.append({
        "session_id": "cs_1", "user_id": uid, "league_id": lid, "amount": 9.99, "currency": "USD", "metadata": {},
    })

    first = asyncio.run(payment_routes.fulfill_paid_session(db, "cs_1", {}))
    second = asyncio.run(payment_routes.fulfill_paid_session(db, "cs_1", {}))

    assert first["payment_status"] == "paid" and second["payment_status"] == "paid"
    assert len(db.player_leagues.docs) == 1
    assert len(db.standings.docs) == 1
    assert db.leagues.docs[0]["current_players"] == 1
    assert len(SENT) == 1


def test_metadata_dict_handles_plain_dicts_and_objects_without_get():
    class Obj:
        def to_dict(self):
            return {"is_doubles": "true"}

    assert payment_routes._metadata_dict(None) == {}
    assert payment_routes._metadata_dict({"a": "b"}) == {"a": "b"}
    assert payment_routes._metadata_dict(Obj()) == {"is_doubles": "true"}
