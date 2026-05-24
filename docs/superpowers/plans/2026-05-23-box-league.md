# Box League Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add box league format — groups of 6 players in a "box" play each other (5 matches), with top 2 promoting and bottom 2 relegating at season end.

**Architecture:** Extend `League` model with `league_type: "box_league"` and box config fields. New `backend/routes/box_league_routes.py` handles 3 endpoints: assign-boxes (serpentine ELO grouping), standings (per-box sorted), finalize (promotion/relegation flags + emails). Frontend adds box tabs to LeagueDetail and a box status card to PlayerDashboard.

**Tech Stack:** FastAPI/Python, Motor (async MongoDB), React 19 + Tailwind v3.

**Prerequisite:** Skill Division Routing plan must be implemented first (adds `division_label` to League model).

---

## File Structure

| File | Change |
|---|---|
| `backend/models.py` | Box fields already added in division routing plan (box_group_size, box_promote, box_relegate); add box_id/promotion_status to Season model |
| `backend/routes/box_league_routes.py` | Create — 3 endpoints |
| `backend/server.py` | Mount box_league_router |
| `backend/tests/test_api.py` | Box league tests |
| `frontend/src/pages/LeagueDetail.jsx` | Box tabs + per-box standings table |
| `frontend/src/pages/PlayerDashboard.jsx` | Box league status card + promotion banner |
| `frontend/src/pages/AdminDashboard.jsx` | Box league creation UI + Assign/Finalize buttons |

---

### Task 1: Backend — Add box fields to Season model

**Files:**
- Modify: `backend/models.py`

- [ ] **Step 1: Write the failing test**

```python
# In backend/tests/test_api.py:
def test_box_league_creation(self):
    s = get_admin_session()
    r = s.post(f"{BASE_URL}/api/leagues", json={
        "name": "Box Test League",
        "sport": "tennis",
        "country": "USA",
        "city": "Austin",
        "format": "singles",
        "entry_fee": 9.99,
        "start_date": "2026-06-01",
        "end_date": "2026-07-15",
        "league_type": "box_league",
        "division_label": "Intermediate",
        "division_ntrp_min": 3.5,
        "division_ntrp_max": 4.0,
    })
    assert r.status_code in [200, 201]
    data = r.json()
    assert data.get("league_type") == "box_league"
    assert data.get("box_group_size") == 6
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py -k "test_box_league_creation" -v
```
Expected: FAIL — `box_group_size` not in response

- [ ] **Step 3: Verify box fields exist on League (from division routing plan) and add box_assignments to Season**

In `backend/models.py`, find the `Season` model. Add after its last field:

```python
    box_assignments: Optional[list] = None
    # Structure: [{"box_id": "A", "player_ids": ["uid1", ...]}, ...]
```

Verify `LeagueCreate` accepts `league_type` (it already has `league_type: str = "flex"`). No change needed.

- [ ] **Step 4: Run test to verify it passes**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py -k "test_box_league_creation" -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/tests/test_api.py
git commit -m "feat(box-league): add box_assignments to Season model"
```

---

### Task 2: Backend — Create box_league_routes.py with assign-boxes endpoint

**Files:**
- Create: `backend/routes/box_league_routes.py`

- [ ] **Step 1: Write the failing test**

```python
# In backend/tests/test_api.py:
def test_assign_boxes(self):
    s = get_admin_session()
    # Use existing box_league league_id from test_box_league_creation or create fresh
    # For test isolation, create a league and register 6 players first
    # (simplified: just check endpoint exists and returns 400 for empty league)
    leagues = requests.get(f"{BASE_URL}/api/leagues?status=registration").json()
    box_leagues = [l for l in leagues if l.get("league_type") == "box_league"]
    if not box_leagues:
        pytest.skip("No box league available")
    lid = box_leagues[0]["id"]
    r = s.post(f"{BASE_URL}/api/box-leagues/{lid}/assign-boxes")
    assert r.status_code in [200, 400]  # 400 = not enough players, still means route exists
