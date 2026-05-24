# Skill Division Routing — Spec

**Date:** 2026-05-23
**Scope:** League model, User model, league registration flow, league listing UI
**Approach:** A — Extend existing models, no new collections

---

## Goal

Add skill division labels to leagues so players self-select into the right competition level. Foundational for Box League and Challenge Ladder. Backward compatible — existing leagues without a division show as "Open Division."

---

## Division Labels

| Label | Tennis NTRP | Pickleball DUPR |
|---|---|---|
| Beginner | 2.5–3.0 | 2.0–3.0 |
| Intermediate | 3.5–4.0 | 3.0–3.5 |
| Advanced | 4.0–4.5 | 3.5–4.5 |
| Competitive | 4.5+ | 4.5+ |

Display format everywhere: `Intermediate Singles (3.5–4.0 NTRP)` or `Intermediate Doubles (3.0–3.5 DUPR)`

No enforcement — honor system. ELO self-corrects after matches. Admin can override player division on admin dashboard.

---

## Backend Changes

### `backend/models.py`

Add to `League` model:
```python
division_label: Optional[str] = None      # "Beginner" | "Intermediate" | "Advanced" | "Competitive" | None
division_ntrp_min: Optional[float] = None # e.g. 3.5
division_ntrp_max: Optional[float] = None # e.g. 4.0
```

Add to `User` model:
```python
dupr_rating: Optional[str] = None  # "2.0-3.0" | "3.0-3.5" | "3.5-4.5" | "4.5+" | None
```

### `backend/routes/league_routes.py`

- `GET /api/leagues` — add optional `?division=Intermediate` filter
- `POST /api/leagues` (admin) — accept `division_label`, `division_ntrp_min`, `division_ntrp_max` in body
- No changes to join flow — division is informational only

### `backend/routes/user_routes.py`

- `PATCH /api/users/me` — accept `dupr_rating` in body

### `backend/seeds/leagues.py`

- Update existing seed leagues to include `division_label` and ranges where appropriate

---

## Frontend Changes

### `frontend/src/pages/Leagues.jsx`

- Division filter chips: All · Beginner · Intermediate · Advanced · Competitive
- League card: show division badge `Intermediate (3.5–4.0 NTRP)` below sport/format tags
- If `division_label` is null: show "Open Division" badge

### `frontend/src/pages/LeagueDetail.jsx`

- Division shown in header: `Austin Intermediate Singles League (3.5–4.0 NTRP)`

### `frontend/src/pages/PlayerDashboard.jsx`

- Registered leagues list: show division label alongside league name

### `frontend/src/pages/AdminDashboard.jsx`

- League creation form: add Division dropdown (None / Beginner / Intermediate / Advanced / Competitive)
- Auto-populate NTRP/DUPR min/max based on selected label and sport

### `frontend/src/pages/PlayerDashboard.jsx` — Profile section

- Pickleball DUPR field: "What's your DUPR rating?" with 4 bracket options (`2.0–3.0` / `3.0–3.5` / `3.5–4.5` / `4.5+`)
- Saved via `PATCH /api/users/me` with `{dupr_rating: "3.0-3.5"}`
- Only shown when user has pickleball sport on their profile
- Pre-selects matching division label when joining pickleball leagues

---

## Out of Scope

- Automated division enforcement (ELO gate blocking join)
- Division-based waitlist/queue
- Cross-division playoffs
