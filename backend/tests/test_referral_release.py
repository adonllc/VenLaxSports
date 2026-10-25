"""Referral credit lifecycle (pending at signup, released after the first confirmed match) and the
self-reported-level rating seed. Runs against a tiny in-memory fake database, no live Mongo needed."""
import asyncio
import sys
from pathlib import Path

from bson import ObjectId

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import email_service  # noqa: E402
import rating_utils  # noqa: E402
import referral_release  # noqa: E402
from routes import auth_routes, referral_routes  # noqa: E402


class Cursor:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, n=None):
        return list(self.docs)


class Coll:
    def __init__(self):
        self.docs = []

    @staticmethod
    def _match(doc, q):
        return all(doc.get(k) == v for k, v in q.items())

    def _apply(self, doc, update):
        for k, v in update.get("$set", {}).items():
            doc[k] = v
        for k, v in update.get("$inc", {}).items():
            doc[k] = doc.get(k, 0) + v

    async def insert_one(self, doc):
        doc = dict(doc)
        doc.setdefault("_id", ObjectId())
        self.docs.append(doc)
        return type("R", (), {"inserted_id": doc["_id"]})()

    async def find_one(self, q, projection=None):
        return next((d for d in self.docs if self._match(d, q)), None)

    def find(self, q=None, projection=None):
        return Cursor([d for d in self.docs if self._match(d, q or {})])

    async def update_one(self, q, update):
        doc = next((d for d in self.docs if self._match(d, q)), None)
        if doc is not None:
            self._apply(doc, update)

    async def find_one_and_update(self, q, update):
        """Returns the document as it was BEFORE the update (motor's default), or None if nothing matched."""
        doc = next((d for d in self.docs if self._match(d, q)), None)
        if doc is None:
            return None
        before = dict(doc)
        self._apply(doc, update)
        return before

    async def count_documents(self, q, **kwargs):
        return len([d for d in self.docs if self._match(d, q)])


class FakeDb:
    def __init__(self):
        self.users = Coll()
        self.referral_credits = Coll()
        self.rating_history = Coll()


def run(coro):
    return asyncio.run(coro)


def make_user(db, email_verified=True, **extra):
    doc = {"_id": ObjectId(), "email": f"{ObjectId()}@example.com", "name": "P", "email_verified": email_verified,
           "credits_balance": 0.0, **extra}
    db.users.docs.append(doc)
    return doc


def signup_with_code(db, referrer, referee, monkeypatch=None):
    run(auth_routes._apply_referral_credit(db, referrer["referral_code"], str(referee["_id"])))


def setup_pair(db, verified=True):
    referrer = make_user(db, referral_code="ABC123")
    referee = make_user(db, email_verified=verified)
    signup_with_code(db, referrer, referee)
    return referrer, referee


# ------------------------------------------------------------------ signup writes pending only
def test_signup_with_code_is_pending_and_changes_no_balance():
    db = FakeDb()
    referrer, referee = setup_pair(db)
    assert len(db.referral_credits.docs) == 1
    credit = db.referral_credits.docs[0]
    assert credit["status"] == "pending" and credit["referee_id"] == str(referee["_id"])
    assert referrer["credits_balance"] == 0.0 and referee["credits_balance"] == 0.0


def test_self_referral_records_nothing():
    db = FakeDb()
    user = make_user(db, referral_code="SELF01")
    run(auth_routes._apply_referral_credit(db, "SELF01", str(user["_id"])))
    assert db.referral_credits.docs == []


def test_unknown_code_does_not_raise_and_records_nothing():
    db = FakeDb()
    user = make_user(db)
    run(auth_routes._apply_referral_credit(db, "NOPE99", str(user["_id"])))
    assert db.referral_credits.docs == []


def test_old_prelaunch_share_code_is_ignored():
    db = FakeDb()
    user = make_user(db)
    run(auth_routes._apply_referral_credit(db, str(ObjectId()), str(user["_id"])))
    assert db.referral_credits.docs == []


# ------------------------------------------------------------------ release
def test_release_pays_both_sides_once_and_marks_applied():
    db = FakeDb()
    referrer, referee = setup_pair(db)
    assert run(referral_release.release_pending_referral_credit(db, str(referee["_id"]))) == 1
    assert referrer["credits_balance"] == 5.0 and referee["credits_balance"] == 5.0
    assert db.referral_credits.docs[0]["status"] == "applied"


def test_double_release_does_not_pay_twice():
    db = FakeDb()
    referrer, referee = setup_pair(db)
    run(referral_release.release_pending_referral_credit(db, str(referee["_id"])))
    assert run(referral_release.release_pending_referral_credit(db, str(referee["_id"]))) == 0
    assert referrer["credits_balance"] == 5.0 and referee["credits_balance"] == 5.0


