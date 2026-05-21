"""Iteration 5 backend tests — seasons, users search, playoffs, rating updates, regression.

Auth model: server sets HttpOnly access_token / refresh_token cookies on login.
Tests use requests.Session() to preserve the cookie jar per role.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = "admin@leaguepro.com"
ADMIN_PASSWORD = "Admin@123"


def _login_session(email: str, password: str) -> tuple[requests.Session, dict]:
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return s, r.json()


def _register(email: str, name: str, password="Test@123"):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "name": name, "password": password, "country": "USA", "city": "New York",
    })
    # 200 on success, 400 if exists
    assert r.status_code in (200, 400), f"register: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def admin_session():
    s, user = _login_session(ADMIN_EMAIL, ADMIN_PASSWORD)
    return s


@pytest.fixture(scope="session")
def two_players():
    uid = uuid.uuid4().hex[:6]
    p1_email = f"test_p1_{uid}@example.com"
    p2_email = f"test_p2_{uid}@example.com"
    _register(p1_email, f"TestP1{uid}")
    _register(p2_email, f"TestP2{uid}")
    s1, u1 = _login_session(p1_email, "Test@123")
    s2, u2 = _login_session(p2_email, "Test@123")
    return {
        "p1": {"session": s1, "user": u1, "email": p1_email},
        "p2": {"session": s2, "user": u2, "email": p2_email},
    }


# ───────── health / regression ─────────
class TestHealth:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert "message" in r.json()

    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_phase_gate(self):
        r = requests.get(f"{BASE_URL}/api/phase")
        assert r.status_code == 200
        data = r.json()
        assert data["phase"] == 1
        assert "tennis" in data["active_sports"]
        assert "pickleball" in data["active_sports"]
        assert "cricket" not in data["active_sports"]
        assert data["active_country"] == "USA"


class TestRegression:
    def test_admin_login(self, admin_session):
        # Verify /auth/me works with the cookie session
        r = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL
        assert r.json()["role"] == "admin"

    def test_leagues_phase_filtered(self):
        r = requests.get(f"{BASE_URL}/api/leagues")
        assert r.status_code == 200
        for l in r.json():
            assert l["sport"] in ("tennis", "pickleball"), f"phase leak: {l['sport']}"
            assert l["country"] == "USA", f"country leak: {l['country']}"

    def test_cities_phase_filtered(self):
        r = requests.get(f"{BASE_URL}/api/cities")
        assert r.status_code == 200
        for c in r.json():
            assert c["country"] == "USA"

    def test_cities_cross_phase_blocked(self):
        r = requests.get(f"{BASE_URL}/api/cities?country=India")
        assert r.status_code == 200
        assert r.json() == []

    def test_forgot_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": ADMIN_EMAIL})
        assert r.status_code in (200, 202, 204)


# ───────── users search / profile ─────────
class TestUserSearch:
    def test_search_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/users/search?q=admin")
        assert r.status_code in (401, 403)

    def test_search_q_too_short(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/users/search?q=a")
        assert r.status_code == 200
        assert r.json() == []

    def test_search_finds_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/users/search?q=adm")
        assert r.status_code == 200
        results = r.json()
        emails = [u["email"] for u in results]
        assert ADMIN_EMAIL in emails
        for u in results:
            assert "password_hash" not in u
            assert "id" in u and "name" in u and "email" in u

    def test_get_user_by_id_requires_auth(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/users/search?q=adm")
        admin_id = next(u["id"] for u in r.json() if u["email"] == ADMIN_EMAIL)
        r2 = requests.get(f"{BASE_URL}/api/users/{admin_id}")
        assert r2.status_code in (401, 403)

    def test_get_user_by_id(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/users/search?q=adm")
        admin_id = next(u["id"] for u in r.json() if u["email"] == ADMIN_EMAIL)
        r2 = admin_session.get(f"{BASE_URL}/api/users/{admin_id}")
        assert r2.status_code == 200
        data = r2.json()
        assert data["email"] == ADMIN_EMAIL
        assert "password_hash" not in data

    def test_get_user_404(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/users/507f1f77bcf86cd799439011")
        assert r.status_code == 404


# ───────── seasons CRUD ─────────
class TestSeasons:
    created_id = None

    def test_create_requires_admin(self, two_players):
        r = two_players["p1"]["session"].post(f"{BASE_URL}/api/seasons", json={
            "name": "x", "sport": "tennis", "start_date": "2025-01-01", "end_date": "2025-12-31"
        })
        assert r.status_code == 403

    def test_create_rejects_inactive_sport(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/seasons", json={
            "name": "TEST_Cricket_Season", "sport": "cricket",
            "start_date": "2025-01-01", "end_date": "2025-12-31",
        })
        assert r.status_code == 400, r.text
        assert "not active" in r.text.lower() or "sport" in r.text.lower()

    def test_create_tennis_season(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/seasons", json={
            "name": f"TEST_Tennis_{uuid.uuid4().hex[:6]}", "sport": "tennis",
            "start_date": "2025-03-01", "end_date": "2025-06-30",
        })
        assert r.status_code == 200, r.text
        TestSeasons.created_id = r.json()["id"]
        assert TestSeasons.created_id

    def test_list_seasons_filters_phase(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/seasons")
        assert r.status_code == 200
        for s in r.json():
            assert s["sport"] in ("tennis", "pickleball")

    def test_patch_season(self, admin_session):
        sid = TestSeasons.created_id
        assert sid
        r = admin_session.patch(f"{BASE_URL}/api/seasons/{sid}", json={"status": "active"})
        assert r.status_code == 200, r.text
        r2 = admin_session.get(f"{BASE_URL}/api/seasons?status=active")
        assert any(s["id"] == sid for s in r2.json())

    def test_delete_season(self, admin_session):
        sid = TestSeasons.created_id
        r = admin_session.delete(f"{BASE_URL}/api/seasons/{sid}")
        assert r.status_code == 200
        r2 = admin_session.delete(f"{BASE_URL}/api/seasons/{sid}")
        assert r2.status_code == 404


# ───────── playoffs ─────────
class TestPlayoffs:
    def test_insufficient_standings(self, admin_session):
        leagues = requests.get(f"{BASE_URL}/api/leagues").json()
        if not leagues:
            pytest.skip("no leagues")
        # Use top_n=16 which should exceed standings for any seeded league
        lid = leagues[-1]["id"]
        r = admin_session.post(f"{BASE_URL}/api/playoffs", json={
            "league_id": lid, "top_n": 16, "first_round_date": "2025-06-01",
        })
        assert r.status_code == 400, r.text
        body = r.text.lower()
        assert "standings" in body or "already" in body or "need" in body

    def test_get_bracket(self, admin_session):
        leagues = requests.get(f"{BASE_URL}/api/leagues").json()
        if not leagues:
            pytest.skip("no leagues")
        lid = leagues[0]["id"]
        r = admin_session.get(f"{BASE_URL}/api/playoffs/{lid}")
        assert r.status_code == 200
        data = r.json()
        assert "rounds" in data
        assert isinstance(data["rounds"], list)


# ───────── rating updates on match score ─────────
class TestRatingUpdates:
    def test_tennis_match_updates_rating(self, two_players):
        leagues = requests.get(f"{BASE_URL}/api/leagues").json()
        tennis_leagues = [l for l in leagues if l["sport"] == "tennis" and l.get("entry_fee", 0) == 0]
        if not tennis_leagues:
            pytest.skip("no free tennis league")
        lid = tennis_leagues[0]["id"]

        s1 = two_players["p1"]["session"]
        s2 = two_players["p2"]["session"]
        p1_id = two_players["p1"]["user"]["id"]
        p2_id = two_players["p2"]["user"]["id"]

        for s in (s1, s2):
            jr = s.post(f"{BASE_URL}/api/leagues/{lid}/join", json={})
            assert jr.status_code in (200, 400), f"join: {jr.status_code} {jr.text}"

        cr = s1.post(f"{BASE_URL}/api/matches", json={
            "league_id": lid, "player2_id": p2_id, "scheduled_date": "2025-06-15",
        })
        assert cr.status_code == 200, f"match create: {cr.status_code} {cr.text}"
        match_id = cr.json()["id"]

        me1 = s1.get(f"{BASE_URL}/api/auth/me").json()
        initial = float(me1.get("tennis_rating", 3.0))

        sr = s1.post(f"{BASE_URL}/api/matches/{match_id}/score",
                     json={"winner_id": p1_id, "score_data": {"sets": "6-4, 6-3"}})
        assert sr.status_code == 200, f"score: {sr.status_code} {sr.text}"
        body = sr.json()
        assert "rating_change" in body, f"rating_change missing: {body}"
        rc = body["rating_change"]
        assert rc["sport"] == "tennis"
        assert rc["winner"]["new"] > rc["winner"]["old"]
        assert rc["loser"]["new"] < rc["loser"]["old"]

        time.sleep(0.3)
        me2 = s1.get(f"{BASE_URL}/api/auth/me").json()
        new = float(me2.get("tennis_rating", 3.0))
        assert new > initial, f"rating did not persist: {initial} -> {new}"

    def test_cricket_league_blocked_phase1(self, admin_session):
        """NOTE: Admin bypasses phase READ filter so POST /api/leagues with sport=cricket
        may still create in DB. Public GET /api/leagues must NOT return it — verified
        in test_leagues_phase_filtered. Here we just confirm the hidden-from-public behavior.
        """
        r = admin_session.post(f"{BASE_URL}/api/leagues", json={
            "name": f"TEST_cricket_phase_{uuid.uuid4().hex[:6]}", "sport": "cricket", "country": "USA",
            "city": "New York", "format": "T20", "entry_fee": 0, "currency": "USD", "max_players": 8,
            "start_date": "2025-06-01", "end_date": "2025-07-01",
        })
        # If admin allows cricket creation, ensure public GET filters it out
        if r.status_code == 200:
            public = requests.get(f"{BASE_URL}/api/leagues").json()
            created_id = r.json().get("id")
            assert all(l["id"] != created_id for l in public), "cricket league leaked to public GET"
        else:
            assert r.status_code in (400, 403)
