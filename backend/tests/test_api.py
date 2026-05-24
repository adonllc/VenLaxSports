"""Backend API tests for Multi-Sport League Platform - uses cookie-based auth"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


def get_admin_session():
    """Returns a requests.Session with admin cookies set"""
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@leaguepro.com",
        "password": "Admin@123"
    })
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return s


class TestHealth:
    def test_api_health(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_api_root(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200


class TestAuth:
    def test_register_user(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "TEST_user1@example.com",
            "password": "Test@1234",
            "name": "Test User",
            "country": "USA"
        })
        # 400 if already exists
        assert r.status_code in [200, 201, 400]
        if r.status_code in [200, 201]:
            data = r.json()
            assert "id" in data
            assert data["email"] == "test_user1@example.com"

    def test_login_admin(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@leaguepro.com",
            "password": "Admin@123"
        })
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "admin@leaguepro.com"
        assert data["role"] == "admin"

    def test_login_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@leaguepro.com",
            "password": "wrongpassword"
        })
        assert r.status_code == 401

    def test_me_endpoint_with_cookie(self):
        s = get_admin_session()
        r = s.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "admin@leaguepro.com"
        assert data["role"] == "admin"


class TestLeagues:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = get_admin_session()

    def test_get_leagues(self):
        r = requests.get(f"{BASE_URL}/api/leagues")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_filter_leagues_by_sport_active(self):
        # Phase 1: tennis & pickleball active
        for sport in ["tennis", "pickleball"]:
            r = requests.get(f"{BASE_URL}/api/leagues?sport={sport}")
            assert r.status_code == 200
            leagues = r.json()
            assert isinstance(leagues, list)
            for l in leagues:
                assert l["sport"] == sport
                assert l["country"] == "USA"

    def test_filter_leagues_by_sport_cricket_blocked(self):
        # Phase 1: cricket NOT active → empty list
        r = requests.get(f"{BASE_URL}/api/leagues?sport=cricket")
        assert r.status_code == 200
        assert r.json() == []

    def test_filter_leagues_by_country_usa(self):
        r = requests.get(f"{BASE_URL}/api/leagues?country=USA")
        assert r.status_code == 200
        leagues = r.json()
        assert len(leagues) > 0
        for l in leagues:
            assert l["country"] == "USA"
            assert l["sport"] in ["tennis", "pickleball"]

    def test_filter_leagues_by_country_india_blocked(self):
        # Phase 1: India NOT active → empty list
        r = requests.get(f"{BASE_URL}/api/leagues?country=India")
        assert r.status_code == 200
        assert r.json() == []

    def test_default_leagues_only_active_phase(self):
        r = requests.get(f"{BASE_URL}/api/leagues")
        assert r.status_code == 200
        leagues = r.json()
        assert len(leagues) > 0
        for l in leagues:
            assert l["sport"] in ["tennis", "pickleball"]
            assert l["country"] == "USA"

    def test_get_league_detail(self):
        leagues = requests.get(f"{BASE_URL}/api/leagues").json()
        league_id = leagues[0]["id"]
        r = requests.get(f"{BASE_URL}/api/leagues/{league_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == league_id

    def test_create_league_admin(self):
        r = self.session.post(f"{BASE_URL}/api/leagues", json={
            "name": "TEST_New League",
            "sport": "tennis",
            "country": "USA",
            "city": "New York",
            "format": "singles",
            "entry_fee": 0.0,
            "currency": "USD",
            "max_players": 8,
            "start_date": "2025-06-01",
            "end_date": "2025-08-01",
            "status": "registration",
            "description": "Test league",
            "venue": "Test Venue",
            "season": "Summer 2025"
        })
        assert r.status_code in [200, 201]
        data = r.json()
        assert "id" in data

    def test_get_league_players(self):
        leagues = requests.get(f"{BASE_URL}/api/leagues").json()
        league_id = leagues[0]["id"]
        r = requests.get(f"{BASE_URL}/api/leagues/{league_id}/players")
        assert r.status_code == 200

    def test_get_league_standings(self):
        leagues = requests.get(f"{BASE_URL}/api/leagues").json()
        league_id = leagues[0]["id"]
        r = requests.get(f"{BASE_URL}/api/leagues/{league_id}/standings")
        assert r.status_code == 200

    def test_get_league_matches(self):
        leagues = requests.get(f"{BASE_URL}/api/leagues").json()
        league_id = leagues[0]["id"]
        r = requests.get(f"{BASE_URL}/api/leagues/{league_id}/matches")
        assert r.status_code == 200

    def test_league_has_division_fields(self):
        s = get_admin_session()
        r = s.post(f"{BASE_URL}/api/leagues", json={
            "name": "Test Division League",
            "sport": "tennis",
            "country": "USA",
            "city": "Austin",
            "format": "singles",
            "entry_fee": 9.99,
            "start_date": "2026-06-01",
            "end_date": "2026-07-15",
            "division_label": "Intermediate",
            "division_ntrp_min": 3.5,
            "division_ntrp_max": 4.0,
        })
        assert r.status_code in [200, 201]
        data = r.json()
        assert data.get("division_label") == "Intermediate"
        assert data.get("division_ntrp_min") == 3.5
        assert data.get("division_ntrp_max") == 4.0

    def test_division_filter(self):
        r = requests.get(f"{BASE_URL}/api/leagues?division=Intermediate")
        assert r.status_code == 200
        data = r.json()
        # All returned leagues must have division_label == "Intermediate"
        for league in data:
            assert league.get("division_label") == "Intermediate"

    def test_box_league_creation(self):
        s = get_admin_session()
        r = s.post(f"{BASE_URL}/api/leagues", json={
            "name": "Box Test League",
            "sport": "tennis",
            "country": "USA",
            "city": "Austin",
            "format": "singles",
            "entry_fee": 9.99,
            "start_date": "2026-06-01",
            "end_date": "2026-07-15",
            "league_type": "box_league",
            "division_label": "Intermediate",
            "division_ntrp_min": 3.5,
            "division_ntrp_max": 4.0,
        })
        assert r.status_code in [200, 201]
        data = r.json()
        assert data.get("league_type") == "box_league"
        assert data.get("box_group_size") == 6


class TestAdmin:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = get_admin_session()

    def test_admin_stats(self):
        r = self.session.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code == 200
        data = r.json()
        assert "total_users" in data
        assert "total_leagues" in data
        assert data["total_leagues"] >= 8

    def test_admin_leagues(self):
        r = self.session.get(f"{BASE_URL}/api/admin/leagues")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 8

    def test_admin_protected_no_cookie(self):
        r = requests.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code in [401, 403]


class TestMatches:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = get_admin_session()

    def test_my_matches(self):
        r = self.session.get(f"{BASE_URL}/api/matches/my")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestCities:
    def test_get_cities(self):
        r = requests.get(f"{BASE_URL}/api/cities")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        for c in data:
            assert c["country"] == "USA"

    def test_get_cities_india_blocked(self):
        # Phase 1: India is not active → empty list
        r = requests.get(f"{BASE_URL}/api/cities?country=India")
        assert r.status_code == 200
        assert r.json() == []

    def test_get_cities_usa_explicit(self):
        r = requests.get(f"{BASE_URL}/api/cities?country=USA")
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        for c in data:
            assert c["country"] == "USA"


class TestUsers:
    def test_patch_user_dupr_rating(self):
        s = get_admin_session()
        r = s.patch(f"{BASE_URL}/api/users/me", json={"dupr_rating": "3.0-3.5"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("dupr_rating") == "3.0-3.5"


class TestBoxLeagues:
    def test_assign_boxes(self):
        s = get_admin_session()
        leagues = requests.get(f"{BASE_URL}/api/leagues?status=registration").json()
        box_leagues = [l for l in leagues if l.get("league_type") == "box_league"]
        if not box_leagues:
            pytest.skip("No box league available")
        lid = box_leagues[0]["id"]
        r = s.post(f"{BASE_URL}/api/box-leagues/{lid}/assign-boxes")
        assert r.status_code in [200, 400]  # 400 = not enough players, still means route exists

    def test_box_standings(self):
        leagues = requests.get(f"{BASE_URL}/api/leagues").json()
        box_leagues = [l for l in leagues if l.get("league_type") == "box_league"]
        if not box_leagues:
            pytest.skip("No box league")
        lid = box_leagues[0]["id"]
        r = requests.get(f"{BASE_URL}/api/box-leagues/{lid}/standings")
        assert r.status_code == 200
        data = r.json()
        assert "boxes" in data


class TestPhase:
    def test_phase_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/phase")
        assert r.status_code == 200
        data = r.json()
        assert data["phase"] == 1
        assert set(data["active_sports"]) == {"tennis", "pickleball"}
        assert data["active_country"] == "USA"
        assert data["currency"] == "USD"
        assert data["payment_provider"] == "stripe"


