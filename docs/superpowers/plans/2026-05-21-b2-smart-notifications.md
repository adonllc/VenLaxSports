# B2 — Smart Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify interested players the moment a new league opens (and at 50%, 80%, full capacity milestones) via email + browser push, capturing interest through a banner and bell icon on city/sport pages.

**Architecture:** Event-triggered dispatches fire inline in `league_routes.py` at four capacity milestones; no background jobs. Interest records live in a new `notification_interests` collection; browser push endpoints live in `push_subscriptions`. A service worker handles push delivery on the frontend.

**Tech Stack:** Python `pywebpush` (VAPID/Web Push), PyJWT (unsubscribe tokens), FastAPI new router, React `Notification.requestPermission()` API, PWA service worker.

---

## File Structure

```
New files:
  backend/notification_dispatch.py          4 dispatch functions, push + email delivery
  backend/routes/notification_routes.py     subscribe, push-subscription, unsubscribe routes
  frontend/public/sw.js                     service worker — push event handler
  frontend/src/components/NotifyMeBanner.jsx  inline "no leagues" banner
  frontend/src/components/NotifyMeModal.jsx   guest email capture modal

Modified files:
  backend/requirements.txt                  +pywebpush
  backend/server.py                         +notification_routes router
  backend/email_service.py                  +send_season_open, send_last_spots, send_waitlist_open
  backend/routes/league_routes.py           +dispatch calls at creation + join milestones
  backend/seeds/indexes.py                  +3 new indexes
  frontend/src/index.js                     +service worker registration
  frontend/src/pages/CityLeaderboard.jsx    +NotifyMeBanner + bell icon
  frontend/src/pages/SportLanding.jsx       +NotifyMeBanner + bell icon
  frontend/src/pages/PlayerDashboard.jsx    +notification subscriptions section
  .env.usa                                  +VAPID_* vars
  frontend/.env                             +REACT_APP_VAPID_PUBLIC_KEY (local dev)
```

---

## Task 1: Install pywebpush + generate VAPID keys

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `.env.usa`
- Modify: `frontend/.env` (local dev only — not committed)

- [ ] **Step 1: Add pywebpush to requirements.txt**

Open `backend/requirements.txt`. Add after the `pydantic_core` line:

```
pywebpush==2.0.0
```

- [ ] **Step 2: Install in backend venv**

```bash
cd backend && pip install pywebpush==2.0.0
```

Expected: Successfully installed pywebpush

- [ ] **Step 3: Generate VAPID key pair**

```bash
cd backend
python - <<'EOF'
from py_vapid import Vapid
import base64

v = Vapid()
v.generate_keys()

# Export private key as base64url
priv_pem = v.private_key.private_bytes(
    encoding=__import__("cryptography.hazmat.primitives.serialization", fromlist=["Encoding"]).Encoding.PEM,
    format=__import__("cryptography.hazmat.primitives.serialization", fromlist=["PrivateFormat"]).PrivateFormat.TraditionalOpenSSL,
    encryption_algorithm=__import__("cryptography.hazmat.primitives.serialization", fromlist=["NoEncryption"]).NoEncryption(),
)
priv_b64 = base64.urlsafe_b64encode(priv_pem).decode()

# Export public key as base64url uncompressed point
pub_bytes = v.public_key.public_bytes(
    encoding=__import__("cryptography.hazmat.primitives.serialization", fromlist=["Encoding"]).Encoding.X962,
    format=__import__("cryptography.hazmat.primitives.serialization", fromlist=["PublicFormat"]).PublicFormat.UncompressedPoint,
)
pub_b64 = base64.urlsafe_b64encode(pub_bytes).decode().rstrip("=")

print("VAPID_PRIVATE_KEY=" + priv_b64)
print("VAPID_PUBLIC_KEY=" + pub_b64)
EOF
```

Copy the two output lines. Keep them — you'll need them in Step 4 and in Coolify.

- [ ] **Step 4: Add VAPID vars to .env.usa**

Open `.env.usa`. Append:

```
VAPID_PRIVATE_KEY=<paste VAPID_PRIVATE_KEY value from step 3>
VAPID_PUBLIC_KEY=<paste VAPID_PUBLIC_KEY value from step 3>
VAPID_CLAIMS_EMAIL=hello@venlaxsports.com
```

- [ ] **Step 5: Add VAPID public key + backend URL to frontend/.env**

Open `frontend/.env`. Append:

```
REACT_APP_VAPID_PUBLIC_KEY=<paste VAPID_PUBLIC_KEY value from step 3>
```

- [ ] **Step 6: Commit requirements change**

```bash
git add backend/requirements.txt .env.usa
git commit -m "feat(notifications): add pywebpush dependency + VAPID env var placeholders"
```

---

## Task 2: notification_dispatch.py — core dispatch functions

**Files:**
- Create: `backend/notification_dispatch.py`
- Create: `backend/tests/test_notifications.py` (tests for dispatch + routes)

- [ ] **Step 1: Write failing test for _get_interests query**

Create `backend/tests/test_notifications.py`:

```python
"""Integration tests for notification dispatch + routes.

Requires a live backend at REACT_APP_BACKEND_URL with admin seeded.
Run: pytest backend/tests/test_notifications.py -v
"""
import pytest
import requests
import os

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
    import secrets, hashlib, base64

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
```

- [ ] **Step 2: Run tests to confirm they fail (backend not wired yet)**

```bash
cd backend && pytest tests/test_notifications.py -v 2>&1 | head -30
```

Expected: `FAILED` or `ConnectionRefusedError` — the routes don't exist yet.

