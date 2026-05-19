# Flex Round Robin League — Design Spec

**Date:** 2026-05-18  
**Status:** Approved  
**Scope:** Add Flex Round Robin as a new league format alongside existing Flex Leagues on VenLax Sports (venlaxsports.com)

---

## Overview

Flex Round Robin is a structured league format for busy players. Unlike the existing Flex League (fully self-scheduled, open-ended), Round Robin auto-generates a complete schedule of matchups at league start, assigns each match to a week, and auto-generates playoffs when all matches complete. Supports Tennis and Pickleball, Singles and Fixed-Partner Doubles.

---

## User-Facing Entry Points

- **Browse:** `/leagues/round-robin` — dedicated listing page (separate from `/leagues`)
- **Detail:** `/round-robin/:id` — league detail with Schedule / Standings / Playoffs tabs
- **Partner invite:** `/round-robin/invite/:token` — partner confirmation page
- **Navbar:** "Round Robin" link added to leagues dropdown

---

## Section 1 — Data Models

### League model changes (`backend/models.py`)

Add two fields to `League` and `LeagueCreate`:

```python
league_type: str = "flex"        # "flex" | "round_robin"
rr_config: Optional[Dict] = None
```

`rr_config` shape (only set when `league_type = "round_robin"`):

```json
{
  "min_players": 6,
  "max_players": 12,
  "division_type": "singles",
  "scoring_format": "fast4",
  "playoff_threshold": 4,
  "schedule_generated": false,
  "playoff_generated": false,
  "auto_started_at": null
}
```

Scoring format values:
- Tennis: `"fast4"` (default) | `"pro_set"` | `"best_of_3"`
- Pickleball: `"to_11"` (default) | `"to_15"`
- Auto-set on schedule generation based on sport — admin does not choose.

### Match model changes (`backend/models.py`)

Add fields:

```python
round: Optional[int] = None              # week number in RR schedule; None for flex leagues
team1_partner_id: Optional[str] = None   # doubles only
team1_partner_name: Optional[str] = None
team2_partner_id: Optional[str] = None
team2_partner_name: Optional[str] = None
```

Playoff rounds use string values: `"QF"` | `"SF"` | `"F"` | `"3rd"`.
Singles matches: partner fields are None.

### New collection: `rr_schedules`

One document per league. Stores the full generated schedule.

```json
{
  "league_id": "...",
  "rounds": [
    {
      "round": 1,
      "week_start": "2026-06-01",
      "week_end": "2026-06-07",
      "matches": [
        { "player1_id": "...", "player1_name": "...", "player2_id": "...", "player2_name": "...", "match_id": "..." }
      ]
    }
  ],
  "created_at": "..."
}
```

For doubles, `player1_id` / `player2_id` refer to the team's primary player (inviter); `team1_partner_id` / `team2_partner_id` store the partner. Match document stores both.

### New collection: `doubles_invites`

```json
{
  "league_id": "...",
  "inviter_id": "...",
  "inviter_name": "...",
  "partner_email": "...",
  "token": "<uuid4>",
  "status": "pending",
  "expires_at": "<72h from creation>",
  "created_at": "..."
}
```

Status values: `"pending"` | `"accepted"` | `"expired"`

---

## Section 2 — Backend Routes

New file: `backend/routes/round_robin_routes.py`  
Mounted at `/api/round-robin` in `server.py`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Public | List RR leagues (phase-filtered by sport + country) |
| GET | `/:id` | Public | League detail |
| GET | `/:id/schedule` | Public | Full round schedule with match statuses |
| GET | `/:id/standings` | Public | Standings sorted by tiebreaker chain |
| GET | `/:id/matches` | Public | All matches |
| POST | `/:id/join` | Player | Singles registration (free or payment redirect) |
| POST | `/:id/invite-partner` | Player | Doubles: create invite, send email to partner |
| GET | `/invite/:token` | Public | Validate invite token, return league + inviter info |
| POST | `/invite/:token/accept` | Player | Partner accepts, registers team, triggers schedule check |
| POST | `/:id/generate-schedule` | Internal | Auto-called after join/accept when min reached |
| POST | `/:id/check-playoffs` | Internal | Auto-called after every score submission |
| POST | `/` | Admin | Create RR league |

