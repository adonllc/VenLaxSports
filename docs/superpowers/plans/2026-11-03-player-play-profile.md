# Player Play Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players save how they play (court side, hand, backhand, years, availability, looking-for-partner, per-sport style) and show it on the public profile and in opponent search.

**Architecture:** One `play_profile` sub-document on the `users` collection, validated by a Pydantic `PlayProfile` model. Saved through the existing `PATCH /users/me` and `PATCH /users/me/setup`. Frontend: option lists in one config file, one controlled form component reused by the dashboard card and the setup flow, one read-only chips component.

**Tech Stack:** FastAPI + Pydantic v2 + motor (backend, pytest), React 19 + Tailwind + axios (frontend), Playwright (e2e).

Spec: `docs/superpowers/specs/2026-11-03-player-play-profile-design.md`

Run backend commands from `backend/`. Backend unit tests here import modules directly and need no live server or DB.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `backend/models.py` | Modify | `PlayProfile` + enums; `User.play_profile` |
| `backend/routes/user_routes.py` | Modify | accept `play_profile` in `PATCH /me` and `/me/setup`; `play_search_fields` helper; search output |
| `backend/auth_utils.py` | Modify | `serialize_public_user` includes `play_profile` when public |
| `backend/tests/test_play_profile.py` | Create | unit tests for model, request models, helper, serializer |
| `frontend/src/config/playProfile.js` | Create | option lists, labels, `profileChips()` |
| `frontend/src/components/PlayProfileForm.jsx` | Create | controlled form (no network) |
| `frontend/src/components/PlayProfileChips.jsx` | Create | read-only chips |
| `frontend/src/components/PlayProfileCard.jsx` | Create | dashboard view/edit card, saves via `PATCH /users/me` |
| `frontend/src/pages/PlayerDashboard.jsx` | Modify | mount card |
| `frontend/src/pages/ProfileSetup.jsx` | Modify | optional 4th step |
| `frontend/src/pages/PublicProfile.jsx` | Modify | show chips |
| `frontend/src/components/OpponentSearch.jsx` | Modify | show side/style/partner badge |
| `e2e/play-profile.spec.js` | Create | edit, save, reload persists |

---

### Task 1: `PlayProfile` model

**Files:**
- Modify: `backend/models.py:1` (import), insert after `BaseDocument` (line 35), `User` (line 61-62)
- Test: `backend/tests/test_play_profile.py` (create)

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_play_profile.py`:

```python
import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import PlayProfile, User


class TestPlayProfileModel:
    def test_empty_is_valid(self):
        assert PlayProfile().model_dump(exclude_unset=True) == {}

    def test_full_profile_valid(self):
        pp = PlayProfile(
            court_side="left",
            dominant_hand="right",
            backhand="two_hand",
            years_playing=5,
            availability=["weekday_evening", "weekend_morning"],
            looking_for_partner=True,
            play_style={"tennis": "baseline", "pickleball": "dinker"},
        )
        assert pp.play_style.tennis == "baseline"
        assert pp.availability == ["weekday_evening", "weekend_morning"]

    @pytest.mark.parametrize("field,value", [
        ("court_side", "middle"),
        ("dominant_hand", "both"),
        ("backhand", "three_hand"),
        ("years_playing", -1),
        ("years_playing", 61),
        ("availability", ["midnight"]),
        ("play_style", {"tennis": "dinker"}),
        ("play_style", {"pickleball": "baseline"}),
    ])
    def test_invalid_values_rejected(self, field, value):
        with pytest.raises(ValidationError):
            PlayProfile(**{field: value})

    def test_user_has_optional_play_profile(self):
        u = User(email="a@b.co", name="A")
        assert u.play_profile is None
        u2 = User(email="a@b.co", name="A", play_profile={"court_side": "either"})
        assert u2.play_profile.court_side == "either"
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_play_profile.py -v`
Expected: FAIL / collection error `ImportError: cannot import name 'PlayProfile' from 'models'`

- [ ] **Step 3: Implement**

In `backend/models.py` change line 1 to:

```python
from typing import Optional, List, Dict, Any, Annotated, Literal
```

Insert after the `BaseDocument` class (after line 34, before `class User`):

```python
# ─── Play profile ───────────────────────────────────
# court_side is stored normalized: right = deuce side, left = ad side (tennis);
# right/left as-is for pickleball. The UI labels it per sport.
CourtSide = Literal["left", "right", "either"]
AvailabilitySlot = Literal[
    "weekday_morning", "weekday_evening",
    "weekend_morning", "weekend_afternoon", "weekend_evening",
]
TennisStyle = Literal["baseline", "serve_volley", "all_court", "aggressive", "counterpuncher"]
PickleballStyle = Literal["banger", "dinker", "all_court"]


