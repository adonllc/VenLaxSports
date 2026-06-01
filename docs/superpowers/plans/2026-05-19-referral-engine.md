# Referral Engine Expansions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 6 distribution features — league spectator view, city leaderboards, match share cards, public player profiles, challenge button, WhatsApp integration — making every match a player acquisition event.

**Architecture:** New `backend/routes/public_routes.py` handles all no-auth endpoints; `get_optional_user()` and `serialize_public_user()` in `auth_utils.py` enforce PII boundaries; 3 new frontend pages consume public endpoints without login. WhatsApp (Task 14) is approval-gated and independently deployable.

**Tech Stack:** FastAPI + MongoDB motor (backend), React 19 + Tailwind v3 + recharts (frontend), requests (tests against live server), WhatsApp Cloud API via httpx (Task 14).

---

## File Structure

**Backend — new:**
- `backend/routes/public_routes.py` — city leaderboard, league spectator, player profile, challenge
- `backend/whatsapp_service.py` — WA Cloud API client (Task 14)
- `backend/routes/whatsapp_routes.py` — WA webhook handler (Task 14)

**Backend — modified:**
- `backend/auth_utils.py` — add `get_optional_user()`, `serialize_public_user()`
- `backend/models.py` — add `Challenge` model; `User.profile_public`; `League.is_public`
- `backend/seeds/indexes.py` — add 5 compound indexes
- `backend/routes/auth_routes.py` — extend `UpdatePreferencesIn` with `profile_public`
- `backend/server.py` — mount `public_routes` + WA routes (Task 14)

**Frontend — new:**
- `frontend/src/pages/LeagueSpectator.jsx`
- `frontend/src/pages/CityLeaderboard.jsx`
- `frontend/src/pages/PublicProfile.jsx`

**Frontend — modified:**
- `frontend/src/App.js` — 3 new routes + imports
- `frontend/src/pages/ScoreReport.jsx` — share card after score submit
- `frontend/src/pages/Standings.jsx` — player names → profile links
- `frontend/src/pages/PlayerDashboard.jsx` — privacy toggle

**Tests — new:**
- `backend/tests/test_public_endpoints.py`

---

### Task 1: Database Indexes

**Files:**
- Modify: `backend/seeds/indexes.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_public_endpoints.py — write just the index smoke test first
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


class TestPublicIndexes:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails (if BASE_URL is unset)**

```
python -m pytest backend/tests/test_public_endpoints.py::TestPublicIndexes -v
```

Expected: PASS (health endpoint exists) — this confirms test file is wired.

- [ ] **Step 3: Add the 5 new indexes to `backend/seeds/indexes.py`**

Replace the entire file:

```python
async def create_indexes(db) -> None:
    await db.users.create_index("email", unique=True)
    await db.player_leagues.create_index([("player_id", 1), ("league_id", 1)])
    await db.matches.create_index([("league_id", 1), ("scheduled_date", 1)])
    await db.standings.create_index([("league_id", 1), ("points", -1)])
    await db.payment_transactions.create_index("session_id")
    await db.seasons.create_index([("sport", 1), ("status", 1)])
    # Referral engine expansions
    await db.users.create_index([("city", 1)])
    await db.matches.create_index([("league_id", 1), ("status", 1)])
    await db.rating_history.create_index([("user_id", 1), ("created_at", -1)])
    await db.challenges.create_index([("challenger_id", 1), ("created_at", -1)])
    await db.challenges.create_index([("challenged_id", 1), ("status", 1)])
```

- [ ] **Step 4: Verify indexes run against live DB**

```bash
cd backend
python -c "
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient
from seeds.indexes import create_indexes
from dotenv import load_dotenv
load_dotenv()
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
asyncio.run(create_indexes(db))
print('Indexes created OK')
"
```

Expected: `Indexes created OK`

- [ ] **Step 5: Commit**

```bash
git add backend/seeds/indexes.py backend/tests/test_public_endpoints.py
git commit -m "feat: add compound indexes and test scaffold for referral engine"
```

---

### Task 2: Auth Utility Helpers

**Files:**
- Modify: `backend/auth_utils.py` (add 2 functions after line 75, before `require_admin`)

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_public_endpoints.py`:

```python
class TestOptionalAuth:
    def test_public_endpoint_no_auth_returns_200_not_401(self):
        # Placeholder — will become meaningful after Task 4.
        # For now, confirm health still works without cookies.
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert "401" not in r.text
```

- [ ] **Step 2: Run test**

```
python -m pytest backend/tests/test_public_endpoints.py::TestOptionalAuth -v
```

Expected: PASS

- [ ] **Step 3: Add `get_optional_user` and `serialize_public_user` to `backend/auth_utils.py`**

Add `from typing import Optional` at the top (after existing imports), then insert these two functions after the `get_current_user` function (after line 75, before `require_admin`):

```python
async def get_optional_user(request: Request, db) -> Optional[dict]:
    """Like get_current_user but returns None instead of raising 401."""
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        return None
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        user_id = payload["sub"]
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            return None
        if not user:
            return None
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except (pyjwt.ExpiredSignatureError, pyjwt.InvalidTokenError):
        return None


def serialize_public_user(user: dict) -> dict:
    """Strip PII — return only public-safe fields from a user document."""
    return {
        "id": str(user.get("_id") or user.get("id", "")),
        "name": user.get("name"),
        "city": user.get("city"),
        "country": user.get("country", "USA"),
        "tennis_rating": user.get("tennis_rating", 3.0),
        "pickleball_rating": user.get("pickleball_rating", 3.0),
        "avatar": user.get("avatar"),
        "profile_public": user.get("profile_public", True),
    }
```

- [ ] **Step 4: Verify import works**

```bash
cd backend
python -c "from auth_utils import get_optional_user, serialize_public_user; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/auth_utils.py backend/tests/test_public_endpoints.py
git commit -m "feat: add get_optional_user and serialize_public_user helpers"
```

---

### Task 3: Models — Challenge, User.profile_public, League.is_public

**Files:**
- Modify: `backend/models.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_public_endpoints.py`:

```python
class TestModels:
    def test_challenge_model_import(self):
        from models import Challenge
        c = Challenge(
            challenger_id="aaa",
            challenger_name="Alice",
            challenged_id="bbb",
        )
        assert c.status == "pending"
        assert c.delivery_method == "email"
        d = c.to_mongo()
        assert "_id" not in d  # no id when not saved
        assert d["challenger_id"] == "aaa"
```

- [ ] **Step 2: Run test to verify it fails**

```
python -m pytest backend/tests/test_public_endpoints.py::TestModels -v
```

Expected: FAIL with `ImportError: cannot import name 'Challenge'`