### Auto-trigger hooks

**After `join` or `accept`:**
```
if current_players >= rr_config.min_players and not rr_config.schedule_generated:
    call generate-schedule
```

**After `PATCH /matches/:id/score`** (existing route):
```
if league.league_type == "round_robin":
    call check-playoffs for that league_id
```

No changes to existing `match_routes.py` scoring logic — only add the playoff check call at the end.

---

## Section 3 — Frontend Pages

### `/leagues/round-robin` (new page)

- Same card layout as existing `/leagues`
- Filters: sport, city, division (Singles / Doubles)
- Card displays: name, sport chip, "Round Robin" badge (emerald outline), entry fee, player count `X/Y`, status pill
- Links to `/round-robin/:id`

### `/round-robin/:id` (new page)

Tabbed layout:

**Overview tab**
- League name, sport, city, dates, entry fee
- Scoring format rules (auto-rendered based on `scoring_format`)
- Full rulebook collapsible (Sections 4–11 from the rulebook)
- Join panel (sidebar):
  - Singles: "Join League" button → existing payment flow
  - Doubles: "Register as Team" → modal: enter partner email → submit sends invite

**Schedule tab**
- Accordion by round (Round 1 Week of June 1–7, etc.)
- Each round lists all matchups: Player A vs Player B — status chip (Scheduled / Completed / Defaulted)
- Completed matches show score
- BYE weeks shown as "BYE — no match this round"

**Standings tab**
- Reuses existing standings table component
- Columns: Rank, Player, W, L, Pts, Set Diff, Game Diff
- Highlights playoff qualifiers (top N rows in green)

**Playoffs tab**
- Greyed out with "Playoffs begin after Round Robin completes" until triggered
- Once generated: bracket view (reuses existing playoffs UI)

### `/round-robin/invite/:token` (new page)

- Shows: inviter name, league name, sport, entry fee
- Auth gate: must be logged in (redirect to login if not, return to this URL after)
- "Accept & Join as Partner" button
- On accept: registers team, redirects to `/round-robin/:id`
- Expired token: shows friendly error with option to contact inviter

### Admin Dashboard additions

- New "Create Round Robin League" button in existing admin league management
- Form fields: same as existing league form + `min_players`, `division_type`, `playoff_threshold`
- League type auto-set to `"round_robin"`

### Navbar

Add "Round Robin" link to leagues dropdown, pointing to `/leagues/round-robin`.

---

## Section 4 — Schedule Generation

**Triggered automatically** when `current_players >= rr_config.min_players` and `schedule_generated = false`.

**Steps:**
1. Set `league.status = "active"`, `rr_config.schedule_generated = true`, `rr_config.auto_started_at = now`
2. Fetch all registered players (singles) or confirmed teams (doubles)
3. Run circle algorithm to generate N-1 rounds
4. If odd number: add BYE slot, skip BYE matches (no match doc created)
5. For each real matchup: create `Match` doc with `round = k`, `status = "scheduled"`, `scheduled_date = week_start`
6. Create `rr_schedules` doc with all rounds
7. Auto-set `scoring_format` based on sport: tennis → `"fast4"`, pickleball → `"to_11"`
8. Email all players: league has started, link to schedule

**Circle algorithm (N players):**
```
Fix player[0]. For round k in 1..N-1:
  Match: player[0] vs player[k]
  For i in 1..floor((N-1)/2):
    Match: player[(k-i) mod (N-1) + 1] vs player[(k+i) mod (N-1) + 1]
  Rotate players[1..N-1] left by 1
```

For doubles: same algorithm with teams as nodes.

**Week assignment:**
- Round 1 week_start = `league.start_date`
- Round k week_start = `start_date + (k-1) * 7 days`
- Each match deadline = `week_start + 7 days`

**Flex scheduling within each week:**
- Players self-schedule within the week window
- Must offer 3 time slots, respond within 48h
- 1 reschedule credit per season
- No court/facility assigned by league

