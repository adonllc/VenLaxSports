"""A player can change their own name; copies of it on teams, standings and matches follow. Fake database."""
import sys
import types
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import player_names  # noqa: E402
from routes import user_routes  # noqa: E402
from test_bulk_email import C  # noqa: E402
from test_league_schedule import run  # noqa: E402


class Copies:
    """Records update_many calls so the test can see which stored names were rewritten."""
    def __init__(self):
        self.calls = []

    async def update_many(self, query, update):
        self.calls.append((query, update["$set"]))


class Db:
    def __init__(self, name="Pat Lee"):
        self.users = C()
        self.uid = ObjectId()
        self.users.docs.append({"_id": self.uid, "name": name, "email": "pat@x.com"})
        for coll in {c for c, _, _ in player_names.NAME_COPIES}:
            setattr(self, coll, Copies())
        self.request = types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=self)))


@pytest.fixture(autouse=True)
def current_user(monkeypatch):
    async def get(request, db):
        return {"_id": str(db.uid), "name": db.users.docs[0]["name"]}
    monkeypatch.setattr(user_routes, "get_current_user", get)


def patch(db, **fields):
    return run(user_routes.update_profile(user_routes.UserProfileUpdate(**fields), db.request))


def test_changing_the_name_updates_the_account():
    db = Db()
    out = patch(db, first_name="Patricia", last_name="O'Neil-Lee")
    stored = db.users.docs[0]
    assert (stored["first_name"], stored["last_name"], stored["name"]) == ("Patricia", "O'Neil-Lee", "Patricia O'Neil-Lee")
    assert out["name"] == "Patricia O'Neil-Lee"


def test_every_stored_copy_of_the_name_is_rewritten():
    db = Db()
    patch(db, first_name="Pam", last_name="Lee")
    uid = str(db.uid)
    seen = {(coll, q_field, name_field) for coll in ("player_leagues", "standings", "matches", "doubles_invites")
            for q, upd in getattr(db, coll).calls for q_field in q for name_field in upd if q[q_field] == uid and upd[name_field] == "Pam Lee"}
    assert seen == set(player_names.NAME_COPIES)


def test_unchanged_name_does_not_touch_other_records():
    db = Db(name="Pat Lee")
    patch(db, first_name="Pat", last_name="Lee")
    assert all(not getattr(db, c).calls for c in ("player_leagues", "standings", "matches", "doubles_invites"))


def test_extra_spaces_are_tidied():
    db = Db()
    patch(db, first_name="  Mary   Ann ", last_name=" Smith ")
    assert db.users.docs[0]["name"] == "Mary Ann Smith"


@pytest.mark.parametrize("fields", [
    {"first_name": "", "last_name": "Lee"},
    {"first_name": "Pat", "last_name": "   "},
    {"first_name": "Pat"},                                   # last name missing
    {"first_name": "<b>Pat</b>", "last_name": "Lee"},
    {"first_name": "Pat", "last_name": "Lee 3rd"},
    {"first_name": "P" * 51, "last_name": "Lee"},
])
def test_bad_names_are_refused_and_nothing_changes(fields):
    db = Db()
    with pytest.raises(HTTPException) as e:
        patch(db, **fields)
    assert e.value.status_code == 400 and db.users.docs[0]["name"] == "Pat Lee"
    assert all(not getattr(db, c).calls for c in ("player_leagues", "standings", "matches", "doubles_invites"))


def test_other_profile_edits_still_work_without_a_name():
    db = Db()
    patch(db, phone="555-0100")
    assert db.users.docs[0]["phone"] == "555-0100" and db.users.docs[0]["name"] == "Pat Lee"
