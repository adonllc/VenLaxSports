"""Season recap cards: badge rules, card drawing, idempotent batch that skips a failed card, own-card access."""
import sys
import types
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import season_recap  # noqa: E402
from routes import recap_routes  # noqa: E402
from test_league_schedule import Coll, run  # noqa: E402

LEAGUE = {"id": "L1", "name": "Atlanta Singles", "sport": "tennis"}


def standing(pid, wins, losses, points, name=None):
    return {"player_id": pid, "player_name": name or pid.title(), "wins": wins, "losses": losses,
            "matches_played": wins + losses, "points": points}


def match(a, b, status="completed"):
    return {"league_id": "L1", "player1_id": a, "player2_id": b, "status": status}


def recaps(standings, matches, history=()):
    return {r["player_id"]: r for r in season_recap.compute_recaps(LEAGUE, standings, matches, list(history))}


def test_rank_record_and_badges_follow_the_rules():
    st = [standing("ann", 4, 0, 12), standing("bo", 2, 2, 6), standing("cy", 0, 4, 0)]
    ms = [match("ann", "bo"), match("ann", "cy"), match("ann", "bo"), match("ann", "cy"),
          match("bo", "cy"), match("bo", "cy"), match("bo", "cy", "scheduled")]
    hist = [{"league_id": "L1", "user_id": "ann", "delta": 0.1}, {"league_id": "L1", "user_id": "ann", "delta": 0.05},
            {"league_id": "L1", "user_id": "bo", "delta": 0.02}, {"league_id": "OTHER", "user_id": "cy", "delta": 9}]
    r = recaps(st, ms, hist)
    assert [r[p]["rank"] for p in ("ann", "bo", "cy")] == [1, 2, 3]
    assert set(r["ann"]["badges"]) == {"league_leader", "undefeated", "finisher", "rating_climber"}
    assert r["ann"]["rating_delta"] == 0.15 and r["cy"]["rating_delta"] is None   # another league's rating rows never count
    assert r["bo"]["badges"] == [] and r["cy"]["badges"] == []                     # bo missed a match, cy lost every game


def test_nobody_gets_a_badge_for_taking_part():
    r = recaps([standing("ann", 0, 0, 0)], [])
    assert r["ann"]["badges"] == []


def test_undefeated_needs_three_matches_and_no_climber_without_a_gain():
    st = [standing("ann", 2, 0, 6), standing("bo", 0, 2, 0)]
    ms = [match("ann", "bo"), match("ann", "bo")]
    r = recaps(st, ms, [{"league_id": "L1", "user_id": "ann", "delta": -0.01}])
    assert "undefeated" not in r["ann"]["badges"] and "rating_climber" not in r["ann"]["badges"]


def test_card_is_a_1080x1350_image_for_with_and_without_badges(tmp_path):
    base = {"player_name": "Alexandra Montgomery-Livingston", "rank": 2, "players": 12, "wins": 3, "losses": 1, "rating_delta": 0.07}
    for badges in ([], ["league_leader", "finisher"]):
        img = season_recap.generate_recap_card({**base, "badges": badges}, "Atlanta Singles Winter 2026", "tennis")
        assert img.size == (1080, 1350)
    season_recap.generate_recap_card({**base, "rating_delta": None, "badges": []}, "x", "")    # no rating rows: no crash


class C(Coll):
    async def insert_one(self, doc):
        self.docs.append(doc)

    async def update_one(self, q, upd, upsert=False):
        d = await self.find_one(q)
        if d is None and upsert:
            d = dict(q)
            self.docs.append(d)
        if d is not None:
            d.update(upd.get("$set", {}))


class Db:
    def __init__(self):
        for n in ("standings", "matches", "rating_history", "season_recaps"):
            setattr(self, n, C())
        self.standings.docs += [{"league_id": "L1", **standing("ann", 3, 1, 9)}, {"league_id": "L1", **standing("bo", 1, 3, 3)}]
        self.matches.docs += [{**match("ann", "bo")} for _ in range(4)]


@pytest.fixture(autouse=True)
def cards_in_tmp(tmp_path, monkeypatch):
    monkeypatch.setattr(season_recap, "CARD_DIR", str(tmp_path))


def test_batch_is_idempotent_and_a_failed_card_does_not_stop_the_rest(monkeypatch):
    db = Db()
    real = season_recap.generate_recap_card

    def flaky(recap, name, sport):
        if recap["player_id"] == "ann":
            raise ValueError("boom")
        return real(recap, name, sport)
    monkeypatch.setattr(season_recap, "generate_recap_card", flaky)
    assert run(season_recap.generate_for_league(db, LEAGUE)) == {"created": 1, "skipped": 0, "failed": 1}
    monkeypatch.setattr(season_recap, "generate_recap_card", real)
    assert run(season_recap.generate_for_league(db, LEAGUE)) == {"created": 1, "skipped": 1, "failed": 0}   # only the missing one
    assert run(season_recap.generate_for_league(db, LEAGUE)) == {"created": 0, "skipped": 2, "failed": 0}
    assert all(Path(r["image_path"]).exists() for r in db.season_recaps.docs)


def req(db):
    return types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)))


def test_a_player_reads_only_their_own_card(monkeypatch):
    db = Db()
    run(season_recap.generate_for_league(db, LEAGUE))

    async def as_ann(request, database):
        return {"_id": "ann", "role": "player"}
    monkeypatch.setattr(recap_routes, "get_current_user", as_ann)

    class Cur(list):
        def sort(self, *a, **k): return self
        async def to_list(self, n): return list(self)
    db.season_recaps.find = lambda q=None, *a, **k: Cur(d for d in db.season_recaps.docs if all(d.get(k2) == v for k2, v in q.items()))
    mine = run(recap_routes.my_recaps(req(db)))["recaps"]
    assert len(mine) == 1 and mine[0]["rank"] == 1 and {b["key"] for b in mine[0]["badges"]} >= {"league_leader"}
    resp = run(recap_routes.my_recap_image("L1", req(db)))
    assert resp.media_type == "image/png" and "ann.png" in str(resp.path)
    with pytest.raises(HTTPException) as e:
        run(recap_routes.my_recap_image("OTHER", req(db)))
    assert e.value.status_code == 404


def test_generating_needs_an_admin_and_a_completed_league(monkeypatch):
    async def player(request, database):
        return {"_id": "p", "role": "player"}
    monkeypatch.setattr(recap_routes, "get_current_user", player)
    with pytest.raises(HTTPException) as e:
        run(recap_routes.generate("507f1f77bcf86cd799439011", req(Db())))
    assert e.value.status_code == 403
