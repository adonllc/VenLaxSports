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


import partner_assignment  # noqa: E402


def make_waiting(db, name, status="initiator_paid", opt_in=True, level="3.0", gender=None, **profile):
    uid = db.add_user(name, f"{name.lower()}@example.com", gender=gender)
    user = next(u for u in db.users.docs if str(u["_id"]) == uid)
    user.update({"skill_level": level, "city": "Atlanta", "zip_code": profile.pop("zip_code", ""),
                 "play_profile": profile or None})
    token = f"tok-{name}"
    db.doubles_invites.docs.append({
        "league_id": str(db.lid), "initiator_id": uid, "initiator_name": name, "token": token, "status": status,
        "partner_email": "", "partner_user_id": None, "partner_later": True, "auto_assign_opt_in": opt_in,
        "created_at": f"2026-11-0{len(db.doubles_invites.docs) + 1}T00:00:00+00:00", "expires_at": "2027-01-01",
    })
    return uid, token


def assign(db, a, b):
    return run(partner_assignment.assign_pair(db, a, b))


def test_waiting_candidates_only_opted_in_and_eligible():
    db = Db()
    make_waiting(db, "Ann", court_side="left")
    make_waiting(db, "Bea", opt_in=False)
    make_waiting(db, "Cy", status="pending")
    cands, skipped = run(partner_assignment.waiting_candidates(db, db.leagues.docs[0]))
    assert [c["name"] for c in cands] == ["Ann"]
    assert cands[0]["level"] == 3.0 and cands[0]["court_side"] == "left" and cands[0]["paid"] is True
    assert [(s["name"], s["reason"]) for s in skipped] == [("Cy", "Has not paid yet")]


def test_assign_pair_builds_the_team_and_flags_the_later_payment(env):
    db = Db()
    a_uid, ta = make_waiting(db, "Ann")
    b_uid, tb = make_waiting(db, "Bea")
    out = assign(db, ta, tb)
    assert out["refund_due"] is True and out["team_token"] == ta
    assert {p["player_id"] for p in db.player_leagues.docs} == {a_uid, b_uid}
    assert db.leagues.docs[0]["current_players"] == 2
    a, b = inv(db, ta), inv(db, tb)
    assert a["status"] == "accepted" and a["assigned_by_admin"] is True and a["partner_user_id"] == b_uid
    assert a["merged_token"] == tb and a["status_before_assign"] == "initiator_paid"
    assert b["status"] == "merged" and b["merged_into"] == ta and b["refund_due"] is True
    assert env == ["ann@example.com", "bea@example.com"]       # one "you were paired" email each, no duplicates


def test_the_earlier_registrant_keeps_the_team_even_if_passed_second(env):
    db = Db()
    _, ta = make_waiting(db, "Ann")
    _, tb = make_waiting(db, "Bea")
    assert assign(db, tb, ta)["team_token"] == ta


def test_free_league_has_no_refund(env):
    db = Db(fee=0)
    _, ta = make_waiting(db, "Ann", status="pending")
    _, tb = make_waiting(db, "Bea", status="pending")
    assert assign(db, ta, tb)["refund_due"] is False
    assert inv(db, tb)["refund_due"] is False


@pytest.mark.parametrize("mutate,message", [
    (lambda db, a, b: inv(db, b).update(auto_assign_opt_in=False), "has not agreed"),
    (lambda db, a, b: inv(db, b).update(status="pending"), "has not paid"),
    (lambda db, a, b: inv(db, b).update(partner_user_id="x"), "no longer waiting"),
    (lambda db, a, b: inv(db, b).update(status="accepted"), "no longer waiting"),
    (lambda db, a, b: inv(db, a).update(rejected_partner_ids=[inv(db, b)["initiator_id"]]), "asked not to be paired"),
    (lambda db, a, b: db.leagues.docs[0].update(current_players=15), "No spots"),
    (lambda db, a, b: db.leagues.docs[0].update(status="active"), "registration is closed"),
    (lambda db, a, b: inv(db, b).update(league_id="other"), "same league"),
])
def test_assign_refuses_stale_or_illegal_pairs(env, mutate, message):
    db = Db()
    _, ta = make_waiting(db, "Ann")
    _, tb = make_waiting(db, "Bea")
    mutate(db, ta, tb)
    with pytest.raises(ValueError) as e:
        assign(db, ta, tb)
    assert message in str(e.value)
    assert db.player_leagues.docs == []


