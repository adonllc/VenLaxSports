"""Admin dashboard KPIs: every number is checked against a small hand-built dataset."""
import sys
import types
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import dashboard_kpis as k  # noqa: E402
import funnel_events  # noqa: E402
from routes import admin_dashboard_routes as routes  # noqa: E402
from test_admin_security import C, Db as BaseDb  # noqa: E402
from test_league_schedule import run  # noqa: E402

NOW = datetime(2026, 10, 27, 15, 0, tzinfo=timezone.utc)


def ago(days, hours=0):
    return (NOW - timedelta(days=days, hours=hours)).isoformat()


def user(name, days_ago, **kw):
    return {"_id": ObjectId(), "name": name, "email": f"{name.lower()}@x.com", "role": "player", "created_at": ago(days_ago), **kw}


def reg(u, league, days_ago, status="paid", sport="tennis"):
    return {"player_id": str(u["_id"]), "league_id": league, "sport": sport, "payment_status": status, "joined_at": ago(days_ago)}


def match(a, b, days_ago):
    return {"player1_id": str(a["_id"]), "player2_id": str(b["_id"]), "status": "completed", "updated_at": ago(days_ago)}


L1, L2 = str(ObjectId()), str(ObjectId())
LEAGUES = [{"_id": ObjectId(L1), "name": "Atlanta Tennis", "sport": "tennis"}, {"_id": ObjectId(L2), "name": "Atlanta Pickleball", "sport": "pickleball"}]


def dataset():
    ann = user("Ann", 1, email_verified=True, profile_complete=True, attribution={"first": {"source": "instagram", "campaign": "tpl_m01_launch"}})
    bob = user("Bob", 3, email_verified=True)
    cy = user("Cy", 10, email_verified=True, profile_complete=True, attribution={"first": {"ref": "ABC"}})
    di = user("Di", 20)
    ed = user("Ed", 60, email_verified=True, profile_complete=True)
    admin = {**user("Boss", 5), "role": "admin"}
    gone = {**user("Gone", 2), "is_active": False}
    users = [ann, bob, cy, di, ed, admin, gone]
    regs = [
        reg(ann, L1, 0),                         # ann: joined today
        reg(cy, L1, 8), reg(cy, L2, 4, sport="pickleball"),   # cy: two sports; joined 2 days after signing up
        reg(bob, L1, 1, status="pending"),       # a checkout that never finished: not joined
        reg(ed, L1, 59),                         # ed: joined a day after signup, long ago
    ]
    matches = [match(cy, ed, 5)]
    return users, regs, matches


def go(**kw):
    users, regs, matches = dataset()
    sends = [{"campaign": "tpl_m01_launch"}] * 3
    return k.compute(users, regs, LEAGUES, matches, sends, {str(users[2]["_id"])}, [], NOW, **kw)


def test_player_counts_ignore_admins_and_deactivated_accounts():
    p = go()["players"]
    assert p["total"] == 5 and p["new_today"] == 0 and p["new_week"] == 2 and p["new_month"] == 4


def test_active_means_joined_or_played_in_the_last_30_days():
    p = go()["players"]
    assert p["active"] == 3 and p["inactive"] == 2     # ann, cy (joined and played), ed (played 5 days ago); bob and di did nothing


def test_a_pending_checkout_is_not_a_league_registration():
    out = go()
    assert out["league_registrations"]["total"] == 4 and out["league_registrations"]["distinct_players"] == 3
    assert out["sport_distribution"] == {"pickleball": 1, "tennis": 3}     # cy counted once per sport


def test_funnel_counts_people_who_signed_up_in_the_range_once_each():
    f = {s["stage"]: s for s in go()["funnel"]}          # default range: the last 30 days -> ann, bob, cy, di
    assert [f[n]["count"] for n in ("Signed up", "Email verified", "Profile completed", "Joined a league", "Played a match")] == [4, 3, 2, 2, 1]
    assert f["Joined a league"]["pct_of_signups"] == 50.0 and f["Joined a league"]["pct_of_previous"] == 100.0
    assert f["Played a match"]["pct_of_previous"] == 50.0


def test_conversion_rates_and_activation():
    out = go()
    assert out["conversion"] == {"signup_to_league": 50.0, "league_to_played": 50.0}
    # signed up 7+ days ago: cy, di, ed. Joined within 7 days of signup: cy (2 days after), ed (1 day after).
    assert out["activation_7d"] == {"rate": 66.7, "eligible": 3}


def test_rates_are_not_available_rather_than_zero_when_nobody_could_convert():
    out = k.compute([], [], [], [], [], set(), [], NOW)
    assert out["conversion"] == {"signup_to_league": None, "league_to_played": None} and out["activation_7d"]["rate"] is None
    assert out["funnel"][0]["pct_of_signups"] is None


def test_filters_by_sport_league_and_source():
    assert go(sport="pickleball")["league_registrations"]["total"] == 1
    assert go(league_id=L1)["league_registrations"]["total"] == 3
    only_ig = go(source="instagram")
    assert only_ig["players"]["total"] == 1 and only_ig["funnel"][0]["count"] == 1
    assert set(go()["available_sources"]) == {"(direct)", "instagram", "referral"}