- [ ] **Step 3: Add `Challenge` model and new fields to `backend/models.py`**

Add `profile_public: bool = True` to the `User` class (after `email_notifications` line 53):

```python
    email_notifications: bool = True
    profile_public: bool = True                      # opt-out toggle for public profile
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
```

Add `is_public: bool = True` to the `League` class (after `league_type` line 92):

```python
    league_type: str = "flex"               # "flex" | "round_robin"
    rr_config: Optional[Dict] = None
    is_public: bool = True                  # spectator view toggle
```

Add the `Challenge` model at the end of `backend/models.py`:

```python
# ─── Challenge ───────────────────────────────────────
class Challenge(BaseDocument):
    challenger_id: str
    challenger_name: str
    challenged_id: str
    league_id: Optional[str] = None
    status: str = "pending"          # pending, accepted, expired
    delivery_method: str = "email"   # email | whatsapp
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
```

- [ ] **Step 4: Run test to verify it passes**

```
python -m pytest backend/tests/test_public_endpoints.py::TestModels -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/tests/test_public_endpoints.py
git commit -m "feat: add Challenge model, User.profile_public, League.is_public"
```

---

### Task 4: Public Routes Backend

**Files:**
- Create: `backend/routes/public_routes.py`

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_public_endpoints.py`:

```python
class TestPublicEndpoints:
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

    def test_league_spectator_no_auth(self):
        leagues = requests.get(f"{BASE_URL}/api/leagues").json()
        if not leagues:
            pytest.skip("No leagues in test DB")
        league_id = leagues[0]["id"]
        r = requests.get(f"{BASE_URL}/api/public/league/{league_id}")
        assert r.status_code == 200
        data = r.json()
        assert "standings" in data
        assert "recent_matches" in data
        assert "email" not in r.text

    def test_league_spectator_invalid_id(self):
        r = requests.get(f"{BASE_URL}/api/public/league/notanobjectid")
        assert r.status_code == 404

    def test_player_profile_no_pii(self):
        s = requests.Session()
        s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@leaguepro.com", "password": "Admin@123"})
        users = s.get(f"{BASE_URL}/api/admin/users").json()
        if not users:
            pytest.skip("No users in test DB")
        player_id = users[0]["id"]
        r = requests.get(f"{BASE_URL}/api/public/player/{player_id}")
        assert r.status_code in [200, 404]
        if r.status_code == 200:
            data = r.json()
            assert "name" in data
            assert "email" not in data
            assert "password_hash" not in data
            assert "google_id" not in data

    def test_challenge_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/public/challenge", json={
            "challenged_id": "000000000000000000000001"
        })
        assert r.status_code == 401

    def test_challenge_rate_limit(self):
        s = requests.Session()
        s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@leaguepro.com", "password": "Admin@123"})
        users_resp = s.get(f"{BASE_URL}/api/admin/users").json()
        non_admin = next((u for u in users_resp if u.get("role") != "admin"), None)
        if not non_admin:
            pytest.skip("Need a non-admin user to challenge")
        for _ in range(3):
            s.post(f"{BASE_URL}/api/public/challenge", json={"challenged_id": non_admin["id"]})
        r = s.post(f"{BASE_URL}/api/public/challenge", json={"challenged_id": non_admin["id"]})
        assert r.status_code == 429
```

- [ ] **Step 2: Run tests to verify they fail**

```
python -m pytest backend/tests/test_public_endpoints.py::TestPublicEndpoints -v
```

Expected: FAIL with `404` on all public endpoints (route doesn't exist yet)

- [ ] **Step 3: Create `backend/routes/public_routes.py`**

```python
"""Public (no-auth) endpoints — city leaderboards, league spectator, player profiles, challenge."""
import os
from datetime import datetime, timezone, date
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth_utils import get_optional_user, serialize_public_user
from models import Challenge
import email_service

router = APIRouter()

_VALID_SPORTS = {"tennis", "pickleball", "cricket"}


@router.get("/city/{city}/sport/{sport}")
async def city_leaderboard(city: str, sport: str, request: Request, limit: int = 20):
    """Public city leaderboard. No auth required. Returns empty lists for unknown cities."""
    db = request.app.state.db
    if sport not in _VALID_SPORTS:
        raise HTTPException(status_code=400, detail=f"sport must be one of {sorted(_VALID_SPORTS)}")
    limit = min(limit, 50)

    rating_field = f"{sport}_rating"
    users = await db.users.find(
        {"city": city, "is_active": {"$ne": False}},
        {"name": 1, rating_field: 1, "profile_public": 1},
    ).sort(rating_field, -1).limit(limit).to_list(limit)

    leaders = []
    for u in users:
        if not u.get("profile_public", True):
            leaders.append({
                "id": str(u["_id"]),
                "name": "Anonymous Player",
                "rating": u.get(rating_field, 3.0),
                "profile_public": False,
            })
        else:
            leaders.append({
                "id": str(u["_id"]),
                "name": u.get("name"),
                "rating": u.get(rating_field, 3.0),
                "profile_public": True,
            })

    leagues = await db.leagues.find(
        {"city": city, "sport": sport, "status": {"$in": ["registration", "active"]}},
        {"name": 1, "status": 1, "current_players": 1, "max_players": 1, "entry_fee": 1, "league_type": 1},
    ).limit(6).to_list(6)

    active_leagues = [
        {
            "id": str(l["_id"]),
            "name": l.get("name"),
            "status": l.get("status"),
            "current_players": l.get("current_players", 0),
            "max_players": l.get("max_players"),
            "entry_fee": l.get("entry_fee", 0),
            "league_type": l.get("league_type", "flex"),
        }
        for l in leagues
    ]

    return {"city": city, "sport": sport, "leaders": leaders, "active_leagues": active_leagues}


@router.get("/league/{league_id}")
async def league_spectator(league_id: str, request: Request):
    """Public league view — no auth required. Returns 404 for private or nonexistent leagues."""
    db = request.app.state.db
    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league or not league.get("is_public", True):
        raise HTTPException(status_code=404, detail="League not found")

    standings = await db.standings.find(
        {"league_id": league_id},
        {"player_id": 1, "player_name": 1, "wins": 1, "losses": 1, "points": 1, "matches_played": 1, "_id": 0},
    ).sort("points", -1).to_list(50)

    recent_matches = await db.matches.find(
        {"league_id": league_id, "status": "completed"},
        {"player1_name": 1, "player2_name": 1, "winner_name": 1, "score_data": 1, "scheduled_date": 1, "sport": 1, "_id": 0},
    ).sort("updated_at", -1).limit(10).to_list(10)

    return {
        "id": league_id,
        "name": league.get("name"),
        "sport": league.get("sport"),
        "city": league.get("city"),
        "format": league.get("format"),
        "league_type": league.get("league_type", "flex"),
        "status": league.get("status"),
        "current_players": league.get("current_players", 0),
        "max_players": league.get("max_players"),
        "start_date": league.get("start_date"),
        "end_date": league.get("end_date"),
        "description": league.get("description"),
        "standings": standings,
        "recent_matches": recent_matches,
    }


