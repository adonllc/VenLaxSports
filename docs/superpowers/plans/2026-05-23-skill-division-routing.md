# Skill Division Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add skill division labels (Beginner/Intermediate/Advanced/Competitive + NTRP/DUPR ranges) to leagues so players self-select into the right competition level.

**Architecture:** Extend `League` model with 3 optional fields (`division_label`, `division_ntrp_min`, `division_ntrp_max`) and `User` model with `dupr_rating`. Add `?division=` filter to `GET /api/leagues`. All frontend components display the hybrid label. Backward compatible — leagues without a division show "Open Division".

**Tech Stack:** FastAPI/Python backend, Motor (async MongoDB), React 19 + Tailwind v3 frontend.

---

## File Structure

| File | Change |
|---|---|
| `backend/models.py` | Add 3 fields to `League`, `LeagueCreate`; add `dupr_rating` to `User` |
| `backend/routes/league_routes.py` | Add `?division=` filter to GET; accept division fields on POST |
| `backend/routes/user_routes.py` | Add `PATCH /api/users/me` endpoint |
| `backend/seeds/leagues.py` | Add `division_label` to seed data |
| `backend/tests/test_api.py` | Add division filter + user patch tests |
| `frontend/src/pages/Leagues.jsx` | Division filter chips + division badge on league card |
| `frontend/src/pages/LeagueDetail.jsx` | Division in header |
| `frontend/src/pages/PlayerDashboard.jsx` | Division in registered leagues list + DUPR field |
| `frontend/src/pages/AdminDashboard.jsx` | Division dropdown in league creation form |

---

### Task 1: Backend — Extend models

**Files:**
- Modify: `backend/models.py`

- [ ] **Step 1: Write the failing test**

```python
# In backend/tests/test_api.py — add to TestLeagues class:
def test_league_has_division_fields(self):
    s = get_admin_session()
    r = s.post(f"{BASE_URL}/api/leagues", json={
        "name": "Test Division League",
        "sport": "tennis",
        "country": "USA",
        "city": "Austin",
        "format": "singles",
        "entry_fee": 9.99,
        "start_date": "2026-06-01",
        "end_date": "2026-07-15",
        "division_label": "Intermediate",
        "division_ntrp_min": 3.5,
        "division_ntrp_max": 4.0,
    })
    assert r.status_code in [200, 201]
    data = r.json()
    assert data.get("division_label") == "Intermediate"
    assert data.get("division_ntrp_min") == 3.5
    assert data.get("division_ntrp_max") == 4.0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py::TestLeagues::test_league_has_division_fields -v
```
Expected: FAIL — fields not present on response

- [ ] **Step 3: Add division fields to League, LeagueCreate; add dupr_rating to User**

In `backend/models.py`, find the `League` class (line ~81). After `is_public: bool = True`, add:
```python
    division_label: Optional[str] = None        # "Beginner"|"Intermediate"|"Advanced"|"Competitive"
    division_ntrp_min: Optional[float] = None   # e.g. 3.5
    division_ntrp_max: Optional[float] = None   # e.g. 4.0
    box_group_size: int = 6
    box_promote: int = 2
    box_relegate: int = 2
```

In `LeagueCreate` class (line ~106), after `rr_config: Optional[Dict] = None`, add:
```python
    division_label: Optional[str] = None
    division_ntrp_min: Optional[float] = None
    division_ntrp_max: Optional[float] = None
```

In `User` class (line ~38), after `founding_member: bool = False`, add:
```python
    dupr_rating: Optional[str] = None           # "2.0-3.0"|"3.0-3.5"|"3.5-4.5"|"4.5+"
    gender: Optional[str] = None                # "male"|"female" — used for mixed doubles
```

- [ ] **Step 4: Run test to verify it passes**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py::TestLeagues::test_league_has_division_fields -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/tests/test_api.py
git commit -m "feat(divisions): add division_label/ntrp fields to League, dupr_rating/gender to User"
```

---

### Task 2: Backend — Division filter on GET /api/leagues + division fields on POST

**Files:**
- Modify: `backend/routes/league_routes.py`

- [ ] **Step 1: Write the failing test**

```python
# In backend/tests/test_api.py — add to TestLeagues:
def test_division_filter(self):
    r = requests.get(f"{BASE_URL}/api/leagues?division=Intermediate")
    assert r.status_code == 200
    data = r.json()
    # All returned leagues must have division_label == "Intermediate"
    for league in data:
        assert league.get("division_label") == "Intermediate"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py::TestLeagues::test_division_filter -v
