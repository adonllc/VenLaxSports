# DUPR Integration + Mixed Doubles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface DUPR as pickleball rating standard in division labels + player profile. Add Mixed Doubles as a first-class league format with soft M+F gender check.

**Architecture:** No new collections. `dupr_rating` and `gender` fields on User (already added by division routing plan). `fee_for_format()` extended for `"mixed_doubles"`. League join handler adds soft gender check for mixed doubles. Frontend adds "Mixed Doubles" format chip, gender indicators in partner search, and DUPR field in profile.

**Tech Stack:** FastAPI/Python, Motor (async MongoDB), React 19 + Tailwind v3.

**Prerequisite:** Skill Division Routing plan must be implemented first (`dupr_rating` and `gender` on User model added there).

---

## File Structure

| File | Change |
|---|---|
| `backend/pricing_config.py` | Add `mixed_doubles` to `ENTRY_FEE_USD` |
| `backend/routes/league_routes.py` | Soft gender check on mixed_doubles invite accept |
| `backend/tests/test_api.py` | Mixed doubles pricing + gender check tests |
| `frontend/src/pages/Leagues.jsx` | Mixed Doubles filter chip + DUPR label in division badges |
| `frontend/src/pages/LeagueDetail.jsx` | Mixed Doubles format badge + gender indicators in partner search |
| `frontend/src/pages/AdminDashboard.jsx` | Mixed Doubles option in format dropdown |
| `frontend/src/components/OpponentSearch.jsx` | Gender indicator on search result cards |

---

### Task 1: Backend — Add mixed_doubles to pricing config

**Files:**
- Modify: `backend/pricing_config.py`

- [ ] **Step 1: Write the failing test**

```python
# In backend/tests/test_api.py — add to TestPayments or new TestPricing class:
class TestPricing:
    def test_mixed_doubles_fee_same_as_doubles(self):
        """pricing_config.fee_for_format returns 19.99 for mixed_doubles"""
        import sys, os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
        from pricing_config import fee_for_format
        assert fee_for_format("mixed_doubles") == 19.99
        assert fee_for_format("doubles") == 19.99
        assert fee_for_format("singles") == 9.99
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py::TestPricing::test_mixed_doubles_fee_same_as_doubles -v
```
Expected: FAIL — `fee_for_format("mixed_doubles")` returns 9.99 (default), not 19.99

- [ ] **Step 3: Add mixed_doubles to ENTRY_FEE_USD**

In `backend/pricing_config.py`, in the `ENTRY_FEE_USD` dict:

```python
ENTRY_FEE_USD: dict[str, float] = {
    "singles": 9.99,
    "doubles": 19.99,
    "mixed": 19.99,
    "mixed_doubles": 19.99,
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py::TestPricing::test_mixed_doubles_fee_same_as_doubles -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/pricing_config.py backend/tests/test_api.py
git commit -m "feat(mixed-doubles): add mixed_doubles pricing (19.99, same as doubles)"
```

---

### Task 2: Backend — Soft gender check on mixed_doubles invite accept

**Files:**
- Modify: `backend/routes/league_routes.py` (or `backend/routes/doubles_routes.py` — check where invite accept lives)

- [ ] **Step 1: Find where partner invite is accepted**

```bash
grep -rn "accept\|invite\|token\|doubles" backend/routes/doubles_routes.py | head -30
```

- [ ] **Step 2: Write the failing test**

```python
# In TestPricing (or TestLeagues):
def test_mixed_doubles_league_creation(self):
    s = get_admin_session()
    r = s.post(f"{BASE_URL}/api/leagues", json={
        "name": "Mixed Doubles Test",
        "sport": "tennis",
        "country": "USA",
        "city": "Austin",
        "format": "mixed_doubles",
        "entry_fee": 19.99,
        "start_date": "2026-06-01",
        "end_date": "2026-07-15",
    })
    assert r.status_code in [200, 201]
    data = r.json()
    assert data.get("format") == "mixed_doubles"
    assert data.get("entry_fee") == 19.99
```

