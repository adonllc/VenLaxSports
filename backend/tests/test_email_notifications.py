"""Email notification & password reset tests for VENLAX Sports.

SMTP not configured in test env => emails are logged to backend console.
We grep /var/log/supervisor/backend.err.log for '[EMAIL:console]' to verify.
"""
import os
import time
import subprocess
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@leaguepro.com"
ADMIN_PASSWORD = "Admin@123"
LOG_PATH = "/var/log/supervisor/backend.err.log"


def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


def tail_log_since(marker_offset_bytes: int) -> str:
    """Return log content after the offset (bytes)."""
    try:
        with open(LOG_PATH, "rb") as f:
            f.seek(marker_offset_bytes)
            return f.read().decode("utf-8", errors="ignore")
    except FileNotFoundError:
        return ""


def current_log_size() -> int:
    try:
        return os.path.getsize(LOG_PATH)
    except FileNotFoundError:
        return 0


def wait_for_log(needles, since_offset, timeout=8.0):
    """Poll log file until all needles substrings appear (or timeout). Returns the captured content."""
    end = time.time() + timeout
    while time.time() < end:
        content = tail_log_since(since_offset)
        if all(n in content for n in needles):
            return content
        time.sleep(0.5)
    return tail_log_since(since_offset)


# ───────── Forgot / Reset Password ─────────
class TestForgotPassword:
    def test_forgot_password_existing_user_logs_email(self):
        # Make sure admin notifications are ON
        s = admin_session()
        s.patch(f"{BASE_URL}/api/auth/preferences", json={"email_notifications": True})

        offset = current_log_size()
        r = requests.post(f"{BASE_URL}/api/auth/forgot-password",
                          json={"email": ADMIN_EMAIL})
        assert r.status_code == 200
        body = r.json()
        assert "message" in body
        # Generic message — no enumeration
        assert "reset" in body["message"].lower() or "if an account" in body["message"].lower()

        log = wait_for_log(["[EMAIL:console]", "Reset your VENLAX Sports password",
                            ADMIN_EMAIL], offset, timeout=10)
        assert "[EMAIL:console]" in log, f"No console email logged. Tail:\n{log[-2000:]}"
        assert "Reset your VENLAX Sports password" in log

    def test_forgot_password_nonexistent_user_returns_200(self):
        offset = current_log_size()
        r = requests.post(f"{BASE_URL}/api/auth/forgot-password",
                          json={"email": "TEST_nobody_xyz@nope.com"})
        assert r.status_code == 200
        # Should not log an email since user does not exist
        time.sleep(2)
        log = tail_log_since(offset)
        # The log line for a real send would include the recipient address. Make sure we don't see THAT email in an [EMAIL:console] entry.
        for line in log.splitlines():
            if "[EMAIL:console]" in line and "TEST_nobody_xyz@nope.com" in line:
                pytest.fail(f"Email was sent for non-existent user: {line}")


class TestResetPassword:
    def test_reset_password_invalid_token(self):
        r = requests.post(f"{BASE_URL}/api/auth/reset-password",
                          json={"token": "not_a_real_token", "new_password": "NewPass@123"})
        assert r.status_code == 400
        assert "invalid" in r.json()["detail"].lower()

    def test_reset_password_short_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/reset-password",
                          json={"token": "anything", "new_password": "abc"})
        assert r.status_code == 400
        assert "6" in r.json()["detail"] or "characters" in r.json()["detail"].lower()


# ───────── Preferences toggle ─────────
class TestPreferences:
    def test_preferences_requires_auth(self):
        r = requests.patch(f"{BASE_URL}/api/auth/preferences",
                           json={"email_notifications": False})
        assert r.status_code in [401, 403]

    def test_toggle_preferences_persists(self):
        s = admin_session()
        # Turn OFF
        r = s.patch(f"{BASE_URL}/api/auth/preferences",
                    json={"email_notifications": False})
        assert r.status_code == 200
        assert r.json()["email_notifications"] is False
        me = s.get(f"{BASE_URL}/api/auth/me").json()
        assert me["email_notifications"] is False

        # Turn ON
        r = s.patch(f"{BASE_URL}/api/auth/preferences",
                    json={"email_notifications": True})
        assert r.status_code == 200
        assert r.json()["email_notifications"] is True
        me = s.get(f"{BASE_URL}/api/auth/me").json()
        assert me["email_notifications"] is True


class TestOptOut:
    def test_no_email_when_opted_out(self):
        s = admin_session()
        # Opt out
        r = s.patch(f"{BASE_URL}/api/auth/preferences", json={"email_notifications": False})
        assert r.status_code == 200

        offset = current_log_size()
        r = requests.post(f"{BASE_URL}/api/auth/forgot-password",
                          json={"email": ADMIN_EMAIL})
        assert r.status_code == 200
        time.sleep(2)
        log = tail_log_since(offset)
        # No console email should be emitted to the admin
        for line in log.splitlines():
            if "[EMAIL:console]" in line and ADMIN_EMAIL in line and "Reset your VENLAX Sports password" in line:
                # Restore preference before failing
                s.patch(f"{BASE_URL}/api/auth/preferences", json={"email_notifications": True})
                pytest.fail(f"Email sent though user opted out: {line}")

        # Restore
        r = s.patch(f"{BASE_URL}/api/auth/preferences", json={"email_notifications": True})
        assert r.json()["email_notifications"] is True


# ───────── Free league join → registration email ─────────
class TestFreeLeagueJoinEmail:
    def _create_test_player(self):
        email = f"TEST_player_{int(time.time())}@example.com"
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "Test@1234",
            "name": "TEST Player", "country": "USA"
        })
        assert r.status_code in [200, 201], r.text
        return s, email

    def _find_free_league(self):
        leagues = requests.get(f"{BASE_URL}/api/leagues").json()
        for l in leagues:
            if float(l.get("entry_fee", 0)) == 0 and l.get("status") == "registration":
                return l["id"]
        # Create one as admin if none exists
        admin = admin_session()
        r = admin.post(f"{BASE_URL}/api/leagues", json={
            "name": f"TEST_FreeLeague_{int(time.time())}", "sport": "tennis",
            "country": "USA", "city": "New York", "format": "singles",
            "entry_fee": 0.0, "currency": "USD", "max_players": 16,
            "start_date": "2025-06-01", "end_date": "2025-08-01",
            "status": "registration", "description": "test", "venue": "T",
            "season": "S25"
        })
        assert r.status_code in [200, 201]
        return r.json()["id"]

    def test_free_join_emits_registration_email(self):
        s, email = self._create_test_player()
        league_id = self._find_free_league()
        offset = current_log_size()
        r = s.post(f"{BASE_URL}/api/leagues/{league_id}/join")
        assert r.status_code == 200, r.text
        log = wait_for_log(["[EMAIL:console]", "You're registered", email], offset, timeout=10)
        assert "[EMAIL:console]" in log, f"No console email logged. Tail:\n{log[-2000:]}"
        assert "You're registered" in log or "Registration" in log