def test_mixed_doubles_needs_opposite_genders(env):
    db = Db()
    db.leagues.docs[0]["format"] = "mixed_doubles"
    _, ta = make_waiting(db, "Ann", gender="female")
    _, tb = make_waiting(db, "Bea", gender="female")
    with pytest.raises(ValueError) as e:
        assign(db, ta, tb)
    assert "one male and one female" in str(e.value)
    _, tc = make_waiting(db, "Cy", gender="male")
    assert assign(db, ta, tc)["team_token"] == ta


def test_spots_are_given_back_if_building_the_team_fails(env, monkeypatch):
    db = Db()
    _, ta = make_waiting(db, "Ann")
    _, tb = make_waiting(db, "Bea")

    async def boom(*a, **k):
        raise RuntimeError("db down")
    monkeypatch.setattr(doubles_routes, "_create_doubles_pair", boom)
    with pytest.raises(RuntimeError):
        assign(db, ta, tb)
    assert db.leagues.docs[0]["current_players"] == 0 and inv(db, ta)["status"] == "initiator_paid"


from routes import partner_match_routes  # noqa: E402


@pytest.fixture
def admin(monkeypatch):
    async def ok(request, db):
        return {"_id": "admin", "role": "admin"}
    monkeypatch.setattr(partner_match_routes, "require_admin", ok)


def find_matches(db, **kw):
    return run(partner_match_routes.find_matches(req(db), **{"league_id": None, "max_gap": 0.0, **kw}))


def assign_matches(db, *pairs):
    body = partner_match_routes.AssignIn(pairs=[{"token_a": a, "token_b": b} for a, b in pairs])
    return run(partner_match_routes.assign_matches(body, req(db)))


def test_find_matches_suggests_the_best_pair_and_explains_the_rest(admin):
    db = Db()
    make_waiting(db, "Ann")
    make_waiting(db, "Bea")
    make_waiting(db, "Cy", level="3.5")
    out = find_matches(db)
    assert out["max_gap"] == 0.0 and len(out["leagues"]) == 1
    lg = out["leagues"][0]
    assert lg["league_name"] == "Atlanta Doubles" and lg["spots_left"] == 16
    assert [(p["a"]["name"], p["b"]["name"]) for p in lg["pairs"]] == [("Ann", "Bea")]
    assert lg["pairs"][0]["token_a"] == "tok-Ann" and lg["pairs"][0]["score"] > 0
    assert [(u["name"], u["reason"]) for u in lg["unmatched"]] == [
        ("Cy", "No one within the chosen level range, try a wider level")]


def test_wider_level_range_pairs_neighbours(admin):
    db = Db()
    make_waiting(db, "Ann")
    make_waiting(db, "Cy", level="3.5")
    assert find_matches(db)["leagues"][0]["pairs"] == []
    pairs = find_matches(db, max_gap=0.5)["leagues"][0]["pairs"]
    assert len(pairs) == 1 and "Levels 3.0 / 3.5" in pairs[0]["reasons"]


def test_bad_max_gap_is_rejected(admin):
    with pytest.raises(HTTPException) as e:
        find_matches(Db(), max_gap=0.3)
    assert e.value.status_code == 400


def test_leagues_without_opt_ins_are_not_listed_and_unpaid_are_reported(admin):
    db = Db()
    assert find_matches(db)["leagues"] == []
    make_waiting(db, "Ann", opt_in=False)
    assert find_matches(db)["leagues"] == []
    make_waiting(db, "Bea")
    make_waiting(db, "Cy", status="pending")
    lg = find_matches(db)["leagues"][0]
    assert [s["name"] for s in lg["skipped"]] == ["Cy"]


def test_assign_reports_each_pair_and_one_failure_does_not_stop_the_rest(admin, env):
    db = Db()
    _, ta = make_waiting(db, "Ann")
    _, tb = make_waiting(db, "Bea")
    _, tc = make_waiting(db, "Cy")
    _, td = make_waiting(db, "Dee", opt_in=False)
    out = assign_matches(db, (tc, td), (ta, tb))
    assert [(r["ok"], r.get("refund_due")) for r in out["results"]] == [(False, None), (True, True)]
    assert "has not agreed" in out["results"][0]["error"]
    assert db.leagues.docs[0]["current_players"] == 2


