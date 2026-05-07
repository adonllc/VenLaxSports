"""Iteration 6 backend tests — playoff auto-advance, rating-history endpoint, league↔season link.

Auth: HttpOnly cookies (access_token / refresh_token). Use requests.Session() per role.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@leaguepro.com"
ADMIN_PASSWORD = "Admin@123"


# ───────── helpers ─────────
def _login_session(email: str, password: str):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return s, r.json()


def _register_and_login(email: str, name: str, password="Test@123"):
    s = requests.Session()
    s.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "name": name, "password": password, "country": "USA", "city": "New York",
    })
    s2, me = _login_session(email, password)
    return s2, me


@pytest.fixture(scope="module")
def admin_session():
    s, _ = _login_session(ADMIN_EMAIL, ADMIN_PASSWORD)
    return s


@pytest.fixture(scope="module")
def four_players():
    uid = uuid.uuid4().hex[:6]
    players = []
    for i in range(1, 5):
        email = f"test_p{i}_{uid}@example.com"
        s, me = _register_and_login(email, f"TestP{i}{uid}")
        players.append({"session": s, "user": me, "email": email, "id": me["id"]})
    return players


@pytest.fixture(scope="module")
def admin_created_league(admin_session, four_players):
    """Create a fresh tennis league, join 4 players, seed standings via 2 group-stage matches so that we have standings for top_n=4."""
    admin = admin_session
    # Create league
    r = admin.post(f"{BASE_URL}/api/leagues", json={
        "name": f"TEST_PlayoffLeague_{uuid.uuid4().hex[:6]}",
        "sport": "tennis",
        "format": "singles",
        "country": "USA",
        "city": "New York",
        "venue": "Central Park",
        "entry_fee": 0,
        "currency": "USD",
        "max_players": 8,
        "start_date": datetime.now(timezone.utc).isoformat(),
        "end_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "description": "test",
    })
    assert r.status_code == 200, r.text
    league_id = r.json()["id"]

    # Each player joins
    for p in four_players:
        rj = p["session"].post(f"{BASE_URL}/api/leagues/{league_id}/join", json={})
        assert rj.status_code == 200, rj.text

    return league_id


# ───────── PLAYOFF AUTO-ADVANCE ─────────
class TestPlayoffAutoAdvance:
    def test_full_bracket_flow(self, admin_session, admin_created_league, four_players):
        league_id = admin_created_league
        admin = admin_session

        # Generate 4-player bracket
        r = admin.post(f"{BASE_URL}/api/playoffs", json={
            "league_id": league_id,
            "top_n": 4,
            "first_round_date": datetime.now(timezone.utc).isoformat(),
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["match_ids"]) == 2  # 4 players → 2 round-1 matches
        assert data["rounds_total"] == 2   # 4-player bracket = 2 rounds

        # GET bracket
        r = admin.get(f"{BASE_URL}/api/playoffs/{league_id}")
        assert r.status_code == 200
        bracket = r.json()
        assert len(bracket["rounds"]) == 1
        assert bracket["rounds"][0]["round"] == 1
        assert len(bracket["rounds"][0]["matches"]) == 2

        m1 = bracket["rounds"][0]["matches"][0]
        m2 = bracket["rounds"][0]["matches"][1]

        # Figure out which player-session can score each match
        def _session_for(pid):
            for p in four_players:
                if p["id"] == pid:
                    return p["session"]
            return None

        s1 = _session_for(m1["player1_id"])
        # Score match 1 — winner = player1
        r = s1.post(f"{BASE_URL}/api/matches/{m1['id']}/score", json={
            "winner_id": m1["player1_id"],
            "score_data": {"sets": [[6, 3], [6, 2]]},
        })
        assert r.status_code == 200, r.text
        resp1 = r.json()
        # Since match 2 still scheduled, no next round
        assert resp1.get("next_round_created") in (None,)

        # Score match 2
        s2 = _session_for(m2["player1_id"])
        r = s2.post(f"{BASE_URL}/api/matches/{m2['id']}/score", json={
            "winner_id": m2["player1_id"],
            "score_data": {"sets": [[6, 4], [6, 3]]},
        })
        assert r.status_code == 200, r.text
        resp2 = r.json()
        nrc = resp2.get("next_round_created")
        assert nrc is not None, f"Expected next_round_created, got {resp2}"
        assert nrc["round"] == 2
        assert nrc["label"] == "Final"
        assert len(nrc["match_ids"]) == 1

        # GET bracket should now have 2 rounds
        r = admin.get(f"{BASE_URL}/api/playoffs/{league_id}")
        bracket = r.json()
        assert len(bracket["rounds"]) == 2
        assert bracket["rounds"][1]["round"] == 2
        final_matches = bracket["rounds"][1]["matches"]
        assert len(final_matches) == 1
        final = final_matches[0]
        assert final["status"] == "scheduled"
        assert final["player1_id"] == m1["player1_id"]
        assert final["player2_id"] == m2["player1_id"]

        # Score the final
        sf = _session_for(final["player1_id"])
        r = sf.post(f"{BASE_URL}/api/matches/{final['id']}/score", json={
            "winner_id": final["player1_id"],
            "score_data": {"sets": [[6, 2], [6, 1]]},
        })
        assert r.status_code == 200, r.text
        resp3 = r.json()
        nrc2 = resp3.get("next_round_created")
        assert nrc2 is not None
        assert nrc2.get("league_completed") is True

        # League status should be completed
        r = admin.get(f"{BASE_URL}/api/leagues/{league_id}")
        league = r.json()
        assert league.get("playoffs_status") == "completed"


# ───────── RATING HISTORY ENDPOINT ─────────
class TestRatingHistory:
    def test_history_returns_snapshots(self, four_players):
        """After the playoff matches above, each player should have ≥1 rating snapshot."""
        p = four_players[0]
        r = p["session"].get(f"{BASE_URL}/api/users/me/rating-history")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 1, "expected at least one rating snapshot for player who played"
        row = rows[0]
        for k in ("rating", "delta", "opponent_name", "result", "match_id", "league_id", "sport"):
            assert k in row, f"missing {k} in rating history row: {row}"
        assert row["result"] in ("win", "loss")
        assert row["sport"] == "tennis"

        # Sorted ascending by created_at
        if len(rows) >= 2:
            assert rows[0]["created_at"] <= rows[-1]["created_at"]

    def test_sport_filter(self, four_players):
        p = four_players[0]
        r = p["session"].get(f"{BASE_URL}/api/users/me/rating-history", params={"sport": "tennis"})
        assert r.status_code == 200
        rows = r.json()
        for row in rows:
            assert row["sport"] == "tennis"

        r = p["session"].get(f"{BASE_URL}/api/users/me/rating-history", params={"sport": "pickleball"})
        assert r.status_code == 200
        assert r.json() == []  # no pickleball matches played

    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/users/me/rating-history")
        assert r.status_code in (401, 403)

    def test_no_matches_user_gets_empty(self):
        """Fresh user with no matches should get [] — not crash."""
        email = f"test_empty_{uuid.uuid4().hex[:6]}@example.com"
        s, me = _register_and_login(email, "EmptyUser")
        r = s.get(f"{BASE_URL}/api/users/me/rating-history")
        assert r.status_code == 200
        assert r.json() == []


# ───────── LEAGUE ↔ SEASON LINK ─────────
class TestLeagueSeasonLink:
    def test_create_league_with_season_id(self, admin_session):
        admin = admin_session
        # Create season
        r = admin.post(f"{BASE_URL}/api/seasons", json={
            "name": f"TEST_Season_{uuid.uuid4().hex[:6]}",
            "sport": "tennis",
            "start_date": datetime.now(timezone.utc).isoformat(),
            "end_date": (datetime.now(timezone.utc) + timedelta(days=60)).isoformat(),
        })
        assert r.status_code == 200, r.text
        season_id = r.json()["id"]

        # Create league linked to season
        r = admin.post(f"{BASE_URL}/api/leagues", json={
            "name": f"TEST_LeagueSeason_{uuid.uuid4().hex[:6]}",
            "sport": "tennis",
            "format": "singles",
            "country": "USA",
            "city": "New York",
            "venue": "V",
            "entry_fee": 0,
            "currency": "USD",
            "max_players": 8,
            "start_date": datetime.now(timezone.utc).isoformat(),
            "end_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "description": "t",
            "season_id": season_id,
        })
        assert r.status_code == 200, r.text
        league_id = r.json()["id"]

        # Verify GET /leagues?season_id= returns only that league
        r = requests.get(f"{BASE_URL}/api/leagues", params={"season_id": season_id})
        assert r.status_code == 200
        leagues = r.json()
        assert any(l["id"] == league_id for l in leagues)
        for l in leagues:
            assert l.get("season_id") == season_id

        # Verify individual league has season_id stored
        r = requests.get(f"{BASE_URL}/api/leagues/{league_id}")
        assert r.status_code == 200
        assert r.json().get("season_id") == season_id

    def test_create_league_without_season_id_ok(self, admin_session):
        admin = admin_session
        r = admin.post(f"{BASE_URL}/api/leagues", json={
            "name": f"TEST_NoSeason_{uuid.uuid4().hex[:6]}",
            "sport": "tennis",
            "format": "singles",
            "country": "USA",
            "city": "New York",
            "venue": "V",
            "entry_fee": 0,
            "currency": "USD",
            "max_players": 8,
            "start_date": datetime.now(timezone.utc).isoformat(),
            "end_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "description": "t",
        })
        assert r.status_code == 200, r.text


# ───────── REGRESSION ─────────
class TestRegression:
    def test_admin_login_cookie(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_phase_gate(self):
        r = requests.get(f"{BASE_URL}/api/phase")
        assert r.status_code == 200
        data = r.json()
        assert data["phase"] == 1
        assert "cricket" not in data["active_sports"]

    def test_leagues_list(self):
        r = requests.get(f"{BASE_URL}/api/leagues")
        assert r.status_code == 200
        for l in r.json():
            assert l["sport"] in ("tennis", "pickleball")
            assert l["country"] == "USA"

    def test_forgot_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": "nobody@example.com"})
        # Always returns 200 to prevent enumeration
        assert r.status_code == 200