def test_date_range_limits_the_funnel_cohort_and_the_trend():
    start, end = k.parse_params("2026-10-24", "2026-10-27", NOW)
    out = go(start=start, end=end)
    assert out["funnel"][0]["count"] == 2                     # ann (1 day ago) and bob (3 days ago)
    assert len(out["trend"]) == 4 and sum(d["signups"] for d in out["trend"]) == 2
    assert next(d for d in out["trend"] if d["date"] == "2026-10-27")["league_registrations"] == 1   # ann today


def test_referrals_and_campaigns():
    out = go()
    assert out["referral_registrations"] == 1
    camp = {c["campaign"]: c for c in out["campaigns"]}["tpl_m01_launch"]
    assert camp == {"campaign": "tpl_m01_launch", "sent": 3, "signups": 1, "joined_league": 1}


def test_a_join_with_no_date_counts_as_joined_but_never_as_active_or_fast():
    u = user("Zed", 20)
    r = {"player_id": str(u["_id"]), "league_id": L1, "sport": "tennis", "payment_status": "free"}
    out = k.compute([u], [r], LEAGUES, [], [], set(), [], NOW)
    assert out["league_registrations"]["distinct_players"] == 1 and out["players"]["active"] == 0 and out["activation_7d"]["rate"] == 0.0


def test_site_events_are_counted_in_range_and_say_when_tracking_began():
    ev = [{"event": "registration_started", "at": NOW - timedelta(days=1)}, {"event": "registration_started", "at": NOW - timedelta(days=90)},
          {"event": "league_viewed", "at": NOW - timedelta(hours=2), "sport": "tennis"}]
    out = k.compute([], [], [], [], [], set(), ev, NOW)
    assert out["site_events"]["counts"] == {"registration_started": 1, "league_viewed": 1, "league_registration_started": 0}
    assert out["site_events"]["tracked_since"] == (NOW - timedelta(days=90)).date().isoformat()


def test_bad_date_ranges_are_rejected():
    with pytest.raises(ValueError):
        k.parse_params("2026-10-27", "2026-10-01", NOW)
    with pytest.raises(ValueError):
        k.parse_params("nonsense", "", NOW)
    with pytest.raises(ValueError):
        k.parse_params("2020-01-01", "2026-10-27", NOW)


# ── event intake ──────────────────────────────────────────────────────────────

def test_events_accept_only_known_names_and_store_no_identity():
    row = funnel_events.build("league_viewed", "Tennis", str(ObjectId()))
    assert set(row) == {"event", "at", "sport", "league_id", "user_id"} and row["sport"] == "tennis" and isinstance(row["at"], datetime)
    for bad in (("purchase",), ("league_viewed", "golf"), ("league_viewed", "", "not-an-id")):
        with pytest.raises(funnel_events.EventError):
            funnel_events.build(*bad)


# ── route ─────────────────────────────────────────────────────────────────────

class Db(BaseDb):
    def __init__(self):
        super().__init__()
        for n in ("email_campaigns", "email_jobs", "funnel_events", "doubles_invites", "disputes"):
            setattr(self, n, C())


def as_admin(db, monkeypatch, **fields):
    uid = str(ObjectId())
    me = {"_id": ObjectId(uid), "email": "a@x.com", "name": "A", "role": "admin", **fields}
    db.users.docs.append(me)

    async def fake(request, database):
        return {**me, "_id": uid}
    monkeypatch.setattr(routes, "get_current_user", fake)
    return types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)))


def test_dashboard_route_returns_numbers_and_hides_names_without_player_access(monkeypatch):
    db = Db()
    users, regs, _ = dataset()
    db.users.docs += users
    db.player_leagues.docs += regs
    db.payment_transactions.docs.append({"status": "pending_zelle"})
    db.email_jobs.docs.append({"failed": 2, "started_at": ago(3)})

    full = run(routes.dashboard(as_admin(db, monkeypatch), "", "", "", "", ""))
    assert full["players"]["total"] == 5 and full["pending"]["zelle_payments"] == 1
    assert full["alerts"]["email_send_failures_30d"] == 2 and full["alerts"]["registration_errors"] is None
    assert full["recent"]["signups"] and "Ann" in {s["name"] for s in full["recent"]["signups"]}

    analyst = run(routes.dashboard(as_admin(db, monkeypatch, admin_role="analytics_viewer"), "", "", "", "", ""))
    assert analyst["players"]["total"] == 5 and analyst["recent"] == {"signups": [], "joins": []}


def test_dashboard_route_rejects_players_and_bad_dates(monkeypatch):
    db = Db()
    req = as_admin(db, monkeypatch, role="player")
    with pytest.raises(HTTPException) as e:
        run(routes.dashboard(req, "", "", "", "", ""))
    assert e.value.status_code == 403
    req = as_admin(db, monkeypatch)
    with pytest.raises(HTTPException) as e:
        run(routes.dashboard(req, "2026-10-27", "2026-01-01", "", "", ""))
    assert e.value.status_code == 400