---

## Section 5 — Playoff Auto-Generation

**Triggered automatically** after every score submission:
```
completed_count = count matches where status in ["completed", "cancelled"] for league_id
total_count = count all matches for league_id
if completed_count == total_count and not rr_config.playoff_generated:
    generate playoffs
```

**Steps:**
1. Pull final standings (tiebreaker chain: wins → head-to-head → point diff → points won)
2. Take top `playoff_threshold` players/teams (default 4, 8 for large divisions)
3. Seed bracket:
   - Top-4: 1v4, 2v3 → Final + 3rd place match
   - Top-8: Standard single-elimination quarterfinals → semis → final
4. Create playoff Match docs (reuse existing `playoffs` collection pattern)
5. Set `rr_config.playoff_generated = true`
6. Email qualified players/teams

**Tiebreaker chain (Section 9 of rulebook):**
1. Wins
2. Head-to-head result between tied players
3. Point differential (games won − games lost for pickleball; games won − games lost for tennis)
4. Total points won
5. Strength of schedule (optional, not implemented in MVP)

**Edge cases:**
- Fewer eligible players than `playoff_threshold` → bracket shrinks (4→2: direct final; 3→SF with bye)
- Admin "Force Close" button: in Admin Dashboard → RR league detail → "Force Close Season" — marks all unplayed matches as cancelled, triggers playoff check
- No substitutes in playoffs (per rulebook Section 8)

---

## Section 6 — Rulebook Integration

The full 12-section rulebook is stored as structured data per league (in `rr_config.rules_version = "v1"`). The detail page renders key rules inline per section:

- Section 4 (Time Limits): shown in Overview tab per sport
- Section 5 (Flex Scheduling): shown in Schedule tab as "How to schedule your match"
- Section 6 (Disclaimer): shown at bottom of Overview tab
- Section 7 (Medical Timeout): shown in match rules collapsible
- Section 8 (Defaults): shown in Schedule tab
- Section 11 (Score Reporting): shown on score submission prompt

---

## Platform Automation Requirements (Section 12)

| Requirement | Implementation |
|-------------|---------------|
| Auto-generate RR schedules | `generate-schedule` endpoint, triggered on min players reached |
| Player standings | Existing standings collection, sorted with tiebreaker chain |
| Point differentials | Existing Standing model (`games_won - games_lost`) |
| Playoff brackets | `check-playoffs` endpoint, uses existing playoffs collection |
| Match reminders | Email on schedule generation + 24h before each week deadline |
| Score submission prompts | Existing score report flow + 24h reminder if round incomplete |
| ELO rating updates | Existing `rating_utils.py` — fires on score submission; doubles: both partners' ratings updated equally |
| Auto-start on min entry | Post-join/accept hook checks min_players |
| Auto-lock on full | `max_players` check on join — returns 400 if full |

---

## Files Changed / Created

**Backend:**
- `backend/models.py` — add `league_type`, `rr_config` to League/LeagueCreate; add `round` to Match
- `backend/routes/round_robin_routes.py` — new file, all RR endpoints
- `backend/server.py` — mount new router at `/api/round-robin`
- `backend/routes/match_routes.py` — add playoff check call after score submission for RR leagues
- `backend/email_service.py` — add: partner invite email, league-started email, playoff-qualified email

**Frontend:**
- `frontend/src/pages/RoundRobinLeagues.jsx` — new listing page
- `frontend/src/pages/RoundRobinDetail.jsx` — new detail page (tabbed)
- `frontend/src/pages/RoundRobinInvite.jsx` — partner invite acceptance page
- `frontend/src/components/RRScheduleView.jsx` — schedule accordion component
- `frontend/src/components/RRBracketView.jsx` — playoff bracket component
- `frontend/src/App.jsx` — add 3 new routes
- `frontend/src/components/Navbar.jsx` — add "Round Robin" link

**No changes to:**
- `payment_routes.py` (payment flow reused as-is)
- `standings` logic (reused)
- `playoffs_routes.py` (reused)
- `auth_utils.py`
- `phase_config.py`
