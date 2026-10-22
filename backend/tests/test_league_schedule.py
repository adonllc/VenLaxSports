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


def _get(doc, key):
    cur = doc
    for part in key.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def _set(doc, key, value):
    parts = key.split(".")
    for part in parts[:-1]:
        doc = doc.setdefault(part, {})
    doc[parts[-1]] = value


class Coll:
    def __init__(self):
        self.docs = []

    @classmethod
    def _match(cls, doc, q):
        for k, v in q.items():
            if k == "$or":
                if not any(cls._match(doc, sub) for sub in v):
                    return False
                continue
            have = _get(doc, k)
            if isinstance(v, dict):
                if "$in" in v and have not in v["$in"]:
                    return False
                if "$nin" in v and have in v["$nin"]:
                    return False
                if "$ne" in v and have == v["$ne"]:
                    return False
                if "$exists" in v and (have is not None or k in doc) != v["$exists"]:
                    return False
                if "$lt" in v and not (have is not None and have < v["$lt"]):
                    return False
                if "$lte" in v and not (have is not None and have <= v["$lte"]):
                    return False
                if "$gte" in v and not (have is not None and have >= v["$gte"]):
                    return False
            elif have != v:
                return False
        return True

    async def find_one(self, q=None, *a, **kw):
        return next((d for d in self.docs if self._match(d, q or {})), None)

    def find(self, q=None, *a, **kw):
        return Cursor([d for d in self.docs if self._match(d, q or {})])

    async def count_documents(self, q=None):
        return len([d for d in self.docs if self._match(d, q or {})])

    async def insert_many(self, docs):
        for d in docs:
            d.setdefault("_id", ObjectId())
        self.docs.extend(docs)

    async def delete_many(self, q):
        self.docs = [d for d in self.docs if not self._match(d, q)]

    async def find_one_and_update(self, q, upd):
        d = await self.find_one(q)
        if d:
            before = dict(d)
            for k, v in upd.get("$set", {}).items():
                _set(d, k, v)
            for k, v in upd.get("$push", {}).items():
                d.setdefault(k, []).extend(v["$each"] if isinstance(v, dict) else [v])
            return before
        return None

    async def update_one(self, q, upd, upsert=False):
        d = await self.find_one(q)
        if not d and upsert:
            d = {k: v for k, v in q.items() if not k.startswith("$")}
            self.docs.append(d)
        if d:
            for k, v in upd.get("$inc", {}).items():
                d[k] = d.get(k, 0) + v
            for k, v in upd.get("$set", {}).items():
                _set(d, k, v)
            for k, v in upd.get("$push", {}).items():
                d.setdefault(k, []).extend(v["$each"] if isinstance(v, dict) else [v])


class FakeDb:
    def __init__(self):
        for n in ("leagues", "users", "player_leagues", "matches", "disputes", "standings"):
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


# ── Spec checks: canonical records, fields, validation, idempotency, status ─────────────

def test_sixteen_players_four_matches_is_32_unique_canonical_matches_with_all_fields(sent):
    db, lid, ids = make_league(16)
    league_of(db)["division_label"] = "Intermediate"
    run(league_schedule.open_league_to_play(db, league_of(db)))
    ms = db.matches.docs
    assert len(ms) == 32
    assert sorted(m["match_number"] for m in ms) == list(range(1, 33))
    assert len({str(m["_id"]) for m in ms}) == 32
    for m in ms:
        assert m["home_player_id"] == m["player1_id"] and m["away_player_id"] == m["player2_id"]
        assert m["home_player_id"] != m["away_player_id"]
        assert m["league_id"] == lid and m["sport"] == "tennis" and m["division"] == "Intermediate"
        assert m["status"] == "scheduled" and m["schedule_status"] == "unscheduled" and m["round"] in (1, 2, 3, 4)
    # one record per pairing: nobody has a second, conflicting record for the same match
    assert len({frozenset({m["player1_id"], m["player2_id"]}) for m in ms}) == 32


def test_adjust_keeps_home_and_away_fields_in_sync(sent):
    db, lid, ids = make_league(8)
    run(league_schedule.open_league_to_play(db, league_of(db)))
    m = db.matches.docs[0]
    h, a = m["player1_id"], m["player2_id"]
    run(league_schedule.adjust_match(db, league_of(db), m, a, h))
    assert m["home_player_id"] == a and m["away_player_id"] == h and m["player1_id"] == a


def test_retry_does_not_duplicate_and_a_held_lock_blocks_a_second_run(sent):
    db, lid, ids = make_league(8)
    run(league_schedule.open_league_to_play(db, league_of(db)))
    with pytest.raises(ValueError):  # admin retries the start action
        run(league_schedule.open_league_to_play(db, league_of(db)))
    assert len(db.matches.docs) == 16

    db2, lid2, _ = make_league(8)
    from datetime import datetime, timezone
    league_of(db2)["generation_lock"] = datetime.now(timezone.utc).isoformat()  # another run in progress
    with pytest.raises(ValueError):
        run(league_schedule.open_league_to_play(db2, league_of(db2)))
    assert db2.matches.docs == []