def test_release_waits_for_a_verified_email():
    db = FakeDb()
    referrer, referee = setup_pair(db, verified=False)
    assert run(referral_release.release_pending_referral_credit(db, str(referee["_id"]))) == 0
    assert db.referral_credits.docs[0]["status"] == "pending"
    assert referrer["credits_balance"] == 0.0
    referee["email_verified"] = True
    assert run(referral_release.release_pending_referral_credit(db, str(referee["_id"]))) == 1


def test_release_with_nothing_pending_is_a_noop():
    db = FakeDb()
    user = make_user(db)
    assert run(referral_release.release_pending_referral_credit(db, str(user["_id"]))) == 0


def test_release_with_garbage_user_id_is_a_noop():
    assert run(referral_release.release_pending_referral_credit(FakeDb(), "not-an-object-id")) == 0


def test_tier_bonus_is_paid_on_the_third_RELEASED_referral_not_the_third_signup(monkeypatch):
    sent = []
    monkeypatch.setattr(email_service, "schedule", lambda coro: (coro.close(), sent.append(1)))
    db = FakeDb()
    referrer = make_user(db, referral_code="TIER01")
    referees = [make_user(db) for _ in range(3)]
    for r in referees:
        signup_with_code(db, referrer, r)
    assert referrer["credits_balance"] == 0.0  # three signups, nothing played, nothing paid

    run(referral_release.release_pending_referral_credit(db, str(referees[0]["_id"])))
    run(referral_release.release_pending_referral_credit(db, str(referees[1]["_id"])))
    assert referrer["credits_balance"] == 10.0  # 2 x $5, no bonus yet

    run(referral_release.release_pending_referral_credit(db, str(referees[2]["_id"])))
    assert referrer["credits_balance"] == 25.0  # 3 x $5 + $10 bonus
    assert sent == [1]


def test_forfeit_path_never_releases_credit():
    """Forfeits are written by match_scheduling, which must not touch referral credit (a walkover is not a played match)."""
    source = (Path(__file__).resolve().parent.parent / "match_scheduling.py").read_text(encoding="utf-8")
    assert "referral_release" not in source and "release_pending_referral_credit" not in source


# ------------------------------------------------------------------ the unsafe endpoint is gone
def test_redeem_endpoint_is_removed():
    paths = [getattr(r, "path", "") for r in referral_routes.router.routes]
    assert not any("redeem" in p for p in paths)


# ------------------------------------------------------------------ rating seed
def test_starting_rating_mapping():
    assert rating_utils.starting_rating_for("2.0") == 2.0
    assert rating_utils.starting_rating_for("4.5") == 4.5
    assert rating_utils.starting_rating_for("6.0+") == 6.0
    assert rating_utils.starting_rating_for("") is None
    assert rating_utils.starting_rating_for(None) is None
    assert rating_utils.starting_rating_for("advanced") is None


def test_seed_sets_both_ratings_before_first_rated_match():
    db = FakeDb()
    user = make_user(db, tennis_rating=3.0, pickleball_rating=3.0)
    assert run(rating_utils.seed_starting_rating(db, str(user["_id"]), "4.5")) is True
    assert user["tennis_rating"] == 4.5 and user["pickleball_rating"] == 4.5


def test_seed_never_touches_an_earned_rating():
    db = FakeDb()
    user = make_user(db, tennis_rating=3.4, pickleball_rating=3.0)
    db.rating_history.docs.append({"user_id": str(user["_id"]), "sport": "tennis"})
    assert run(rating_utils.seed_starting_rating(db, str(user["_id"]), "5.5")) is False
    assert user["tennis_rating"] == 3.4


def test_seed_ignores_an_unusable_level():
    db = FakeDb()
    user = make_user(db, tennis_rating=3.0, pickleball_rating=3.0)
    assert run(rating_utils.seed_starting_rating(db, str(user["_id"]), "pro")) is False
    assert user["tennis_rating"] == 3.0


# ------------------------------------------------------------------ Rewards page numbers
def test_my_credits_reports_pending_separately_from_available(monkeypatch):
    db = FakeDb()
    referrer, referee = setup_pair(db)
    me = {"current": referrer}

    async def fake_current_user(request, db_):
        return me["current"]

    monkeypatch.setattr(referral_routes, "get_current_user", fake_current_user)
    request = type("Req", (), {"app": type("A", (), {"state": type("S", (), {"db": db})()})()})()

    mine = run(referral_routes.get_my_credits(request))
    assert mine["pending_credits"] == 5.0 and mine["credits_balance"] == 0.0

    me["current"] = referee  # the referred player also has a pending $5
    assert run(referral_routes.get_my_credits(request))["pending_credits"] == 5.0

    run(referral_release.release_pending_referral_credit(db, str(referee["_id"])))
    after = run(referral_routes.get_my_credits(request))
    assert after["pending_credits"] == 0.0 and after["credits_balance"] == 5.0