def test_refund_due_list_and_mark_refunded(admin, env):
    db = Db()
    _, ta = make_waiting(db, "Ann")
    _, tb = make_waiting(db, "Bea")
    assign_matches(db, (ta, tb))
    rows = run(partner_match_routes.refund_due(req(db)))["rows"]
    assert [(r["token"], r["player_name"], r["team_with"], r["amount"]) for r in rows] == [("tok-Bea", "Bea", "Ann", 19.99)]
    assert run(partner_match_routes.mark_refunded("tok-Bea", req(db))) == {"refunded": True}
    assert run(partner_match_routes.refund_due(req(db)))["rows"] == []
    assert inv(db, "tok-Bea")["refunded_at"]
    with pytest.raises(HTTPException) as e:
        run(partner_match_routes.mark_refunded("tok-Bea", req(db)))
    assert e.value.status_code == 409


from datetime import datetime, timezone  # noqa: E402

from routes import league_routes  # noqa: E402


def assigned_team(db):
    db.leagues.docs[0]["start_date"] = "2999-01-01"
    a_uid, ta = make_waiting(db, "Ann")
    b_uid, tb = make_waiting(db, "Bea")
    assign(db, ta, tb)
    return a_uid, b_uid, ta, tb


def request_change(db, token, reason=None):
    body = doubles_routes.ChangeRequestBody(reason=reason)
    return run(doubles_routes.request_partner_change(token, body, req(db)))


def test_change_window():
    now = datetime(2026, 11, 4, tzinfo=timezone.utc)
    lg = {"status": "registration", "start_date": "2026-11-05"}
    assert partner_assignment.change_window_open(lg, now) is True
    assert partner_assignment.change_window_open({**lg, "start_date": "2026-11-04"}, now) is False   # start day is locked
    assert partner_assignment.change_window_open({**lg, "status": "active"}, now) is False
    assert partner_assignment.change_window_open({"status": "registration"}, now) is False


def test_either_player_can_ask_for_a_different_partner(env, monkeypatch):
    db = Db()
    a_uid, b_uid, ta, _ = assigned_team(db)
    as_user(monkeypatch, db, b_uid)
    assert request_change(db, ta, "  We play at different levels  ") == {"requested": True}
    r = inv(db, ta)["partner_change_request"]
    assert r["status"] == "pending" and r["by_user_id"] == b_uid and r["reason"] == "We play at different levels"
    assert r["requested_at"]


@pytest.mark.parametrize("setup,status,fragment", [
    (lambda db, a, b, t: None, 403, "Only the two players"),
    (lambda db, a, b, t: inv(db, t).update(assigned_by_admin=False), 409, "paired by VenLax"),
    (lambda db, a, b, t: db.leagues.docs[0].update(start_date="2000-01-01"), 409, "locked"),
    (lambda db, a, b, t: db.leagues.docs[0].update(status="active"), 409, "locked"),
    (lambda db, a, b, t: inv(db, t).update(partner_change_request={"status": "pending"}), 409, "already asked"),
    (lambda db, a, b, t: inv(db, t).update(partner_change_request={"status": "declined"}), 409, "stays as it is"),
])
def test_change_request_is_refused_when_not_allowed(env, monkeypatch, setup, status, fragment):
    db = Db()
    a_uid, b_uid, ta, _ = assigned_team(db)
    outsider = db.p1
    setup(db, a_uid, b_uid, ta)
    as_user(monkeypatch, db, outsider if fragment == "Only the two players" else a_uid)
    with pytest.raises(HTTPException) as e:
        request_change(db, ta)
    assert e.value.status_code == status and fragment in e.value.detail


def test_team_info_for_the_dashboard(env):
    db = Db()
    a_uid, b_uid, ta, _ = assigned_team(db)
    league = db.leagues.docs[0]
    now = datetime.now(timezone.utc)
    info = run(partner_assignment.team_info(db, league, a_uid, now))
    assert info == {"invite_token": ta, "partner_name": "Bea", "assigned_by_venlax": True,
                    "change_request": None, "can_request_change": True}
    inv(db, ta)["partner_change_request"] = {"status": "pending"}
    info = run(partner_assignment.team_info(db, league, b_uid, now))
    assert info["partner_name"] == "Ann" and info["change_request"] == "pending" and info["can_request_change"] is False
    league["start_date"] = "2000-01-01"
    inv(db, ta)["partner_change_request"] = None
    assert run(partner_assignment.team_info(db, league, a_uid, now))["can_request_change"] is False
    inv(db, ta)["assigned_by_admin"] = False
    assert run(partner_assignment.team_info(db, league, a_uid, now)) is None