```
Expected: FAIL — filter not applied

- [ ] **Step 3: Add ?division= filter to get_leagues**

In `backend/routes/league_routes.py`, find `async def get_leagues(` (line ~24). Add `division: Optional[str] = None` to the parameters:

```python
async def get_leagues(
    request: Request,
    sport: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    status: Optional[str] = None,
    season_id: Optional[str] = None,
    division: Optional[str] = None,
    limit: int = 24,
    skip: int = 0,
):
```

After the existing `if season_id:` block, add:
```python
    if division:
        query["division_label"] = division
```

- [ ] **Step 4: Run test to verify it passes**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py::TestLeagues::test_division_filter -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routes/league_routes.py backend/tests/test_api.py
git commit -m "feat(divisions): add ?division= filter to GET /api/leagues"
```

---

### Task 3: Backend — PATCH /api/users/me

**Files:**
- Modify: `backend/routes/user_routes.py`

- [ ] **Step 1: Write the failing test**

```python
# In backend/tests/test_api.py — add to TestAuth or new TestUsers class:
def test_patch_user_dupr_rating(self):
    s = get_admin_session()
    r = s.patch(f"{BASE_URL}/api/users/me", json={"dupr_rating": "3.0-3.5"})
    assert r.status_code == 200
    data = r.json()
    assert data.get("dupr_rating") == "3.0-3.5"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py::TestUsers::test_patch_user_dupr_rating -v
```
Expected: FAIL — 404 or 405

- [ ] **Step 3: Add PATCH /api/users/me to user_routes.py**

In `backend/routes/user_routes.py`, add after imports:

```python
class UserProfileUpdate(BaseModel):
    city: Optional[str] = None
    phone: Optional[str] = None
    home_court: Optional[str] = None
    email_notifications: Optional[bool] = None
    profile_public: Optional[bool] = None
    dupr_rating: Optional[str] = None
    gender: Optional[str] = None
    sport_preferences: Optional[list] = None
```

Then add endpoint before the last line of the file:

```python
@router.patch("/me")
async def update_profile(data: UserProfileUpdate, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": update})
    updated = await db.users.find_one({"_id": ObjectId(user["_id"])}, {"password_hash": 0})
    updated["id"] = str(updated.pop("_id"))
    return updated
```

Also add `from bson import ObjectId` at top if not already imported (check — it's already imported via `from bson import ObjectId` in user_routes.py).

- [ ] **Step 4: Run test to verify it passes**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py::TestUsers::test_patch_user_dupr_rating -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routes/user_routes.py backend/tests/test_api.py
git commit -m "feat(divisions): add PATCH /api/users/me for profile updates (dupr_rating, gender)"
```

---

### Task 4: Backend — Seed leagues with division labels

**Files:**
- Modify: `backend/seeds/leagues.py`

- [ ] **Step 1: Read the current seed data**

```bash
cat backend/seeds/leagues.py
```

- [ ] **Step 2: Add division_label to relevant seed entries**

In `backend/seeds/leagues.py`, for each seed league entry that has a `sport` of `"tennis"` or `"pickleball"`, add `division_label`, `division_ntrp_min`, `division_ntrp_max`. Use this mapping:

Tennis seeds:
- Beginner/free leagues → `"division_label": "Beginner", "division_ntrp_min": 2.5, "division_ntrp_max": 3.0`
- Intermediate → `"division_label": "Intermediate", "division_ntrp_min": 3.5, "division_ntrp_max": 4.0`
- Competitive/rated → `"division_label": "Competitive", "division_ntrp_min": 4.5, "division_ntrp_max": None`

Pickleball seeds:
- Intermediate → `"division_label": "Intermediate", "division_ntrp_min": 3.0, "division_ntrp_max": 3.5`

- [ ] **Step 3: Commit**

```bash
git add backend/seeds/leagues.py
git commit -m "feat(divisions): add division_label to seed league data"
```

---

### Task 5: Frontend — Division filter chips + badge on Leagues.jsx

**Files:**
- Modify: `frontend/src/pages/Leagues.jsx`

- [ ] **Step 1: Add division to filters state and fetchLeagues params**

In `Leagues.jsx`, find the `filters` state (line ~40). Add `division: ""` to the initial state object:

```js
const [filters, setFilters] = useState({
  sport: searchParams.get("sport") || "",
  country: searchParams.get("country") || "",
  city: searchParams.get("city") || "",
  status: searchParams.get("status") || "",
  season_id: searchParams.get("season_id") || "",
  division: searchParams.get("division") || "",
  search: "",
});
```

In `fetchLeagues`, add `division` to the params:
```js
if (filters.division) params.division = filters.division;
```

Also add `filters.division` to the `useEffect` dependency array.

- [ ] **Step 2: Add division filter chip row**

Find the filter bar section in the JSX. Add a division filter row below the existing sport/status filters:

```jsx
{/* Division filter */}
<div className="flex flex-wrap gap-2 mt-2">
  {["", "Beginner", "Intermediate", "Advanced", "Competitive"].map((div) => (
    <button
      key={div || "all"}
      data-testid={`division-filter-${div || "all"}`}
      onClick={() => setFilters((f) => ({ ...f, division: div }))}
      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
        filters.division === div
          ? "bg-gray-900 text-white border-gray-900"
          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
      }`}
    >
      {div || "All Levels"}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Add division badge to league card**

Find the league card render in the JSX. Add division badge below the format/sport tags:

```jsx
{/* Division badge */}
{league.division_label ? (
  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
    {league.division_label}
    {league.division_ntrp_min && (
      <span className="ml-1 text-indigo-400">
        ({league.division_ntrp_min}–{league.division_ntrp_max || "+"}{" "}
        {league.sport === "pickleball" ? "DUPR" : "NTRP"})
      </span>
    )}
  </span>
) : (
  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
    Open Division
  </span>
)}
```

- [ ] **Step 4: Test in browser**

```bash
cd frontend && yarn start
```

Open http://localhost:3000/leagues — verify:
- Division filter chips appear
- Clicking "Intermediate" filters leagues
- League cards show division badge
- Leagues without division show "Open Division"

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Leagues.jsx
git commit -m "feat(divisions): division filter chips + badge on league cards"
```

---

### Task 6: Frontend — Division in LeagueDetail header

**Files:**
- Modify: `frontend/src/pages/LeagueDetail.jsx`

- [ ] **Step 1: Find the league name/header render in LeagueDetail.jsx**

```bash
grep -n "league.name\|league\.sport\|league\.city" frontend/src/pages/LeagueDetail.jsx | head -20
```

- [ ] **Step 2: Add division label to header**

Find where `league.name` is rendered in the page header. Below or alongside the league name, add:

```jsx
{league.division_label && (
  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
    {league.division_label}
    {league.division_ntrp_min && (
      <span className="ml-1 text-indigo-400 font-normal">
        {league.division_ntrp_min}–{league.division_ntrp_max || "+"}{" "}
        {league.sport === "pickleball" ? "DUPR" : "NTRP"}
      </span>
    )}
  </span>
)}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/LeagueDetail.jsx
git commit -m "feat(divisions): show division label in LeagueDetail header"
```

---

### Task 7: Frontend — Division in AdminDashboard league creation form

**Files:**
- Modify: `frontend/src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Add DIVISION_RANGES constant and division to DEFAULT_FORM**

Near the top of `AdminDashboard.jsx`, after the `FORMATS` constant, add:

```js
const DIVISION_RANGES = {
  Beginner:     { tennis: [2.5, 3.0], pickleball: [2.0, 3.0] },
  Intermediate: { tennis: [3.5, 4.0], pickleball: [3.0, 3.5] },
  Advanced:     { tennis: [4.0, 4.5], pickleball: [3.5, 4.5] },
  Competitive:  { tennis: [4.5, null], pickleball: [4.5, null] },
};
```

Add to `DEFAULT_FORM`:
```js
division_label: "",
division_ntrp_min: null,
division_ntrp_max: null,
```

- [ ] **Step 2: Add division dropdown to league creation form**

Find the league creation form JSX (look for the format `<select>` or `<input>` fields in the admin form). Add after the format select:

```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Division (optional)</label>
  <select
    data-testid="admin-division-select"
    value={form.division_label}
    onChange={(e) => {
      const label = e.target.value;
      const sport = form.sport;
      const ranges = label && DIVISION_RANGES[label] ? DIVISION_RANGES[label][sport] || [] : [];
      setForm((f) => ({
        ...f,
        division_label: label,
        division_ntrp_min: ranges[0] ?? null,
        division_ntrp_max: ranges[1] ?? null,
      }));
    }}
    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-gray-900"
  >
    <option value="">Open Division (no skill gate)</option>
    <option value="Beginner">Beginner (2.5–3.0 NTRP / 2.0–3.0 DUPR)</option>
    <option value="Intermediate">Intermediate (3.5–4.0 NTRP / 3.0–3.5 DUPR)</option>
    <option value="Advanced">Advanced (4.0–4.5 NTRP / 3.5–4.5 DUPR)</option>
    <option value="Competitive">Competitive (4.5+ NTRP / 4.5+ DUPR)</option>
  </select>
</div>
```

- [ ] **Step 3: Include division fields in POST body**

Find where `form` is POSTed to `/api/leagues`. Ensure `division_label`, `division_ntrp_min`, `division_ntrp_max` are included in the request body. They're already in `form` state so if you spread `form` they'll be included automatically. If the POST uses explicit fields, add them.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/AdminDashboard.jsx
git commit -m "feat(divisions): division dropdown in admin league creation form"
```

---

### Task 8: Frontend — DUPR field + division in PlayerDashboard

**Files:**
- Modify: `frontend/src/pages/PlayerDashboard.jsx`

- [ ] **Step 1: Add DUPR rating field to profile section**

Find the profile/settings section in `PlayerDashboard.jsx`. Add after existing profile fields (look for where `city`, `phone`, or `home_court` are rendered as editable fields):

```jsx
{/* DUPR Rating — shown only when user has pickleball */}
{(user?.sport_preferences?.includes("pickleball") || true) && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Pickleball Rating (DUPR)
    </label>
    <div className="flex flex-wrap gap-2">
      {["2.0-3.0", "3.0-3.5", "3.5-4.5", "4.5+"].map((bracket) => (
        <button
          key={bracket}
          data-testid={`dupr-bracket-${bracket}`}
          onClick={() => handleProfileUpdate({ dupr_rating: bracket })}
          className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
            user?.dupr_rating === bracket
              ? "bg-orange-500 text-white border-orange-500"
              : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
          }`}
        >
          {bracket}
        </button>
      ))}
      <button
        data-testid="dupr-bracket-unknown"
        onClick={() => handleProfileUpdate({ dupr_rating: null })}
        className="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-200 text-gray-400 hover:border-gray-400"
      >
        I don't know
      </button>
    </div>
    <p className="mt-1.5 text-xs text-gray-400">
      Don't know your DUPR?{" "}
      <a href="https://www.dupr.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">
        Find it at dupr.com →
      </a>
    </p>
  </div>
)}
```

- [ ] **Step 2: Add handleProfileUpdate function if not present**

If `PlayerDashboard.jsx` doesn't already have a profile update function, add:

```js
const handleProfileUpdate = async (fields) => {
  try {
    const { data } = await axios.patch(`${API}/users/me`, fields, { withCredentials: true });
    setUser(data);
  } catch (err) {
    console.error("Profile update failed", err);
  }
};
```

- [ ] **Step 3: Show division label in registered leagues list**

Find where registered/joined leagues are listed in PlayerDashboard. Add division badge next to each league name:

```jsx
{league.division_label && (
  <span className="ml-2 text-xs text-indigo-600 font-medium">
    {league.division_label}
    {league.division_ntrp_min ? ` (${league.division_ntrp_min}–${league.division_ntrp_max || "+"}${league.sport === "pickleball" ? " DUPR" : " NTRP"})` : ""}
  </span>
)}
```

- [ ] **Step 4: Test in browser**

- Open http://localhost:3000/dashboard
- Profile section should show DUPR rating picker
- Clicking a bracket should save via PATCH /api/users/me
- Registered leagues list shows division label

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PlayerDashboard.jsx
git commit -m "feat(divisions): DUPR rating field + division labels in PlayerDashboard"
```
