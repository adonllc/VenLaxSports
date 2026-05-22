"""Integration tests for notification dispatch + routes.

Requires a live backend at REACT_APP_BACKEND_URL with admin seeded.
Run: pytest backend/tests/test_notifications.py -v
"""
import pytest
import requests
import os
import secrets
import hashlib
import base64

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": "admin@leaguepro.com", "password": "Admin@123"})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return s


def player_session(email="notif_test@example.com", name="Notif Tester"):
    s = requests.Session()
    # Try register, ignore 400 (already exists)
    s.post(f"{API}/auth/register", json={
        "email": email, "password": "Test@1234!", "name": name, "country": "USA"
    })
    # PKCE login via authorize + token
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    state = base64.urlsafe_b64encode(secrets.token_bytes(16)).rstrip(b"=").decode()

    r = s.post(f"{API}/auth/authorize", json={
        "email": email, "password": "Test@1234!",
        "code_challenge": challenge, "code_challenge_method": "S256", "state": state
    })
    assert r.status_code == 200, f"Authorize failed: {r.text}"
    auth = r.json()
    assert auth["state"] == state

    r2 = s.post(f"{API}/auth/token", json={"code": auth["code"], "code_verifier": verifier})
    assert r2.status_code == 200, f"Token failed: {r2.text}"
    return s


class TestSubscribeRoute:
    def test_subscribe_guest_creates_interest(self):
        """Anonymous subscribe creates a notification_interests record."""
        r = requests.post(f"{API}/notifications/subscribe", json={
            "email": "guest_notif@example.com",
            "city": "New York",
            "sport": "tennis",
            "channels": ["email"],
        })
        assert r.status_code == 200
        assert r.json()["message"] == "Subscribed"

    def test_subscribe_guest_duplicate_is_idempotent(self):
        """Same email+city+sport returns 200 without error."""
        payload = {"email": "guest_dup@example.com", "city": "New York", "sport": "tennis", "channels": ["email"]}
        r1 = requests.post(f"{API}/notifications/subscribe", json=payload)
        r2 = requests.post(f"{API}/notifications/subscribe", json=payload)
        assert r1.status_code == 200
        assert r2.status_code == 200

    def test_subscribe_requires_email(self):
        """Missing email returns 422."""
        r = requests.post(f"{API}/notifications/subscribe", json={
            "city": "New York", "sport": "tennis", "channels": ["email"]
        })
        assert r.status_code == 422

    def test_subscribe_logged_in_uses_account_email(self):
        """Logged-in user subscribes without providing email."""
        s = player_session("notif_loggedin@example.com", "Notif LoggedIn")
        r = s.post(f"{API}/notifications/subscribe", json={
            "city": "New York", "sport": "tennis", "channels": ["email", "push"]
        })
        assert r.status_code == 200


class TestPushSubscriptionRoute:
    def test_push_subscription_requires_auth(self):
        """Unauthenticated push-subscription returns 401."""
        r = requests.post(f"{API}/notifications/push-subscription", json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/fake",
            "keys": {"p256dh": "fake_key", "auth": "fake_auth"},
        })
        assert r.status_code == 401

    def test_push_subscription_stores_record(self):
        """Authenticated push-subscription stores the record."""
        s = player_session("notif_push@example.com", "Notif Push")
        r = s.post(f"{API}/notifications/push-subscription", json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/test_endpoint_123",
            "keys": {"p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtZ", "auth": "tBHItJI5svbpez7KI4CCXg"},
        })
        assert r.status_code == 200
        assert r.json()["message"] == "Push subscription saved"


class TestUnsubscribeRoute:
    def test_unsubscribe_invalid_token_returns_400(self):
        """Invalid token returns 400."""
        r = requests.delete(f"{API}/notifications/unsubscribe?token=notavalidtoken")
        assert r.status_code == 400

    def test_subscribe_then_unsubscribe(self):
        """Subscribe, get token from subscribe response, unsubscribe with it."""
        r = requests.post(f"{API}/notifications/subscribe", json={
            "email": "unsub_test@example.com",
            "city": "Chicago",
            "sport": "pickleball",
            "channels": ["email"],
        })
        assert r.status_code == 200
        token = r.json().get("unsubscribe_token")
        assert token, "subscribe response must include unsubscribe_token"

        r2 = requests.delete(f"{API}/notifications/unsubscribe?token={token}")
        assert r2.status_code == 200
        assert r2.json()["message"] == "Unsubscribed"
