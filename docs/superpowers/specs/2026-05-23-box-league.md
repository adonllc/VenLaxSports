# Box League — Spec

**Date:** 2026-05-23
**Scope:** New `league_type: "box_league"`, season assignment, promotion/relegation
**Depends on:** Skill Division Routing spec (division_label fields)
**Approach:** A — Extend league_type enum, reuse round-robin match engine

---

## Goal

Groups of 6 players in a "box" play each other (5 matches). At season end, top 2 promote to higher division, bottom 2 relegate down. Highest engagement format — players return next season to protect/improve their division standing.

---

## How It Works

1. Admin creates Box League (`league_type: "box_league"`, division_label set)
2. Players register normally ($9.99 singles / $19.99 doubles per player)
3. Admin triggers box assignment — players grouped into boxes of 6 by ELO (serpentine order)
4. System generates all 15 match pairs per box — same 7-day flex schedule
5. Matches play out — same score reporting + ELO update flow
6. Admin triggers season finalize — standings computed, top 2 flagged for promotion, bottom 2 for relegation
7. Next season opens — promoted/relegated players notified, can register for new division

---

## Data Model Changes

### `backend/models.py`

Add to `League` model:
```python
# league_type already exists — add "box_league" as valid value
box_group_size: int = 6     # players per box (fixed at 6 for v1)
box_promote: int = 2        # top N per box promote to next division
box_relegate: int = 2       # bottom N per box relegate to lower division
```

Add to `Season` model:
```python
box_assignments: Optional[list] = None
# Structure: [{"box_id": "A", "player_ids": ["uid1", "uid2", ...]}, ...]
```

Add to player join document (within Season.players list entry):
```python
box_id: Optional[str] = None        # "A" | "B" | "C" etc.
promotion_status: Optional[str] = None   # "promoted" | "relegated" | None
```

---

## Backend Changes

### New file: `backend/routes/box_league_routes.py`

#### `POST /api/box-leagues/:league_id/assign-boxes`
- Admin only
- Fetch all registered players for the season, sorted by ELO descending
- Serpentine group assignment: player 1→Box A, 2→Box B, 3→Box C, 4→Box C, 5→Box B, 6→Box A, 7→Box A...
- Generate all match pairs within each box (C(6,2) = 15 matches per box)
- Store box_assignments on Season, box_id on each player entry
- Create all Match documents (status: "scheduled")
- Return: `{boxes: [{box_id, players, match_count}]}`

#### `GET /api/box-leagues/:league_id/standings`
- Public
- Return per-box standings: wins, losses, sets_won, games_won (for tiebreaker)
- Sorted: W desc → head-to-head → games_won desc
- Include promotion/relegation thresholds (top 2 / bottom 2 highlighted)

#### `POST /api/box-leagues/:league_id/finalize`
- Admin only
- Compute final standings per box
- Top `box_promote` players per box: set `promotion_status: "promoted"`
- Bottom `box_relegate` players per box: set `promotion_status: "relegated"`
- Send email to each player with their result
- Return: `{promoted: [...], relegated: [...], mid: [...]}`

### Mount in `backend/server.py`
```python
from routes.box_league_routes import router as box_league_router
app.include_router(box_league_router, prefix="/api")
```

---

## Frontend Changes

### `frontend/src/pages/LeagueDetail.jsx`

For `league_type === "box_league"`:
- Show tabs: Box A · Box B · Box C (one per box)
- Each tab: standings table with columns: Rank / Player / W / L / Status
- Status badge: "Promoting ↑" (green) / "Relegating ↓" (red) / "" (mid)
- Hide match schedule tab (too many matches) — show per-box match list instead

### `frontend/src/pages/PlayerDashboard.jsx`

Add "Box League" card:
```
Austin Intermediate Singles
Box B · Rank #2 of 6 · 3-1
Status: On track to promote ↑
```

End-of-season banner (when `promotion_status` set):
- Promoted: "You finished 2nd in Box B — promoted to Advanced next season!"
- Relegated: "You finished 5th in Box B — relegated to Beginner next season."
- Mid: "Season complete. You finished 3rd in Box B."

### `frontend/src/pages/AdminDashboard.jsx`

- League creation: when `league_type = "box_league"` selected, show box config fields (group size locked at 6, promote/relegate shown as info)
- Box League tab: "Assign Boxes" button (triggers assign-boxes API) + "Finalize Season" button

---

## Email Templates

### Promotion email
Subject: `You've been promoted on VENLAX!`
Body: `You finished #2 in Box B of the Austin Intermediate Singles League. You're promoted to Advanced next season. Register now: [link]`

### Relegation email
Subject: `Season results — VENLAX Austin`
Body: `You finished #5 in Box B. You've been moved to the Beginner division for next season. [link]`

---

## Tiebreaker Rules (within a box)

1. Wins (W-L record)
2. Head-to-head result between tied players
3. Sets won across all matches
4. Games won across all matches
5. ELO rating (final tiebreaker)

---

## Out of Scope

- Flexible box size (admin-configurable) — always 6 for v1
- Cross-box playoffs (top 1 per box playoff bracket) — v2
- Automatic next-season registration for promoted players — v2
- Waitlist for oversubscribed boxes — v2
