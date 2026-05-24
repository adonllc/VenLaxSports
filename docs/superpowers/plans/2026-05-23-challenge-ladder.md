# Challenge Ladder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an always-on ranked ladder per city/sport/division. Players join free, challenge anyone above them, swap ranks on win, 48h cooldown between challenges.

**Architecture:** Two new MongoDB collections (`ladders`, `ladder_challenges`). New `backend/routes/ladder_routes.py` with 7 endpoints. Match score handler extended to swap ranks after ladder matches. Two new frontend pages (`/ladders`, `/ladders/:id`). Ladder ranking card added to PlayerDashboard.

**Tech Stack:** FastAPI/Python, Motor (async MongoDB), React 19 + Tailwind v3.

**Prerequisite:** Skill Division Routing plan must be implemented first (division_label used in Ladder model).

---

## File Structure

| File | Change |
|---|---|
| `backend/models.py` | Add `Ladder` and `LadderChallenge` models |
| `backend/routes/ladder_routes.py` | Create — 7 endpoints |
| `backend/routes/match_routes.py` | Extend score handler to process ladder rank swaps |
| `backend/server.py` | Mount ladder_router |
| `backend/seeds/indexes.py` | Add 3 ladder indexes |
| `backend/tests/test_api.py` | Ladder API tests |
| `frontend/src/pages/Ladders.jsx` | Create — ladder listing page |
| `frontend/src/pages/LadderDetail.jsx` | Create — single ladder ranked list + challenge UI |
| `frontend/src/pages/PlayerDashboard.jsx` | Add ladder rankings card |
| `frontend/src/App.js` | Add /ladders and /ladders/:id routes |
| `frontend/src/components/Navbar.jsx` | Add Ladders nav link |

---

### Task 1: Backend — Ladder and LadderChallenge models

**Files:**
- Modify: `backend/models.py`

- [ ] **Step 1: Write the failing test**