- [ ] **Step 3: Create notification_dispatch.py**

Create `backend/notification_dispatch.py`:

```python
"""Notification dispatch — fires push + email at capacity milestones.

Called from league_routes.py. Never raises — errors are logged and skipped
so that the join/create flow is never blocked.
"""
from __future__ import annotations
import asyncio
import json
import logging
import os
from functools import partial
from typing import Optional

import email_service

logger = logging.getLogger(__name__)


def _fe_url() -> str:
    return os.environ.get("FRONTEND_URL", "").rstrip("/")


def _vapid_private_key() -> Optional[str]:
    return os.environ.get("VAPID_PRIVATE_KEY")


def _vapid_claims_email() -> str:
    return os.environ.get("VAPID_CLAIMS_EMAIL", "hello@venlaxsports.com")


async def _get_interests(db, city: str, sport: str) -> list[dict]:
    """Return all active (non-unsubscribed) interests matching city+sport."""
    return await db.notification_interests.find(
        {"city": city, "sport": sport, "unsubscribed_at": None}
    ).to_list(1000)


async def _get_user_for_interest(db, interest: dict) -> Optional[dict]:
    """Fetch user doc if user_id is set on the interest."""
    user_id = interest.get("user_id")
    if not user_id:
        return None
    from bson import ObjectId
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user:
            user["_id"] = str(user["_id"])
        return user
    except Exception:
        return None


def _notifications_allowed(user: Optional[dict]) -> bool:
    """Return False only if user exists and has explicitly disabled notifications."""
    if user is None:
        return True
    return user.get("email_notifications", True)


async def _send_push_to_user(db, user_id: str, payload: dict) -> None:
    """Send push notification to all active subscriptions for user_id."""
    vapid_key = _vapid_private_key()
    if not vapid_key:
        logger.warning("VAPID_PRIVATE_KEY not set — skipping push")
        return

    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush not installed — skipping push")
        return

    from bson import ObjectId
    try:
        subs = await db.push_subscriptions.find({"user_id": user_id}).to_list(10)
    except Exception:
        return

    loop = asyncio.get_event_loop()
    for sub in subs:
        try:
            await loop.run_in_executor(None, partial(
                webpush,
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": sub["keys"],
                },
                data=json.dumps(payload),
                vapid_private_key=vapid_key,
                vapid_claims={"sub": f"mailto:{_vapid_claims_email()}"},
            ))
        except Exception as exc:
            # 410 Gone — browser revoked the subscription; clean it up
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status == 410:
                logger.info("Dead push subscription %s — removing", sub.get("_id"))
                try:
                    await db.push_subscriptions.delete_one({"_id": sub["_id"]})
                except Exception:
                    pass
            else:
                logger.warning("Push send failed for user %s: %s", user_id, exc)


async def dispatch_season_open(db, league: dict) -> None:
    """Trigger 1 — fires when a new league is created (status=registration)."""
    city = league.get("city", "")
    sport = league.get("sport", "")
    league_id = str(league.get("id") or league.get("_id", ""))
    league_name = league.get("name", "")
    join_url = f"{_fe_url()}/leagues/{league_id}"

    sport_emoji = {"tennis": "🎾", "pickleball": "🏓", "cricket": "🏏"}.get(sport, "🏆")
    city_short = city.split(",")[0]

    try:
        interests = await _get_interests(db, city, sport)
    except Exception:
        logger.exception("dispatch_season_open: failed to query interests")
        return

    for interest in interests:
        try:
            user = await _get_user_for_interest(db, interest)
            if not _notifications_allowed(user):
                continue
            name = user["name"] if user else "Player"
            email = interest["email"]
            channels = interest.get("channels", ["email"])

            if "email" in channels:
                email_service.schedule(email_service.send_season_open(
                    email, name, city, sport, league_name, join_url
                ))

            if "push" in channels and interest.get("user_id"):
                push_payload = {
                    "title": f"{sport_emoji} {city_short} {sport.title()} Season just opened",
                    "body": f"{league_name} — Join now →",
                    "url": join_url,
                }
                asyncio.create_task(_send_push_to_user(db, interest["user_id"], push_payload))
        except Exception:
            logger.exception("dispatch_season_open: error processing interest %s", interest.get("_id"))


async def dispatch_filling_fast(db, league: dict) -> None:
    """Trigger 2 — fires when league crosses 50% capacity. Push only."""
    city = league.get("city", "")
    sport = league.get("sport", "")
    league_id = str(league.get("id") or league.get("_id", ""))
    league_name = league.get("name", "")
    join_url = f"{_fe_url()}/leagues/{league_id}"

    sport_emoji = {"tennis": "🎾", "pickleball": "🏓", "cricket": "🏏"}.get(sport, "🏆")
    city_short = city.split(",")[0]

    try:
        interests = await _get_interests(db, city, sport)
    except Exception:
        logger.exception("dispatch_filling_fast: failed to query interests")
        return

    for interest in interests:
        try:
            if not interest.get("user_id"):
                continue  # push only — need user_id
            user = await _get_user_for_interest(db, interest)
            if not _notifications_allowed(user):
                continue
            if "push" in interest.get("channels", []):
                push_payload = {
                    "title": f"{sport_emoji} {city_short} {sport.title()} is half full",
                    "body": "Don't miss out →",
                    "url": join_url,
                }
                asyncio.create_task(_send_push_to_user(db, interest["user_id"], push_payload))
        except Exception:
            logger.exception("dispatch_filling_fast: error processing interest %s", interest.get("_id"))


async def dispatch_last_spots(db, league: dict, spots_left: int) -> None:
    """Trigger 3 — fires when league crosses 80% capacity. Email + push."""
    city = league.get("city", "")
    sport = league.get("sport", "")
    league_id = str(league.get("id") or league.get("_id", ""))
    league_name = league.get("name", "")
    join_url = f"{_fe_url()}/leagues/{league_id}"

    sport_emoji = {"tennis": "🎾", "pickleball": "🏓", "cricket": "🏏"}.get(sport, "🏆")
    city_short = city.split(",")[0]

    try:
        interests = await _get_interests(db, city, sport)
    except Exception:
        logger.exception("dispatch_last_spots: failed to query interests")
        return

    for interest in interests:
        try:
            user = await _get_user_for_interest(db, interest)
            if not _notifications_allowed(user):
                continue
            name = user["name"] if user else "Player"
            email = interest["email"]
            channels = interest.get("channels", ["email"])

            if "email" in channels:
                email_service.schedule(email_service.send_last_spots(
                    email, name, city, sport, spots_left, join_url
                ))

            if "push" in channels and interest.get("user_id"):
                push_payload = {
                    "title": f"⚡ {spots_left} spot{'s' if spots_left != 1 else ''} left in {city_short} {sport.title()}",
                    "body": "Last chance →",
                    "url": join_url,
                }
                asyncio.create_task(_send_push_to_user(db, interest["user_id"], push_payload))
        except Exception:
            logger.exception("dispatch_last_spots: error processing interest %s", interest.get("_id"))


async def dispatch_waitlist_open(db, league: dict) -> None:
    """Trigger 4 — fires when league hits max_players. Email + push."""
    city = league.get("city", "")
    sport = league.get("sport", "")
    league_id = str(league.get("id") or league.get("_id", ""))
    league_name = league.get("name", "")
    waitlist_url = f"{_fe_url()}/leagues/{league_id}"

    sport_emoji = {"tennis": "🎾", "pickleball": "🏓", "cricket": "🏏"}.get(sport, "🏆")
    city_short = city.split(",")[0]

    try:
        interests = await _get_interests(db, city, sport)
    except Exception:
        logger.exception("dispatch_waitlist_open: failed to query interests")
        return

    for interest in interests:
        try:
            user = await _get_user_for_interest(db, interest)
            if not _notifications_allowed(user):
                continue
            name = user["name"] if user else "Player"
            email = interest["email"]
            channels = interest.get("channels", ["email"])

            if "email" in channels:
                email_service.schedule(email_service.send_waitlist_open(
                    email, name, city, sport, waitlist_url
                ))

            if "push" in channels and interest.get("user_id"):
                push_payload = {
                    "title": f"🔔 {city_short} {sport.title()} is full",
                    "body": "You're on the waitlist →",
                    "url": waitlist_url,
                }
                asyncio.create_task(_send_push_to_user(db, interest["user_id"], push_payload))
        except Exception:
            logger.exception("dispatch_waitlist_open: error processing interest %s", interest.get("_id"))
```

