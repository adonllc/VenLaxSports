"""Admin-assisted partner assignment. In-memory fake database (see test_partner_later.py)."""
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from routes import doubles_routes  # noqa: E402
from test_league_schedule import run  # noqa: E402
from test_partner_later import Db, as_user, env, join, req  # noqa: E402,F401  (env is a fixture)


def inv(db, token):
    return next(i for i in db.doubles_invites.docs if i["token"] == token)


def toggle(db, token, enabled):
    return run(doubles_routes.set_auto_assign(token, doubles_routes.AutoAssignRequest(enabled=enabled), req(db)))


def test_join_with_partner_later_can_opt_in(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    join(db, partner_later=True, auto_assign_partner=True)
    doc = db.doubles_invites.docs[0]
    assert doc["auto_assign_opt_in"] is True and doc["auto_assign_opt_in_at"]


def test_join_defaults_to_no_opt_in(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    join(db, partner_later=True)
    assert db.doubles_invites.docs[0]["auto_assign_opt_in"] is False


def test_toggle_on_and_off(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    token = join(db, partner_later=True)["invite_token"]
    assert toggle(db, token, True) == {"auto_assign_opt_in": True}
    assert inv(db, token)["auto_assign_opt_in"] is True and inv(db, token)["auto_assign_opt_in_at"]
    assert toggle(db, token, False) == {"auto_assign_opt_in": False}
    assert inv(db, token)["auto_assign_opt_in"] is False and inv(db, token)["auto_assign_opt_in_at"] is None


def test_only_the_initiator_can_toggle(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    token = join(db, partner_later=True)["invite_token"]
    as_user(monkeypatch, db, db.p2)
    with pytest.raises(HTTPException) as e:
        toggle(db, token, True)
    assert e.value.status_code == 403


def test_cannot_toggle_once_a_partner_is_attached(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    token = join(db, partner_later=True)["invite_token"]
    inv(db, token)["partner_user_id"] = db.p2
    with pytest.raises(HTTPException) as e:
        toggle(db, token, True)
    assert e.value.status_code == 409
