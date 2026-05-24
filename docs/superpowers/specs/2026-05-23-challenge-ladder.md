# Challenge Ladder — Spec

**Date:** 2026-05-23
**Scope:** New `ladders` + `ladder_challenges` collections, 7 new API routes, new `/ladders` page
**Depends on:** Skill Division Routing spec (division_label)
**Approach:** A — New collections, reuse existing match engine for challenge matches

---

## Goal

Always-on ranked list per city + sport + division. No seasons, no fixed schedule. Challenge anyone ranked above you. Win = swap positions. Lose = stay. Serves players who can't commit to a full season but still want ranked competitive play.

---

## How It Works

1. Player joins a ladder (free, no season commitment)
2. Player enters at bottom, seeded by ELO relative to existing entries
3. Player sends a challenge to any player ranked above them
4. Challenged player has 72 hours to accept or decline
5. If accepted: a match is created (same match engine), both schedule + play
6. Score reported: winner moves up (or holds rank #1), loser stays
7. 48h cooldown before challenger can send another challenge

---

## Data Model — New Collections

### `Ladder`
```python
class Ladder(BaseModel):
    id: Optional[str] = None
    city: str
    sport: str                        # "tennis" | "pickleball"
    division_label: str               # "Beginner" | "Intermediate" | "Advanced" | "Competitive"
    format: str                       # "singles" | "doubles"
    entries: list = []
    # entry shape: {
    #   player_id: str,
    #   rank: int,          # 1 = top, increases down
    #   elo: float,
    #   joined_at: str,
    #   challenge_cooldown_until: Optional[str]  # ISO timestamp
    # }
    created_at: str
    is_active: bool = True
```

### `LadderChallenge`
```python
class LadderChallenge(BaseModel):
    id: Optional[str] = None
    ladder_id: str
    challenger_id: str
    challenged_id: str
    challenger_rank: int              # rank at time of challenge
    challenged_rank: int
    status: str = "pending"          # "pending" | "accepted" | "declined" | "completed" | "expired"
    match_id: Optional[str] = None   # set when accepted
    expires_at: str                  # 72h from created_at
    created_at: str
```

---

## Backend Changes

### New file: `backend/routes/ladder_routes.py`

#### `GET /api/ladders`
- Public
- Filter params: `?city=Austin&sport=tennis&division=Intermediate&format=singles`
- Returns list of active ladders with entry count and top 5 players

#### `POST /api/ladders`
- Admin only
- Body: `{city, sport, division_label, format}`
- Creates ladder doc with empty entries

#### `GET /api/ladders/:ladder_id`
- Public
- Returns full ladder: all entries ranked 1→N, pending challenges (masked for non-auth users)
- Auth users: includes "Can you challenge?" flag and cooldown_until for each entry above them

#### `POST /api/ladders/:ladder_id/join`
- Auth required
- Seeds player ELO-based: insert at rank where their ELO fits (above players with lower ELO, below players with higher ELO)
- If ladder empty: rank 1
- Returns updated entry with assigned rank

#### `POST /api/ladder-challenges`
- Auth required
- Body: `{ladder_id, challenged_player_id}`
- Validations:
  - Challenger must be in ladder
  - Challenged must be ranked above challenger
  - Challenger must not have active outgoing challenge
  - Challenger cooldown must be expired
- Creates `LadderChallenge` doc (status: "pending", expires_at: now + 72h)
- Sends email to challenged player
- Returns challenge doc

#### `PATCH /api/ladder-challenges/:challenge_id/accept`
- Auth required (challenged player only)
- Creates match doc (`source: "ladder"`, `ladder_challenge_id` stored)
- Sets challenge status: "accepted"
- Returns match doc

#### `PATCH /api/ladder-challenges/:challenge_id/decline`
- Auth required (challenged player only)
- Sets challenge status: "declined"
- Challenger can challenge again immediately (no cooldown applied on decline)

### Extend `backend/routes/match_routes.py`

In `PATCH /api/matches/:id/score` — after ELO update, check if `source == "ladder"`:
- Fetch associated `LadderChallenge` doc
- If challenger won: swap ranks in Ladder.entries
- Update both players' ELO in their ladder entries
- Set challenge status: "completed"
- Set challenger's `challenge_cooldown_until = now + 48h`

### Mount in `backend/server.py`
```python
from routes.ladder_routes import router as ladder_router
app.include_router(ladder_router, prefix="/api")
```

### `backend/seeds/indexes.py`

Add indexes:
```python
await db.ladders.create_index([("city", 1), ("sport", 1), ("division_label", 1), ("format", 1)])
await db.ladder_challenges.create_index([("ladder_id", 1), ("status", 1)])
await db.ladder_challenges.create_index([("challenger_id", 1), ("status", 1)])
```

---

## Frontend Changes

### New page: `frontend/src/pages/Ladders.jsx`

Route: `/ladders`

- Filter bar: City / Sport / Division / Format
- Ladder cards: city, sport, division badge, format, player count, top 3 players shown
- "Join" button on each card (auth required)
- "View" button → `/ladders/:id`

### New page: `frontend/src/pages/LadderDetail.jsx`

Route: `/ladders/:id`

- Header: `Austin · Intermediate Tennis Ladder · Singles · 24 players`
- Ranked list table: Rank / Player / ELO / W-L / Action
  - Players above auth user: "Challenge" button (disabled if on cooldown or challenge already pending)
  - Auth user's row: highlighted, shows rank, cooldown badge if active
  - Players below auth user: no action
- Pending challenges section: "You challenged Marcus T. — awaiting response (expires in 38h)"
- "Join this Ladder" CTA if user not yet in ladder

### `frontend/src/pages/PlayerDashboard.jsx`

Add "Ladder Rankings" card:
```
Intermediate Tennis · Austin · Singles
Rank #7 of 24
Pending: Challenge vs Marcus T. (awaiting response)
```

### `frontend/src/App.js`

Add routes:
```jsx
<Route path="/ladders" element={<Ladders />} />
<Route path="/ladders/:id" element={<LadderDetail />} />
```

### `frontend/src/components/Navbar.jsx`

Add "Ladders" nav link between Leagues and Dashboard.

---

## Email Templates

### Challenge received
Subject: `Marcus T. has challenged you on the VENLAX Ladder`
Body: `You've been challenged on the Austin Intermediate Tennis Ladder (Singles). Accept by [date]: [link]`

### Challenge accepted
Subject: `Your challenge was accepted — schedule your match`
Body: `Sarah K. accepted your challenge. Schedule your match: [link]`

### Challenge declined
Subject: `Your challenge was declined`
Body: `Sarah K. declined your challenge on the Austin Intermediate Tennis Ladder. You can challenge again now.`

### Challenge expired
Subject: `Your challenge expired`
Body: `Your challenge to Sarah K. was not accepted within 72 hours. You can challenge again now.`

---

## Out of Scope

- Doubles ladder (partner coordination adds complexity) — v2
- Ladder leaderboard across cities — v2
- Challenge notifications via push (uses B2 notification system when ready)
- Scheduled expiry job (for MVP: check expiry on join/challenge attempt; cron job in v2)
