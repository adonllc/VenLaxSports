"""Standings are private: a player sees only their own row, an admin sees all, visitors see none, and the public page lists no names."""
import sys
import types
from pathlib import Path

import pytest
from bson import ObjectId

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from routes import league_routes, public_routes  # noqa: E402
from test_league_schedule import Coll, run  # noqa: E402

LID = str(ObjectId())
A, B, C = "playerA", "playerB", "playerC"


class Db:
    def __init__(self):
        self.leagues, self.standings, self.matches = Coll(), Coll(), Coll()
        self.leagues.docs.append({"_id": ObjectId(LID), "name": "ATL Singles", "sport": "tennis", "format": "singles", "status": "active",
                                  "is_public": True, "city": "Atlanta", "current_players": 3, "max_players": 16})
        for pid, name, wins, pts in ((A, "Alice A", 3, 9), (B, "Bob B", 2, 6), (C, "Cara C", 1, 3)):
            self.standings.docs.append({"league_id": LID, "player_id": pid, "player_name": name, "wins": wins, "losses": 1,
                                        "matches_played": wins + 1, "points": pts})
        self.matches.docs.append({"league_id": LID, "status": "completed", "player1_name": "Alice A", "player2_name": "Bob B",
                                  "winner_name": "Alice A", "is_playoff": False})


def req(db):
    return types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)))


def as_viewer(monkeypatch, viewer):
    async def fake(request, database):
        return viewer
    monkeypatch.setattr(league_routes, "get_optional_user", fake)


def names(rows):
    return [r["player_name"] for r in rows]


def test_a_player_sees_only_their_own_row(monkeypatch):
    db = Db()
    as_viewer(monkeypatch, {"_id": B, "role": "player"})
    rows = run(league_routes.get_league_standings(LID, req(db)))
    assert names(rows) == ["Bob B"] and (rows[0]["wins"], rows[0]["losses"], rows[0]["matches_played"], rows[0]["points"]) == (2, 1, 3, 6)
    assert "Alice A" not in str(rows) and "Cara C" not in str(rows)


def test_every_player_gets_their_own_and_only_their_own(monkeypatch):
    db = Db()
    for pid, expected in ((A, "Alice A"), (C, "Cara C")):
        as_viewer(monkeypatch, {"_id": pid, "role": "player"})
        assert names(run(league_routes.get_league_standings(LID, req(db)))) == [expected]


def test_a_player_not_in_the_league_sees_nothing(monkeypatch):
    as_viewer(monkeypatch, {"_id": "outsider", "role": "player"})
    assert run(league_routes.get_league_standings(LID, req(Db()))) == []


def test_visitors_who_are_not_signed_in_see_nothing(monkeypatch):
    as_viewer(monkeypatch, None)
    assert run(league_routes.get_league_standings(LID, req(Db()))) == []


@pytest.mark.parametrize("role", ["admin", "city_admin"])
def test_admins_see_every_player_in_rank_order(monkeypatch, role):
    as_viewer(monkeypatch, {"_id": "adm", "role": role})
    assert names(run(league_routes.get_league_standings(LID, req(Db())))) == ["Alice A", "Bob B", "Cara C"]


def test_the_public_league_page_lists_no_player_names_or_results():
    out = run(public_routes.league_spectator(LID, req(Db())))
    assert out["standings"] == [] and out["recent_matches"] == []
    assert "Alice" not in str(out) and out["name"] == "ATL Singles"