```

- [ ] **Step 2: Run test to verify it fails**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py -k "test_assign_boxes" -v
```
Expected: FAIL — 404 (route doesn't exist)

- [ ] **Step 3: Create box_league_routes.py with assign-boxes**

Create `backend/routes/box_league_routes.py`:

```python
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from bson import ObjectId
from itertools import combinations
from auth_utils import require_admin

router = APIRouter(redirect_slashes=False)

BOX_LABELS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


def _serpentine_groups(players: list, group_size: int) -> list:
    """Sort players by ELO desc, assign to groups using serpentine draft."""
    players = sorted(players, key=lambda p: p.get("elo", 1500), reverse=True)
    n_groups = max(1, len(players) // group_size)
    groups = [[] for _ in range(n_groups)]
    forward = True
    group_idx = 0
    for player in players:
        groups[group_idx].append(player)
        if forward:
            group_idx += 1
            if group_idx >= n_groups:
                group_idx = n_groups - 1
                forward = False
        else:
            group_idx -= 1
            if group_idx < 0:
                group_idx = 0
                forward = True
    return groups


@router.post("/{league_id}/assign-boxes")
async def assign_boxes(league_id: str, request: Request):
    db = request.app.state.db
    await require_admin(request, db)

    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league or league.get("league_type") != "box_league":
        raise HTTPException(status_code=400, detail="Not a box league")

    group_size = league.get("box_group_size", 6)

    # Get registered players with their ELO
    regs = await db.player_leagues.find(
        {"league_id": league_id, "payment_status": {"$in": ["paid", "free"]}},
    ).to_list(500)
    if len(regs) < group_size:
        raise HTTPException(status_code=400, detail=f"Need at least {group_size} players to assign boxes")

    # Fetch ELO for each player
    sport = league.get("sport", "tennis")
    elo_field = f"{sport}_rating"
    player_data = []
    for reg in regs:
        uid = reg["player_id"]
        user = await db.users.find_one({"_id": ObjectId(uid)}, {elo_field: 1, "name": 1})
        player_data.append({
            "player_id": uid,
            "name": user.get("name", "") if user else "",
            "elo": user.get(elo_field, 1500) if user else 1500,
        })

    groups = _serpentine_groups(player_data, group_size)
    now_iso = datetime.now(timezone.utc).isoformat()
    box_assignments = []
    all_matches = []

    for i, group in enumerate(groups):
        box_id = BOX_LABELS[i] if i < len(BOX_LABELS) else str(i + 1)
        player_ids = [p["player_id"] for p in group]
        box_assignments.append({"box_id": box_id, "player_ids": player_ids})

        # Update each player's box_id in player_leagues
        for pid in player_ids:
            await db.player_leagues.update_one(
                {"league_id": league_id, "player_id": pid},
                {"$set": {"box_id": box_id}},
            )

        # Generate all match pairs within box (C(n,2) pairs)
        for p1, p2 in combinations(group, 2):
            match_doc = {
                "league_id": league_id,
                "sport": sport,
                "player1_id": p1["player_id"],
                "player2_id": p2["player_id"],
                "player1_name": p1["name"],
                "player2_name": p2["name"],
                "scheduled_date": league.get("start_date", now_iso),
                "status": "scheduled",
                "source": "box_league",
                "box_id": box_id,
                "created_at": now_iso,
            }
            result = await db.matches.insert_one(match_doc)
            all_matches.append(str(result.inserted_id))

    # Store box_assignments on league doc
    await db.leagues.update_one(
        {"_id": ObjectId(league_id)},
        {"$set": {"box_assignments": box_assignments, "status": "active"}},
    )

    return {
        "boxes": [
            {"box_id": ba["box_id"], "player_count": len(ba["player_ids"])}
            for ba in box_assignments
        ],
        "match_count": len(all_matches),
    }
```

- [ ] **Step 4: Mount router in server.py**

In `backend/server.py`, after the last `from routes.` import, add:
```python
from routes.box_league_routes import router as box_league_router
```

After the last `api_router.include_router(...)` call, add:
```python
api_router.include_router(box_league_router, prefix="/box-leagues", tags=["box-leagues"])
```

- [ ] **Step 5: Run test to verify it passes**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py -k "test_assign_boxes" -v
```
Expected: PASS (200 or 400 — route exists)

- [ ] **Step 6: Commit**

```bash
git add backend/routes/box_league_routes.py backend/server.py backend/tests/test_api.py
git commit -m "feat(box-league): assign-boxes endpoint with serpentine ELO grouping"
```

---

### Task 3: Backend — GET /box-leagues/:id/standings

**Files:**
- Modify: `backend/routes/box_league_routes.py`

- [ ] **Step 1: Write the failing test**

```python
def test_box_standings(self):
    leagues = requests.get(f"{BASE_URL}/api/leagues").json()
    box_leagues = [l for l in leagues if l.get("league_type") == "box_league"]
    if not box_leagues:
        pytest.skip("No box league")
    lid = box_leagues[0]["id"]
    r = requests.get(f"{BASE_URL}/api/box-leagues/{lid}/standings")
    assert r.status_code == 200
    data = r.json()
    assert "boxes" in data
```

- [ ] **Step 2: Run test to verify it fails**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py -k "test_box_standings" -v
```
Expected: FAIL — 404

- [ ] **Step 3: Add standings endpoint to box_league_routes.py**

In `backend/routes/box_league_routes.py`, add after `assign_boxes`:

```python
@router.get("/{league_id}/standings")
async def box_standings(league_id: str, request: Request):
    db = request.app.state.db
    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    box_assignments = league.get("box_assignments") or []
    sport = league.get("sport", "tennis")
    elo_field = f"{sport}_rating"

    boxes = []
    for ba in box_assignments:
        box_id = ba["box_id"]
        player_ids = ba["player_ids"]

        # Fetch completed matches in this box
        matches = await db.matches.find({
            "league_id": league_id,
            "box_id": box_id,
            "status": "completed",
        }).to_list(500)

        # Build stats per player
        stats = {pid: {"player_id": pid, "wins": 0, "losses": 0, "games_won": 0, "games_lost": 0, "name": ""} for pid in player_ids}

        for m in matches:
            p1, p2 = m["player1_id"], m["player2_id"]
            winner = m.get("winner_id")
            score = m.get("score", "")
            # Parse games from score string "6-4 6-3" → games_won
            games = _parse_games(score, p1, p2)
            if winner == p1:
                stats[p1]["wins"] += 1
                stats[p2]["losses"] += 1
            elif winner == p2:
                stats[p2]["wins"] += 1
                stats[p1]["losses"] += 1
            stats[p1]["games_won"] += games.get(p1, 0)
            stats[p1]["games_lost"] += games.get(p2, 0)
            stats[p2]["games_won"] += games.get(p2, 0)
            stats[p2]["games_lost"] += games.get(p1, 0)

        # Fetch player names + ELO
        for pid in player_ids:
            try:
                user = await db.users.find_one({"_id": ObjectId(pid)}, {"name": 1, elo_field: 1})
                if user:
                    stats[pid]["name"] = user.get("name", "")
                    stats[pid]["elo"] = user.get(elo_field, 1500)
            except Exception:
                pass

            # Fetch promotion_status from player_leagues
            reg = await db.player_leagues.find_one({"league_id": league_id, "player_id": pid})
            stats[pid]["promotion_status"] = reg.get("promotion_status") if reg else None

        # Sort: wins desc → games_won desc → ELO desc
        sorted_players = sorted(
            stats.values(),
            key=lambda p: (-p["wins"], -p.get("games_won", 0), -p.get("elo", 0))
        )
        for rank_idx, player in enumerate(sorted_players):
            player["rank"] = rank_idx + 1

        boxes.append({"box_id": box_id, "players": sorted_players})

    promote_n = league.get("box_promote", 2)
    relegate_n = league.get("box_relegate", 2)
    return {"boxes": boxes, "box_promote": promote_n, "box_relegate": relegate_n}


def _parse_games(score: str, p1_id: str, p2_id: str) -> dict:
    """Parse '6-4 6-3' into {p1_id: 12, p2_id: 7} games totals. Returns empty on parse error."""
    result = {p1_id: 0, p2_id: 0}
    if not score:
        return result
    try:
        for set_score in score.strip().split():
            parts = set_score.split("-")
            if len(parts) == 2:
                result[p1_id] += int(parts[0])
                result[p2_id] += int(parts[1])
    except Exception:
        pass
    return result
```

- [ ] **Step 4: Run test to verify it passes**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py -k "test_box_standings" -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routes/box_league_routes.py backend/tests/test_api.py
git commit -m "feat(box-league): standings endpoint with wins/games tiebreaker"
```

---

### Task 4: Backend — POST /box-leagues/:id/finalize

**Files:**
- Modify: `backend/routes/box_league_routes.py`

- [ ] **Step 1: Write the failing test**

```python
def test_box_finalize_requires_admin(self):
    leagues = requests.get(f"{BASE_URL}/api/leagues").json()
    box_leagues = [l for l in leagues if l.get("league_type") == "box_league"]
    if not box_leagues:
        pytest.skip("No box league")
    lid = box_leagues[0]["id"]
    # Unauthenticated → 401/403
    r = requests.post(f"{BASE_URL}/api/box-leagues/{lid}/finalize")
    assert r.status_code in [401, 403]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py -k "test_box_finalize_requires_admin" -v
```
Expected: FAIL — 404

- [ ] **Step 3: Add finalize endpoint**

In `backend/routes/box_league_routes.py`, add after `box_standings`:

```python
@router.post("/{league_id}/finalize")
async def finalize_box_league(league_id: str, request: Request):
    db = request.app.state.db
    await require_admin(request, db)

    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league or league.get("league_type") != "box_league":
        raise HTTPException(status_code=400, detail="Not a box league")

    promote_n = league.get("box_promote", 2)
    relegate_n = league.get("box_relegate", 2)

    # Re-use standings logic to get sorted players per box
    standings_resp = await box_standings(league_id, request)
    boxes = standings_resp["boxes"]

    promoted, relegated, mid_table = [], [], []

    for box in boxes:
        players = box["players"]
        n = len(players)
        for i, p in enumerate(players):
            pid = p["player_id"]
            rank = i + 1
            if rank <= promote_n:
                status = "promoted"
                promoted.append({"player_id": pid, "name": p["name"], "box": box["box_id"], "rank": rank})
            elif rank > n - relegate_n:
                status = "relegated"
                relegated.append({"player_id": pid, "name": p["name"], "box": box["box_id"], "rank": rank})
            else:
                status = None
                mid_table.append({"player_id": pid, "name": p["name"], "box": box["box_id"], "rank": rank})

            await db.player_leagues.update_one(
                {"league_id": league_id, "player_id": pid},
                {"$set": {"promotion_status": status}},
            )

    # Update league status to completed
    await db.leagues.update_one(
        {"_id": ObjectId(league_id)},
        {"$set": {"status": "completed"}},
    )

    # Send emails
    import email_service
    league_name = league.get("name", "Box League")
    city = league.get("city", "")
    for p in promoted:
        user = await db.users.find_one({"_id": ObjectId(p["player_id"])}, {"email": 1, "email_notifications": 1})
        if user and user.get("email") and user.get("email_notifications", True):
            await email_service.send_email(
                to=user["email"],
                subject="You've been promoted on VENLAX!",
                body=f"You finished #{p['rank']} in Box {p['box']} of the {city} {league_name}. "
                     f"You're promoted to the next division next season!",
            )
    for p in relegated:
        user = await db.users.find_one({"_id": ObjectId(p["player_id"])}, {"email": 1, "email_notifications": 1})
        if user and user.get("email") and user.get("email_notifications", True):
            await email_service.send_email(
                to=user["email"],
                subject=f"Season results — VENLAX {city}",
                body=f"You finished #{p['rank']} in Box {p['box']} of the {city} {league_name}. "
                     f"You've been moved to the lower division for next season.",
            )

    return {"promoted": promoted, "relegated": relegated, "mid": mid_table}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py -k "test_box_finalize_requires_admin" -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routes/box_league_routes.py backend/tests/test_api.py
git commit -m "feat(box-league): finalize endpoint with promotion/relegation + result emails"
```

---

### Task 5: Frontend — Box tabs + standings in LeagueDetail

**Files:**
- Modify: `frontend/src/pages/LeagueDetail.jsx`

- [ ] **Step 1: Read current LeagueDetail.jsx tab structure**

```bash
grep -n "tab\|Tab\|activeTab\|setTab" frontend/src/pages/LeagueDetail.jsx | head -20
```

- [ ] **Step 2: Add box standings state + fetch**

Near the top of `LeagueDetail.jsx`, inside the component, add state:

```js
const [boxStandings, setBoxStandings] = useState(null);
const [activeBox, setActiveBox] = useState("A");

// Add inside useEffect that fetches league:
if (leagueData.league_type === "box_league") {
  axios.get(`${API}/box-leagues/${league_id}/standings`)
    .then(({ data }) => {
      setBoxStandings(data);
      if (data.boxes?.length > 0) setActiveBox(data.boxes[0].box_id);
    })
    .catch(() => {});
}
```

- [ ] **Step 3: Render box tabs + standings table**

In the JSX, when `league?.league_type === "box_league"` and `boxStandings`, render instead of the normal standings:

```jsx
{league?.league_type === "box_league" && boxStandings && (
  <div className="mt-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">Box Standings</h3>
    {/* Box tab pills */}
    <div className="flex gap-2 mb-4 flex-wrap">
      {boxStandings.boxes.map((box) => (
        <button
          key={box.box_id}
          data-testid={`box-tab-${box.box_id}`}
          onClick={() => setActiveBox(box.box_id)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            activeBox === box.box_id
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
          }`}
        >
          Box {box.box_id}
        </button>
      ))}
    </div>

    {/* Active box standings table */}
    {boxStandings.boxes.filter((b) => b.box_id === activeBox).map((box) => (
      <div key={box.box_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Player</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">W</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">L</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {box.players.map((p, idx) => {
              const isPromote = idx < boxStandings.box_promote;
              const isRelegate = idx >= box.players.length - boxStandings.box_relegate;
              return (
                <tr key={p.player_id} className={isPromote ? "bg-emerald-50" : isRelegate ? "bg-red-50" : ""}>
                  <td className="px-4 py-3 font-semibold text-gray-500">#{p.rank}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{p.wins}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{p.losses}</td>
                  <td className="px-4 py-3 text-right">
                    {isPromote && <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">Promoting ↑</span>}
                    {isRelegate && <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-md">Relegating ↓</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 4: Test in browser**

- Create a box league via admin, register 6+ players, hit assign-boxes
- Open league detail → should show Box A / Box B tabs with standings table
- Promoting ↑ / Relegating ↓ badges on top/bottom rows

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/LeagueDetail.jsx
git commit -m "feat(box-league): box tabs + standings table in LeagueDetail"
```

---

### Task 6: Frontend — Box status card + banner in PlayerDashboard

**Files:**
- Modify: `frontend/src/pages/PlayerDashboard.jsx`

- [ ] **Step 1: Fetch box standings for each box league the user is in**

In `PlayerDashboard.jsx`, when fetching user leagues, for each league where `league_type === "box_league"`, fetch `GET /api/box-leagues/:id/standings` and find the user's box + rank.

Add state: `const [boxStatuses, setBoxStatuses] = useState({})` (keyed by league_id).

After leagues are loaded:
```js
for (const league of myLeagues.filter(l => l.league_type === "box_league")) {
  try {
    const { data } = await axios.get(`${API}/box-leagues/${league.id}/standings`, { withCredentials: true });
    const myBox = data.boxes?.find(b => b.players.some(p => p.player_id === user.id));
    if (myBox) {
      const myEntry = myBox.players.find(p => p.player_id === user.id);
      setBoxStatuses(prev => ({ ...prev, [league.id]: { box_id: myBox.box_id, rank: myEntry?.rank, total: myBox.players.length, promotion_status: myEntry?.promotion_status } }));
    }
  } catch {}
}
```

- [ ] **Step 2: Render box status card**

In the registered leagues section, for each box league, add below the league name:

```jsx
{boxStatuses[league.id] && (
  <div className="mt-1 text-sm text-gray-600">
    Box {boxStatuses[league.id].box_id} · Rank #{boxStatuses[league.id].rank} of {boxStatuses[league.id].total}
    {boxStatuses[league.id].promotion_status === "promoted" && (
      <span className="ml-2 text-xs font-semibold text-emerald-700">Promoted ↑</span>
    )}
    {boxStatuses[league.id].promotion_status === "relegated" && (
      <span className="ml-2 text-xs font-semibold text-red-600">Relegated ↓</span>
    )}
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PlayerDashboard.jsx
git commit -m "feat(box-league): box status card in PlayerDashboard"
```

---

### Task 7: Frontend — Box league creation + admin buttons

**Files:**
- Modify: `frontend/src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Add "box_league" to league_type options in admin form**

In `AdminDashboard.jsx`, find where `league_type` is set in the form (look for `league_type` in `DEFAULT_FORM` or the form JSX). Add "Box League" option:

If there's a league_type select/radio, add:
```jsx
<option value="box_league">Box League (promotion/relegation)</option>
```

If `league_type` is not currently shown in the admin form, add a select after the format select:
```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">League Type</label>
  <select
    data-testid="admin-league-type-select"
    value={form.league_type || "flex"}
    onChange={(e) => setForm((f) => ({ ...f, league_type: e.target.value }))}
    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
  >
    <option value="flex">Flex (self-scheduled)</option>
    <option value="round_robin">Round Robin</option>
    <option value="box_league">Box League (promotion/relegation)</option>
  </select>
</div>
```

Also add `league_type: "flex"` to `DEFAULT_FORM` if not already there.

- [ ] **Step 2: Add Assign Boxes + Finalize Season buttons in league management tab**

In the admin leagues list, for each league with `league_type === "box_league"`, add action buttons:

```jsx
{league.league_type === "box_league" && (
  <div className="flex gap-2 mt-2">
    <button
      data-testid={`assign-boxes-${league.id}`}
      onClick={() => handleAssignBoxes(league.id)}
      className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
    >
      Assign Boxes
    </button>
    <button
      data-testid={`finalize-season-${league.id}`}
      onClick={() => handleFinalizeSeason(league.id)}
      className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700"
    >
      Finalize Season
    </button>
  </div>
)}
```

Add handler functions:
```js
const handleAssignBoxes = async (leagueId) => {
  try {
    const { data } = await axios.post(`${API}/box-leagues/${leagueId}/assign-boxes`, {}, { withCredentials: true });
    setMsg(`Boxes assigned: ${data.boxes.map(b => `Box ${b.box_id} (${b.player_count} players)`).join(", ")}`);
    fetchLeagues();
  } catch (err) {
    setMsg(err.response?.data?.detail || "Failed to assign boxes");
  }
};

const handleFinalizeSeason = async (leagueId) => {
  if (!window.confirm("Finalize this season? This will set promotion/relegation for all players and send emails.")) return;
  try {
    const { data } = await axios.post(`${API}/box-leagues/${leagueId}/finalize`, {}, { withCredentials: true });
    setMsg(`Season finalized. Promoted: ${data.promoted.length}, Relegated: ${data.relegated.length}`);
    fetchLeagues();
  } catch (err) {
    setMsg(err.response?.data?.detail || "Failed to finalize");
  }
};
```

- [ ] **Step 3: Test in browser**

- Admin: create box league → Assign Boxes button appears → click → boxes assigned
- Finalize Season button → confirmation → emails sent
- League detail shows box tabs

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/AdminDashboard.jsx
git commit -m "feat(box-league): admin create box league + assign boxes + finalize buttons"
```
