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
