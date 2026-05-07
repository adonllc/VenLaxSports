"""Iteration 7 — All-USA-cities, auto-leagues, standardized pricing, multi-payment-method tests.

Auth: HttpOnly cookies (access_token / refresh_token).
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@leaguepro.com"
ADMIN_PASSWORD = "Admin@123"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return s, r.json()


def _register_and_login(email, name, password="Test@123"):
    s = requests.Session()
    s.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "name": name, "password": password, "country": "USA", "city": "Austin",
    })
    return _login(email, password)


@pytest.fixture(scope="module")
def admin_session():
    s, _ = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    return s


@pytest.fixture(scope="module")
def fresh_user():
    uid = uuid.uuid4().hex[:6]
    email = f"test_pay_{uid}@example.com"
    s, me = _register_and_login(email, f"TestPay{uid}")
    return {"session": s, "user": me, "email": email}


# ───────── /payments/methods (public) ─────────
class TestPaymentMethods:
    def test_methods_public_returns_4(self):
        r = requests.get(f"{BASE_URL}/api/payments/methods")
        assert r.status_code == 200
        data = r.json()
        ids = [m["id"] for m in data["methods"]]
        assert ids == ["stripe", "apple_pay", "google_pay", "zelle"]
        for m in data["methods"]:
            assert m["enabled"] is True
            assert "label" in m and "icon" in m and "config" in m
        # placeholder flag
        cfg = {m["id"]: m["config"] for m in data["methods"]}
        assert cfg["apple_pay"].get("placeholder") is True
        assert cfg["google_pay"].get("placeholder") is True
        assert cfg["zelle"].get("placeholder") is True
        assert "placeholder" not in cfg["stripe"] or cfg["stripe"].get("placeholder") is not True


# ───────── /admin/auto/leagues ─────────
class TestAutoGenerateLeagues:
    def test_non_admin_403(self, fresh_user):
        r = fresh_user["session"].post(f"{BASE_URL}/api/admin/auto/leagues",
                                       json={"cadence": "monthly"})
        assert r.status_code == 403, r.text

    def test_bad_cadence_400(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/auto/leagues",
                               json={"cadence": "weekly"})
        assert r.status_code == 400

    def test_monthly_idempotent(self, admin_session):
        # First run — create or skip if already there
        r1 = admin_session.post(f"{BASE_URL}/api/admin/auto/leagues",
                                json={"cadence": "monthly"})
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        total = len(d1["created"]) + len(d1["skipped"])
        assert total == 6, f"expected 6 monthly (2 sports x 3 formats), got {total}"

        # Second run — must skip all 6
        r2 = admin_session.post(f"{BASE_URL}/api/admin/auto/leagues",
                                json={"cadence": "monthly"})
        assert r2.status_code == 200
        d2 = r2.json()
        assert len(d2["created"]) == 0
        assert len(d2["skipped"]) == 6

    def test_all_cadences_generates_24(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/auto/leagues",
                               json={"cadence": "all"})
        assert r.status_code == 200
        d = r.json()
        total = len(d["created"]) + len(d["skipped"])
        assert total == 24, f"expected 24 (4 cadences x 2 sports x 3 formats), got {total}"

    def test_auto_leagues_have_correct_pricing_and_metadata(self):
        r = requests.get(f"{BASE_URL}/api/leagues")
        assert r.status_code == 200
        leagues = r.json()
        auto = [l for l in leagues if l.get("auto_generated")]
        assert len(auto) >= 24, f"expected >=24 auto-generated leagues, got {len(auto)}"
        for l in auto:
            assert l["city"] == "All Cities", l
            assert l["currency"] == "USD"
            assert l.get("auto_cadence") in ("monthly", "quarterly", "half_yearly", "yearly")
            fmt = l["format"]
            expected = 9.99 if fmt == "singles" else 19.99
            assert abs(float(l["entry_fee"]) - expected) < 0.001, \
                f"League {l['name']} fmt={fmt} fee={l['entry_fee']} expected {expected}"


# ───────── Existing seeded leagues normalized ─────────
class TestPricingNormalization:
    def test_all_usa_tennis_pickleball_have_standard_fees(self):
        r = requests.get(f"{BASE_URL}/api/leagues")
        assert r.status_code == 200
        leagues = r.json()
        usa_rk = [l for l in leagues
                  if l.get("country") == "USA" and l.get("sport") in ("tennis", "pickleball")]
        assert usa_rk, "Expected at least some USA tennis/pickleball leagues"
        bad = []
        for l in usa_rk:
            fee = float(l.get("entry_fee", 0))
            if fee == 0:
                continue  # free leagues are allowed
            fmt = l.get("format", "singles")
            expected = 9.99 if fmt == "singles" else 19.99
            if abs(fee - expected) > 0.001:
                bad.append(f"{l['name']} fmt={fmt} fee={fee} expected {expected}")
        assert not bad, f"Unstandardized fees: {bad[:5]}"


# ───────── Wallet payments (Apple/Google Pay) ─────────
class TestWalletPayments:
    @pytest.fixture(scope="class")
    def paid_league_id(self):
        r = requests.get(f"{BASE_URL}/api/leagues")
        leagues = r.json()
        # Pick a singles auto-generated league
        for l in leagues:
            if l.get("auto_generated") and l.get("format") == "singles" \
                    and float(l.get("entry_fee", 0)) > 0:
                return l["id"]
        pytest.skip("No paid auto-generated league found")

    def test_apple_pay_success_and_idempotent(self, paid_league_id):
        uid = uuid.uuid4().hex[:6]
        s, me = _register_and_login(f"test_apple_{uid}@example.com", f"AppleU{uid}")
        r = s.post(f"{BASE_URL}/api/payments/wallet", json={
            "league_id": paid_league_id, "method": "apple_pay",
            "token": "placeholder_token_xyz",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert "Apple Pay" in body.get("message", "")
        assert body.get("placeholder") is True
        assert abs(float(body["amount"]) - 9.99) < 0.001
        # idempotency
        r2 = s.post(f"{BASE_URL}/api/payments/wallet", json={
            "league_id": paid_league_id, "method": "apple_pay",
            "token": "placeholder_token_xyz",
        })
        assert r2.status_code == 200
        assert r2.json().get("message") == "Already registered"

        # verify player_leagues record (via league players endpoint)
        pr = requests.get(f"{BASE_URL}/api/leagues/{paid_league_id}/players")
        if pr.status_code == 200:
            names = [p.get("player_name") for p in pr.json()]
            assert any(f"AppleU{uid}" == n for n in names), f"player not in roster: {names}"

    def test_google_pay_success(self, paid_league_id):
        uid = uuid.uuid4().hex[:6]
        s, me = _register_and_login(f"test_gpay_{uid}@example.com", f"GPayU{uid}")
        r = s.post(f"{BASE_URL}/api/payments/wallet", json={
            "league_id": paid_league_id, "method": "google_pay",
            "token": "placeholder_token_xyz",
        })
        assert r.status_code == 200
        assert "Google Pay" in r.json()["message"]

    def test_wallet_rejects_stripe_method(self, fresh_user, paid_league_id):
        r = fresh_user["session"].post(f"{BASE_URL}/api/payments/wallet", json={
            "league_id": paid_league_id, "method": "stripe", "token": "anything",
        })
        assert r.status_code == 400

    def test_wallet_rejects_empty_token(self, fresh_user, paid_league_id):
        r = fresh_user["session"].post(f"{BASE_URL}/api/payments/wallet", json={
            "league_id": paid_league_id, "method": "apple_pay", "token": "",
        })
        assert r.status_code == 400


# ───────── Zelle ─────────
class TestZelle:
    @pytest.fixture(scope="class")
    def paid_doubles_league_id(self):
        r = requests.get(f"{BASE_URL}/api/leagues")
        leagues = r.json()
        for l in leagues:
            if l.get("auto_generated") and l.get("format") == "doubles" \
                    and float(l.get("entry_fee", 0)) > 0:
                return l["id"]
        pytest.skip("No paid doubles auto league found")

    def test_zelle_intent_returns_instructions(self, paid_doubles_league_id):
        uid = uuid.uuid4().hex[:6]
        s, _ = _register_and_login(f"test_zelle_{uid}@example.com", f"ZelleU{uid}")
        r = s.post(f"{BASE_URL}/api/payments/zelle/intent",
                   json={"league_id": paid_doubles_league_id})
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("handle", "amount", "memo", "instructions"):
            assert k in d
        assert d.get("placeholder") is True
        assert abs(float(d["amount"]) - 19.99) < 0.001

    def test_zelle_confirm_short_ref_400(self, paid_doubles_league_id):
        uid = uuid.uuid4().hex[:6]
        s, _ = _register_and_login(f"test_zshort_{uid}@example.com", f"ZShort{uid}")
        r = s.post(f"{BASE_URL}/api/payments/zelle/confirm",
                   json={"league_id": paid_doubles_league_id, "reference_number": "abc"})
        assert r.status_code == 400

    def test_zelle_confirm_success_and_idempotent(self, paid_doubles_league_id):
        uid = uuid.uuid4().hex[:6]
        s, _ = _register_and_login(f"test_zok_{uid}@example.com", f"ZOk{uid}")
        # intent first (recommended flow)
        s.post(f"{BASE_URL}/api/payments/zelle/intent",
               json={"league_id": paid_doubles_league_id})
        r = s.post(f"{BASE_URL}/api/payments/zelle/confirm", json={
            "league_id": paid_doubles_league_id, "reference_number": "ZL12345REF",
        })
        assert r.status_code == 200, r.text
        # second time → already registered
        r2 = s.post(f"{BASE_URL}/api/payments/zelle/confirm", json={
            "league_id": paid_doubles_league_id, "reference_number": "ZL12345REF",
        })
        assert r2.status_code == 200
        assert r2.json().get("message") == "Already registered"


# ───────── Free league still works ─────────
class TestFreeLeagueJoin:
    def test_free_league_join_no_payment(self, admin_session):
        # Create a free league
        uid = uuid.uuid4().hex[:6]
        r = admin_session.post(f"{BASE_URL}/api/leagues", json={
            "name": f"TEST_FreeLeague_{uid}",
            "sport": "tennis",
            "format": "singles",
            "country": "USA",
            "city": "Austin",
            "entry_fee": 0,
            "currency": "USD",
            "max_players": 8,
            "start_date": "2026-06-01",
            "end_date": "2026-06-30",
            "venue": "Test Venue",
        })
        if r.status_code != 200:
            pytest.skip(f"could not create free league: {r.status_code} {r.text[:150]}")
        league_id = r.json().get("id") or r.json().get("_id")
        assert league_id

        s, _ = _register_and_login(f"test_free_{uid}@example.com", f"Free{uid}")
        rj = s.post(f"{BASE_URL}/api/leagues/{league_id}/join")
        assert rj.status_code == 200, rj.text
        body = rj.json()
        assert body.get("requires_payment") in (False, None)