def test_validate_plan_refuses_rule_breaking_schedules():
    units = [{"id": "a", "name": "A", "rating": 3}, {"id": "b", "name": "B", "rating": 3}]
    a, b = units
    with pytest.raises(ValueError):
        league_schedule.validate_plan(units, [{"round": 1, "pairs": [(a, a)], "bye": None}], 1, False)
    with pytest.raises(ValueError):  # rematch not allowed
        league_schedule.validate_plan(units, [{"round": 1, "pairs": [(a, b)], "bye": None},
                                              {"round": 2, "pairs": [(b, a)], "bye": None}], 2, False)
    league_schedule.validate_plan(units, [{"round": 1, "pairs": [(a, b)], "bye": None},
                                          {"round": 2, "pairs": [(b, a)], "bye": None}], 2, True)


def test_eligibility_skips_inactive_and_withdrawn_and_warns_about_division(sent):
    db, lid, ids = make_league(10)
    league_of(db).update({"division_ntrp_min": 3.7, "division_ntrp_max": 4.0})
    db.users.docs[0]["is_active"] = False
    db.player_leagues.docs[1]["status"] = "withdrawn"
    pv = run(league_schedule.open_league_to_play(db, league_of(db), preview=True))
    assert pv["players"] == 8
    assert any("outside this division" in w for w in pv["warnings"])
    assert any("inactive" in w for w in pv["warnings"])


def test_league_phase_only_ready_after_schedule_is_published():
    ph = league_schedule.league_phase
    lg = {"status": "registration", "league_type": "flex", "start_date": "2026-11-08"}
    assert ph(lg, False, False, "2026-10-01") == "registration_open"
    lg["status"] = "active"
    assert ph(lg, False, False, "2026-10-01") == "upcoming"  # active but nothing published: not ready
    assert ph(lg, True, False, "2026-10-01") == "ready_to_play"
    assert ph(lg, True, False, "2026-11-09") == "open_to_play"
    assert ph(lg, True, True, "2026-11-09") == "in_progress"
    assert ph({**lg, "playoffs_status": "round_1"}, True, True, "2026-12-30") == "playoffs"
    assert ph({**lg, "status": "completed"}, True, True, "2027-01-04") == "completed"


def test_league_progress_card_data(sent):
    db, lid, ids = make_league(8)
    run(league_schedule.open_league_to_play(db, league_of(db)))
    me = db.matches.docs[0]["player1_id"]
    prog = run(league_schedule.league_progress(db, league_of(db), me))
    assert prog["schedule_published"] and prog["matches_total"] == 4 and prog["matches_completed"] == 0
    assert prog["label"] in ("Ready to Play", "Open to Play") and prog["action"]["href"].endswith("/my-matches")
    before = run(league_schedule.league_progress(db, {**league_of(db), "schedule_published_at": None, "schedule_generation": None}, me))
    assert "players" not in before and before["label"] != "Open to Play"


def test_open_replaces_matches_left_by_the_retired_create_round_tool(sent):
    db, lid, ids = make_league(8)
    league_of(db)["status"] = "active"  # was activated by the old tool, but nothing was published
    old = {"_id": ObjectId(), "league_id": lid, "round": 1, "player1_id": ids[0], "player2_id": ids[1],
           "status": "scheduled", "schedule_status": None, "deadline": None}
    db.matches.docs.append(old)
    run(league_schedule.open_league_to_play(db, league_of(db)))
    assert old not in db.matches.docs and len(db.matches.docs) == 16
    assert all(m["deadline"] for m in db.matches.docs)

    db2, lid2, ids2 = make_league(8)
    db2.matches.docs.append({"_id": ObjectId(), "league_id": lid2, "round": 1, "player1_id": ids2[0], "player2_id": ids2[1],
                             "status": "completed", "deadline": None})
    with pytest.raises(league_schedule.ScheduleLocked):
        run(league_schedule.open_league_to_play(db2, league_of(db2)))


# ── My Matches page: states, privacy, authorization, progress ───────────────────────────
from datetime import datetime, timedelta, timezone  # noqa: E402

import match_view  # noqa: E402

NOW = datetime(2026, 11, 20, 15, 0, tzinfo=timezone.utc)


def _m(**kw):
    base = {"_id": "m1", "status": "scheduled", "schedule_status": "unscheduled", "scheduled_date": "2026-12-01T10:00:00+00:00"}
    base.update(kw)
    return base