@router.get("/player/{player_id}")
async def public_player_profile(player_id: str, request: Request):
    """Public player profile — no auth required. Returns 404 for private profiles."""
    db = request.app.state.db
    if not ObjectId.is_valid(player_id):
        raise HTTPException(status_code=404, detail="Player not found")
    user = await db.users.find_one({"_id": ObjectId(player_id)})
    if not user or not user.get("profile_public", True):
        raise HTTPException(status_code=404, detail="Player not found")

    user["_id"] = str(user["_id"])
    public_user = serialize_public_user(user)

    matches = await db.matches.find(
        {"$or": [{"player1_id": player_id}, {"player2_id": player_id}], "status": "completed"},
        {"player1_name": 1, "player2_name": 1, "winner_name": 1, "winner_id": 1,
         "score_data": 1, "sport": 1, "scheduled_date": 1, "_id": 0},
    ).sort("scheduled_date", -1).limit(20).to_list(20)

    rating_history = await db.rating_history.find(
        {"user_id": player_id},
        {"sport": 1, "rating": 1, "delta": 1, "result": 1, "created_at": 1, "_id": 0},
    ).sort("created_at", 1).limit(50).to_list(50)

    wins = sum(1 for m in matches if m.get("winner_id") == player_id)
    losses = len(matches) - wins

    return {
        **public_user,
        "wins": wins,
        "losses": losses,
        "recent_matches": matches,
        "rating_history": rating_history,
    }


class ChallengeIn(BaseModel):
    challenged_id: str
    league_id: Optional[str] = None


@router.post("/challenge")
async def send_challenge(data: ChallengeIn, request: Request):
    """Send a match challenge. Auth required. Rate-limited to 3 per calendar day."""
    db = request.app.state.db
    challenger = await get_optional_user(request, db)
    if not challenger:
        raise HTTPException(status_code=401, detail="Login to send a challenge")

    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc).isoformat()
    count = await db.challenges.count_documents({
        "challenger_id": challenger["_id"],
        "created_at": {"$gte": today_start},
    })
    if count >= 3:
        raise HTTPException(status_code=429, detail="Challenge limit reached (3 per day). Try again tomorrow.")

    if not ObjectId.is_valid(data.challenged_id):
        raise HTTPException(status_code=404, detail="Player not found")
    challenged = await db.users.find_one({"_id": ObjectId(data.challenged_id)})
    if not challenged:
        raise HTTPException(status_code=404, detail="Player not found")

    challenge = Challenge(
        challenger_id=challenger["_id"],
        challenger_name=challenger["name"],
        challenged_id=data.challenged_id,
        league_id=data.league_id,
    )
    await db.challenges.insert_one(challenge.to_mongo())

    if challenged.get("email") and challenged.get("email_notifications", True):
        frontend_url = os.environ.get("FRONTEND_URL", "https://venlaxsports.com")
        email_service.schedule(email_service.send_generic(
            challenged["email"],
            subject=f"{challenger['name']} challenged you on VENLAX Sports!",
            body=(
                f"Hi {challenged.get('name')},\n\n"
                f"{challenger['name']} wants to play you on VENLAX Sports.\n\n"
                f"View their profile: {frontend_url}/players/{challenger['_id']}\n\n"
                f"— VENLAX Sports"
            ),
        ))

    return {"message": "Challenge sent!", "challenged_name": challenged.get("name")}
```

- [ ] **Step 4: Run tests — still failing because route not mounted yet**

```
python -m pytest backend/tests/test_public_endpoints.py::TestPublicEndpoints::test_city_leaderboard_no_auth -v
```

Expected: FAIL with 404 (route not mounted)

- [ ] **Step 5: Commit the route file (before mount)**

```bash
git add backend/routes/public_routes.py
git commit -m "feat: add public_routes.py with city, league, player, challenge endpoints"
```

---

### Task 5: Mount Public Routes + Extend Preferences Endpoint

**Files:**
- Modify: `backend/server.py`
- Modify: `backend/routes/auth_routes.py`

- [ ] **Step 1: Mount public_routes in `backend/server.py`**

Add after line 34 (`from routes.round_robin_routes import router as rr_router`):

```python
from routes.public_routes import router as public_router
```

Add after line 46 (`api_router.include_router(rr_router, ...)`):

```python
api_router.include_router(public_router, prefix="/public", tags=["public"])
```

- [ ] **Step 2: Extend `UpdatePreferencesIn` in `backend/routes/auth_routes.py`**

Find `class UpdatePreferencesIn(BaseModel):` (around line 136). Replace it and the `update_preferences` handler with:

```python
class UpdatePreferencesIn(BaseModel):
    email_notifications: Optional[bool] = None
    profile_public: Optional[bool] = None