- [ ] **Step 3: Run test to verify it fails**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py -k "test_mixed_doubles_league_creation" -v
```
Expected: FAIL or 422 if format enum blocks it

- [ ] **Step 4: Find invite accept handler and add gender check**

In `backend/routes/doubles_routes.py` (or wherever `DoublesConfirmRequest` with `action: "accept"` is handled), find the accept path. After confirming the invite, when `league.get("format") == "mixed_doubles"`:

```python
# Soft gender check for mixed doubles
if league.get("format") == "mixed_doubles":
    p1 = await db.users.find_one({"_id": ObjectId(invite["initiator_id"])}, {"gender": 1})
    p2 = await db.users.find_one({"_id": ObjectId(current_user["_id"])}, {"gender": 1})
    p1_gender = p1.get("gender") if p1 else None
    p2_gender = p2.get("gender") if p2 else None
    gender_warning = None
    if p1_gender and p2_gender and p1_gender == p2_gender:
        gender_warning = "Mixed doubles requires one male and one female player. Please verify your team composition."
    # Continue registration (do NOT raise — soft check only)
    # Include warning in response if present
```

The response from the accept endpoint should already return a dict — add `"gender_warning": gender_warning` to it if `gender_warning` is set.

- [ ] **Step 5: Run test to verify league creation passes**

```bash
REACT_APP_BACKEND_URL=http://localhost:8001 python -m pytest tests/test_api.py -k "test_mixed_doubles_league_creation" -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/routes/doubles_routes.py backend/routes/league_routes.py backend/tests/test_api.py
git commit -m "feat(mixed-doubles): soft gender check on invite accept for mixed_doubles leagues"
```

---

### Task 3: Frontend — DUPR label in division badges + Mixed Doubles filter chip in Leagues.jsx

**Files:**
- Modify: `frontend/src/pages/Leagues.jsx`

- [ ] **Step 1: Update division badge to show DUPR vs NTRP based on sport**

In `Leagues.jsx`, find the division badge JSX (added in the division routing plan). Update the rating system label:

```jsx
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
  <span className="...">Open Division</span>
)}
```

The `{league.sport === "pickleball" ? "DUPR" : "NTRP"}` logic is the key change.

- [ ] **Step 2: Add Mixed Doubles to format filter options**

In `Leagues.jsx`, find where format filter chips are rendered (look for "Singles", "Doubles" filter buttons). Add:

```jsx
<button
  data-testid="format-filter-mixed-doubles"
  onClick={() => setFilters((f) => ({ ...f, format: f.format === "mixed_doubles" ? "" : "mixed_doubles" }))}
  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
    filters.format === "mixed_doubles"
      ? "bg-purple-700 text-white border-purple-700"
      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
  }`}
>
  Mixed Doubles
</button>
```

Also add `format: ""` to the `filters` state if not already there, and pass `format` to `fetchLeagues` params.

- [ ] **Step 3: Add Mixed Doubles format badge color**

In `Leagues.jsx`, add to `FORMAT_COLORS` (or wherever format badge colors are defined):
```js
mixed_doubles: "bg-purple-100 text-purple-700",
```

- [ ] **Step 4: Test in browser**

- http://localhost:3000/leagues — "Mixed Doubles" filter chip appears
- Pickleball leagues show "DUPR" in division badge, tennis shows "NTRP"

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Leagues.jsx
git commit -m "feat(mixed-doubles): mixed doubles filter chip + DUPR/NTRP division label in Leagues"
```

---

### Task 4: Frontend — Gender indicators in OpponentSearch + LeagueDetail mixed doubles badge

**Files:**
- Modify: `frontend/src/components/OpponentSearch.jsx`
- Modify: `frontend/src/pages/LeagueDetail.jsx`

- [ ] **Step 1: Add gender indicator to OpponentSearch results**

In `frontend/src/components/OpponentSearch.jsx`, find where player search results are rendered. Each result shows `player.name` — add gender indicator after the name:

```jsx
<span className="text-xs text-gray-400 ml-1.5">
  {player.gender === "male" ? "(M)" : player.gender === "female" ? "(F)" : ""}