def test_match_states_follow_the_spec_groups():
    st = lambda m, d=frozenset(): match_view.match_state(m, NOW, set(d))  # noqa: E731
    assert st(_m()) == "not_scheduled"
    assert st(_m(schedule_status="proposed")) == "awaiting_confirmation"
    assert st(_m(schedule_status="scheduled", scheduled_date="2026-11-25T10:00:00+00:00")) == "scheduled"
    assert st(_m(schedule_status="scheduled", scheduled_date="2026-11-20T09:00:00+00:00")) == "in_progress"
    assert st(_m(schedule_status="scheduled", scheduled_date="2026-11-18T09:00:00+00:00")) == "awaiting_result"
    assert st(_m(status="completed")) == "completed"
    assert st(_m(status="walkover")) == "cancelled" and st(_m(status="cancelled")) == "cancelled"
    assert st(_m(status="completed"), {"m1"}) == "disputed"
    # a legacy self-scheduled match (no schedule_status) is judged by its date
    assert st({"_id": "x", "status": "scheduled", "scheduled_date": "2026-12-05T10:00:00+00:00"}) == "scheduled"


def test_playoff_rules_and_rank():
    assert match_view.playoff_top_n(12) == 4 and match_view.playoff_top_n(16) == 8
    standings = [{"player_id": "a", "matches_played": 2}, {"player_id": "b", "matches_played": 0}]
    assert match_view.standing_rank(standings, "a") == 1
    assert match_view.standing_rank(standings, "b") is None  # unranked until they have played
    assert match_view.playoff_status(3, 4, {}, False)["status"] == "in_position"
    assert match_view.playoff_status(5, 4, {}, False)["status"] == "outside"
    assert match_view.playoff_status(None, 4, {}, False)["status"] == "unranked"
    assert match_view.playoff_status(2, 4, {"playoffs_status": "round_1"}, True)["status"] == "qualified"
    assert match_view.playoff_status(9, 8, {"playoffs_status": "round_1"}, False)["status"] == "not_qualified"


def test_my_matches_page_data_privacy_authorization_and_progress(sent, monkeypatch):
    db, lid, ids = make_league(8)
    run(league_schedule.open_league_to_play(db, league_of(db)))
    m = db.matches.docs[0]
    home, away = m["player1_id"], m["player2_id"]
    for u in db.users.docs:
        if str(u["_id"]) == away:
            u.update({"profile_public": False, "avatar": "http://x/a.png", "skill_level": "advanced"})
        if str(u["_id"]) == home:
            u.update({"avatar": "http://x/h.png", "skill_level": "intermediate"})

    as_user(monkeypatch, db, home)
    page = run(match_routes.my_league_matches(lid, request_for(db)))
    card = next(c for c in page["matches"] if c["id"] == str(m["_id"]))
    assert card["match_number"] == m["match_number"] and card["role"] == "home" and card["state"] == "not_scheduled"
    opp = card["opponent"]  # private profile: name and email shared, avatar/rating/skill hidden
    assert opp["name"] and opp["email"] and opp["rating"] is None and opp["skill_level"] is None
    assert opp["members"][0]["avatar"] is None
    assert page["summary"]["total"] == 4 and page["summary"]["remaining"] == 4 and page["summary"]["wins"] == 0
    assert page["summary"]["playoff"]["status"] == "unranked" and page["summary"]["rank"] is None

    as_user(monkeypatch, db, away)  # the opponent sees the public side of the home player
    page2 = run(match_routes.my_league_matches(lid, request_for(db)))
    card2 = next(c for c in page2["matches"] if c["id"] == str(m["_id"]))
    assert card2["role"] == "away" and card2["opponent"]["rating"] is not None
    assert card2["opponent"]["members"][0]["avatar"] == "http://x/h.png"

    # someone who is not in the league cannot open it
    stranger = ObjectId()
    db.users.docs.append({"_id": stranger, "name": "Stranger", "email": "s@example.com", "role": "player"})
    as_user(monkeypatch, db, str(stranger))
    with pytest.raises(HTTPException) as e:
        run(match_routes.my_league_matches(lid, request_for(db)))
    assert e.value.status_code == 403


def test_summary_counts_results_rank_and_playoff_position(sent, monkeypatch):
    db, lid, ids = make_league(8)
    run(league_schedule.open_league_to_play(db, league_of(db)))
    me = ids[0]
    mine = [m for m in db.matches.docs if me in (m["player1_id"], m["player2_id"])]
    mine[0].update({"status": "completed", "winner_id": me})
    mine[1].update({"status": "completed", "winner_id": mine[1]["player2_id"] if mine[1]["player1_id"] == me else mine[1]["player1_id"]})
    mine[2].update({"schedule_status": "scheduled", "scheduled_date": "2099-01-01T10:00:00+00:00"})
    for pid, pts in ((me, 4.0), (ids[1], 3.0), (ids[2], 1.0)):
        db.standings.docs.append({"league_id": lid, "player_id": pid, "matches_played": 2, "points": pts, "wins": 1})
    as_user(monkeypatch, db, me)
    s = run(match_routes.my_league_matches(lid, request_for(db)))["summary"]
    assert (s["total"], s["completed"], s["scheduled"], s["remaining"], s["wins"], s["losses"]) == (4, 2, 1, 2, 1, 1)
    assert s["rank"] == 1 and s["playoff"] == {"status": "in_position", "top_n": 4}