```python
# In backend/tests/test_api.py — add TestLadders class:
class TestLadders:
    def test_create_ladder(self):
        s = get_admin_session()
        r = s.post(f"{BASE_URL}/api/ladders", json={
            "city": "Austin",
            "sport": "tennis",
            "division_label": "Intermediate",
            "format": "singles",
        })
        assert r.status_code in [200, 201]
        data = r.json()
        assert data["city"] == "Austin"
        assert data["sport"] == "tennis"
        assert data["entries"] == []
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py::TestLadders::test_create_ladder -v
```
Expected: FAIL — 404 (route doesn't exist yet)

- [ ] **Step 3: Add Ladder and LadderChallenge models to models.py**

In `backend/models.py`, at the end of the file, add:

```python
# ─── Ladder ──────────────────────────────────────────
class Ladder(BaseDocument):
    city: str
    sport: str                          # "tennis" | "pickleball"
    division_label: str                 # "Beginner" | "Intermediate" | "Advanced" | "Competitive"
    format: str = "singles"             # "singles" (doubles v2)
    entries: list = []
    # entry shape: {player_id, rank, elo, name, joined_at, challenge_cooldown_until}
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class LadderCreate(BaseModel):
    city: str
    sport: str
    division_label: str
    format: str = "singles"


# ─── LadderChallenge ─────────────────────────────────
class LadderChallenge(BaseDocument):
    ladder_id: str
    challenger_id: str
    challenged_id: str
    challenger_rank: int
    challenged_rank: int
    status: str = "pending"             # "pending"|"accepted"|"declined"|"completed"|"expired"
    match_id: Optional[str] = None
    expires_at: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class LadderChallengeCreate(BaseModel):
    ladder_id: str
    challenged_player_id: str
```

- [ ] **Step 4: Commit**

```bash
git add backend/models.py
git commit -m "feat(ladder): add Ladder and LadderChallenge models"
```

---

### Task 2: Backend — Create ladder_routes.py (GET /ladders, POST /ladders, GET /ladders/:id)

**Files:**
- Create: `backend/routes/ladder_routes.py`

- [ ] **Step 1: Create the file with GET and POST /ladders**

Create `backend/routes/ladder_routes.py`:

```python
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from models import LadderCreate, LadderChallengeCreate
from auth_utils import get_current_user, require_admin, get_optional_user

router = APIRouter(redirect_slashes=False)


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
@router.get("/")
async def list_ladders(
    request: Request,
    city: Optional[str] = None,
    sport: Optional[str] = None,
    division: Optional[str] = None,
    format: Optional[str] = None,
):
    db = request.app.state.db
    query: dict = {"is_active": True}
    if city:
        query["city"] = city
    if sport:
        query["sport"] = sport
    if division:
        query["division_label"] = division
    if format:
        query["format"] = format
    ladders = await db.ladders.find(query).sort("created_at", -1).to_list(50)
    result = []
    for l in ladders:
        l["id"] = str(l.pop("_id"))
        l["entry_count"] = len(l.get("entries", []))
        l["top_players"] = l.get("entries", [])[:3]
        result.append(l)
    return result


@router.post("")
@router.post("/")
async def create_ladder(data: LadderCreate, request: Request):
    db = request.app.state.db
    await require_admin(request, db)
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "city": data.city,
        "sport": data.sport,
        "division_label": data.division_label,
        "format": data.format,
        "entries": [],
        "is_active": True,
        "created_at": now_iso,
    }
    result = await db.ladders.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.get("/{ladder_id}")
async def get_ladder(ladder_id: str, request: Request):
    db = request.app.state.db
    optional_user = await get_optional_user(request, db)
    try:
        ladder = await db.ladders.find_one({"_id": ObjectId(ladder_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Ladder not found")
    if not ladder:
        raise HTTPException(status_code=404, detail="Ladder not found")

    ladder["id"] = str(ladder.pop("_id"))
    entries = ladder.get("entries", [])
    now = datetime.now(timezone.utc)

    if optional_user:
        uid = optional_user["_id"]
        my_rank = next((e["rank"] for e in entries if e["player_id"] == uid), None)
        for entry in entries:
            is_above = my_rank and entry["rank"] < my_rank
            # Check if user already has active challenge
            active_challenge = await db.ladder_challenges.find_one({
                "ladder_id": ladder_id,
                "challenger_id": uid,
                "status": "pending",
            })
            cooldown_until = None
            my_entry = next((e for e in entries if e["player_id"] == uid), None)
            if my_entry:
                cooldown_until = my_entry.get("challenge_cooldown_until")

            on_cooldown = bool(cooldown_until and datetime.fromisoformat(cooldown_until) > now)
            entry["can_challenge"] = bool(
                is_above and not active_challenge and not on_cooldown
            )
        ladder["my_rank"] = my_rank
        ladder["my_cooldown_until"] = next(
            (e.get("challenge_cooldown_until") for e in entries if e["player_id"] == uid), None
        )

    ladder["entry_count"] = len(entries)
    return ladder
```

- [ ] **Step 2: Mount in server.py**

In `backend/server.py`:
```python
from routes.ladder_routes import router as ladder_router
```

After last `api_router.include_router` line:
```python
api_router.include_router(ladder_router, prefix="/ladders", tags=["ladders"])
```

- [ ] **Step 3: Run the failing test now that route exists**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py::TestLadders::test_create_ladder -v
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/routes/ladder_routes.py backend/server.py backend/tests/test_api.py
git commit -m "feat(ladder): GET /ladders, POST /ladders, GET /ladders/:id"
```

---

### Task 3: Backend — POST /ladders/:id/join (ELO-seeded)

**Files:**
- Modify: `backend/routes/ladder_routes.py`

- [ ] **Step 1: Write the failing test**

```python
# In TestLadders:
def test_join_ladder(self):
    s = get_admin_session()
    # Get any active ladder
    r = requests.get(f"{BASE_URL}/api/ladders")
    ladders = r.json()
    if not ladders:
        pytest.skip("No ladders available")
    lid = ladders[0]["id"]
    r = s.post(f"{BASE_URL}/api/ladders/{lid}/join")
    assert r.status_code in [200, 201, 400]  # 400 = already joined
    if r.status_code in [200, 201]:
        data = r.json()
        assert "rank" in data
        assert data["rank"] >= 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py::TestLadders::test_join_ladder -v
```
Expected: FAIL — 404

- [ ] **Step 3: Add join endpoint to ladder_routes.py**

```python
@router.post("/{ladder_id}/join")
async def join_ladder(ladder_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    uid = user["_id"]

    try:
        ladder = await db.ladders.find_one({"_id": ObjectId(ladder_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Ladder not found")
    if not ladder:
        raise HTTPException(status_code=404, detail="Ladder not found")

    entries = ladder.get("entries", [])
    # Check already joined
    if any(e["player_id"] == uid for e in entries):
        raise HTTPException(status_code=400, detail="Already in this ladder")

    sport = ladder.get("sport", "tennis")
    elo_field = f"{sport}_rating"
    my_elo = user.get(elo_field, 1500)
    now_iso = datetime.now(timezone.utc).isoformat()

    new_entry = {
        "player_id": uid,
        "name": user.get("name", ""),
        "elo": my_elo,
        "joined_at": now_iso,
        "challenge_cooldown_until": None,
    }

    # Insert in ELO order (above players with lower ELO)
    insert_pos = len(entries)
    for i, e in enumerate(entries):
        if my_elo > e.get("elo", 0):
            insert_pos = i
            break

    entries.insert(insert_pos, new_entry)

    # Re-rank all entries (rank = 1-based index)
    for i, e in enumerate(entries):
        e["rank"] = i + 1

    await db.ladders.update_one(
        {"_id": ObjectId(ladder_id)},
        {"$set": {"entries": entries}},
    )

    new_entry["rank"] = insert_pos + 1
    return new_entry
```

- [ ] **Step 4: Run test to verify it passes**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py::TestLadders::test_join_ladder -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routes/ladder_routes.py backend/tests/test_api.py
git commit -m "feat(ladder): join ladder with ELO-based seeding"
```

---

### Task 4: Backend — POST /ladder-challenges + PATCH accept/decline

**Files:**
- Modify: `backend/routes/ladder_routes.py`

- [ ] **Step 1: Write the failing test**

```python
# In TestLadders:
def test_challenge_requires_auth(self):
    r = requests.post(f"{BASE_URL}/api/ladder-challenges", json={
        "ladder_id": "fakeid",
        "challenged_player_id": "fakeid2",
    })
    assert r.status_code in [401, 403, 422]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py::TestLadders::test_challenge_requires_auth -v
```
Expected: FAIL — 404

- [ ] **Step 3: Add challenge endpoints to ladder_routes.py**

```python
@router.post("/challenges")
async def create_challenge(data: LadderChallengeCreate, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    uid = user["_id"]
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    try:
        ladder = await db.ladders.find_one({"_id": ObjectId(data.ladder_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Ladder not found")
    if not ladder:
        raise HTTPException(status_code=404, detail="Ladder not found")

    entries = ladder.get("entries", [])
    my_entry = next((e for e in entries if e["player_id"] == uid), None)
    if not my_entry:
        raise HTTPException(status_code=400, detail="You are not in this ladder")

    challenged_entry = next((e for e in entries if e["player_id"] == data.challenged_player_id), None)
    if not challenged_entry:
        raise HTTPException(status_code=400, detail="Challenged player is not in this ladder")

    if challenged_entry["rank"] >= my_entry["rank"]:
        raise HTTPException(status_code=400, detail="You can only challenge players ranked above you")

    # Cooldown check
    cooldown = my_entry.get("challenge_cooldown_until")
    if cooldown and datetime.fromisoformat(cooldown) > now:
        raise HTTPException(status_code=400, detail=f"Challenge cooldown active until {cooldown}")

    # Active outgoing challenge check
    existing = await db.ladder_challenges.find_one({
        "ladder_id": data.ladder_id,
        "challenger_id": uid,
        "status": "pending",
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active outgoing challenge")

    expires_at = (now + timedelta(hours=72)).isoformat()
    challenge_doc = {
        "ladder_id": data.ladder_id,
        "challenger_id": uid,
        "challenged_id": data.challenged_player_id,
        "challenger_rank": my_entry["rank"],
        "challenged_rank": challenged_entry["rank"],
        "status": "pending",
        "match_id": None,
        "expires_at": expires_at,
        "created_at": now_iso,
    }
    result = await db.ladder_challenges.insert_one(challenge_doc)
    challenge_doc["id"] = str(result.inserted_id)
    challenge_doc.pop("_id", None)

    # Email challenged player
    import email_service
    challenged_user = await db.users.find_one({"_id": ObjectId(data.challenged_player_id)}, {"email": 1, "name": 1, "email_notifications": 1})
    challenger_name = user.get("name", "A player")
    ladder_name = f"{ladder['city']} {ladder['division_label']} {ladder['sport'].title()} Ladder"
    if challenged_user and challenged_user.get("email") and challenged_user.get("email_notifications", True):
        expires_display = (now + timedelta(hours=72)).strftime("%b %d at %I:%M %p UTC")
        await email_service.send_email(
            to=challenged_user["email"],
            subject=f"{challenger_name} has challenged you on the VENLAX Ladder",
            body=f"You've been challenged on the {ladder_name} (Singles). Accept by {expires_display}.",
        )

    return challenge_doc


@router.patch("/challenges/{challenge_id}/accept")
async def accept_challenge(challenge_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    uid = user["_id"]

    try:
        challenge = await db.ladder_challenges.find_one({"_id": ObjectId(challenge_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if challenge["challenged_id"] != uid:
        raise HTTPException(status_code=403, detail="Not your challenge to accept")
    if challenge["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Challenge is {challenge['status']}")

    # Check expiry
    if datetime.fromisoformat(challenge["expires_at"]) < datetime.now(timezone.utc):
        await db.ladder_challenges.update_one({"_id": ObjectId(challenge_id)}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=400, detail="Challenge has expired")

    # Fetch ladder for sport/city info
    ladder = await db.ladders.find_one({"_id": ObjectId(challenge["ladder_id"])})
    sport = ladder["sport"] if ladder else "tennis"

    # Fetch player names
    challenger = await db.users.find_one({"_id": ObjectId(challenge["challenger_id"])}, {"name": 1})
    challenged = await db.users.find_one({"_id": ObjectId(uid)}, {"name": 1})

    # Create match
    now_iso = datetime.now(timezone.utc).isoformat()
    match_doc = {
        "league_id": challenge["ladder_id"],  # ladder_id used as league reference
        "sport": sport,
        "player1_id": challenge["challenger_id"],
        "player2_id": uid,
        "player1_name": challenger.get("name", "") if challenger else "",
        "player2_name": challenged.get("name", "") if challenged else "",
        "scheduled_date": now_iso,
        "status": "scheduled",
        "source": "ladder",
        "ladder_challenge_id": challenge_id,
        "created_at": now_iso,
    }
    match_result = await db.matches.insert_one(match_doc)
    match_id = str(match_result.inserted_id)

    await db.ladder_challenges.update_one(
        {"_id": ObjectId(challenge_id)},
        {"$set": {"status": "accepted", "match_id": match_id}},
    )

    match_doc["id"] = match_id
    match_doc.pop("_id", None)
    return match_doc


@router.patch("/challenges/{challenge_id}/decline")
async def decline_challenge(challenge_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    uid = user["_id"]

    try:
        challenge = await db.ladder_challenges.find_one({"_id": ObjectId(challenge_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if challenge["challenged_id"] != uid:
        raise HTTPException(status_code=403, detail="Not your challenge to decline")
    if challenge["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Challenge is {challenge['status']}")

    await db.ladder_challenges.update_one(
        {"_id": ObjectId(challenge_id)},
        {"$set": {"status": "declined"}},
    )
    # No cooldown on decline — challenger can challenge again immediately
    return {"status": "declined"}
```

Note: The `/ladder-challenges` endpoints need to be mounted at `/ladders/challenges/...` or separately. Since the router is prefixed `/ladders`, use `@router.post("/challenges")` and mount as `/ladders/challenges`. Alternatively, mount a separate prefix. Use `/ladders/challenges` for simplicity.

- [ ] **Step 4: Run test to verify it passes**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py::TestLadders::test_challenge_requires_auth -v
```
Expected: PASS (401/403)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/ladder_routes.py backend/tests/test_api.py
git commit -m "feat(ladder): create/accept/decline challenge endpoints"
```

---

### Task 5: Backend — Extend match score handler for rank swaps

**Files:**
- Modify: `backend/routes/match_routes.py`

- [ ] **Step 1: Find the score update handler**

```bash
grep -n "score\|winner_id\|ELO\|rating" backend/routes/match_routes.py | head -30
```

- [ ] **Step 2: Add ladder rank swap logic after ELO update**

In `backend/routes/match_routes.py`, find the `PATCH /{match_id}/score` handler. After the ELO update block (look for `await db.users.update_one` calls updating ratings), add:

```python
    # ── Ladder rank swap (if this is a ladder challenge match) ──
    if match.get("source") == "ladder" and match.get("ladder_challenge_id"):
        try:
            challenge = await db.ladder_challenges.find_one(
                {"_id": ObjectId(match["ladder_challenge_id"])}
            )
            if challenge and challenge.get("status") == "accepted":
                ladder = await db.ladders.find_one(
                    {"_id": ObjectId(challenge["ladder_id"])}
                )
                if ladder:
                    entries = ladder.get("entries", [])
                    challenger_id = challenge["challenger_id"]
                    challenged_id = challenge["challenged_id"]
                    winner_id = score_data.winner_id  # from the score submission

                    # Update ELO in ladder entries
                    sport = ladder.get("sport", "tennis")
                    elo_field = f"{sport}_rating"
                    for entry in entries:
                        if entry["player_id"] == challenger_id:
                            u = await db.users.find_one({"_id": ObjectId(challenger_id)}, {elo_field: 1})
                            if u:
                                entry["elo"] = u.get(elo_field, entry["elo"])
                        elif entry["player_id"] == challenged_id:
                            u = await db.users.find_one({"_id": ObjectId(challenged_id)}, {elo_field: 1})
                            if u:
                                entry["elo"] = u.get(elo_field, entry["elo"])

                    # If challenger won: swap ranks
                    if winner_id == challenger_id:
                        c_idx = next((i for i, e in enumerate(entries) if e["player_id"] == challenger_id), None)
                        d_idx = next((i for i, e in enumerate(entries) if e["player_id"] == challenged_id), None)
                        if c_idx is not None and d_idx is not None:
                            entries[c_idx]["rank"], entries[d_idx]["rank"] = entries[d_idx]["rank"], entries[c_idx]["rank"]
                            entries[c_idx], entries[d_idx] = entries[d_idx], entries[c_idx]

                    # Apply 48h cooldown to challenger
                    from datetime import timedelta as _td
                    cooldown_until = (datetime.now(timezone.utc) + _td(hours=48)).isoformat()
                    for entry in entries:
                        if entry["player_id"] == challenger_id:
                            entry["challenge_cooldown_until"] = cooldown_until

                    # Re-number ranks sequentially
                    for i, e in enumerate(entries):
                        e["rank"] = i + 1

                    await db.ladders.update_one(
                        {"_id": ObjectId(challenge["ladder_id"])},
                        {"$set": {"entries": entries}},
                    )
                    await db.ladder_challenges.update_one(
                        {"_id": ObjectId(match["ladder_challenge_id"])},
                        {"$set": {"status": "completed"}},
                    )
        except Exception as ladder_err:
            # Non-fatal — log and continue, don't fail the score submission
            import logging
            logging.getLogger(__name__).warning(f"Ladder rank swap failed: {ladder_err}")
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/match_routes.py
git commit -m "feat(ladder): extend match score handler to swap ladder ranks on win"
```

---

### Task 6: Backend — Add indexes

**Files:**
- Modify: `backend/seeds/indexes.py`

- [ ] **Step 1: Add ladder indexes**

In `backend/seeds/indexes.py`, at the end of `create_indexes`, add:

```python
    # Challenge Ladder
    await db.ladders.create_index([("city", 1), ("sport", 1), ("division_label", 1), ("format", 1)])
    await db.ladder_challenges.create_index([("ladder_id", 1), ("status", 1)])
    await db.ladder_challenges.create_index([("challenger_id", 1), ("status", 1)])
```

- [ ] **Step 2: Run indexes (dev)**

```bash
cd backend
python -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
load_dotenv()
from seeds.indexes import create_indexes
async def run():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    await create_indexes(db)
    print('Indexes created')
asyncio.run(run())
"
```
Expected: prints "Indexes created" with no errors

- [ ] **Step 3: Commit**

```bash
git add backend/seeds/indexes.py
git commit -m "feat(ladder): add MongoDB indexes for ladders and ladder_challenges collections"
```

---

### Task 7: Frontend — Create Ladders.jsx listing page

**Files:**
- Create: `frontend/src/pages/Ladders.jsx`

- [ ] **Step 1: Create the file**

Create `frontend/src/pages/Ladders.jsx`:

```jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_COLORS = {
  tennis: "text-emerald-700 bg-emerald-50 border-emerald-200",
  pickleball: "text-orange-700 bg-orange-50 border-orange-200",
};

export default function Ladders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ladders, setLadders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ sport: "", division: "" });

  useEffect(() => {
    fetchLadders();
  }, [filters]);

  const fetchLadders = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.sport) params.sport = filters.sport;
      if (filters.division) params.division = filters.division;
      const { data } = await axios.get(`${API}/ladders`, { params });
      setLadders(data);
    } catch {
      setLadders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (ladderId) => {
    if (!user) { navigate("/auth"); return; }
    try {
      await axios.post(`${API}/ladders/${ladderId}/join`, {}, { withCredentials: true });
      navigate(`/ladders/${ladderId}`);
    } catch (err) {
      alert(err.response?.data?.detail || "Could not join ladder");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Challenge Ladders</h1>
          <p className="mt-2 text-gray-500">Always-on ranked play. Challenge anyone above you. No season needed.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {["", "tennis", "pickleball"].map((sport) => (
            <button
              key={sport || "all"}
              data-testid={`ladder-sport-filter-${sport || "all"}`}
              onClick={() => setFilters((f) => ({ ...f, sport }))}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filters.sport === sport
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {sport ? sport.charAt(0).toUpperCase() + sport.slice(1) : "All Sports"}
            </button>
          ))}
          <span className="mx-1 text-gray-300">|</span>
          {["", "Beginner", "Intermediate", "Advanced", "Competitive"].map((div) => (
            <button
              key={div || "all-div"}
              data-testid={`ladder-division-filter-${div || "all"}`}
              onClick={() => setFilters((f) => ({ ...f, division: div }))}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filters.division === div
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {div || "All Levels"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading ladders...</div>
        ) : ladders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No ladders found. Check back soon.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ladders.map((ladder) => (
              <div
                key={ladder.id}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${SPORT_COLORS[ladder.sport] || "text-gray-600 bg-gray-50 border-gray-200"}`}>
                      {ladder.sport}
                    </span>
                    <span className="ml-2 text-xs text-indigo-600 font-medium">
                      {ladder.division_label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{ladder.entry_count} players</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  {ladder.city} · {ladder.division_label} {ladder.sport.charAt(0).toUpperCase() + ladder.sport.slice(1)} Ladder
                </h3>
                <p className="text-sm text-gray-500 mb-4">Singles · Always open · Free to join</p>

                {/* Top 3 players */}
                {ladder.top_players?.length > 0 && (
                  <div className="space-y-1 mb-4">
                    {ladder.top_players.slice(0, 3).map((p, i) => (
                      <div key={p.player_id} className="flex items-center gap-2 text-sm">
                        <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                        <span className="text-gray-700">{p.name}</span>
                        <span className="ml-auto text-xs text-gray-400">{Math.round(p.elo)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    data-testid={`ladder-join-${ladder.id}`}
                    onClick={() => handleJoin(ladder.id)}
                    className="flex-1 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Join Ladder
                  </button>
                  <button
                    data-testid={`ladder-view-${ladder.id}`}
                    onClick={() => navigate(`/ladders/${ladder.id}`)}
                    className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:border-gray-400 transition-colors"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add route in App.js**

In `frontend/src/App.js`, add imports and routes:
```jsx
import Ladders from "./pages/Ladders";
import LadderDetail from "./pages/LadderDetail";
```

Inside the `<Routes>` block, add:
```jsx
<Route path="/ladders" element={<Ladders />} />
<Route path="/ladders/:id" element={<LadderDetail />} />
```

- [ ] **Step 3: Add Ladders link to Navbar**

In `frontend/src/components/Navbar.jsx`, find the nav links (look for `<Link to="/leagues">`). Add:
```jsx
<Link to="/ladders" className="...same classes as other nav links...">Ladders</Link>
```

- [ ] **Step 4: Test in browser**

```bash
cd frontend && yarn start
```
Open http://localhost:3000/ladders — ladder list renders. Join button requires auth.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Ladders.jsx frontend/src/App.js frontend/src/components/Navbar.jsx
git commit -m "feat(ladder): Ladders listing page + nav link + routes"
```

---

### Task 8: Frontend — Create LadderDetail.jsx

**Files:**
- Create: `frontend/src/pages/LadderDetail.jsx`

- [ ] **Step 1: Create the file**

Create `frontend/src/pages/LadderDetail.jsx`:

```jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function LadderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ladder, setLadder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [challengingId, setChallengingId] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchLadder();
  }, [id]);

  const fetchLadder = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/ladders/${id}`, { withCredentials: true });
      setLadder(data);
    } catch {
      setLadder(null);
    } finally {
      setLoading(false);
    }
  };

  const handleChallenge = async (challengedPlayerId) => {
    setChallengingId(challengedPlayerId);
    try {
      await axios.post(`${API}/ladders/challenges`, {
        ladder_id: id,
        challenged_player_id: challengedPlayerId,
      }, { withCredentials: true });
      setMsg("Challenge sent! They have 72 hours to accept.");
      fetchLadder();
    } catch (err) {
      setMsg(err.response?.data?.detail || "Could not send challenge");
    } finally {
      setChallengingId(null);
    }
  };

  const handleJoin = async () => {
    if (!user) { navigate("/auth"); return; }
    try {
      await axios.post(`${API}/ladders/${id}/join`, {}, { withCredentials: true });
      fetchLadder();
    } catch (err) {
      setMsg(err.response?.data?.detail || "Could not join");
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>;
  if (!ladder) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Ladder not found</div>;

  const isInLadder = ladder.my_rank != null;
  const onCooldown = ladder.my_cooldown_until && new Date(ladder.my_cooldown_until) > new Date();
  const cooldownDisplay = onCooldown
    ? `Cooldown until ${new Date(ladder.my_cooldown_until).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <button onClick={() => navigate("/ladders")} className="hover:text-gray-700">← Ladders</button>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {ladder.city} · {ladder.division_label} {ladder.sport.charAt(0).toUpperCase() + ladder.sport.slice(1)} Ladder
          </h1>
          <p className="text-gray-500 mt-1">Singles · {ladder.entry_count} players · Always open</p>
        </div>

        {/* My rank banner */}
        {isInLadder && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-indigo-800">Your Rank</p>
              <p className="text-2xl font-bold text-indigo-900">#{ladder.my_rank} of {ladder.entry_count}</p>
            </div>
            {cooldownDisplay && (
              <span className="text-xs text-orange-700 bg-orange-100 px-3 py-1.5 rounded-md font-medium">
                {cooldownDisplay}
              </span>
            )}
          </div>
        )}

        {msg && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
            {msg}
          </div>
        )}

        {/* Join CTA */}
        {!isInLadder && (
          <div className="mb-6">
            <button
              data-testid="ladder-detail-join"
              onClick={handleJoin}
              className="w-full py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-700 transition-colors"
            >
              Join this Ladder
            </button>
          </div>
        )}

        {/* Ranked list */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Rankings</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {(ladder.entries || []).map((entry) => {
              const isMe = user && entry.player_id === user.id;
              const canChallenge = isInLadder && entry.can_challenge && !onCooldown;
              return (
                <div
                  key={entry.player_id}
                  data-testid={`ladder-entry-${entry.rank}`}
                  className={`px-4 py-3 flex items-center gap-3 ${isMe ? "bg-indigo-50" : ""}`}
                >
                  <span className="w-8 text-sm font-bold text-gray-400">#{entry.rank}</span>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isMe ? "text-indigo-900" : "text-gray-900"}`}>
                      {entry.name} {isMe && <span className="text-xs text-indigo-500">(you)</span>}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400 font-mono">{Math.round(entry.elo)}</span>
                  {canChallenge && (
                    <button
                      data-testid={`challenge-btn-${entry.player_id}`}
                      onClick={() => handleChallenge(entry.player_id)}
                      disabled={challengingId === entry.player_id}
                      className="px-3 py-1 text-xs font-semibold bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                      {challengingId === entry.player_id ? "..." : "Challenge"}
                    </button>
                  )}
                  {isInLadder && !isMe && !canChallenge && entry.rank > ladder.my_rank && (
                    <span className="text-xs text-gray-300">below you</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test in browser**

- Open http://localhost:3000/ladders/:id
- Ranked list renders
- Join button appears if not in ladder
- "Challenge" button appears on players above auth user
- Clicking challenge sends API call, shows success message

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/LadderDetail.jsx
git commit -m "feat(ladder): LadderDetail page with ranked list + challenge UI"
```

---

### Task 9: Frontend — Ladder rankings card in PlayerDashboard

**Files:**
- Modify: `frontend/src/pages/PlayerDashboard.jsx`

- [ ] **Step 1: Fetch ladder entries for current user**

In `PlayerDashboard.jsx`, add state: `const [ladderEntries, setLadderEntries] = useState([])`.

After user loads, fetch ladders the user is in:

```js
const fetchLadderRankings = async () => {
  try {
    const { data } = await axios.get(`${API}/ladders`, { withCredentials: true });
    const myEntries = [];
    for (const ladder of data) {
      const myEntry = (ladder.entries || []).find(e => e.player_id === user?.id);
      if (myEntry) {
        myEntries.push({
          ladder_id: ladder.id,
          city: ladder.city,
          sport: ladder.sport,
          division_label: ladder.division_label,
          rank: myEntry.rank,
          total: ladder.entry_count,
          cooldown_until: myEntry.challenge_cooldown_until,
        });
      }
    }
    setLadderEntries(myEntries);
  } catch {}
};
```

Call `fetchLadderRankings()` in the dashboard `useEffect`.

- [ ] **Step 2: Render ladder rankings card**

In the dashboard JSX, add a "Ladder Rankings" section (alongside or below registered leagues):

```jsx
{ladderEntries.length > 0 && (
  <div className="mt-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-3">Ladder Rankings</h3>
    <div className="space-y-3">
      {ladderEntries.map((entry) => (
        <div key={entry.ladder_id} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate(`/ladders/${entry.ladder_id}`)}>
          <div>
            <p className="font-semibold text-gray-900">
              {entry.city} · {entry.division_label} {entry.sport.charAt(0).toUpperCase() + entry.sport.slice(1)}
            </p>
            <p className="text-sm text-gray-500">Rank #{entry.rank} of {entry.total}</p>
          </div>
          <span className="text-2xl font-bold text-indigo-700">#{entry.rank}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PlayerDashboard.jsx
git commit -m "feat(ladder): ladder rankings card in PlayerDashboard"
```
