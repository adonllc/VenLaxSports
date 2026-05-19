import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")


class TestPublicEndpoints:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200


class TestOptionalAuth:
    def test_public_endpoint_no_auth_returns_200_not_401(self):
        # Confirms health works without cookies.
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert "401" not in r.text


class TestModels:
    def test_challenge_model_import(self):
        import sys, os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
        from models import Challenge
        c = Challenge(
            challenger_id="aaa",
            challenger_name="Alice",
            challenged_id="bbb",
        )
        assert c.status == "pending"
        assert c.delivery_method == "email"
        d = c.to_mongo()
        assert d["challenger_id"] == "aaa"


class TestPublicEndpointsRoutes:
    def test_city_leaderboard_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/public/city/New York/sport/tennis")
        assert r.status_code == 200
        data = r.json()
        assert "leaders" in data
        assert "active_leagues" in data
        assert "city" in data

    def test_city_leaderboard_empty_city_returns_200_not_404(self):
        r = requests.get(f"{BASE_URL}/api/public/city/ZzzzNoSuchCity9999/sport/tennis")
        assert r.status_code == 200
        data = r.json()
        assert data["leaders"] == []
        assert data["active_leagues"] == []

    def test_city_leaderboard_no_pii(self):
        r = requests.get(f"{BASE_URL}/api/public/city/New York/sport/tennis")
        assert r.status_code == 200
        assert "email" not in r.text
        assert "password" not in r.text
        assert "google_id" not in r.text

    def test_league_spectator_invalid_id(self):
        r = requests.get(f"{BASE_URL}/api/public/league/notanobjectid")
        assert r.status_code == 404

    def test_challenge_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/public/challenge", json={
            "challenged_id": "000000000000000000000001"
        })
        assert r.status_code == 401