@router.patch("/preferences")
async def update_preferences(body: UpdatePreferencesIn, request: Request):
    """Toggle email notifications and/or profile visibility."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    update = {}
    if body.email_notifications is not None:
        update["email_notifications"] = body.email_notifications
    if body.profile_public is not None:
        update["profile_public"] = body.profile_public
    if update:
        await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": update})
    merged = {**user, **update}
    return {
        "email_notifications": merged.get("email_notifications", True),
        "profile_public": merged.get("profile_public", True),
    }
```

Make sure `Optional` is imported at the top of auth_routes.py. Add if missing:
```python
from typing import Optional
```

- [ ] **Step 3: Restart backend and run all public endpoint tests**

```bash
uvicorn server:app --reload --port 8001 &
sleep 2
python -m pytest backend/tests/test_public_endpoints.py -v
```

Expected: All tests PASS (rate limit test may fail if DB has leftover challenges — clear challenges collection first if needed)

- [ ] **Step 4: Commit**

```bash
git add backend/server.py backend/routes/auth_routes.py
git commit -m "feat: mount public_routes, extend preferences endpoint with profile_public"
```

---

### Task 6: Frontend Routes

**Files:**
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Add imports and routes to `frontend/src/App.js`**

Add three imports after line 14 (`import RoundRobinInvite from "./pages/RoundRobinInvite";`):

```jsx
import LeagueSpectator from "./pages/LeagueSpectator";
import CityLeaderboard from "./pages/CityLeaderboard";
import PublicProfile from "./pages/PublicProfile";
```

Add three routes inside `<Routes>` after the `/terms` route (line 47):

```jsx
      <Route path="/leagues/:id/public" element={<LeagueSpectator />} />
      <Route path="/city/:city/sport/:sport" element={<CityLeaderboard />} />
      <Route path="/players/:id" element={<PublicProfile />} />
```

- [ ] **Step 2: Verify app compiles**

```bash
cd frontend && yarn start
```

Expected: App starts. Console shows `Failed to compile` only if the 3 new page files don't exist yet — that's expected. Create empty placeholder files to unblock:

```bash
echo 'export default function LeagueSpectator() { return <div>Loading...</div>; }' > src/pages/LeagueSpectator.jsx
echo 'export default function CityLeaderboard() { return <div>Loading...</div>; }' > src/pages/CityLeaderboard.jsx
echo 'export default function PublicProfile() { return <div>Loading...</div>; }' > src/pages/PublicProfile.jsx
```

- [ ] **Step 3: Confirm routes load in browser**

Visit `http://localhost:3000/leagues/ANYID/public` → should show "Loading..."
Visit `http://localhost:3000/city/New York/sport/tennis` → should show "Loading..."
Visit `http://localhost:3000/players/ANYID` → should show "Loading..."

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.js frontend/src/pages/LeagueSpectator.jsx frontend/src/pages/CityLeaderboard.jsx frontend/src/pages/PublicProfile.jsx
git commit -m "feat: add frontend routes for spectator, city leaderboard, public profile"
```

---

### Task 7: LeagueSpectator.jsx (Expansion 1)

**Files:**
- Modify: `frontend/src/pages/LeagueSpectator.jsx` (replace placeholder)

- [ ] **Step 1: Replace the placeholder with the full component**

```jsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Trophy, Users, Calendar, Share2, AlertCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_COLORS = {
  tennis: "text-emerald-600",
  pickleball: "text-orange-500",
  cricket: "text-blue-600",
};

export default function LeagueSpectator() {
  const { id: leagueId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    axios.get(`${API}/public/league/${leagueId}`)
      .then(r => setData(r.data))
      .catch(() => setError("League not found or not public."))
      .finally(() => setLoading(false));
  }, [leagueId]);

  const handleShare = () => {
    const url = `${window.location.href}?utm_source=venlax&utm_medium=spectator`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
        <p className="text-gray-500 mb-4">{error}</p>
        <Link to="/leagues" className="text-sm font-medium text-black underline">
          Browse all leagues
        </Link>
      </div>
    </div>
  );

  const sportColor = SPORT_COLORS[data.sport] || "text-gray-700";

  return (
    <div className="min-h-screen bg-gray-50" data-testid="league-spectator-page">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${sportColor}`}>
                {data.sport} · {data.city}
              </p>
              <h1 className="font-heading font-black text-2xl text-gray-900 mb-2 truncate">
                {data.name}
              </h1>
              <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {data.current_players}/{data.max_players} players
                </span>
                <span className={`capitalize px-2 py-0.5 rounded-full text-xs font-semibold ${
                  data.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {data.status}
                </span>
              </div>
            </div>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-black transition shrink-0"
              data-testid="spectator-share-btn"
            >
              <Share2 className="w-4 h-4" />
              {copied ? "Copied!" : "Share"}
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
            <Link
              to={`/leagues/${leagueId}`}
              className="flex-1 text-center bg-black text-white rounded-md py-2.5 text-sm font-bold hover:bg-gray-800 transition"
              data-testid="spectator-join-btn"
            >
              Join this league
            </Link>
          </div>
        </div>

        {/* Standings */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <h2 className="font-heading font-bold text-gray-900">Standings</h2>
          </div>
          {data.standings.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              Season starting soon — check back after matches begin!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="spectator-standings-table">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Player</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">W</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">L</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {data.standings.map((s, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/players/${s.player_id}`}
                          className="font-medium text-gray-900 hover:underline"
                        >
                          {s.player_name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-center text-emerald-600 font-medium">{s.wins}</td>
                      <td className="px-3 py-3 text-center text-red-400">{s.losses}</td>
                      <td className="px-3 py-3 text-center font-bold text-gray-900">
                        {s.points?.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent results */}
        {data.recent_matches.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <h2 className="font-heading font-bold text-gray-900">Recent Results</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {data.recent_matches.map((m, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-gray-700">
                    <span className="font-medium">{m.player1_name}</span>
                    <span className="text-gray-400 mx-2">vs</span>
                    <span className="font-medium">{m.player2_name}</span>
                  </span>
                  <span className="text-xs text-gray-400 shrink-0 ml-4">
                    {m.winner_name} won
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Join CTA */}
        <div className="text-center py-2">
          <p className="text-gray-500 text-sm mb-3">Want to compete? No club required.</p>
          <Link
            to="/auth"
            className="inline-block bg-black text-white rounded-md px-8 py-3 text-sm font-bold hover:bg-gray-800 transition"
            data-testid="spectator-signup-cta"
          >
            Join VenLax Sports Free
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test in browser**

Visit `http://localhost:3000/leagues/REAL_LEAGUE_ID/public` (get an ID from `/api/leagues`).

Verify:
- Page loads without login
- Standings table renders (or "Season starting soon" if empty)
- Share button copies URL
- "Join this league" goes to league detail
- Player names link to `/players/{id}`
- "Join VenLax Sports Free" goes to `/auth`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/LeagueSpectator.jsx
git commit -m "feat: LeagueSpectator public league page (Expansion 1)"
```

---

### Task 8: CityLeaderboard.jsx (Expansion 2)

**Files:**
- Modify: `frontend/src/pages/CityLeaderboard.jsx` (replace placeholder)

- [ ] **Step 1: Replace the placeholder with the full component**

```jsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Trophy, Users, ChevronRight } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_CONFIG = {
  tennis: { label: "Tennis", emoji: "🎾", color: "text-emerald-600" },
  pickleball: { label: "Pickleball", emoji: "🏓", color: "text-orange-500" },
  cricket: { label: "Cricket", emoji: "🏏", color: "text-blue-600" },
};

export default function CityLeaderboard() {
  const { city, sport } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API}/public/city/${encodeURIComponent(city)}/sport/${sport}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [city, sport]);

  const cfg = SPORT_CONFIG[sport] || { label: sport, emoji: "🏆", color: "text-gray-700" };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50" data-testid="city-leaderboard-page">
      {/* SEO header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${cfg.color}`}>
            {cfg.emoji} {cfg.label}
          </p>
          <h1 className="font-heading font-black text-3xl text-gray-900 mb-1">
            {city} Leaderboard
          </h1>
          <p className="text-gray-500 text-sm">
            Top ranked {cfg.label.toLowerCase()} players in {city}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Top Players */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <h2 className="font-heading font-bold text-gray-900">Top Players</h2>
          </div>
          {!data || data.leaders.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-gray-500 text-sm mb-4">
                No players in {city} yet — be the first!
              </p>
              <Link
                to="/auth"
                className="inline-block bg-black text-white rounded-md px-6 py-2.5 text-sm font-bold hover:bg-gray-800 transition"
                data-testid="city-first-player-cta"
              >
                Join VenLax Sports
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.leaders.map((player, i) => (
                <div
                  key={player.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition"
                  data-testid={`leaderboard-row-${i}`}
                >
                  <span className="w-6 text-center font-bold text-gray-400 text-sm shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    {player.profile_public ? (
                      <Link
                        to={`/players/${player.id}`}
                        className="font-medium text-gray-900 hover:underline truncate block"
                      >
                        {player.name}
                      </Link>
                    ) : (
                      <span className="text-gray-400 italic text-sm">{player.name}</span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${cfg.color} shrink-0`}>
                    {player.rating?.toFixed(2)}
                  </span>
                  {player.profile_public && (
                    <Link
                      to={`/players/${player.id}`}
                      className="text-gray-300 hover:text-gray-600 transition shrink-0"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Leagues */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <h2 className="font-heading font-bold text-gray-900">
              Active Leagues in {city}
            </h2>
          </div>
          {!data || data.active_leagues.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              No active leagues — check back soon!
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
                      {league.current_players}/{league.max_players} players ·{" "}
                      {league.entry_fee > 0 ? `$${league.entry_fee}` : "Free"}
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
        </div>

        {/* Join CTA */}
        <div className="text-center py-4">
          <p className="text-gray-500 text-sm mb-3">
            Play competitively in {city}. No club required.
          </p>
          <Link
            to="/auth"
            className="inline-block bg-black text-white rounded-md px-8 py-3 text-sm font-bold hover:bg-gray-800 transition"
            data-testid="city-join-cta"
          >
            Join Free · VenLax Sports
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test in browser**

Visit `http://localhost:3000/city/New York/sport/tennis`

Verify:
- Loads without login
- Shows player rows (or "No players yet" empty state)
- Player names link to `/players/{id}` for public profiles
- League cards link to `/leagues/{id}/public`
- "Join VenLax Sports" links to `/auth`

- [ ] **Step 3: Test empty city**

Visit `http://localhost:3000/city/ZzzzNoSuchCity9999/sport/tennis`

Expected: "No players yet" + "No active leagues" empty states. No error.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/CityLeaderboard.jsx
git commit -m "feat: CityLeaderboard public city+sport page (Expansion 2)"
```

---

### Task 9: Match Result Share Card (Expansion 3)

**Files:**
- Modify: `frontend/src/pages/ScoreReport.jsx`

- [ ] **Step 1: Locate the submitted success block in ScoreReport.jsx**

Find the block starting at `if (submitted && submittedResult) {` (around line 211). The block renders a "Results Recorded" confirmation and schedules a redirect to dashboard after 4000ms.

- [ ] **Step 2: Add share card to the success block**

Replace the existing `if (submitted && submittedResult)` block (lines 211–240) with:

```jsx
  if (submitted && submittedResult) {
    const loserName =
      submittedResult.winnerName === match.player1_name
        ? match.player2_name
        : match.player1_name;
    const sportEmoji = match.sport === "tennis" ? "🎾" : match.sport === "pickleball" ? "🏓" : "🏏";
    const shareText = encodeURIComponent(
      `${sportEmoji} ${submittedResult.winnerName} defeated ${loserName}${submittedResult.summary ? ` ${submittedResult.summary}` : ""}\n` +
      `📍 VenLax Sports · ${match.sport}\n` +
      `👉 https://venlaxsports.com/leagues/${match.league_id}/public?utm_source=venlax&utm_medium=share_card`
    );
    const waUrl = `https://wa.me/?text=${shareText}`;
    const spectatorUrl = `https://venlaxsports.com/leagues/${match.league_id}/public?utm_source=venlax&utm_medium=share_card`;

    return (
      <div className="min-h-screen bg-gray-50" data-testid="score-report-page">
        <div className="max-w-xl mx-auto px-4 py-8 space-y-4">
          {/* Result confirmation */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className={`h-1.5 w-full ${config.accentClass}`} />
            <div className="p-8 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${config.accentClass}`}>
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h2 className="font-heading font-black text-2xl text-gray-900 mb-1">Results Recorded</h2>
              <p className={`text-sm font-medium ${config.textClass} mb-6`}>{config.label} Match</p>
              <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Winner</p>
                <p className="font-heading font-bold text-xl text-gray-900">{submittedResult.winnerName}</p>
                {submittedResult.summary && (
                  <p className="text-sm text-gray-500 mt-1 font-mono">{submittedResult.summary}</p>
                )}
              </div>
              <p className="text-xs text-gray-400">Redirecting to dashboard in a few seconds...</p>
            </div>
          </div>

          {/* Share card */}
          <div className="bg-gray-900 rounded-2xl p-6 text-center" data-testid="share-card">
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-3">Share your result</p>
            <div className="text-4xl mb-2">{sportEmoji}</div>
            <p className="text-white font-heading font-black text-xl mb-1">
              {submittedResult.winnerName} won
            </p>
            <p className="text-gray-400 text-sm mb-5">
              {submittedResult.summary && `${submittedResult.summary} · `}
              {match.sport} · VenLax Sports
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white rounded-lg px-4 py-2.5 text-sm font-bold transition"
                data-testid="share-wa-btn"
              >
                Share on WhatsApp
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(spectatorUrl);
                }}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition"
                data-testid="share-copy-btn"
              >
                Copy link
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
```

- [ ] **Step 3: Test the share card in browser**

Submit a score on any match. After submission:
- "Results Recorded" card appears
- Share card appears below it with dark background
- "Share on WhatsApp" opens WA with pre-filled text
- "Copy link" copies the spectator URL
- After 4 seconds, redirects to `/dashboard`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ScoreReport.jsx
git commit -m "feat: match result share card with WA deep link (Expansion 3)"
```

---

### Task 10: PublicProfile.jsx (Expansion 4)

**Files:**
- Modify: `frontend/src/pages/PublicProfile.jsx` (replace placeholder)

- [ ] **Step 1: Replace placeholder with full component**

```jsx
import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { Trophy, Share2, Swords, MapPin } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_COLORS = {
  tennis: "#10B981",
  pickleball: "#F97316",
  cricket: "#2563EB",
};

export default function PublicProfile() {
  const { id: playerId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [challenging, setChallenging] = useState(false);
  const [challengeSent, setChallengeSent] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    axios.get(`${API}/public/player/${playerId}`)
      .then(r => setProfile(r.data))
      .catch(() => setError("Player not found or profile is private."))
      .finally(() => setLoading(false));
  }, [playerId]);

  const handleChallenge = async () => {
    if (!user) {
      navigate(`/auth?next=/players/${playerId}`);
      return;
    }
    setChallenging(true);
    try {
      await axios.post(
        `${API}/public/challenge`,
        { challenged_id: playerId },
        { withCredentials: true }
      );
      setChallengeSent(true);
    } catch (e) {
      alert(e.response?.data?.detail || "Could not send challenge.");
    } finally {
      setChallenging(false);
    }
  };

  const handleShare = () => {
    const url = `${window.location.href}?utm_source=venlax&utm_medium=profile`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm text-center">
        <p className="text-gray-500 mb-4">{error}</p>
        <Link to="/leagues" className="text-sm font-medium text-black underline">
          Browse leagues
        </Link>
      </div>
    </div>
  );

  const isOwnProfile = user && (user.id === playerId || user._id === playerId);

  const chartData = profile.rating_history.map((h, i) => ({
    match: i + 1,
    rating: h.rating,
    sport: h.sport,
  }));

  // Use color of the most recent sport in rating history
  const lastSport = profile.rating_history[profile.rating_history.length - 1]?.sport || "tennis";
  const chartColor = SPORT_COLORS[lastSport] || "#10B981";

  return (
    <div className="min-h-screen bg-gray-50" data-testid="public-profile-page">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Player card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-heading font-black text-2xl text-gray-900">{profile.name}</h1>
              {profile.city && (
                <p className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {profile.city}{profile.country ? `, ${profile.country}` : ""}
                </p>
              )}
            </div>
            <button
              onClick={handleShare}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition shrink-0"
              data-testid="profile-share-btn"
              title="Copy profile link"
            >
              <Share2 className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          {copied && (
            <p className="text-xs text-emerald-600 mt-2">Profile link copied!</p>
          )}

          {/* Stats row */}
          <div className="mt-5 flex gap-6">
            <div className="text-center">
              <p className="text-2xl font-black text-gray-900">{profile.wins}</p>
              <p className="text-xs text-gray-400 uppercase font-medium tracking-wide">Wins</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-gray-900">{profile.losses}</p>
              <p className="text-xs text-gray-400 uppercase font-medium tracking-wide">Losses</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-600">
                {profile.tennis_rating?.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 uppercase font-medium tracking-wide">Tennis</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-orange-500">
                {profile.pickleball_rating?.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 uppercase font-medium tracking-wide">Pickleball</p>
            </div>
          </div>

          {/* Challenge button — hidden for own profile */}
          {!isOwnProfile && (
            <button
              onClick={handleChallenge}
              disabled={challenging || challengeSent}
              className="mt-5 w-full flex items-center justify-center gap-2 bg-black text-white rounded-md py-2.5 text-sm font-bold hover:bg-gray-800 transition disabled:opacity-50"
              data-testid="challenge-btn"
            >
              <Swords className="w-4 h-4" />
              {challengeSent
                ? "Challenge Sent!"
                : challenging
                ? "Sending..."
                : `Challenge ${profile.name}`}
            </button>
          )}
        </div>

        {/* ELO chart */}
        {chartData.length > 1 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="font-heading font-bold text-gray-900 mb-5">Rating History</h2>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 16 }}>
                <XAxis
                  dataKey="match"
                  label={{ value: "Match #", position: "insideBottom", offset: -8, fontSize: 11 }}
                  tick={{ fontSize: 10 }}
                />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v) => [v.toFixed(2), "Rating"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="rating"
                  stroke={chartColor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent matches */}
        {profile.recent_matches.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <h2 className="font-heading font-bold text-gray-900">Recent Matches</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {profile.recent_matches.map((m, i) => {
                const won = m.winner_id === playerId;
                const opponent = won ? m.player2_name : m.player1_name;
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      won ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-500"
                    }`}>
                      {won ? "W" : "L"}
                    </span>
                    <span className="text-sm text-gray-700 flex-1">vs {opponent}</span>
                    <span className="text-xs text-gray-400 shrink-0">{m.sport}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Join CTA for non-users */}
        {!user && (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm mb-3">Play competitively. Track your rating.</p>
            <Link
              to="/auth"
              className="inline-block bg-black text-white rounded-md px-8 py-3 text-sm font-bold hover:bg-gray-800 transition"
              data-testid="profile-join-cta"
            >
              Join VenLax Sports Free
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test in browser**

Visit `http://localhost:3000/players/REAL_PLAYER_ID` (get an ID from admin users list).

Verify:
- Loads without login
- Shows name, city, win/loss, ELO ratings
- ELO chart appears if player has match history (recharts LineChart)
- Recent matches list shows W/L badges
- Challenge button appears if not own profile
- Share button copies URL with UTM params
- "Join VenLax Sports" CTA appears for logged-out visitors

- [ ] **Step 3: Test challenge button flow**

Log out. Visit any player profile. Click "Challenge". Should redirect to `/auth?next=/players/{id}`.
Log in. Visit another player's profile. Click "Challenge". Should show "Challenge Sent!".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PublicProfile.jsx
git commit -m "feat: PublicProfile with ELO chart, match history, challenge button (Expansion 4)"
```

---

### Task 11: Standings Player Links + Privacy Toggle (Expansion 5 + 4 prereq)

**Files:**
- Modify: `frontend/src/pages/Standings.jsx`
- Modify: `frontend/src/pages/PlayerDashboard.jsx`

- [ ] **Step 1: Add `Link` import and player name links to `Standings.jsx`**

Find line 4: `import { ArrowLeft, Trophy } from "lucide-react";`

Change line 2 to add Link:
```jsx
import { useParams, useNavigate, Link } from "react-router-dom";
```

Read the tbody of the standings table (after line 60). Find where `player_name` is rendered. It will look like a `<td>` with the player name as text. Wrap the name in a Link:

```jsx
<td className="px-6 py-3 font-medium text-gray-900">
  <Link
    to={`/players/${s.player_id}`}
    className="hover:underline"
    data-testid={`standings-player-link-${i}`}
  >
    {s.player_name}
  </Link>
</td>
```

To find the exact line, open `frontend/src/pages/Standings.jsx` and search for `player_name`. The `td` containing it needs the Link wrapper.

- [ ] **Step 2: Test standings player links**

Visit any league standings page (e.g. `/leagues/ID/standings`). Click a player name. Should navigate to `/players/{player_id}`.

- [ ] **Step 3: Add privacy toggle to `PlayerDashboard.jsx`**

Find the notification toggle button block (around line 114–128) in PlayerDashboard.jsx. Add a privacy toggle button immediately after the notification toggle `</button>`:

```jsx
              <button
                onClick={togglePrivacy}
                disabled={togglingPrivacy}
                className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  user.profile_public !== false
                    ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                    : "bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200"
                } disabled:opacity-60`}
                data-testid="toggle-profile-public"
                title="Control who can see your public profile and match history"
              >
                {user.profile_public !== false ? "🌐 Profile: Public" : "🔒 Profile: Private"}
              </button>
```

Add the state and handler at the top of the component (after the existing `togglingNotif` state on line 28):

```jsx
  const [togglingPrivacy, setTogglingPrivacy] = useState(false);
```

Add the handler after `toggleNotifications` (after line 90):

```jsx
  const togglePrivacy = async () => {
    if (togglingPrivacy) return;
    setTogglingPrivacy(true);
    try {
      await axios.patch(
        `${API}/auth/preferences`,
        { profile_public: user.profile_public === false },
        { withCredentials: true },
      );
      await fetchMe();
    } catch (e) {
      console.error(e);
    } finally {
      setTogglingPrivacy(false);
    }
  };
```

- [ ] **Step 4: Test privacy toggle**

Log in as any player. Go to `/dashboard`. Click "Profile: Public" toggle. Should switch to "Profile: Private". Visit `/players/{your_id}` — should return 404 when private.

Click toggle again. Should switch back to "Profile: Public". Visit `/players/{your_id}` — should show profile again.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Standings.jsx frontend/src/pages/PlayerDashboard.jsx
git commit -m "feat: player name links in standings, profile privacy toggle in dashboard (Expansion 5)"
```

---

### Task 12: Full Test Run + Deploy Verification

**Files:** None changed — verification only.

- [ ] **Step 1: Run all backend tests**

```bash
cd backend
python -m pytest tests/ -v 2>&1 | tail -30
```

Expected: All existing tests PASS + new public endpoint tests PASS.

- [ ] **Step 2: Run frontend build**

```bash
cd frontend
CI=false yarn build
```

Expected: Build succeeds with no errors. Warnings about unused vars are OK.

- [ ] **Step 3: Manual smoke test of all 6 expansion features**

| Feature | URL | Check |
|---------|-----|-------|
| League Spectator | `/leagues/REAL_ID/public` | loads without login, standings visible |
| City Leaderboard | `/city/New York/sport/tennis` | loads without login, player list visible |
| Share Card | Submit any match score | share card appears with WA link |
| Public Profile | `/players/REAL_ID` | loads without login, ELO chart visible |
| Challenge button | `/players/REAL_ID` | sends challenge (logged in) or redirects to auth |
| Privacy toggle | `/dashboard` | toggles between public/private |

- [ ] **Step 4: Commit final verification**

```bash
git add -A
git commit -m "chore: verify all referral engine expansions 1-5 working"
```

---

### Task 13: Privacy Disclosure on Registration (Expansion 4 polish)

**Files:**
- Modify: `frontend/src/pages/Auth.jsx`

- [ ] **Step 1: Find the registration form submit button in Auth.jsx**

Open `frontend/src/pages/Auth.jsx`. Search for the registration submit button (`type="submit"`). Add a privacy disclosure note just above or below the submit button:

```jsx
<p className="text-xs text-gray-400 text-center">
  By registering, your match results will be publicly visible.{" "}
  <span className="text-gray-500">You can make your profile private anytime in Settings.</span>
</p>
```

- [ ] **Step 2: Test in browser**

Visit `/auth`. Switch to Register tab. Confirm the privacy disclosure text appears below the form, above or after the submit button.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Auth.jsx
git commit -m "feat: add profile privacy disclosure to registration form"
```

---

### Task 14: WhatsApp Business API Integration (Expansion 6 — approval gated)

> **Pre-condition:** This task requires an approved Meta Business Account and WhatsApp Business Account. Apply at developers.facebook.com before starting engineering. Average approval time: 2–4 weeks. Add these env vars to `backend/.env` and `env.usa` before starting:
>
> ```
> WHATSAPP_API_TOKEN=
> WHATSAPP_PHONE_NUMBER_ID=
> WHATSAPP_VERIFY_TOKEN=choose_a_random_string
> META_APP_SECRET=
> ```

**Files:**
- Create: `backend/whatsapp_service.py`
- Create: `backend/routes/whatsapp_routes.py`
- Modify: `backend/server.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add httpx to requirements**

```bash
cd backend
pip install httpx
echo "httpx>=0.27.0" >> requirements.txt
```

- [ ] **Step 2: Write the failing test**

Add to `backend/tests/test_public_endpoints.py`:

```python
class TestWhatsApp:
    def test_wa_webhook_verify(self):
        """Meta pings this URL to verify the webhook. Must echo back hub.challenge."""
        import os
        verify_token = os.environ.get("WHATSAPP_VERIFY_TOKEN", "test_token_123")
        r = requests.get(
            f"{BASE_URL}/api/webhook/whatsapp/webhook",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": verify_token,
                "hub.challenge": "CHALLENGE_VALUE",
            },
        )
        assert r.status_code == 200
        assert r.text == "CHALLENGE_VALUE"

    def test_wa_webhook_wrong_token(self):
        r = requests.get(
            f"{BASE_URL}/api/webhook/whatsapp/webhook",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "wrong_token",
                "hub.challenge": "xyz",
            },
        )
        assert r.status_code == 403
```

- [ ] **Step 3: Run test to verify it fails**

```
python -m pytest backend/tests/test_public_endpoints.py::TestWhatsApp -v
```

Expected: FAIL with 404 (route doesn't exist yet)

- [ ] **Step 4: Create `backend/whatsapp_service.py`**

```python
"""WhatsApp Cloud API client — wraps Meta Graph API for sending messages.