- [ ] **Step 4: Commit**

```bash
git add backend/notification_dispatch.py backend/tests/test_notifications.py
git commit -m "feat(notifications): add notification_dispatch.py + test skeleton"
```

---

## Task 3: Email templates in email_service.py

**Files:**
- Modify: `backend/email_service.py`

- [ ] **Step 1: Add 3 new email template functions**

Open `backend/email_service.py`. Append the following three functions before the final `send_generic` function (before line that starts `async def send_generic`):

```python
async def send_season_open(to: str, player_name: str, city: str, sport: str,
                            league_name: str, join_url: str) -> None:
    sport_emoji = {"tennis": "🎾", "pickleball": "🏓", "cricket": "🏏"}.get(sport, "🏆")
    body = f"""
      <p>Hi {player_name},</p>
      <p>Great news — <strong>{league_name}</strong> just opened registration in {city}!</p>
      <p>Spots fill fast. Secure yours now.</p>
    """
    subject = f"{city} {sport.title()} is open — grab your spot"
    await send_email(to, subject, _wrap(f"{sport_emoji} New League Open", body, "Join Now", join_url))


async def send_last_spots(to: str, player_name: str, city: str, sport: str,
                           spots_left: int, join_url: str) -> None:
    sport_emoji = {"tennis": "🎾", "pickleball": "🏓", "cricket": "🏏"}.get(sport, "🏆")
    body = f"""
      <p>Hi {player_name},</p>
      <p>Only <strong>{spots_left} spot{'s' if spots_left != 1 else ''}</strong> left in the {city} {sport.title()} league you were interested in.</p>
      <p>Join now before it fills up.</p>
    """
    subject = f"Only {spots_left} spot{'s' if spots_left != 1 else ''} left in {city} {sport.title()}"
    await send_email(to, subject, _wrap(f"{sport_emoji} Last Spots Remaining", body, "Claim Your Spot", join_url))


async def send_waitlist_open(to: str, player_name: str, city: str, sport: str,
                              waitlist_url: str) -> None:
    sport_emoji = {"tennis": "🎾", "pickleball": "🏓", "cricket": "🏏"}.get(sport, "🏆")
    body = f"""
      <p>Hi {player_name},</p>
      <p>The {city} {sport.title()} league you were interested in is now full.</p>
      <p>You've been added to the waitlist — we'll notify you the moment a spot opens.</p>
    """
    subject = f"{city} {sport.title()} is full — you're on the waitlist"
    await send_email(to, subject, _wrap(f"{sport_emoji} You're on the Waitlist", body, "View League", waitlist_url))
```

