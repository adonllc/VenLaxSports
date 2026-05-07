"""End-to-end test for match-scheduled and score-reported email notifications."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
LOG_PATH = "/var/log/supervisor/backend.err.log"


def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": "admin@leaguepro.com", "password": "Admin@123"})
    assert r.status_code == 200
    return s


def register_player(suffix):
    email = f"TEST_match_{suffix}_{int(time.time())}@example.com"
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": "Test@1234",
        "name": f"TEST P{suffix}", "country": "USA"
    })
    assert r.status_code in [200, 201], r.text
    me = s.get(f"{BASE_URL}/api/auth/me").json()
    uid = me.get("id") or me.get("_id")
    return s, email, uid


def log_size():
    try:
        return os.path.getsize(LOG_PATH)
    except FileNotFoundError:
        return 0


def read_log_since(offset, wait=4.0):
    time.sleep(wait)
    try:
        with open(LOG_PATH, "rb") as f:
            f.seek(offset)
            return f.read().decode("utf-8", errors="ignore")
    except FileNotFoundError:
        return ""


def create_free_league(admin):
    r = admin.post(f"{BASE_URL}/api/leagues", json={
        "name": f"TEST_MatchEmailLeague_{int(time.time())}", "sport": "tennis",
        "country": "USA", "city": "New York", "format": "singles",
        "entry_fee": 0.0, "currency": "USD", "max_players": 16,
        "start_date": "2025-06-01", "end_date": "2025-08-01",
        "status": "registration", "description": "test", "venue": "Court A",
        "season": "S25"
    })
    assert r.status_code in [200, 201], r.text
    return r.json()["id"]


def test_match_schedule_and_score_emit_emails():
    admin = admin_session()
    league_id = create_free_league(admin)

    s1, email1, id1 = register_player("A")
    s2, email2, id2 = register_player("B")

    # Both players join the free league
    r1 = s1.post(f"{BASE_URL}/api/leagues/{league_id}/join")
    r2 = s2.post(f"{BASE_URL}/api/leagues/{league_id}/join")
    assert r1.status_code == 200 and r2.status_code == 200, (r1.text, r2.text)

    # Schedule a match - p1 schedules vs p2
    offset = log_size()
    r = s1.post(f"{BASE_URL}/api/matches/", json={
        "league_id": league_id,
        "player2_id": id2,
        "scheduled_date": "2025-07-15T10:00:00",
        "venue": "Court A",
        "notes": "test"
    })
    assert r.status_code == 200, r.text
    match_id = r.json()["id"]

    log = read_log_since(offset, wait=4)
    # Should include 2 console emails - one for p1, one for p2
    log_lower = log.lower()
    assert "[EMAIL:console]" in log, f"No email logged. Tail:\n{log[-2000:]}"
    assert email1.lower() in log_lower, f"player1 email missing. log:\n{log[-2000:]}"
    assert email2.lower() in log_lower, f"player2 email missing. log:\n{log[-2000:]}"
    # Subject should mention "match scheduled" (case-insensitive)
    assert "match scheduled" in log_lower, f"subject not found. log:\n{log[-2000:]}"

    # Report score - p1 wins
    offset = log_size()
    r = s1.post(f"{BASE_URL}/api/matches/{match_id}/score", json={
        "winner_id": id1,
        "score_data": {"sets": [[6, 3], [6, 4]]}
    })
    assert r.status_code == 200, r.text
    log = read_log_since(offset, wait=4)
    log_lower = log.lower()
    assert "[EMAIL:console]" in log, f"No score email logged. Tail:\n{log[-2000:]}"
    assert email1.lower() in log_lower and email2.lower() in log_lower
    assert "match result" in log_lower, f"score subject missing. log:\n{log[-2000:]}"
