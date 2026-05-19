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