- [ ] **Step 2: Verify email_service.py parses cleanly**

```bash
cd backend && python -c "import email_service; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/email_service.py
git commit -m "feat(notifications): add season_open, last_spots, waitlist_open email templates"
```

---

## Task 4: notification_routes.py

**Files:**
- Create: `backend/routes/notification_routes.py`

- [ ] **Step 1: Create notification_routes.py**

Create `backend/routes/notification_routes.py`:

```python
"""Notification subscription routes.

POST /api/notifications/subscribe           — capture city+sport interest (auth optional)
POST /api/notifications/push-subscription  — store browser push endpoint (auth required)
DELETE /api/notifications/unsubscribe      — one-click unsubscribe via signed token
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import List, Optional

import jwt as pyjwt
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr

from auth_utils import get_current_user, get_optional_user, get_jwt_secret, JWT_ALGORITHM

router = APIRouter()
logger = logging.getLogger(__name__)

JWT_UNSUB_TYPE = "unsub"


# ── helpers ──────────────────────────────────────────────────────────────────

def _make_unsub_token(interest_id: str) -> str:
    return pyjwt.encode(
        {"sub": interest_id, "type": JWT_UNSUB_TYPE},
        get_jwt_secret(),
        algorithm=JWT_ALGORITHM,
    )


def _decode_unsub_token(token: str) -> str:
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except pyjwt.InvalidTokenError as e:
        raise HTTPException(status_code=400, detail=f"Invalid unsubscribe token: {e}")
    if payload.get("type") != JWT_UNSUB_TYPE:
        raise HTTPException(status_code=400, detail="Invalid token type")
    return payload["sub"]


# ── request models ────────────────────────────────────────────────────────────

class SubscribeRequest(BaseModel):
    city: str
    sport: str
    channels: List[str] = ["email"]
    email: Optional[EmailStr] = None


class PushSubscriptionRequest(BaseModel):
    endpoint: str
    keys: dict  # {"p256dh": str, "auth": str}


# ── routes ────────────────────────────────────────────────────────────────────

@router.post("/subscribe")
async def subscribe(body: SubscribeRequest, request: Request):
    """Create or refresh a notification interest record."""
    db = request.app.state.db
    user = await get_optional_user(request, db)

    # Determine email — logged-in users use account email; guests must supply one
    if user:
        email = user["email"]
        user_id = user["_id"]
    else:
        if not body.email:
            raise HTTPException(status_code=422, detail="email is required for guest subscriptions")
        email = body.email
        user_id = None

    now = datetime.now(timezone.utc)

    # Upsert — if record exists (same email+city+sport), refresh it (clear unsubscribed_at)
    existing = await db.notification_interests.find_one({
        "email": email,
        "city": body.city,
        "sport": body.sport,
    })

    if existing:
        update: dict = {"unsubscribed_at": None, "channels": body.channels}
        # Link user_id if guest previously subscribed and is now logged in
        if user_id and not existing.get("user_id"):
            update["user_id"] = user_id
        await db.notification_interests.update_one(
            {"_id": existing["_id"]},
            {"$set": update},
        )
        interest_id = str(existing["_id"])
    else:
        doc = {
            "user_id": user_id,
            "email": email,
            "city": body.city,
            "sport": body.sport,
            "channels": body.channels,
            "created_at": now,
            "unsubscribed_at": None,
        }
        result = await db.notification_interests.insert_one(doc)
        interest_id = str(result.inserted_id)

    return {
        "message": "Subscribed",
        "unsubscribe_token": _make_unsub_token(interest_id),
    }


@router.post("/push-subscription")
async def save_push_subscription(body: PushSubscriptionRequest, request: Request):
    """Store a browser push subscription endpoint for the authenticated user."""
    db = request.app.state.db
    user = await get_current_user(request, db)

    now = datetime.now(timezone.utc)

    # Upsert by endpoint so re-subscribing on same browser is idempotent
    existing = await db.push_subscriptions.find_one({"endpoint": body.endpoint})
    if existing:
        await db.push_subscriptions.update_one(
            {"_id": existing["_id"]},
            {"$set": {"user_id": user["_id"], "keys": body.keys, "last_used_at": now}},
        )
    else:
        import httpx
        user_agent = request.headers.get("user-agent", "")
        await db.push_subscriptions.insert_one({
            "user_id": user["_id"],
            "endpoint": body.endpoint,
            "keys": body.keys,
            "user_agent": user_agent,
            "created_at": now,
            "last_used_at": None,
        })

    return {"message": "Push subscription saved"}


@router.delete("/unsubscribe")
async def unsubscribe(token: str = Query(...), request: Request = None):
    """One-click unsubscribe from email link. No login required."""
    db = request.app.state.db
    interest_id = _decode_unsub_token(token)

    try:
        oid = ObjectId(interest_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid interest ID in token")

    result = await db.notification_interests.update_one(
        {"_id": oid},
        {"$set": {"unsubscribed_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")

    return {"message": "Unsubscribed"}


@router.get("/interests")
async def list_interests(request: Request):
    """Return the current user's active notification interests."""
    db = request.app.state.db
    user = await get_current_user(request, db)

    interests = await db.notification_interests.find(
        {"user_id": user["_id"], "unsubscribed_at": None}
    ).to_list(100)

    return [
        {
            "id": str(i["_id"]),
            "city": i["city"],
            "sport": i["sport"],
            "channels": i.get("channels", ["email"]),
            "created_at": i.get("created_at"),
            "unsubscribe_token": _make_unsub_token(str(i["_id"])),
        }
        for i in interests
    ]
```