class PlayStyle(BaseModel):
    tennis: Optional[TennisStyle] = None
    pickleball: Optional[PickleballStyle] = None


class PlayProfile(BaseModel):
    court_side: Optional[CourtSide] = None
    dominant_hand: Optional[Literal["right", "left"]] = None
    backhand: Optional[Literal["one_hand", "two_hand"]] = None  # tennis only
    years_playing: Optional[int] = Field(default=None, ge=0, le=60)
    availability: Optional[List[AvailabilitySlot]] = None
    looking_for_partner: Optional[bool] = None
    play_style: Optional[PlayStyle] = None


```

In `class User`, after the line `    home_court: Optional[str] = None` add:

```python
    play_profile: Optional[PlayProfile] = None
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_play_profile.py -v`
Expected: all PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/tests/test_play_profile.py
git commit -m "feat(profile): PlayProfile model and User.play_profile"
```

---

### Task 2: Accept `play_profile` on profile endpoints + search fields

**Files:**
- Modify: `backend/routes/user_routes.py:9` (import), `:53-61` (search result), `:65-80` (request models), `:88-100` (setup handler)
- Test: `backend/tests/test_play_profile.py` (append)

Note on `PATCH /users/me`: the handler already uses `model_dump(exclude_unset=True)`, sends `None` values to `$unset` and others to `$set`. A `PlayProfile` value is dumped to a dict, so it is saved as a whole-sub-document replace and `play_profile: null` clears it. No handler change is needed there, only the field on `UserProfileUpdate`.

- [ ] **Step 1: Write the failing tests** (append to `backend/tests/test_play_profile.py`)

```python
from routes.user_routes import (
    UserProfileUpdate, ProfileSetupIn, play_search_fields,
)


class TestRequestModels:
    def test_profile_update_dumps_only_set_nested_keys(self):
        body = UserProfileUpdate(play_profile={"court_side": "left"})
        assert body.model_dump(exclude_unset=True) == {"play_profile": {"court_side": "left"}}

    def test_profile_update_null_clears(self):
        body = UserProfileUpdate(play_profile=None)
        assert body.model_dump(exclude_unset=True) == {"play_profile": None}

    def test_profile_update_rejects_bad_enum(self):
        with pytest.raises(ValidationError):
            UserProfileUpdate(play_profile={"court_side": "middle"})

    def test_setup_accepts_play_profile(self):
        body = ProfileSetupIn(play_profile={"looking_for_partner": True})
        assert body.play_profile.looking_for_partner is True


class TestSearchFields:
    def test_returns_fields_for_public_user(self):
        u = {"profile_public": True, "play_profile": {
            "court_side": "right", "play_style": {"tennis": "baseline"}, "looking_for_partner": True,
            "dominant_hand": "left"}}
        assert play_search_fields(u) == {
            "court_side": "right",
            "play_style": {"tennis": "baseline"},
            "looking_for_partner": True,
        }

    def test_hidden_for_private_user(self):
        u = {"profile_public": False, "play_profile": {"court_side": "right", "looking_for_partner": True}}
        assert play_search_fields(u) == {"court_side": None, "play_style": None, "looking_for_partner": False}

    def test_missing_profile(self):
        assert play_search_fields({}) == {"court_side": None, "play_style": None, "looking_for_partner": False}
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_play_profile.py -v`
Expected: FAIL `ImportError: cannot import name 'play_search_fields'`

