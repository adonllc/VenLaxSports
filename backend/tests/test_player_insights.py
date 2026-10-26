"""Admin player insights: stage, how each player joined and paid, segments, funnel, league rows, access and CSV safety."""
import sys
import types
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import player_insights as pi  # noqa: E402
from routes import admin_players_routes as routes  # noqa: E402
from test_league_schedule import Coll, run  # noqa: E402


def oid():
    return ObjectId()


A, B, C, D, E = (str(oid()) for _ in range(5))
L_SINGLES, L_DOUBLES, L_OPEN = str(oid()), str(oid()), str(oid())

USERS = [
    {"_id": ObjectId(A), "name": "Ann", "email": "ann@x.com", "city": "Atlanta", "created_at": "2026-10-01T00:00:00+00:00", "email_verified": True, "profile_complete": True,
     "attribution": {"first": {"source": "facebook", "medium": "social", "campaign": "launch"}}},
    {"_id": ObjectId(B), "name": "Bo", "email": "bo@x.com", "city": "Atlanta", "created_at": "2026-10-03T00:00:00+00:00", "email_verified": True, "profile_complete": False},
    {"_id": ObjectId(C), "name": "=Cy", "email": "cy@x.com", "city": "Austin", "created_at": "2026-10-05T00:00:00+00:00"},
    {"_id": ObjectId(D), "name": "Di", "email": "di@x.com", "city": "Atlanta", "created_at": "2026-10-07T00:00:00+00:00", "email_verified": True, "profile_complete": True},
    {"_id": ObjectId(E), "name": "Ed", "email": "ed@x.com", "city": "Atlanta", "created_at": "2026-10-09T00:00:00+00:00", "email_verified": True, "profile_complete": True},
]
LEAGUES = [
    {"_id": ObjectId(L_SINGLES), "name": "ATL Singles", "city": "Atlanta", "sport": "tennis", "format": "singles", "status": "registration", "start_date": "2026-11-08", "entry_fee": 9.99, "max_players": 16},
    {"_id": ObjectId(L_DOUBLES), "name": "ATL Doubles", "city": "Atlanta", "sport": "pickleball", "format": "doubles", "status": "registration", "start_date": "2026-11-08", "entry_fee": 19.99, "max_players": 16},
    {"_id": ObjectId(L_OPEN), "name": "ATL Mixed", "city": "Atlanta", "sport": "tennis", "format": "mixed_doubles", "status": "completed", "start_date": "2026-01-01", "entry_fee": 19.99, "max_players": 16},
]
REGS = [
    {"player_id": A, "league_id": L_SINGLES, "payment_status": "paid", "joined_at": "2026-10-02"},
    {"player_id": B, "league_id": L_SINGLES, "payment_status": "free", "joined_at": "2026-10-04"},      # promo
    {"player_id": D, "league_id": L_DOUBLES, "payment_status": "paid", "joined_at": "2026-10-08"},      # team fee paid by Ed
    {"player_id": E, "league_id": L_DOUBLES, "payment_status": "paid", "joined_at": "2026-10-08"},
    {"player_id": C, "league_id": L_SINGLES, "payment_status": "pending"},                              # not joined
]
TXNS = [
    {"user_id": A, "league_id": L_SINGLES, "payment_status": "paid", "amount": 9.99},
    {"user_id": E, "league_id": L_DOUBLES, "payment_status": "paid", "amount": 19.99},
]
PROMOS = [{"code": "PLAY1FREE", "user_id": B, "league_id": L_SINGLES}]
INVITES = [{"initiator_id": E, "league_id": L_DOUBLES, "status": "initiator_paid"}]
PLAYED = {A: 2}


def rows():
    return {r["id"]: r for r in pi.build_player_rows(USERS, REGS, LEAGUES, TXNS, PROMOS, PLAYED, INVITES)}


def test_stage_is_the_furthest_step_reached():
    r = rows()
    assert (r[A]["stage"], r[B]["stage"], r[C]["stage"], r[D]["stage"], r[E]["stage"]) == ("played", "joined", "signed_up", "joined", "paid")


def test_how_each_player_joined_and_what_they_paid():
    r = rows()
    assert r[A]["leagues"][0]["how"] == "paid" and r[A]["total_paid"] == 9.99
    assert r[B]["leagues"][0]["how"] == "promo PLAY1FREE" and r[B]["promo_codes"] == ["PLAY1FREE"] and r[B]["total_paid"] == 0
    assert r[D]["leagues"][0]["how"] == "partner paid the team fee" and r[E]["leagues"][0]["how"] == "paid"
    assert r[C]["league_count"] == 0                                    # a pending registration is not a join
    assert r[A]["source"] == "facebook" and r[C]["source"] == "(direct)"


def test_open_leagues_each_player_has_not_joined_in_their_city():
    r = rows()
    assert r[A]["open_leagues_not_joined"] == ["ATL Doubles"]           # ATL Mixed is completed, so it is not an upsell
    assert r[C]["open_leagues_not_joined"] == []                        # Austin: no open league there
    assert set(r[B]["open_leagues_not_joined"]) == {"ATL Doubles"}


@pytest.mark.parametrize("segment,expected", [
    ("never_joined", {C}), ("one_league", {A, B, D, E}), ("paid", {A, E}), ("coupon", {B}), ("partner_paid", {D}),
    ("doubles", {D, E}), ("waiting_partner", {E}), ("joined_not_played", {B, D, E}), ("played", {A}),
    ("unverified", {C}), ("profile_incomplete", {B, C}), ("all", {A, B, C, D, E}),
])
def test_segments(segment, expected):
    assert {i for i, r in rows().items() if pi.in_segment(r, segment)} == expected