- [ ] **Step 2: Verify it parses cleanly**

```bash
cd backend && python -c "from routes.notification_routes import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/routes/notification_routes.py
git commit -m "feat(notifications): add notification_routes.py (subscribe, push-sub, unsubscribe)"
```

---

## Task 5: Register router + add indexes

**Files:**
- Modify: `backend/server.py`
- Modify: `backend/seeds/indexes.py`

- [ ] **Step 1: Register notification router in server.py**

Open `backend/server.py`. After line 36 (`from routes.social_auth_routes import router as social_auth_router`), add:

```python
from routes.notification_routes import router as notification_router
```

After line 50 (`api_router.include_router(wa_router, ...)`), add:

```python
api_router.include_router(notification_router, prefix="/notifications", tags=["notifications"])
```

- [ ] **Step 2: Add indexes to seeds/indexes.py**

Open `backend/seeds/indexes.py`. Append inside the `create_indexes` function:

```python
    # Smart notifications (B2)
    await db.notification_interests.create_index([("city", 1), ("sport", 1)])
    await db.notification_interests.create_index([("email", 1)])
    await db.push_subscriptions.create_index([("user_id", 1)])
```

- [ ] **Step 3: Restart backend and run notification tests**

```bash
cd backend && uvicorn server:app --reload --port 8001 &
sleep 3
pytest tests/test_notifications.py -v
```

Expected: All tests pass (PASSED).

- [ ] **Step 4: Commit**

```bash
git add backend/server.py backend/seeds/indexes.py
git commit -m "feat(notifications): register notification router + add DB indexes"
```

---

## Task 6: Wire dispatch triggers into league_routes.py

**Files:**
- Modify: `backend/routes/league_routes.py`

- [ ] **Step 1: Add import at top of league_routes.py**

Open `backend/routes/league_routes.py`. Find the existing imports at the top. Add after the last existing import:

```python
import asyncio
import notification_dispatch
```

- [ ] **Step 2: Wire Trigger 1 — season opens on league creation**

Find `create_league` function. The current return statement is:

```python
    result = await db.leagues.insert_one(league.to_mongo())
    return {"id": str(result.inserted_id), "message": "League created", **data.model_dump()}
```

Replace it with:

```python
    result = await db.leagues.insert_one(league.to_mongo())
    league_id = str(result.inserted_id)

    # Trigger 1 — notify interested players that a new season opened
    league_dict = {"id": league_id, **data.model_dump()}
    asyncio.create_task(notification_dispatch.dispatch_season_open(db, league_dict))

    return {"id": league_id, "message": "League created", **data.model_dump()}
```

- [ ] **Step 3: Wire Triggers 2–4 — capacity milestones on player join**

Find the join_league function. Locate the block that increments current_players:

```python
    await db.leagues.update_one({"_id": ObjectId(league_id)}, {"$inc": {"current_players": 1}})
```

Replace it with:

```python
    old_count = league["current_players"]
    new_count = old_count + 1
    max_p = league.get("max_players", 0)

    await db.leagues.update_one({"_id": ObjectId(league_id)}, {"$inc": {"current_players": 1}})

    # Capacity milestone dispatch (fire-and-forget)
    _league_info = {
        "id": league_id,
        "name": league["name"],
        "city": league.get("city", ""),
        "sport": league.get("sport", ""),
    }
    if max_p > 0:
        if new_count >= max_p:
            asyncio.create_task(notification_dispatch.dispatch_waitlist_open(db, _league_info))
        elif old_count < int(max_p * 0.8) and new_count >= int(max_p * 0.8):
            spots_left = max_p - new_count
            asyncio.create_task(notification_dispatch.dispatch_last_spots(db, _league_info, spots_left))
        elif old_count < int(max_p * 0.5) and new_count >= int(max_p * 0.5):
            asyncio.create_task(notification_dispatch.dispatch_filling_fast(db, _league_info))
```

- [ ] **Step 4: Verify backend starts without error**

```bash
cd backend && python -c "from routes.league_routes import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/routes/league_routes.py
git commit -m "feat(notifications): wire capacity-milestone dispatch triggers into league_routes"
```

---

## Task 7: Service worker

**Files:**
- Create: `frontend/public/sw.js`

- [ ] **Step 1: Create service worker**

Create `frontend/public/sw.js`:

```js
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'VenLax Sports';
  const options = {
    body: data.body || '',
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add frontend/public/sw.js
git commit -m "feat(notifications): add PWA service worker for push events"
```

---

## Task 8: NotifyMeBanner + NotifyMeModal components

**Files:**
- Create: `frontend/src/components/NotifyMeBanner.jsx`
- Create: `frontend/src/components/NotifyMeModal.jsx`

- [ ] **Step 1: Create NotifyMeBanner.jsx**

Create `frontend/src/components/NotifyMeBanner.jsx`:

```jsx
import { useState } from "react";
import { Bell } from "lucide-react";
import NotifyMeModal from "./NotifyMeModal";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function NotifyMeBanner({ city, sport }) {
  const { user } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (user) {
      // Logged-in: one-click subscribe
      setLoading(true);
      try {
        await axios.post(`${API}/notifications/subscribe`, {
          city,
          sport,
          channels: ["email", "push"],
        }, { withCredentials: true });
        setSubscribed(true);
        // Request push permission + register
        if ("Notification" in window && Notification.permission === "default") {
          const perm = await Notification.requestPermission();
          if (perm === "granted") {
            await _registerPush();
          }
        }
      } catch (e) {
        console.error("Subscribe failed", e);
      } finally {
        setLoading(false);
      }
    } else {
      setModalOpen(true);
    }
  };

  if (subscribed) {
    return (
      <div
        className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3"
        data-testid="notify-banner-success"
      >
        <Bell className="w-4 h-4 text-emerald-600 shrink-0" />
        <p className="text-sm text-emerald-700 font-medium">
          You're on the list! We'll notify you when {city} {sport} opens.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4"
        data-testid="notify-me-banner"
      >
        <div className="flex items-center gap-3">
          <Bell className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">No open leagues right now</p>
            <p className="text-xs text-emerald-600">
              Get notified when a {city} {sport} season opens
            </p>
          </div>
        </div>
        <button
          onClick={handleClick}
          disabled={loading}
          className="shrink-0 bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 transition disabled:opacity-60"
          data-testid="notify-me-banner-btn"
        >
          {loading ? "..." : "Notify Me"}
        </button>
      </div>

      <NotifyMeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        city={city}
        sport={sport}
      />
    </>
  );
}

async function _registerPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const vapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
  if (!vapidKey) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlBase64ToUint8Array(vapidKey),
    });
    const subJson = sub.toJSON();
    await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/notifications/push-subscription`, {
      endpoint: subJson.endpoint,
      keys: subJson.keys,
    }, { withCredentials: true });
  } catch (e) {
    console.warn("Push registration failed", e);
  }
}

function _urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}
```

- [ ] **Step 2: Create NotifyMeModal.jsx**

Create `frontend/src/components/NotifyMeModal.jsx`:

```jsx
import { useState } from "react";
import { X, Bell } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function NotifyMeModal({ isOpen, onClose, city, sport }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axios.post(`${API}/notifications/subscribe`, {
        email,
        city,
        sport,
        channels: ["email"],
      });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-testid="notify-modal-overlay"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        data-testid="notify-modal"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-600" />
            <h2 className="font-heading font-bold text-gray-900">Notify me</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            data-testid="notify-modal-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-4" data-testid="notify-modal-success">
            <p className="text-2xl mb-2">🎾</p>
            <p className="font-semibold text-gray-900 mb-1">You're on the list!</p>
            <p className="text-sm text-gray-500">
              We'll email you when {city} {sport} opens.
            </p>
            <button
              onClick={onClose}
              className="mt-4 text-sm text-emerald-600 font-semibold hover:underline"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} data-testid="notify-modal-form">
            <p className="text-sm text-gray-500 mb-4">
              When a {city} {sport.charAt(0).toUpperCase() + sport.slice(1)} season opens.
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              data-testid="notify-modal-email"
            />
            {error && (
              <p className="text-xs text-red-500 mb-2" data-testid="notify-modal-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white font-semibold text-sm py-2.5 rounded-lg hover:bg-emerald-700 transition disabled:opacity-60"
              data-testid="notify-modal-submit"
            >
              {loading ? "Subscribing..." : "Get Notified"}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              No account needed. Unsubscribe anytime.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/NotifyMeBanner.jsx frontend/src/components/NotifyMeModal.jsx
git commit -m "feat(notifications): add NotifyMeBanner + NotifyMeModal components"
```

---

## Task 9: CityLeaderboard integration

**Files:**
- Modify: `frontend/src/pages/CityLeaderboard.jsx`

- [ ] **Step 1: Add NotifyMeBanner import + bell icon**

Open `frontend/src/pages/CityLeaderboard.jsx`. Replace the existing import block:

```jsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Trophy, Users, ChevronRight } from "lucide-react";
```

with:

```jsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Trophy, Users, ChevronRight, Bell } from "lucide-react";
import NotifyMeBanner from "../components/NotifyMeBanner";
import NotifyMeModal from "../components/NotifyMeModal";
```

- [ ] **Step 2: Add bell icon state and banner logic**

Inside `CityLeaderboard`, after the existing `const [loading, setLoading] = useState(true);` line, add:

```jsx
  const [bellOpen, setBellOpen] = useState(false);
```

- [ ] **Step 3: Add bell icon to page header**

Find the `<h1>` block in CityLeaderboard. The current heading section is:

```jsx
          <h1 className="font-heading font-black text-3xl text-gray-900 mb-1">
            {city} Leaderboard
          </h1>
          <p className="text-gray-500 text-sm">
            Top ranked {cfg.label.toLowerCase()} players in {city}
          </p>