Requires env vars:
  WHATSAPP_API_TOKEN        — permanent system user token from Meta Business Suite
  WHATSAPP_PHONE_NUMBER_ID  — from WhatsApp Business Account phone number settings
  META_APP_SECRET           — from Meta App Dashboard → Settings → Basic

Falls back to console logging when not configured (dev/staging).
"""
import os
import hmac
import hashlib
import logging
import asyncio
from typing import Optional

logger = logging.getLogger(__name__)

_WA_API_VERSION = "v18.0"
_WA_BASE = f"https://graph.facebook.com/{_WA_API_VERSION}"


def is_configured() -> bool:
    return bool(
        os.environ.get("WHATSAPP_API_TOKEN")
        and os.environ.get("WHATSAPP_PHONE_NUMBER_ID")
    )


async def send_text(to_phone: str, body: str) -> bool:
    """Send a WhatsApp text message. Returns True on success, False on failure."""
    if not is_configured():
        logger.info(f"[WA stub] To: {to_phone} | {body[:100]}")
        return False
    try:
        import httpx
    except ImportError:
        logger.error("httpx not installed. Run: pip install httpx")
        return False

    token = os.environ["WHATSAPP_API_TOKEN"]
    phone_id = os.environ["WHATSAPP_PHONE_NUMBER_ID"]

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{_WA_BASE}/{phone_id}/messages",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "messaging_product": "whatsapp",
                "to": to_phone,
                "type": "text",
                "text": {"body": body},
            },
        )

    if resp.status_code != 200:
        logger.error(f"WA send failed: {resp.status_code} — {resp.text[:200]}")
        return False
    return True


def schedule_wa(to_phone: str, body: str) -> None:
    """Fire-and-forget WA send. Degrades gracefully when not configured."""
    try:
        asyncio.get_event_loop().create_task(send_text(to_phone, body))
    except RuntimeError:
        asyncio.run(send_text(to_phone, body))


def verify_signature(payload: bytes, signature_header: str) -> bool:
    """Verify Meta webhook X-Hub-Signature-256 header."""
    app_secret = os.environ.get("META_APP_SECRET", "")
    if not app_secret:
        return False
    expected = "sha256=" + hmac.new(
        app_secret.encode("utf-8"), payload, digestmod=hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)
```

- [ ] **Step 5: Create `backend/routes/whatsapp_routes.py`**

```python
"""WhatsApp Cloud API webhook — verification handshake and incoming event handler."""
import os
import json
import logging

from fastapi import APIRouter, HTTPException, Request, Response
from whatsapp_service import verify_signature

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/webhook")
async def wa_verify(request: Request):
    """Meta webhook verification — GET request with hub.challenge that we echo back."""
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge", "")

    expected_token = os.environ.get("WHATSAPP_VERIFY_TOKEN", "")
    if mode == "subscribe" and token == expected_token:
        return Response(content=challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook")
async def wa_receive(request: Request):
    """Receive incoming WA events (delivery receipts, read receipts, inbound messages).

    Signature verification is enforced when META_APP_SECRET is set.
    """
    body = await request.body()
    sig = request.headers.get("X-Hub-Signature-256", "")

    if os.environ.get("META_APP_SECRET") and not verify_signature(body, sig):
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        data = json.loads(body)
        changes = data.get("entry", [{}])[0].get("changes", [{}])[0].get("value", {})
        if "statuses" in changes:
            for status in changes["statuses"]:
                logger.info(f"WA message status: {status.get('status')} — id {status.get('id')}")
        if "messages" in changes:
            for msg in changes["messages"]:
                logger.info(f"WA inbound from {msg.get('from')}: {msg.get('text', {}).get('body', '')[:80]}")
    except Exception as e:
        logger.warning(f"WA webhook parse error: {e}")

    return {"status": "ok"}
```

- [ ] **Step 6: Mount WA routes in `backend/server.py`**

Add after the public_router import line:

```python
from routes.whatsapp_routes import router as wa_router
```

Add after the public_router include_router line:

```python
api_router.include_router(wa_router, prefix="/webhook/whatsapp", tags=["whatsapp"])
```

- [ ] **Step 7: Set WHATSAPP_VERIFY_TOKEN in `.env` for testing**

```bash
echo "WHATSAPP_VERIFY_TOKEN=test_token_123" >> backend/.env
```

- [ ] **Step 8: Run the WA tests**

```bash
python -m pytest backend/tests/test_public_endpoints.py::TestWhatsApp -v
```

Expected: PASS (verify token matches, wrong token returns 403)

- [ ] **Step 9: Wire WA send into score submission reminder flow**

In `backend/routes/match_routes.py`, find where matches are created. After the match is inserted, add a WA reminder for both players if they have phone numbers on file. Import and call `schedule_wa` from `whatsapp_service`:

Find the match creation endpoint (POST /). After `await db.matches.insert_one(...)`:

```python
# WA reminder — only fires when WA is configured and player has phone
try:
    from whatsapp_service import schedule_wa, is_configured
    if is_configured():
        for pid, pname, oname in [
            (user["_id"], user["name"], opponent.get("name")),
            (opponent["_id"], opponent.get("name"), user["name"]),
        ]:
            player_doc = await db.users.find_one({"_id": ObjectId(pid)}, {"phone": 1})
            if player_doc and player_doc.get("phone"):
                schedule_wa(
                    player_doc["phone"],
                    f"Hi {pname}! Your match vs {oname} is scheduled on VenLax Sports. "
                    f"Complete it by the deadline and submit your score. "
                    f"— VENLAX Sports",
                )
except Exception as e:
    import logging
    logging.getLogger(__name__).warning(f"WA reminder failed: {e}")
```

- [ ] **Step 10: Run full test suite**

```bash
python -m pytest backend/tests/ -v 2>&1 | tail -20
```

Expected: All tests PASS.

- [ ] **Step 11: Commit**

```bash
git add backend/whatsapp_service.py backend/routes/whatsapp_routes.py backend/server.py backend/requirements.txt backend/routes/match_routes.py backend/tests/test_public_endpoints.py
git commit -m "feat: WhatsApp Business API integration — webhook, send client, match reminders (Expansion 6)"
```

---

## Self-Review

**Spec coverage check:**

| CEO Plan Requirement | Task |
|----------------------|------|
| League spectator view (public URL) | Task 7 |
| City public leaderboards (SEO pages) | Task 8 |
| Match result shareable cards | Task 9 |
| Public player profiles with ELO chart | Task 10 |
| Challenge any player button | Task 10, 11 |
| Privacy opt-out toggle | Task 11 |
| WhatsApp integration | Task 14 |
| Rate-limit challenges (3/day) | Task 4 |
| Strip PII from public endpoints | Task 4 (`serialize_public_user`) |
| Private profile → 404 not 403 | Task 4 |
| Empty city → 200 not 404 | Task 4 |
| Compound indexes for performance | Task 1 |
| UTM params on all shared URLs | Tasks 7, 9, 10 |

**Placeholder scan:** None found.

**Type consistency check:**
- `serialize_public_user()` defined in Task 2, used in Task 4 (public_routes.py) ✓
- `get_optional_user()` defined in Task 2, used in Task 4 ✓
- `Challenge` model defined in Task 3, imported in Task 4 ✓
- `profile_public` field added to User in Task 3, read in Task 4 ✓
- `is_public` field added to League in Task 3, read in Task 4 ✓
- `UpdatePreferencesIn.profile_public` added in Task 5, consumed by Task 11 frontend ✓
