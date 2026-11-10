"""Admin view of waiting doubles teams: solo vs invited vs expired. In-memory fake database."""
import sys
import types
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from bson import ObjectId

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from routes import admin_routes  # noqa: E402
from test_bulk_email import C  # noqa: E402
from test_league_schedule import run  # noqa: E402

NOW = datetime(2026, 12, 10, 12, 0, tzinfo=timezone.utc)


def iso(days):
    return (NOW + timedelta(days=days)).isoformat()


@pytest.mark.parametrize("invite,expected", [
    ({"partner_email": ""}, "solo"),
    ({}, "solo"),
    ({"partner_email": "  "}, "solo"),
    ({"partner_email": "a@x.com", "expires_at": iso(5)}, "invited"),
    ({"partner_email": "a@x.com", "expires_at": iso(-1)}, "expired"),
    ({"partner_email": "a@x.com"}, "invited"),
    ({"partner_email": "a@x.com", "expires_at": "garbage"}, "invited"),
])
def test_status(invite, expected):
    assert admin_routes.team_status(invite, NOW) == expected


def real_iso(days):
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def test_endpoint_reports_status_account_and_dates(monkeypatch):
    async def admin(request, db):
        return {"_id": "admin"}
    monkeypatch.setattr(admin_routes, "require_admin", admin)

    db = types.SimpleNamespace(doubles_invites=C(), leagues=C(), users=C())
    lid = ObjectId()
    db.leagues.docs.append({"_id": lid, "name": "Atlanta Doubles", "start_date": "2027-01-10", "entry_fee": 19.99})
    uid = ObjectId()
    db.users.docs += [{"_id": uid, "name": "Pat", "email": "pat@x.com"}, {"_id": ObjectId(), "name": "Sam", "email": "sam@x.com"}]
    base = {"league_id": str(lid), "initiator_id": str(uid), "initiator_name": "Pat", "status": "pending", "created_at": real_iso(-3)}
    db.doubles_invites.docs += [
        {**base, "token": "a" * 60},
        {**base, "token": "b" * 60, "partner_email": "sam@x.com", "partner_invited_at": real_iso(-2), "expires_at": real_iso(10)},
        {**base, "token": "c" * 60, "partner_email": "new@x.com", "expires_at": real_iso(-1)},
    ]
    request = types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)))
    rows = run(admin_routes.incomplete_teams(request))["teams"]
    by_tail = {r["token_tail"][-1]: r for r in rows}
    assert by_tail["a"]["status"] == "solo" and not by_tail["a"]["partner_has_account"]
    assert by_tail["b"]["status"] == "invited" and by_tail["b"]["partner_has_account"] and by_tail["b"]["invited_at"]
    assert by_tail["c"]["status"] == "expired" and not by_tail["c"]["partner_has_account"]
    assert {r["payment"] for r in rows} == {"unpaid"}   # fee is due and the initiator has not paid