</span>
```

Also ensure `gender` is returned by the `GET /api/users/search` endpoint. In `backend/routes/user_routes.py`, in `search_users`, add `"gender": u.get("gender")` to the result dict:

```python
results.append({
    "id": str(u["_id"]),
    "name": u.get("name"),
    "email": u.get("email"),
    "city": u.get("city"),
    "tennis_rating": u.get("tennis_rating"),
    "cricket_rating": u.get("cricket_rating"),
    "pickleball_rating": u.get("pickleball_rating"),
    "gender": u.get("gender"),        # ← add this
})
```

- [ ] **Step 2: Add Mixed Doubles badge and gender context to LeagueDetail**

In `frontend/src/pages/LeagueDetail.jsx`, find where the format badge is rendered. Add the Mixed Doubles case:

```jsx
{league.format === "mixed_doubles" && (
  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-purple-100 text-purple-700 border border-purple-200">
    Mixed Doubles
  </span>
)}
```

Below the partner search section (for mixed_doubles leagues), add a helper note:

```jsx
{league.format === "mixed_doubles" && (
  <p className="text-xs text-gray-400 mt-2">
    Mixed Doubles requires one male and one female player. Gender shown as (M) or (F) in search results.
  </p>
)}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/OpponentSearch.jsx frontend/src/pages/LeagueDetail.jsx backend/routes/user_routes.py
git commit -m "feat(mixed-doubles): gender indicators in partner search + mixed doubles badge in LeagueDetail"
```

---

### Task 5: Frontend — Mixed Doubles in AdminDashboard format dropdown

**Files:**
- Modify: `frontend/src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Add mixed_doubles to ALL_FORMATS**

In `AdminDashboard.jsx`, find `ALL_FORMATS`:

```js
const ALL_FORMATS = {
  tennis: ["singles", "doubles", "mixed", "mixed_doubles"],
  cricket: ["T10", "T20", "8-a-side", "11-a-side"],
  pickleball: ["singles", "doubles", "mixed", "mixed_doubles"],
};
```

- [ ] **Step 2: Add display label for mixed_doubles**

Find wherever format is displayed as a label (e.g., in league cards in the admin dashboard). Add to format display mapping:

```js
const FORMAT_LABELS = {
  singles: "Singles",
  doubles: "Doubles",
  mixed: "Mixed",
  mixed_doubles: "Mixed Doubles",
};
```

- [ ] **Step 3: Test in browser**

- Admin → Create League → format dropdown includes "Mixed Doubles"
- Created league card shows "Mixed Doubles" format badge

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/AdminDashboard.jsx
git commit -m "feat(mixed-doubles): add mixed_doubles to admin format options"
```

---

### Task 6: Frontend — DUPR profile field in PlayerDashboard (if not already done)

**Files:**
- Check: `frontend/src/pages/PlayerDashboard.jsx`

> **Note:** This task was specified in the Skill Division Routing plan (Task 8). If that plan has been implemented, skip this task — the DUPR field is already present.

- [ ] **Step 1: Verify DUPR field is present**

```bash
grep -n "dupr_rating\|DUPR" frontend/src/pages/PlayerDashboard.jsx
```

If output shows the field — skip to commit. If not found, implement per division routing plan Task 8 Step 1.

- [ ] **Step 2: Ensure DUPR field pre-selects division on pickleball league join**

In `Leagues.jsx`, when the user clicks Join on a pickleball league and `user.dupr_rating` is set, pre-select the matching division in the join modal/flow:

```js
const duprToDivision = {
  "2.0-3.0": "Beginner",
  "3.0-3.5": "Intermediate",
  "3.5-4.5": "Advanced",
  "4.5+": "Competitive",
};

// When opening join flow for pickleball:
const suggestedDivision = league.sport === "pickleball" && user?.dupr_rating
  ? duprToDivision[user.dupr_rating]
  : null;
```

If there's a division selection step in the join flow, default to `suggestedDivision`.

- [ ] **Step 3: Commit (only if changes were made)**

```bash
git add frontend/src/pages/PlayerDashboard.jsx frontend/src/pages/Leagues.jsx
git commit -m "feat(dupr): DUPR pre-selects division on pickleball league join"
```
