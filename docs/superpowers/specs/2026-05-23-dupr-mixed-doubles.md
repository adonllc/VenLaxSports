# DUPR Integration + Mixed Doubles — Spec

**Date:** 2026-05-23
**Scope:** User model (dupr_rating), league format enum (mixed_doubles), registration flow
**Depends on:** Skill Division Routing spec (division_label, dupr_rating on User)
**Approach:** A — Extend existing models, no new collections, no external API calls

---

## Goal

### DUPR
Surface DUPR as the pickleball rating standard throughout VENLAX — at signup, on profiles, and in division labels — without requiring any API integration. Players who know their DUPR use it for accurate division placement. ELO takes over after that.

### Mixed Doubles
Add Mixed Doubles as a first-class league format (one male + one female per team). Uses the existing doubles partner invite flow with a gender validation step.

---

## DUPR Integration

### What it is NOT
- No DUPR API calls
- No match results submitted to DUPR
- No DUPR account required
- Players self-report their bracket (honor system)

### What it IS
- Optional `dupr_rating` field on User: `"2.0-3.0"` | `"3.0-3.5"` | `"3.5-4.5"` | `"4.5+"`
- Shown in pickleball division labels: `Intermediate Doubles (3.0–3.5 DUPR)`
- Pre-selects matching division when joining a pickleball league
- Shown on player profile page

### Backend Changes

#### `backend/models.py`
`dupr_rating` field already added in Skill Division Routing spec (User model). No additional changes.

#### `backend/routes/user_routes.py`
`PATCH /api/users/me` already accepts arbitrary profile fields. No new endpoint needed — just ensure `dupr_rating` is accepted and stored.

### Frontend Changes

#### `frontend/src/pages/PlayerDashboard.jsx` — Profile section
Add pickleball DUPR field:
```
Pickleball Rating (DUPR)
[ 2.0–3.0 ] [ 3.0–3.5 ] [ 3.5–4.5 ] [ 4.5+ ] [ I don't know ]
Don't know your DUPR? Find it at dupr.com →
```
- Saved on change via `PATCH /api/users/me`
- Only shown when user has pickleball in their profile

#### `frontend/src/pages/Leagues.jsx` — League join flow (pickleball leagues)
When user clicks "Join" on a pickleball league:
- If `dupr_rating` not set on user: show inline prompt "What's your DUPR rating?" before division select
- Selected bracket → pre-selects matching division label

#### Division label display — pickleball
All division labels for pickleball leagues append "DUPR" instead of "NTRP":
- Tennis: `Intermediate Singles (3.5–4.0 NTRP)`
- Pickleball: `Intermediate Doubles (3.0–3.5 DUPR)`

Logic in league display component:
```js
const ratingSystem = sport === "pickleball" ? "DUPR" : "NTRP";
```

---

## Mixed Doubles

### Rules
- Format: `"mixed_doubles"` — one male player + one female player per team
- Pricing: $19.99/team (same as doubles — P1 pays upfront)
- Registration: same partner invite flow as doubles
- Gender check: runs when P2 accepts the invite

### Gender data
User model already has `gender: Optional[str]` field (set at registration via Google OAuth or manual entry). For this feature: if `gender` is null, treat as "unspecified" — allow join with warning, do not hard-block.

### Backend Changes

#### `backend/models.py`
Add `"mixed_doubles"` to format enum (comment only — Python doesn't enforce string enums at model level):
```python
format: str  # "singles" | "doubles" | "mixed_doubles" | "T20" | "T10"
```

#### `backend/routes/league_routes.py`

In `POST /api/leagues/:id/join` (doubles partner invite accept path):

When `league.format == "mixed_doubles"` and P2 is accepting invite:
```python
p1_gender = p1_user.get("gender")
p2_gender = p2_user.get("gender")
if p1_gender and p2_gender and p1_gender == p2_gender:
    # Soft warning — do not hard reject in v1
    # Return 200 with warning flag
    return {
        "status": "registered",
        "warning": "Mixed doubles requires one male and one female player. Please verify your team composition."
    }
```

Hard rejection deferred to v2 (too aggressive for launch — some users may not have gender set).

#### `backend/pricing_config.py`
`fee_for_format()` already returns $19.99 for `"doubles"`. Add:
```python
if fmt in ("doubles", "mixed_doubles"):
    return 19.99
```

### Frontend Changes

#### `frontend/src/pages/Leagues.jsx`
- Format filter: add "Mixed Doubles" chip alongside Singles / Doubles
- League card format badge: `Mixed Doubles` in purple (`#7c3aed`)

#### `frontend/src/pages/LeagueDetail.jsx`
- Format shown in header: `Mixed Doubles League`
- Partner search: show gender indicator on player result cards (`M` / `F` / `—`)
- Post-signup: "Mixed Doubles team registered — partner invite sent to [name]"

#### `frontend/src/components/OpponentSearch.jsx`
For mixed doubles leagues: add gender indicator next to player name in search results:
```jsx
<span className="text-xs text-gray-400 ml-1">
  {player.gender === "male" ? "(M)" : player.gender === "female" ? "(F)" : ""}
</span>
```

#### `frontend/src/pages/AdminDashboard.jsx`
League creation form: "Mixed Doubles" option in format dropdown.

---

## Out of Scope

- DUPR API match submission (full integration) — post-launch, requires DUPR partner approval
- Hard gender enforcement on mixed doubles — v2 (requires all users to have gender set)
- Non-binary / gender-neutral division options — v2
- DUPR leaderboard synced from DUPR.com — v2