- [ ] **Step 3: Implement**

In `backend/routes/user_routes.py` change line 9 to:

```python
from models import UserFollow, PlayProfile
```

Add this helper directly above `@router.get("/search")`:

```python
def play_search_fields(u: dict) -> dict:
    """Play-profile bits shown in opponent search. Empty for private profiles."""
    empty = {"court_side": None, "play_style": None, "looking_for_partner": False}
    if not u.get("profile_public", True):
        return empty
    pp = u.get("play_profile") or {}
    return {
        "court_side": pp.get("court_side"),
        "play_style": pp.get("play_style"),
        "looking_for_partner": bool(pp.get("looking_for_partner")),
    }
```

In the search result dict, after `"pickleball_rating": u.get("pickleball_rating"),` add:

```python
            **play_search_fields(u),
```

In `UserProfileUpdate` add after `sport_preferences`:

```python
    play_profile: Optional[PlayProfile] = None
```

In `ProfileSetupIn` add after `city`:

```python
    play_profile: Optional[PlayProfile] = None
```

In `profile_setup`, after the `if body.city is not None:` block (before `await db.users.update_one`), add:

```python
    if body.play_profile is not None:
        update["play_profile"] = body.play_profile.model_dump(exclude_unset=True)
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_play_profile.py -v`
Expected: all PASS (19 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/user_routes.py backend/tests/test_play_profile.py
git commit -m "feat(profile): accept play_profile on PATCH /users/me and /me/setup, expose in search"
```

---

### Task 3: Public serializer

**Files:**
- Modify: `backend/auth_utils.py:178-191`
- Test: `backend/tests/test_play_profile.py` (append)

- [ ] **Step 1: Write the failing tests** (append)

```python
from auth_utils import serialize_public_user


class TestPublicSerializer:
    def test_includes_play_profile_when_public(self):
        u = {"_id": "1", "name": "A", "profile_public": True,
             "play_profile": {"court_side": "left"}, "phone": "+1-555"}
        out = serialize_public_user(u)
        assert out["play_profile"] == {"court_side": "left"}
        assert "phone" not in out

    def test_omits_play_profile_when_private(self):
        u = {"_id": "1", "name": "A", "profile_public": False, "play_profile": {"court_side": "left"}}
        assert serialize_public_user(u)["play_profile"] is None

    def test_none_when_unset(self):
        assert serialize_public_user({"_id": "1", "name": "A"})["play_profile"] is None
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_play_profile.py::TestPublicSerializer -v`
Expected: FAIL `KeyError: 'play_profile'`

- [ ] **Step 3: Implement**

In `serialize_public_user`, after the `"founding_member": ...` line add:

```python
        "play_profile": (user.get("play_profile") or None) if user.get("profile_public", True) else None,
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_play_profile.py -v`
Expected: all PASS (22 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/auth_utils.py backend/tests/test_play_profile.py
git commit -m "feat(profile): include play_profile in public player serializer"
```

---

### Task 4: Frontend option config

**Files:**
- Create: `frontend/src/config/playProfile.js`

- [ ] **Step 1: Create the file**

```js
// Option lists for the play profile. Values must match backend/models.py (PlayProfile).

export const COURT_SIDE_LABELS = {
  tennis: { right: "Deuce side", left: "Ad side", either: "Either side" },
  pickleball: { right: "Right side", left: "Left side", either: "Either side" },
};

// Read-only views (public profile, search) are not tied to one sport, so keep labels neutral.
export const COURT_SIDE_NEUTRAL = { right: "Right side", left: "Left side", either: "Either side" };

export const HANDS = [
  { value: "right", label: "Right-handed" },
  { value: "left", label: "Left-handed" },
];

export const BACKHANDS = [
  { value: "one_hand", label: "One-handed backhand" },
  { value: "two_hand", label: "Two-handed backhand" },
];

export const STYLE_OPTIONS = {
  tennis: [
    { value: "baseline", label: "Baseliner" },
    { value: "serve_volley", label: "Serve & volley" },
    { value: "all_court", label: "All-court" },
    { value: "aggressive", label: "Aggressive" },
    { value: "counterpuncher", label: "Counterpuncher" },
  ],
  pickleball: [
    { value: "banger", label: "Banger" },
    { value: "dinker", label: "Dinker" },
    { value: "all_court", label: "All-court" },
  ],
};

export const AVAILABILITY = [
  { value: "weekday_morning", label: "Weekday mornings" },
  { value: "weekday_evening", label: "Weekday evenings" },
  { value: "weekend_morning", label: "Weekend mornings" },
  { value: "weekend_afternoon", label: "Weekend afternoons" },
  { value: "weekend_evening", label: "Weekend evenings" },
];

const labelOf = (list, value) => list.find((o) => o.value === value)?.label;

export function courtSideOptions(sports) {
  const sport = !sports.length || sports.includes("tennis") ? "tennis" : "pickleball";
  const labels = COURT_SIDE_LABELS[sport];
  return [
    { value: "right", label: labels.right },
    { value: "left", label: labels.left },
    { value: "either", label: labels.either },
  ];
}

/** Flat list of display strings for the read-only chips. */
export function profileChips(pp) {
  if (!pp) return [];
  const chips = [];
  if (pp.looking_for_partner) chips.push("Looking for a partner");
  if (pp.court_side) chips.push(COURT_SIDE_NEUTRAL[pp.court_side]);
  if (pp.dominant_hand) chips.push(labelOf(HANDS, pp.dominant_hand));
  if (pp.backhand) chips.push(labelOf(BACKHANDS, pp.backhand));
  if (pp.play_style?.tennis) chips.push(`Tennis: ${labelOf(STYLE_OPTIONS.tennis, pp.play_style.tennis)}`);
  if (pp.play_style?.pickleball) chips.push(`Pickleball: ${labelOf(STYLE_OPTIONS.pickleball, pp.play_style.pickleball)}`);
  if (pp.years_playing != null) chips.push(`${pp.years_playing} yr${pp.years_playing === 1 ? "" : "s"} playing`);
  (pp.availability || []).forEach((a) => chips.push(labelOf(AVAILABILITY, a)));
  return chips.filter(Boolean);
}
```

- [ ] **Step 2: Verify it builds**

Run (from `frontend/`): `yarn build`
Expected: build succeeds (file is unused yet, so this only checks syntax if imported; if tree-shaken, continue and verify in Task 5).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/config/playProfile.js
git commit -m "feat(profile): play profile option config"
```

---

### Task 5: Form and chips components

**Files:**
- Create: `frontend/src/components/PlayProfileForm.jsx`
- Create: `frontend/src/components/PlayProfileChips.jsx`

- [ ] **Step 1: Create `PlayProfileForm.jsx`**

```jsx
import { AVAILABILITY, BACKHANDS, HANDS, STYLE_OPTIONS, courtSideOptions } from "../config/playProfile";

function Pill({ active, onClick, testId, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="px-3 py-1.5 text-sm font-medium transition-colors"
      style={active
        ? { background: "#008F70", color: "#FFFFFF", border: "1px solid #008F70" }
        : { background: "#FFFFFF", color: "#374151", border: "1px solid #E5E7EB" }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function Group({ label, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#6B7280" }}>{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * Controlled play-profile form. `value` is the play_profile object (may be empty),
 * `onChange(next)` receives the whole next object. Clicking a selected option clears it.
 */
export default function PlayProfileForm({ value, onChange, sports = [] }) {
  const showTennis = !sports.length || sports.includes("tennis");
  const showPickleball = !sports.length || sports.includes("pickleball");

  const setKey = (key, v) => {
    const next = { ...value };
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) delete next[key];
    else next[key] = v;
    onChange(next);
  };
  const toggleKey = (key, v) => setKey(key, value[key] === v ? undefined : v);

  const setStyle = (sport, v) => {
    const style = { ...(value.play_style || {}) };
    if (style[sport] === v) delete style[sport];
    else style[sport] = v;
    setKey("play_style", Object.keys(style).length ? style : undefined);
  };

  const toggleAvailability = (v) => {
    const cur = value.availability || [];
    setKey("availability", cur.includes(v) ? cur.filter((a) => a !== v) : [...cur, v]);
  };

  return (
    <div className="space-y-5" data-testid="play-profile-form">
      <Group label="Preferred court side">
        {courtSideOptions(sports).map((o) => (
          <Pill key={o.value} active={value.court_side === o.value} onClick={() => toggleKey("court_side", o.value)} testId={`pp-court-side-${o.value}`}>
            {o.label}
          </Pill>
        ))}
      </Group>

      <Group label="Dominant hand">
        {HANDS.map((o) => (
          <Pill key={o.value} active={value.dominant_hand === o.value} onClick={() => toggleKey("dominant_hand", o.value)} testId={`pp-hand-${o.value}`}>
            {o.label}
          </Pill>
        ))}
      </Group>

      {showTennis && (
        <Group label="Backhand (tennis)">
          {BACKHANDS.map((o) => (
            <Pill key={o.value} active={value.backhand === o.value} onClick={() => toggleKey("backhand", o.value)} testId={`pp-backhand-${o.value}`}>
              {o.label}
            </Pill>
          ))}
        </Group>
      )}

      {showTennis && (
        <Group label="Tennis play style">
          {STYLE_OPTIONS.tennis.map((o) => (
            <Pill key={o.value} active={value.play_style?.tennis === o.value} onClick={() => setStyle("tennis", o.value)} testId={`pp-style-tennis-${o.value}`}>
              {o.label}
            </Pill>
          ))}
        </Group>
      )}

      {showPickleball && (
        <Group label="Pickleball play style">
          {STYLE_OPTIONS.pickleball.map((o) => (
            <Pill key={o.value} active={value.play_style?.pickleball === o.value} onClick={() => setStyle("pickleball", o.value)} testId={`pp-style-pickleball-${o.value}`}>
              {o.label}
            </Pill>
          ))}
        </Group>
      )}

      <div>
        <label htmlFor="pp-years" className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#6B7280" }}>
          Years playing
        </label>
        <input
          id="pp-years"
          type="number"
          min={0}
          max={60}
          value={value.years_playing ?? ""}
          onChange={(e) => setKey("years_playing", e.target.value === "" ? undefined : Math.min(60, Math.max(0, parseInt(e.target.value, 10) || 0)))}
          className="w-24 px-3 py-1.5 text-sm"
          style={{ border: "1px solid #E5E7EB", color: "#3D3D3D", background: "white" }}
          data-testid="pp-years"
        />
      </div>

      <Group label="Availability">
        {AVAILABILITY.map((o) => (
          <Pill key={o.value} active={(value.availability || []).includes(o.value)} onClick={() => toggleAvailability(o.value)} testId={`pp-avail-${o.value}`}>
            {o.label}
          </Pill>
        ))}
      </Group>

      <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "#374151" }}>
        <input
          type="checkbox"
          checked={!!value.looking_for_partner}
          onChange={(e) => setKey("looking_for_partner", e.target.checked ? true : undefined)}
          data-testid="pp-looking-for-partner"
        />
        I'm looking for a doubles partner
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Create `PlayProfileChips.jsx`**

```jsx
import { profileChips } from "../config/playProfile";

/** Read-only chips. Renders nothing when the profile is empty. */
export default function PlayProfileChips({ profile, testId = "play-profile-chips" }) {
  const chips = profileChips(profile);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5" data-testid={testId}>
      {chips.map((c) => (
        <span
          key={c}
          className="px-2 py-0.5 text-xs font-medium"
          style={{ background: "#F1F1F1", color: "#374151" }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run (from `frontend/`): `yarn build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PlayProfileForm.jsx frontend/src/components/PlayProfileChips.jsx
git commit -m "feat(profile): play profile form and chips components"
```

---

### Task 6: Dashboard card

**Files:**
- Create: `frontend/src/components/PlayProfileCard.jsx`
- Modify: `frontend/src/pages/PlayerDashboard.jsx:10` (import), `:337` (mount)

- [ ] **Step 1: Create `PlayProfileCard.jsx`**

```jsx
import { useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import PlayProfileForm from "./PlayProfileForm";
import PlayProfileChips from "./PlayProfileChips";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function PlayProfileCard() {
  const { user, fetchMe } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!user) return null;
  const profile = user.play_profile || {};
  const hasProfile = Object.keys(profile).length > 0;

  const startEdit = () => { setDraft(profile); setError(""); setEditing(true); };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await axios.patch(
        `${API}/users/me`,
        { play_profile: Object.keys(draft).length ? draft : null },
        { withCredentials: true }
      );
      await fetchMe();
      setEditing(false);
    } catch {
      setError("Could not save your play profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-none p-6 mb-6" style={{ border: "1px solid #E5E7EB" }} data-testid="play-profile-card">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-heading font-bold text-lg" style={{ color: "#3D3D3D" }}>Play profile</h2>
        {!editing && (
          <button onClick={startEdit} className="text-xs font-semibold" style={{ color: "#008F70" }} data-testid="edit-play-profile-btn">
            {hasProfile ? "Edit" : "Add"}
          </button>
        )}
      </div>

      {editing ? (
        <>
          <PlayProfileForm value={draft} onChange={setDraft} sports={user.sport_preferences || []} />
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 text-sm font-bold disabled:opacity-60"
              style={{ background: "#F2A922", color: "#1D1D1D" }}
              data-testid="save-play-profile-btn"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-sm font-semibold"
              style={{ color: "#6B7280" }}
              data-testid="cancel-play-profile-btn"
            >
              Cancel
            </button>
            {error && <span className="text-xs text-red-600" data-testid="play-profile-error">{error}</span>}
          </div>
        </>
      ) : hasProfile ? (
        <PlayProfileChips profile={profile} testId="play-profile-summary" />
      ) : (
        <p className="text-sm" style={{ color: "#6B7280" }}>
          Tell opponents and partners how you play: court side, style, when you're free.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount in `PlayerDashboard.jsx`**

After line 10 (`import SeasonRecaps from "../components/SeasonRecaps";`) add:

```jsx
import PlayProfileCard from "../components/PlayProfileCard";
```

Replace the line `        {/* DUPR Rating */}` with:

```jsx
        <PlayProfileCard />

        {/* DUPR Rating */}
```

- [ ] **Step 3: Verify build**

Run (from `frontend/`): `yarn build`
Expected: succeeds.

- [ ] **Step 4: Manual check**

Run backend (`uvicorn server:app --reload --port 8001` in `backend/`) and frontend (`yarn start`). Log in, open `/dashboard`: card shows "Add". Select a side and style, Save: chips appear. Reload: chips persist. Click Edit, deselect everything, Save: card shows empty-state text.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PlayProfileCard.jsx frontend/src/pages/PlayerDashboard.jsx
git commit -m "feat(profile): play profile card on player dashboard"
```

---

### Task 7: Optional setup step

**Files:**
- Modify: `frontend/src/pages/ProfileSetup.jsx:5-6`, `:22`, `:29-34`, `:173-191`

Home court stays step 2. Its "Go to Dashboard" button becomes "Continue" and a new step 3 holds the form and the finish button. Skip stays available on both.

- [ ] **Step 1: Edit imports** — after `import { activeSports } from "../config/platformConfig";` add:

```jsx
import PlayProfileForm from "../components/PlayProfileForm";
```

- [ ] **Step 2: Edit steps and state**

Replace `const STEPS = ["Sports", "Skill Level", "Home Court"];` with:

```jsx
const STEPS = ["Sports", "Skill Level", "Home Court", "Play Style"];
```

Replace the `form` initial state block with:

```jsx
  const [form, setForm] = useState({
    sport_preferences: user?.sport_preferences || [],
    skill_level: user?.skill_level || "",
    home_court: user?.home_court || "",
    city: user?.city || "",
    play_profile: user?.play_profile || {},
  });
```

- [ ] **Step 3: Send `play_profile` only when filled**

Replace the line `await axios.patch(`${API}/users/me/setup`, form, { withCredentials: true });` with:

```jsx
      const { play_profile, ...rest } = form;
      const payload = Object.keys(play_profile).length ? { ...rest, play_profile } : rest;
      await axios.patch(`${API}/users/me/setup`, payload, { withCredentials: true });
```

- [ ] **Step 4: Change step 2's finish button to Continue**

In the step 2 block, replace the button with `onClick={handleFinish}` ... through its closing `</button>` (the one with `data-testid="finish-setup-btn"`) with:

```jsx
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-3.5 bg-[#008F70] text-white font-semibold rounded-full hover:bg-[#00765C] transition-colors text-sm flex items-center justify-center gap-2"
                  data-testid="next-step-3"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
```

- [ ] **Step 5: Add step 3** — immediately before the closing `</div>` of the white card (the line `        </div>` that follows the step 2 block's `)}`), add:

```jsx
          {/* Step 3: Play style (optional) */}
          {step === 3 && (
            <>
              <h2 className="font-heading font-bold text-2xl text-heading-dark mb-2">How do you play?</h2>
              <p className="text-sm text-gray-500 mb-6">Optional. Helps opponents and doubles partners find you. Change it anytime on your dashboard.</p>
              <div className="mb-8">
                <PlayProfileForm
                  value={form.play_profile}
                  onChange={(pp) => setForm((f) => ({ ...f, play_profile: pp }))}
                  sports={form.sport_preferences}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-3.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">
                  Back
                </button>
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex-1 py-3.5 bg-[#008F70] text-white font-semibold rounded-full hover:bg-[#00765C] transition-colors disabled:opacity-60 text-sm"
                  data-testid="finish-setup-btn"
                >
                  {saving ? "Saving..." : "Go to Dashboard"}
                </button>
              </div>
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4"
              >
                Skip for now
              </button>
            </>
          )}
```

- [ ] **Step 6: Verify**

Run (from `frontend/`): `yarn build` → succeeds. Manual: `/profile-setup`, walk steps 0→3, pick a style, finish; `/dashboard` card shows it. Repeat without touching step 3: no `play_profile` in the request (check Network tab), existing flow unchanged.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/ProfileSetup.jsx
git commit -m "feat(profile): optional play style step in profile setup"
```

---

### Task 8: Public profile and opponent search

**Files:**
- Modify: `frontend/src/pages/PublicProfile.jsx` (import, after city block ~line 155)
- Modify: `frontend/src/components/OpponentSearch.jsx:3`, `:119-127`

- [ ] **Step 1: PublicProfile** — add to the imports at the top of the file:

```jsx
import PlayProfileChips from "../components/PlayProfileChips";
```

In the player card, directly after the `{profile.city && ( ... )}` block (the `<p className="flex items-center gap-1 ...">` ending at the line `)}` before `</div>` that closes the `min-w-0` div), add:

```jsx
              {profile.play_profile && (
                <div className="mt-3">
                  <PlayProfileChips profile={profile.play_profile} testId="public-play-profile" />
                </div>
              )}
```

- [ ] **Step 2: OpponentSearch** — add import:

```jsx
import { profileChips } from "../config/playProfile";
```

In the result row, after the email `<p className="text-xs text-gray-500 truncate">{u.email}</p>` (inside the `min-w-0 flex-1` div, the one in the results map, not the selected-state one) add:

```jsx
                {(() => {
                  const bits = profileChips({
                    court_side: u.court_side,
                    play_style: u.play_style,
                    looking_for_partner: u.looking_for_partner,
                  });
                  return bits.length ? (
                    <p className="text-[11px] text-gray-400 truncate" data-testid={`${testId}-play-${u.id}`}>{bits.join(" · ")}</p>
                  ) : null;
                })()}
```

- [ ] **Step 3: Verify**

Run (from `frontend/`): `yarn build` → succeeds. Manual: open `/players/<id>` of a user with a saved profile, chips show; of a user with none, nothing extra. Open any page with `OpponentSearch`, type 2+ letters, a user with a profile shows the dotted summary line.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PublicProfile.jsx frontend/src/components/OpponentSearch.jsx
git commit -m "feat(profile): show play profile on public profile and opponent search"
```

---

### Task 9: E2E and full verification

**Files:**
- Create: `e2e/play-profile.spec.js`

Needs a real test account. Set `E2E_EMAIL` and `E2E_PASSWORD`; the test skips when unset.

- [ ] **Step 1: Create the spec**

```js
import { test, expect } from '@playwright/test';
import { loginUser, fixtures } from './fixtures.js';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe('play profile', () => {
  test.skip(!email || !password, 'E2E_EMAIL / E2E_PASSWORD not set');

  test('edit, save, and persist after reload', async ({ page }) => {
    await loginUser(page, email, password);
    await page.goto(`${fixtures.BASE_URL}/dashboard`);

    await page.getByTestId('edit-play-profile-btn').click();
    await page.getByTestId('pp-court-side-left').click();
    await page.getByTestId('pp-hand-right').click();
    await page.getByTestId('pp-avail-weekend_morning').click();
    await page.getByTestId('pp-looking-for-partner').check();
    await page.getByTestId('save-play-profile-btn').click();

    const summary = page.getByTestId('play-profile-summary');
    await expect(summary).toContainText('Left side');
    await expect(summary).toContainText('Looking for a partner');

    await page.reload();
    await expect(page.getByTestId('play-profile-summary')).toContainText('Weekend mornings');
  });
});
```

- [ ] **Step 2: Run backend suite for this feature**

Run (from `backend/`): `python -m pytest tests/test_play_profile.py -v`
Expected: 22 passed

- [ ] **Step 3: Run e2e**

Run (from repo root, servers running, `SKIP_SERVER=1`): `E2E_EMAIL=<test account> E2E_PASSWORD=<pw> SKIP_SERVER=1 npx playwright test e2e/play-profile.spec.js`
Expected: 1 passed. Without the env vars: 1 skipped.

- [ ] **Step 4: Final build**

Run (from `frontend/`): `yarn build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add e2e/play-profile.spec.js
git commit -m "test(profile): e2e for play profile edit and persist"
```

---

## Self-review (spec coverage)

- Data model, enums, bounds → Task 1.
- `PATCH /users/me`, `/me/setup` accept it; invalid → 422; `null` unsets → Task 2.
- `/users/search` returns `court_side`, `play_style`, `looking_for_partner` → Task 2 (hidden for private profiles).
- `serialize_public_user` gated by `profile_public`; phone stays private → Task 3.
- Sport-aware labels (Deuce/Ad vs Left/Right), backhand hidden without tennis → Tasks 4-5. Read-only chips use neutral side labels because the public payload has no sport list.
- Dashboard editor, optional setup step with skip → Tasks 6-7.
- Public profile chips, search badge → Task 8.
- Tests: pytest + Playwright → Tasks 1-3, 9. Spec's "failed save shows inline error" → `play-profile-error` in Task 6 (manual check: stop backend, press Save).
- Out of scope respected: no partner-finder page, no matching, no signup-form fields.