def test_funnel_counts_and_percentages():
    f = {s["label"]: s for s in pi.funnel(list(rows().values()))}
    assert f["Signed up"]["count"] == 5 and f["Verified email"]["count"] == 4 and f["Joined a league"]["count"] == 4
    assert f["Paid with money"]["count"] == 2 and f["Played a match"]["count"] == 1 and f["Joined 2 or more leagues"]["count"] == 0
    assert f["Joined a league"]["percent"] == 80
    assert pi.funnel([])[0] == {"label": "Signed up", "count": 0, "percent": 0}      # no signups: no divide by zero


def test_league_rows_show_revenue_promo_use_and_city_players_not_joined():
    by = {r["name"]: r for r in pi.league_summary(LEAGUES, REGS, TXNS, PROMOS, USERS, INVITES)}
    s = by["ATL Singles"]
    assert (s["registered"], s["with_promo"], s["revenue"], s["capacity"]) == (2, 1, 9.99, 16)
    assert s["city_players_not_joined"] == 2                              # Atlanta players Di and Ed
    assert by["ATL Doubles"]["waiting_for_partner"] == 1 and by["ATL Doubles"]["revenue"] == 19.99
    assert list(by)[0] != "ATL Mixed"                                     # open leagues first


def test_personal_coupons_are_one_summary_row_not_one_row_each():
    codes = [{"code": f"THANKS-{i}", "restricted_user_id": str(i), "campaign_key": "tpl_thank_you", "description": "$10 thank-you credit",
              "used_count": 1 if i == 0 else 0, "max_uses": 1, "type": "amount_off"} for i in range(40)]
    codes += [{"code": f"THANKS-T{i}", "restricted_user_id": "adm", "campaign_key": f"test_tpl_thank_you_{i}", "used_count": 0, "type": "amount_off"} for i in range(5)]
    codes.append({"code": "PLAY1FREE", "used_count": 3})
    out = pi.promo_summary([{"code": "THANKS-0", "user_id": "0"}], codes)
    assert len(out) == 3                                                       # PLAY1FREE, the 40 real coupons, the 5 test ones
    group = next(r for r in out if r["code"].startswith("Personal coupons") and "test" not in r["code"])
    assert (group["max_uses"], group["used"], group["players"]) == (40, 1, 1)


def test_promo_summary():
    out = pi.promo_summary(PROMOS, [{"code": "PLAY1FREE", "used_count": 1, "max_uses": 100, "active": True}, {"code": "UNUSED", "used_count": 0}])
    assert out[0]["code"] == "PLAY1FREE" and out[0]["players"] == 1 and out[1]["used"] == 0


# ── routes ────────────────────────────────────────────────────────────────────

class Db:
    def __init__(self):
        for name, docs in (("users", USERS), ("leagues", LEAGUES), ("player_leagues", REGS), ("payment_transactions", TXNS),
                           ("promo_uses", PROMOS), ("doubles_invites", INVITES), ("promo_codes", []),
                           ("matches", [{"status": "completed", "player1_id": A, "player2_id": B}, {"status": "completed", "player1_id": A, "player2_id": B}])):
            c = Coll()
            c.docs = [dict(d) for d in docs]
            setattr(self, name, c)


def req(db):
    return types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)))


@pytest.fixture
def admin(monkeypatch):
    async def fake(request, database):
        return {"_id": "a", "role": "admin"}
    monkeypatch.setattr(routes, "get_current_user", fake)


def test_only_a_full_admin_may_read_player_data(monkeypatch):
    for role in ("player", "city_admin"):
        async def fake(request, database, role=role):
            return {"_id": "x", "role": role}
        monkeypatch.setattr(routes, "get_current_user", fake)
        with pytest.raises(HTTPException) as e:
            run(routes.overview(req(Db())))
        assert e.value.status_code == 403


def test_overview_has_everything_the_screen_needs(admin):
    r = run(routes.overview(req(Db())))
    assert r["total_players"] == 5 and r["revenue"] == 29.98 and len(r["funnel"]) == 7 and len(r["leagues"]) == 3
    assert {s["id"] for s in r["segments"]} == set(pi.SEGMENTS) and r["promos"] == []


def test_list_filters_and_pages(admin):
    d = Db()
    assert run(routes.players(req(d), segment="coupon"))["players"][0]["name"] == "Bo"
    assert run(routes.players(req(d), q="ANN@"))["total"] == 1
    assert run(routes.players(req(d), league_id=L_DOUBLES))["total"] == 2
    got = run(routes.players(req(d), not_in_league=L_SINGLES))              # Atlanta players not in ATL Singles
    assert {p["name"] for p in got["players"]} == {"Di", "Ed"}
    assert len(run(routes.players(req(d), limit=2))["players"]) == 2 and run(routes.players(req(d), limit=2, skip=4))["players"][0]["name"] == "Ann"
    with pytest.raises(HTTPException) as e:
        run(routes.players(req(d), segment="nope"))
    assert e.value.status_code == 400
    with pytest.raises(HTTPException) as e:
        run(routes.players(req(d), not_in_league=str(oid())))
    assert e.value.status_code == 404


def test_csv_export_neutralises_spreadsheet_formulas(admin):
    resp = run(routes.export(req(Db()), segment="all"))
    text = resp.body.decode()
    assert text.splitlines()[0].startswith("name,email,city") and "'=Cy" in text and ",=Cy" not in text
    assert "attachment" in resp.headers["content-disposition"]