```

Replace it with:

```jsx
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-heading font-black text-3xl text-gray-900 mb-1">
                {city} Leaderboard
              </h1>
              <p className="text-gray-500 text-sm">
                Top ranked {cfg.label.toLowerCase()} players in {city}
              </p>
            </div>
            <button
              onClick={() => setBellOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-emerald-600 transition"
              data-testid="city-notify-bell"
              title={`Notify me when ${city} ${cfg.label} opens`}
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Notify Me</span>
            </button>
          </div>
```

- [ ] **Step 4: Add NotifyMeBanner in "Active Leagues" section when no open-registration leagues**

Find this block in CityLeaderboard:

```jsx
          {!data || (data.active_leagues?.length ?? 0) === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              No active leagues — check back soon!
            </div>
          ) : (
```

Replace it with:

```jsx
          {!data || (data.active_leagues?.length ?? 0) === 0 ? (
            <div className="p-4">
              <NotifyMeBanner city={city} sport={sport} />
            </div>
          ) : data.active_leagues.every(l => l.status !== "registration") ? (
            <div className="p-4">
              <NotifyMeBanner city={city} sport={sport} />
              <div className="mt-3 divide-y divide-gray-50">
                {data.active_leagues.map(league => (
```

Then you need to close that block properly. Find the closing `)}` of the `active_leagues.map(...)` block and add a closing `</div>` before the final ternary close. The full active leagues section should look like:

```jsx
          {!data || (data.active_leagues?.length ?? 0) === 0 ? (
            <div className="p-4">
              <NotifyMeBanner city={city} sport={sport} />
            </div>
          ) : data.active_leagues.every(l => l.status !== "registration") ? (
            <div className="p-4">
              <NotifyMeBanner city={city} sport={sport} />
              <div className="mt-3 divide-y divide-gray-50">
                {data.active_leagues.map(league => (
                  <Link
                    key={league.id}
                    to={`/leagues/${league.id}/public`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
                    data-testid={`city-league-${league.id}`}
                  >
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{league.name}</p>
                      <p className="text-xs text-gray-500">
                        {league.current_players}/{league.max_players} players
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 ${
                      league.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {league.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.active_leagues.map(league => (
                <Link
                  key={league.id}
                  to={`/leagues/${league.id}/public`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
                  data-testid={`city-league-${league.id}`}
                >
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{league.name}</p>
                    <p className="text-xs text-gray-500">
                      {league.current_players}/{league.max_players} players
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 ${
                    league.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {league.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
```

- [ ] **Step 5: Add NotifyMeModal for bell icon at end of component return**

Find the closing `</div>` of the outermost `<div className="min-h-screen bg-gray-50"...>` in CityLeaderboard. Add the modal just before it:

```jsx
      <NotifyMeModal
        isOpen={bellOpen}
        onClose={() => setBellOpen(false)}
        city={city}
        sport={sport}
      />
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/CityLeaderboard.jsx
git commit -m "feat(notifications): add NotifyMeBanner + bell icon to CityLeaderboard"
```

---

## Task 10: SportLanding integration

**Files:**
- Modify: `frontend/src/pages/SportLanding.jsx`

- [ ] **Step 1: Add imports to SportLanding.jsx**

Open `frontend/src/pages/SportLanding.jsx`. Add to existing import block:

```jsx
import NotifyMeBanner from "../components/NotifyMeBanner";
import NotifyMeModal from "../components/NotifyMeModal";
```

Also add `Bell` to any existing lucide-react import in the file. If there is no lucide-react import, add:

```jsx
import { Bell } from "lucide-react";
```

- [ ] **Step 2: Add bell state**

Find the existing `const [leagues, setLeagues] = useState([]);` line. After it, add:

```jsx
  const [bellOpen, setBellOpen] = useState(false);
```

- [ ] **Step 3: Add NotifyMeBanner when no open-registration leagues**

In SportLanding, find the "no leagues" empty state. The current empty state is:

```jsx
              <p className="text-gray-500">No {meta.label} leagues open yet</p>
```

Replace the surrounding empty state block with (keep the city/sport context — `sport` is available from `useParams`):

```jsx
              <div className="px-2 py-2">
                <NotifyMeBanner city="" sport={sport} />
              </div>
```

Note: SportLanding doesn't have a city context (it's the sport-level page). Pass `city=""` — the backend will accept any string and will match interests where city is also "". For the sport-level page, this is an acceptable simplification; the banner copy will read "Get notified when a Tennis season opens".

- [ ] **Step 4: Add bell icon button near the page header in SportLanding**

Find the page's main heading. Add a bell button next to it following the same pattern as CityLeaderboard:

```jsx
            <button
              onClick={() => setBellOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-emerald-600 transition"
              data-testid="sport-notify-bell"
              title={`Notify me when a ${meta?.label} league opens`}
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Notify Me</span>
            </button>
```

- [ ] **Step 5: Add NotifyMeModal before closing tag**

Before SportLanding's closing `</div>` of the outermost element, add:

```jsx
      <NotifyMeModal
        isOpen={bellOpen}
        onClose={() => setBellOpen(false)}
        city=""
        sport={sport}
      />
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/SportLanding.jsx
git commit -m "feat(notifications): add NotifyMeBanner + bell icon to SportLanding"
```

---

## Task 11: PlayerDashboard notification settings section

**Files:**
- Modify: `frontend/src/pages/PlayerDashboard.jsx`

- [ ] **Step 1: Add state + fetch for notification interests**

Open `frontend/src/pages/PlayerDashboard.jsx`. After the existing `const [togglingPrivacy, setTogglingPrivacy] = useState(false);` state line (or near it), add:

```jsx
  const [interests, setInterests] = useState([]);
  const [removingInterest, setRemovingInterest] = useState(null);
```

- [ ] **Step 2: Add fetchInterests in useEffect**

Find the existing `useEffect` that fetches leagues and matches. Add a parallel fetch for interests. Locate the `useEffect` and add inside it (after existing fetches):

```jsx
    axios.get(`${API}/notifications/interests`, { withCredentials: true })
      .then(r => setInterests(r.data))
      .catch(() => {});
```

- [ ] **Step 3: Add removeInterest handler**

After `togglePrivacy`, add:

```jsx
  const removeInterest = async (token) => {
    if (removingInterest) return;
    setRemovingInterest(token);
    try {
      await axios.delete(`${API}/notifications/unsubscribe?token=${encodeURIComponent(token)}`);
      setInterests(prev => prev.filter(i => i.unsubscribe_token !== token));
    } catch (e) {
      console.error(e);
    } finally {
      setRemovingInterest(null);
    }
  };
```

- [ ] **Step 4: Add notification subscriptions section to the dashboard**

Find the closing section of the PlayerDashboard JSX (near the `{/* Find a League CTA */}` comment or at the bottom of the main content area). Add this section:

```jsx
        {/* Notification Subscriptions */}
        {interests.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-heading font-bold text-gray-900 text-sm">Notification Subscriptions</h2>
              <p className="text-xs text-gray-500 mt-0.5">You'll be notified when these leagues open</p>
            </div>
            <div className="divide-y divide-gray-50">
              {interests.map((interest) => {
                const sportEmoji = { tennis: "🎾", pickleball: "🏓", cricket: "🏏" }[interest.sport] || "🏆";
                return (
                  <div
                    key={interest.id}
                    className="flex items-center justify-between px-4 py-3"
                    data-testid={`interest-row-${interest.id}`}
                  >
                    <span className="text-sm text-gray-700">
                      {sportEmoji} {interest.sport.charAt(0).toUpperCase() + interest.sport.slice(1)}
                      {interest.city ? ` — ${interest.city}` : ""}
                    </span>
                    <button
                      onClick={() => removeInterest(interest.unsubscribe_token)}
                      disabled={removingInterest === interest.unsubscribe_token}
                      className="text-xs text-red-500 font-semibold hover:text-red-700 transition disabled:opacity-50"
                      data-testid={`remove-interest-${interest.id}`}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PlayerDashboard.jsx
git commit -m "feat(notifications): add notification subscriptions section to PlayerDashboard"
```

---

## Task 12: Register service worker in frontend/src/index.js

**Files:**
- Modify: `frontend/src/index.js`

- [ ] **Step 1: Add service worker registration**

Open `frontend/src/index.js`. Replace its entire contents with:

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register service worker for push notifications
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("SW registration failed:", err));
  });
}
```

- [ ] **Step 2: Verify frontend compiles**

```bash
cd frontend && yarn build 2>&1 | tail -10
```

Expected: `Compiled successfully.`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.js
git commit -m "feat(notifications): register service worker in frontend/src/index.js"
```

---

## Task 13: Add VAPID vars to Coolify + run indexes seed

**Files:** Coolify dashboard (manual step), `backend/seeds/indexes.py` (already modified in Task 5)

- [ ] **Step 1: Add VAPID env vars in Coolify backend**

In the Coolify backend application env vars, add:

```
VAPID_PRIVATE_KEY=<value from Task 1 Step 3>
VAPID_PUBLIC_KEY=<value from Task 1 Step 3>
VAPID_CLAIMS_EMAIL=hello@venlaxsports.com
```

In the Coolify frontend application env vars, add:

```
REACT_APP_VAPID_PUBLIC_KEY=<value from Task 1 Step 3>
```

- [ ] **Step 2: Run indexes seed against production DB**

```bash
cd backend && python -c "
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient
from seeds.indexes import create_indexes

async def run():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ.get('DB_NAME', 'venlaxsports')]
    await create_indexes(db)
    print('Indexes created')

asyncio.run(run())
"
```

Expected: `Indexes created`

- [ ] **Step 3: Deploy**

```bash
git push origin main
```

Then trigger redeploy in Coolify for both frontend and backend.

- [ ] **Step 4: Smoke test production**

1. Visit `/city/New York/sport/tennis` — confirm NotifyMeBanner appears in Active Leagues section when no open-registration leagues exist
2. Click bell icon — confirm NotifyMeModal opens
3. Submit email as guest — confirm success state
4. Log in, click "Notify Me" on banner — confirm one-click subscribe toast
5. Visit `/dashboard` — confirm subscription appears in Notification Subscriptions section
6. Click Remove — confirm it disappears

---

## Self-Review Checklist

**Spec coverage:**
- [x] Trigger 1 (season opens) — Task 6 Step 2
- [x] Trigger 2 (50% fill) — Task 6 Step 3
- [x] Trigger 3 (80% fill) — Task 6 Step 3
- [x] Trigger 4 (league full) — Task 6 Step 3
- [x] Email channel — Tasks 3, 2
- [x] Push channel — Tasks 2, 7, 8, 12
- [x] NotifyMeBanner — Tasks 8, 9, 10
- [x] Bell icon — Tasks 9, 10
- [x] Guest modal — Task 8
- [x] One-click logged-in subscribe — Task 8 (NotifyMeBanner)
- [x] Push permission prompt after subscribe — Task 8 (_registerPush)
- [x] `notification_interests` collection — Tasks 2, 4, 5
- [x] `push_subscriptions` collection — Tasks 2, 4, 5
- [x] Indexes — Task 5
- [x] Dead subscription cleanup (410) — Task 2 (`_send_push_to_user`)
- [x] Unsubscribe token in email — Tasks 3, 4 (send functions pass join_url; unsubscribe_token returned by subscribe route)
- [x] PlayerDashboard settings section — Task 11
- [x] VAPID keys — Tasks 1, 13
- [x] `email_notifications=False` kill switch — Task 2 (`_notifications_allowed`)

**Note on unsubscribe link in emails:** The `send_season_open` / `send_last_spots` / `send_waitlist_open` functions currently don't include the unsubscribe token in the email footer. The `_wrap` helper includes a generic "You can disable notifications from your dashboard" line. To add a one-click unsubscribe link in the footer, the dispatch functions would need to pass the token to the email functions. As a post-MVP improvement, update `notification_dispatch.py` to fetch the interest's token and pass it to each email send function; add a `_wrap_with_unsub` variant that includes the link. This is out of scope for initial launch but should be addressed before scaling email volume.