def test_my_leagues_carries_the_team_info(env, monkeypatch):
    db = Db()
    a_uid, _, ta, _ = assigned_team(db)
    as_user(monkeypatch, db, a_uid)

    async def no_progress(*a, **k):
        return {}
    import league_schedule
    monkeypatch.setattr(league_schedule, "league_progress", no_progress)
    out = run(league_routes.my_leagues(req(db)))
    assert out[0]["team"]["invite_token"] == ta and out[0]["team"]["partner_name"] == "Bea"


def dissolve(db, token):
    team = dict(inv(db, token))  # a snapshot, as a real find_one returns (the fake returns the live doc)
    return run(partner_assignment.dissolve_team(db, db.leagues.docs[0], team))


def test_dissolve_puts_both_players_back_on_the_waiting_list(env):
    db = Db()
    a_uid, b_uid, ta, tb = assigned_team(db)
    out = dissolve(db, ta)
    assert out["repay_required"] is False
    assert db.player_leagues.docs == [] and db.leagues.docs[0]["current_players"] == 0
    a, b = inv(db, ta), inv(db, tb)
    assert a["status"] == "initiator_paid" and a["partner_user_id"] is None and a["assigned_by_admin"] is False
    assert b["status"] == "initiator_paid" and b["merged_into"] is None and b["refund_due"] is False
    assert a["rejected_partner_ids"] == [b_uid] and b["rejected_partner_ids"] == [a_uid]
    with pytest.raises(ValueError) as e:                     # the same pair is never offered again
        assign(db, ta, tb)
    assert "asked not to be paired" in str(e.value)


def test_dissolve_after_the_refund_makes_the_absorbed_player_pay_again(env):
    db = Db()
    _, _, ta, tb = assigned_team(db)
    inv(db, tb).update(refund_due=False, refunded_at="2026-11-05T00:00:00+00:00")
    out = dissolve(db, ta)
    assert out["repay_required"] is True and inv(db, tb)["status"] == "pending"


def test_dissolve_is_refused_once_the_league_started(env):
    db = Db()
    _, _, ta, _ = assigned_team(db)
    db.leagues.docs[0]["status"] = "active"
    with pytest.raises(ValueError):
        dissolve(db, ta)
    assert len(db.player_leagues.docs) == 2 and inv(db, ta)["status"] == "accepted"


def resolve(db, token, action):
    body = partner_match_routes.ResolveIn(action=action)
    return run(partner_match_routes.resolve_change_request(token, body, req(db)))


def test_admin_sees_pending_requests_and_approves_one(admin, env, monkeypatch):
    db = Db()
    a_uid, b_uid, ta, tb = assigned_team(db)
    as_user(monkeypatch, db, a_uid)
    request_change(db, ta, "Different levels")
    rows = run(partner_match_routes.list_change_requests(req(db)))["rows"]
    assert [(r["token"], r["player_a"], r["player_b"], r["requested_by"], r["reason"]) for r in rows] == [
        (ta, "Ann", "Bea", "Ann", "Different levels")]
    env.clear()
    out = resolve(db, ta, "approve")
    assert out["resolved"] == "approved" and out["repay_required"] is False
    assert inv(db, ta)["partner_change_request"]["status"] == "approved"
    assert sorted(env) == ["ann@example.com", "bea@example.com"]
    assert run(partner_match_routes.list_change_requests(req(db)))["rows"] == []


def test_admin_declines_a_request_and_the_team_stays(admin, env, monkeypatch):
    db = Db()
    a_uid, _, ta, _ = assigned_team(db)
    as_user(monkeypatch, db, a_uid)
    request_change(db, ta)
    env.clear()
    assert resolve(db, ta, "decline") == {"resolved": "declined"}
    assert inv(db, ta)["partner_change_request"]["status"] == "declined" and inv(db, ta)["status"] == "accepted"
    assert env == ["ann@example.com"]
    assert len(db.player_leagues.docs) == 2


def test_resolving_without_a_pending_request_is_a_conflict(admin, env):
    db = Db()
    _, _, ta, _ = assigned_team(db)
    with pytest.raises(HTTPException) as e:
        resolve(db, ta, "approve")
    assert e.value.status_code == 409


def test_approving_after_the_league_started_is_a_conflict_and_changes_nothing(admin, env, monkeypatch):
    db = Db()
    a_uid, _, ta, _ = assigned_team(db)
    as_user(monkeypatch, db, a_uid)
    request_change(db, ta)
    db.leagues.docs[0]["status"] = "active"
    with pytest.raises(HTTPException) as e:
        resolve(db, ta, "approve")
    assert e.value.status_code == 409
    assert len(db.player_leagues.docs) == 2 and inv(db, ta)["partner_change_request"]["status"] == "pending"
