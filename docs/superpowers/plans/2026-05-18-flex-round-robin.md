# Flex Round Robin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Flex Round Robin as a new league format alongside the existing Flex League, with auto-generated schedules, partner invite flow, and auto-playoff generation.

**Architecture:** New `league_type` field on the existing League model distinguishes RR from flex. A dedicated `round_robin_routes.py` handles all RR endpoints. Schedule generation uses the circle method and stores results in a new `rr_schedules` collection. Playoffs auto-trigger when all RR matches complete, hooking into the existing playoffs infrastructure.

**Tech Stack:** FastAPI + Motor (async MongoDB), Pydantic v2, React 19, Tailwind v3, shadcn/ui (Radix), react-router-dom v7, existing `email_service.py` / `rating_utils.py` / `auth_utils.py`

---

## File Map

**New files:**
- `backend/rr_scheduler.py` — circle method algorithm + week assignment
- `backend/routes/round_robin_routes.py` — all RR API endpoints
- `frontend/src/pages/RoundRobinLeagues.jsx` — listing page
- `frontend/src/pages/RoundRobinDetail.jsx` — tabbed detail page
- `frontend/src/pages/RoundRobinInvite.jsx` — partner invite acceptance
- `frontend/src/components/RRScheduleView.jsx` — schedule accordion
- `frontend/src/components/RRBracketView.jsx` — playoff bracket wrapper

**Modified files:**
- `backend/models.py` — add `league_type`, `rr_config` to League/LeagueCreate; add `round` + partner fields to Match; add `RRConfig`, `DoublesInvite` models
- `backend/server.py` — mount RR router at `/api/round-robin`
- `backend/routes/match_routes.py` — add RR playoff check hook after score submission
- `backend/email_service.py` — add 3 new email senders
- `frontend/src/App.js` — 3 new routes
- `frontend/src/components/Navbar.jsx` — Round Robin nav link

---

### Task 1: Data Model Changes

**Files:**
- Modify: `backend/models.py`

- [ ] **Step 1: Add models to `backend/models.py`**

Open `backend/models.py`. After the `LeagueUpdate` class (line ~121), insert:

```python
# ─── Round Robin Config ───────────────────────────────
class RRConfig(BaseModel):
    min_players: int = 6
    max_players: int = 12
    division_type: str = "singles"          # "singles" | "doubles"
    scoring_format: Optional[str] = None    # auto-set on schedule generation
    playoff_threshold: int = 4
    schedule_generated: bool = False
    playoff_generated: bool = False
    auto_started_at: Optional[str] = None


# ─── Doubles Invite ──────────────────────────────────
class DoublesInvite(BaseDocument):
    league_id: str
    inviter_id: str
    inviter_name: str
    partner_email: str
    token: str
    status: str = "pending"                 # "pending" | "accepted" | "expired"
    expires_at: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
```

- [ ] **Step 2: Extend `League` model**

In `League` class, after `created_at` field, add:

```python
    league_type: str = "flex"               # "flex" | "round_robin"
    rr_config: Optional[Dict] = None
```

- [ ] **Step 3: Extend `LeagueCreate` model**

In `LeagueCreate` class, after `rules` field, add:

```python
    league_type: str = "flex"
    rr_config: Optional[Dict] = None
```

- [ ] **Step 4: Extend `Match` model**

In `Match` class, after `updated_at` field, add:

```python
    round: Optional[int] = None             # week number in RR; None for flex
    is_rr: bool = False
    team1_partner_id: Optional[str] = None
    team1_partner_name: Optional[str] = None
    team2_partner_id: Optional[str] = None
    team2_partner_name: Optional[str] = None
```

- [ ] **Step 5: Commit**

```bash
git add backend/models.py
git commit -m "feat(backend): add RRConfig, DoublesInvite models; extend League and Match for round-robin"
```

---

### Task 2: RR Scheduler Module

**Files:**
- Create: `backend/rr_scheduler.py`

- [ ] **Step 1: Create `backend/rr_scheduler.py`**

```python
"""
Circle-method round-robin schedule generator.

generate_schedule(players) -> list of rounds.
Each round is a list of (player_a, player_b) tuples.
If len(players) is odd, a BYE slot is inserted so every player
gets exactly one BYE per season.
"""
from __future__ import annotations
from typing import Any


def generate_schedule(players: list[Any]) -> list[list[tuple[Any, Any]]]:
    """Return N-1 rounds for N players (BYE-padded if odd).

    Each entry in a round is (player_a, player_b).
    BYE is represented as None — callers must skip match creation for it.
    """
    ps = list(players)
    if len(ps) % 2 == 1:
        ps.append(None)                     # BYE slot
    n = len(ps)
    rounds = []
    rotation = ps[1:]                       # ps[0] is fixed
    for _ in range(n - 1):
        round_pairs = [(ps[0], rotation[0])]
        for i in range(1, n // 2):
            round_pairs.append((rotation[n - 1 - i], rotation[i]))
        rounds.append(round_pairs)
        rotation = [rotation[-1]] + rotation[:-1]   # rotate right by 1
    return rounds


def scoring_format_for(sport: str) -> str:
    return "fast4" if sport == "tennis" else "to_11"
```

- [ ] **Step 2: Write tests**

Create `backend/tests/test_rr_scheduler.py`:

```python
import pytest
from rr_scheduler import generate_schedule, scoring_format_for


def _all_pairs(players):
    """Return set of frozensets for every possible pairing."""
    return {frozenset([a, b]) for a in players for b in players if a != b}


def test_even_players_round_count():
    players = ["A", "B", "C", "D"]
    rounds = generate_schedule(players)
    assert len(rounds) == 3                 # N-1 rounds


def test_even_players_each_plays_once_per_round():
    players = ["A", "B", "C", "D"]
    rounds = generate_schedule(players)
    for r in rounds:
        seen = set()
        for a, b in r:
            assert a not in seen and b not in seen
            seen.update([a, b])


def test_even_players_all_pairs_covered():
    players = ["A", "B", "C", "D"]
    rounds = generate_schedule(players)
    played = set()
    for r in rounds:
        for a, b in r:
            played.add(frozenset([a, b]))
    expected = _all_pairs(players)
    assert played == expected


def test_odd_players_bye_once_each():
    players = ["A", "B", "C"]
    rounds = generate_schedule(players)
    # 4 players after BYE insertion → 3 rounds
    assert len(rounds) == 3
    bye_counts = {p: 0 for p in players}
    for r in rounds:
        for a, b in r:
            if a is None:
                bye_counts[b] += 1
            elif b is None:
                bye_counts[a] += 1
    # every player gets exactly one BYE
    assert all(v == 1 for v in bye_counts.values())


def test_scoring_format():
    assert scoring_format_for("tennis") == "fast4"
    assert scoring_format_for("pickleball") == "to_11"
    assert scoring_format_for("cricket") == "to_11"     # fallback
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
cd backend
python -m pytest tests/test_rr_scheduler.py -v
```

Expected: 5 PASSED

- [ ] **Step 4: Commit**

```bash
git add backend/rr_scheduler.py backend/tests/test_rr_scheduler.py
git commit -m "feat(backend): add circle-method RR scheduler with tests"
```

---

### Task 3: RR Backend Routes — Read Endpoints

**Files:**
- Create: `backend/routes/round_robin_routes.py`
- Modify: `backend/server.py`

- [ ] **Step 1: Create `backend/routes/round_robin_routes.py` with GET routes**

```python
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime, timezone
from auth_utils import get_current_user

router = APIRouter(redirect_slashes=False)


def _ser(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


def _require_rr(league: dict) -> None:
    if not league or league.get("league_type") != "round_robin":
        raise HTTPException(status_code=404, detail="Round Robin league not found")


@router.get("")
@router.get("/")
async def list_rr_leagues(
    request: Request,
    sport: str = None,
    country: str = None,
    city: str = None,
    division: str = None,
    status: str = None,
):
    db = request.app.state.db
    from phase_config import ACTIVE_SPORTS, ACTIVE_COUNTRY

    q: dict = {"league_type": "round_robin"}
    effective_country = country or ACTIVE_COUNTRY
    q["country"] = effective_country

    sport_filter = sport if sport and sport in ACTIVE_SPORTS else None
    if sport_filter:
        q["sport"] = sport_filter
    else:
        q["sport"] = {"$in": ACTIVE_SPORTS}

    if city:
        q["city"] = city
    if status:
        q["status"] = status
    if division:
        q["rr_config.division_type"] = division

    leagues = await db.leagues.find(q).sort("created_at", -1).to_list(100)
    return [_ser(lg) for lg in leagues]


@router.get("/:id")
@router.get("/{league_id}")
async def get_rr_league(league_id: str, request: Request):
    db = request.app.state.db
    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    _require_rr(league)
    return _ser(league)


@router.get("/{league_id}/schedule")
async def get_rr_schedule(league_id: str, request: Request):
    db = request.app.state.db
    schedule = await db.rr_schedules.find_one({"league_id": league_id})
    if not schedule:
        return {"rounds": [], "generated": False}
    schedule.pop("_id", None)
    # Enrich each match_id with current match status from matches collection
    for rnd in schedule.get("rounds", []):
        enriched = []
        for m in rnd.get("matches", []):
            if m.get("match_id"):
                try:
                    doc = await db.matches.find_one({"_id": ObjectId(m["match_id"])})
                    if doc:
                        m["status"] = doc.get("status", "scheduled")
                        m["score_data"] = doc.get("score_data")
                        m["winner_id"] = doc.get("winner_id")
                except Exception:
                    pass
            enriched.append(m)
        rnd["matches"] = enriched
    return schedule


@router.get("/{league_id}/standings")
async def get_rr_standings(league_id: str, request: Request):
    db = request.app.state.db
    standings = await db.standings.find({"league_id": league_id}).to_list(100)
    # Sort: wins desc → head-to-head (omitted, complex) → point diff desc → points won desc
    standings.sort(
        key=lambda s: (
            -s.get("wins", 0),
            -(s.get("games_won", 0) - s.get("games_lost", 0)),
            -s.get("points", 0),
        )
    )
    for i, s in enumerate(standings):
        s["id"] = str(s.pop("_id"))
        s["rank"] = i + 1
    return standings


@router.get("/{league_id}/matches")
async def get_rr_matches(league_id: str, request: Request):
    db = request.app.state.db
    matches = await db.matches.find({"league_id": league_id, "is_rr": True}).to_list(500)
    return [_ser(m) for m in matches]
```

- [ ] **Step 2: Mount router in `backend/server.py`**

After the existing imports block (around line 33), add:

```python
from routes.round_robin_routes import router as rr_router
```

After the existing `api_router.include_router(auto_league_router, ...)` line, add:

```python
api_router.include_router(rr_router, prefix="/round-robin", tags=["round-robin"])
```

- [ ] **Step 3: Start backend, verify routes exist**

```bash
cd backend
uvicorn server:app --reload --port 8001
```

Open `http://localhost:8001/docs` — confirm `/api/round-robin` GET endpoints appear.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/round_robin_routes.py backend/server.py
git commit -m "feat(backend): add RR GET endpoints, mount router at /api/round-robin"
```

---

### Task 4: Schedule Generation + Singles Join

**Files:**
- Modify: `backend/routes/round_robin_routes.py`

- [ ] **Step 1: Add `generate_schedule` internal endpoint**

Append to `backend/routes/round_robin_routes.py`:

```python
async def _run_generate_schedule(db, league_id: str) -> dict:
    """Generate the round-robin schedule and create Match documents.
    Called internally after join/accept when min_players is reached.
    Returns {"generated": True, "rounds": N} or {"generated": False, "reason": "..."}.
    """
    from rr_scheduler import generate_schedule, scoring_format_for
    from datetime import timedelta
    import uuid

    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        return {"generated": False, "reason": "league not found"}

    rr = league.get("rr_config", {})
    if rr.get("schedule_generated"):
        return {"generated": False, "reason": "already generated"}

    division_type = rr.get("division_type", "singles")

    if division_type == "singles":
        regs = await db.player_leagues.find({"league_id": league_id}).to_list(100)
        players = [{"id": r["player_id"], "name": r["player_name"]} for r in regs]
    else:
        # doubles: registered teams = player_leagues with team1_partner_id set
        regs = await db.player_leagues.find(
            {"league_id": league_id, "partner_id": {"$exists": True, "$ne": None}}
        ).to_list(100)
        players = [
            {
                "id": r["player_id"],
                "name": r["player_name"],
                "partner_id": r.get("partner_id"),
                "partner_name": r.get("partner_name"),
            }
            for r in regs
        ]

    if len(players) < rr.get("min_players", 6):
        return {"generated": False, "reason": "not enough players"}

    scoring_format = scoring_format_for(league["sport"])
    start_date = datetime.fromisoformat(league["start_date"].replace("Z", "+00:00"))

    rounds_raw = generate_schedule(players)
    rounds_doc = []
    for k, pairs in enumerate(rounds_raw, start=1):
        week_start = start_date + timedelta(days=(k - 1) * 7)
        week_end = week_start + timedelta(days=6)
        round_matches = []
        for p1, p2 in pairs:
            if p1 is None or p2 is None:
                continue                        # BYE — skip match creation
            match_doc = {
                "league_id": league_id,
                "sport": league["sport"],
                "player1_id": p1["id"],
                "player2_id": p2["id"],
                "player1_name": p1["name"],
                "player2_name": p2["name"],
                "scheduled_date": week_start.isoformat(),
                "status": "scheduled",
                "round": k,
                "is_rr": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            if division_type == "doubles":
                match_doc.update({
                    "team1_partner_id": p1.get("partner_id"),
                    "team1_partner_name": p1.get("partner_name"),
                    "team2_partner_id": p2.get("partner_id"),
                    "team2_partner_name": p2.get("partner_name"),
                })
            result = await db.matches.insert_one(match_doc)
            round_matches.append({
                "player1_id": p1["id"],
                "player1_name": p1["name"],
                "player2_id": p2["id"],
                "player2_name": p2["name"],
                "match_id": str(result.inserted_id),
            })
        rounds_doc.append({
            "round": k,
            "week_start": week_start.date().isoformat(),
            "week_end": week_end.date().isoformat(),
            "matches": round_matches,
        })

    await db.rr_schedules.insert_one({
        "league_id": league_id,
        "rounds": rounds_doc,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await db.leagues.update_one(
        {"_id": ObjectId(league_id)},
        {
            "$set": {
                "status": "active",
                "rr_config.schedule_generated": True,
                "rr_config.scoring_format": scoring_format,
                "rr_config.auto_started_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    # Notify all players (fire-and-forget)
    import email_service
    all_player_ids = [p["id"] for p in players]
    for pid in all_player_ids:
        try:
            user = await db.users.find_one({"_id": ObjectId(pid)})
            if user and user.get("email") and user.get("email_notifications", True):
                email_service.schedule(email_service.send_league_started(
                    user["email"], user["name"], league["name"], league_id
                ))
        except Exception:
            pass

    return {"generated": True, "rounds": len(rounds_doc)}


@router.post("/{league_id}/generate-schedule")
async def generate_schedule_endpoint(league_id: str, request: Request):
    db = request.app.state.db
    return await _run_generate_schedule(db, league_id)
```

- [ ] **Step 2: Add singles join endpoint**

Append to `backend/routes/round_robin_routes.py`:

```python
@router.post("/{league_id}/join")
async def join_rr_league(league_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)

    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    _require_rr(league)

    rr = league.get("rr_config", {})
    if rr.get("division_type") != "singles":
        raise HTTPException(status_code=400, detail="Use invite-partner for doubles leagues")
    if rr.get("schedule_generated"):
        raise HTTPException(status_code=400, detail="League already started — registration closed")

    current = league.get("current_players", 0)
    if current >= rr.get("max_players", 12):
        raise HTTPException(status_code=400, detail="League is full")

    existing = await db.player_leagues.find_one({"player_id": user["_id"], "league_id": league_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already registered")

    entry_fee = league.get("entry_fee", 0)
    if entry_fee > 0:
        # Redirect to existing payment flow — same as flex leagues
        from routes.payment_routes import _create_checkout_session  # type: ignore
        try:
            session = await _create_checkout_session(
                user, league_id, league["name"], entry_fee, league.get("currency", "USD"),
                request
            )
            return {"redirect": True, "checkout_url": session["url"]}
        except Exception:
            raise HTTPException(status_code=503, detail="Payment service unavailable")

    # Free league — register immediately
    await db.player_leagues.insert_one({
        "player_id": user["_id"],
        "player_name": user["name"],
        "league_id": league_id,
        "sport": league["sport"],
        "payment_status": "free",
        "joined_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.leagues.update_one(
        {"_id": ObjectId(league_id)},
        {"$inc": {"current_players": 1}}
    )

    import email_service
    email_service.schedule(email_service.send_registration_confirmed(
        user["email"], user["name"], league["name"], league["sport"], league_id, False
    ))

    # Auto-trigger schedule generation
    new_count = current + 1
    if new_count >= rr.get("min_players", 6) and not rr.get("schedule_generated"):
        await _run_generate_schedule(db, league_id)

    return {"registered": True, "message": "Joined league"}
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/round_robin_routes.py
git commit -m "feat(backend): add RR schedule generation + singles join with auto-start"
```

---

### Task 5: Doubles Partner Invite Flow

**Files:**
- Modify: `backend/routes/round_robin_routes.py`
- Modify: `backend/email_service.py`

- [ ] **Step 1: Add `send_partner_invite` to `email_service.py`**

Append to `backend/email_service.py`:

```python
async def send_partner_invite(to: str, inviter_name: str, league_name: str,
                               sport: str, entry_fee: float, accept_url: str) -> None:
    fee_line = f"<li><strong>Entry fee:</strong> ${entry_fee:.2f} (split or per team)</li>" if entry_fee > 0 else ""
    body = f"""
      <p><strong>{inviter_name}</strong> has invited you to join them as a doubles partner in a VENLAX Round Robin league.</p>
      <ul style="padding-left:18px;margin:0 0 12px">
        <li><strong>League:</strong> {league_name}</li>
        <li><strong>Sport:</strong> {sport.title()}</li>
        {fee_line}
      </ul>
      <p>Click below to accept and confirm your spot. This invite expires in 72 hours.</p>
    """
    await send_email(
        to,
        f"{inviter_name} invited you to a Round Robin doubles league",
        _wrap("You're invited!", body, "Accept & Join", accept_url),
    )


async def send_league_started(to: str, player_name: str, league_name: str, league_id: str) -> None:
    url = f"{_get_frontend_url()}/round-robin/{league_id}" if _get_frontend_url() else f"/round-robin/{league_id}"
    body = f"""
      <p>Hi {player_name},</p>
      <p>Your Round Robin league <strong>{league_name}</strong> has reached minimum players and the schedule has been generated!</p>
      <p>Check your schedule and start coordinating match times with your opponents.</p>
    """
    await send_email(to, f"Schedule generated — {league_name}",
                     _wrap("Your league has started!", body, "View schedule", url))


async def send_playoff_qualified(to: str, player_name: str, league_name: str,
                                  league_id: str, seed: int) -> None:
    url = f"{_get_frontend_url()}/round-robin/{league_id}" if _get_frontend_url() else f"/round-robin/{league_id}"
    body = f"""
      <p>Hi {player_name},</p>
      <p>Congratulations! You've qualified for the playoffs in <strong>{league_name}</strong> as seed #{seed}.</p>
      <p>Playoff brackets are now live — check the Playoffs tab to see your matchup.</p>
    """
    await send_email(to, f"You qualified for playoffs — {league_name}",
                     _wrap("Playoffs qualification confirmed!", body, "View bracket", url))
```

- [ ] **Step 2: Add invite-partner and accept endpoints**

Append to `backend/routes/round_robin_routes.py`:

```python
@router.post("/{league_id}/invite-partner")
async def invite_partner(league_id: str, request: Request):
    import uuid
    from datetime import timedelta
    db = request.app.state.db
    user = await get_current_user(request, db)

    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    _require_rr(league)

    rr = league.get("rr_config", {})
    if rr.get("division_type") != "doubles":
        raise HTTPException(status_code=400, detail="Not a doubles league")
    if rr.get("schedule_generated"):
        raise HTTPException(status_code=400, detail="League already started")

    body = await request.json()
    partner_email = body.get("partner_email", "").strip().lower()
    if not partner_email:
        raise HTTPException(status_code=400, detail="partner_email required")

    existing = await db.player_leagues.find_one({"player_id": user["_id"], "league_id": league_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already registered in this league")

    token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(hours=72)

    await db.doubles_invites.insert_one({
        "league_id": league_id,
        "inviter_id": user["_id"],
        "inviter_name": user["name"],
        "partner_email": partner_email,
        "token": token,
        "status": "pending",
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    import email_service
    frontend_url = email_service._get_frontend_url()
    accept_url = f"{frontend_url}/round-robin/invite/{token}" if frontend_url else f"/round-robin/invite/{token}"
    email_service.schedule(email_service.send_partner_invite(
        partner_email, user["name"], league["name"],
        league["sport"], league.get("entry_fee", 0), accept_url
    ))

    return {"invited": True, "message": "Invite sent to " + partner_email}


@router.get("/invite/{token}")
async def get_invite(token: str, request: Request):
    db = request.app.state.db
    invite = await db.doubles_invites.find_one({"token": token})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    if invite.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Invite already used or expired")

    now = datetime.now(timezone.utc)
    expires_raw = invite.get("expires_at", "")
    try:
        exp = datetime.fromisoformat(expires_raw.replace("Z", "+00:00"))
        if now > exp:
            await db.doubles_invites.update_one({"token": token}, {"$set": {"status": "expired"}})
            raise HTTPException(status_code=400, detail="Invite has expired")
    except HTTPException:
        raise
    except Exception:
        pass

    try:
        league = await db.leagues.find_one({"_id": ObjectId(invite["league_id"])})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")

    return {
        "inviter_name": invite["inviter_name"],
        "league_id": invite["league_id"],
        "league_name": league.get("name") if league else "",
        "sport": league.get("sport") if league else "",
        "entry_fee": league.get("entry_fee", 0) if league else 0,
        "status": invite["status"],
    }


@router.post("/invite/{token}/accept")
async def accept_invite(token: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)

    invite = await db.doubles_invites.find_one({"token": token})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Invite already used or expired")

    now = datetime.now(timezone.utc)
    try:
        exp = datetime.fromisoformat(invite["expires_at"].replace("Z", "+00:00"))
        if now > exp:
            await db.doubles_invites.update_one({"token": token}, {"$set": {"status": "expired"}})
            raise HTTPException(status_code=400, detail="Invite has expired")
    except HTTPException:
        raise
    except Exception:
        pass

    league_id = invite["league_id"]
    inviter_id = invite["inviter_id"]

    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    _require_rr(league)

    rr = league.get("rr_config", {})
    if rr.get("schedule_generated"):
        raise HTTPException(status_code=400, detail="League already started — invite no longer valid")

    current = league.get("current_players", 0)
    if current >= rr.get("max_players", 12):
        raise HTTPException(status_code=400, detail="League is full")

    # Register the team (inviter + partner)
    now_iso = datetime.now(timezone.utc).isoformat()
    team_entry = {
        "player_id": inviter_id,
        "player_name": invite["inviter_name"],
        "league_id": league_id,
        "sport": league["sport"],
        "payment_status": "free",
        "partner_id": user["_id"],
        "partner_name": user["name"],
        "joined_at": now_iso,
    }
    existing = await db.player_leagues.find_one({"player_id": inviter_id, "league_id": league_id})
    if not existing:
        await db.player_leagues.insert_one(team_entry)
        await db.leagues.update_one({"_id": ObjectId(league_id)}, {"$inc": {"current_players": 1}})

    await db.doubles_invites.update_one({"token": token}, {"$set": {"status": "accepted"}})

    import email_service
    try:
        inviter = await db.users.find_one({"_id": ObjectId(inviter_id)})
        if inviter and inviter.get("email"):
            email_service.schedule(email_service.send_registration_confirmed(
                inviter["email"], inviter["name"], league["name"], league["sport"], league_id, False
            ))
    except Exception:
        pass

    # Auto-trigger schedule generation
    new_count = current + 1
    if new_count >= rr.get("min_players", 6) and not rr.get("schedule_generated"):
        await _run_generate_schedule(db, league_id)

    return {"accepted": True, "league_id": league_id}
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/round_robin_routes.py backend/email_service.py
git commit -m "feat(backend): doubles partner invite flow, league-started email, playoff-qualified email"
```

---

### Task 6: Admin Create RR League + Force-Close

**Files:**
- Modify: `backend/routes/round_robin_routes.py`

- [ ] **Step 1: Add admin create endpoint**

Append to `backend/routes/round_robin_routes.py`:

```python
@router.post("")
@router.post("/")
async def create_rr_league(request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    if user.get("role") not in ("admin", "city_admin"):
        raise HTTPException(status_code=403, detail="Admin only")

    body = await request.json()

    required = ["name", "sport", "country", "city", "format", "start_date", "end_date", "rr_config"]
    for f in required:
        if f not in body:
            raise HTTPException(status_code=400, detail=f"Missing field: {f}")

    rr_cfg = body["rr_config"]
    for rf in ["min_players", "max_players", "division_type", "playoff_threshold"]:
        if rf not in rr_cfg:
            raise HTTPException(status_code=400, detail=f"rr_config missing: {rf}")

    rr_cfg.setdefault("schedule_generated", False)
    rr_cfg.setdefault("playoff_generated", False)
    rr_cfg.setdefault("scoring_format", None)
    rr_cfg.setdefault("auto_started_at", None)

    league_doc = {
        "name": body["name"],
        "sport": body["sport"],
        "country": body.get("country", "USA"),
        "city": body["city"],
        "format": body.get("format", rr_cfg["division_type"]),
        "entry_fee": body.get("entry_fee", 0.0),
        "currency": body.get("currency", "USD"),
        "max_players": rr_cfg["max_players"],
        "current_players": 0,
        "start_date": body["start_date"],
        "end_date": body["end_date"],
        "status": "registration",
        "admin_id": user["_id"],
        "description": body.get("description"),
        "venue": body.get("venue"),
        "season": body.get("season", "Season 1"),
        "season_id": body.get("season_id"),
        "rules": body.get("rules"),
        "league_type": "round_robin",
        "rr_config": rr_cfg,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.leagues.insert_one(league_doc)
    return {"id": str(result.inserted_id), "message": "Round Robin league created"}


@router.post("/{league_id}/force-close")
async def force_close_rr(league_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    if user.get("role") not in ("admin", "city_admin"):
        raise HTTPException(status_code=403, detail="Admin only")

    await db.matches.update_many(
        {"league_id": league_id, "is_rr": True, "status": "scheduled"},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await _run_check_playoffs(db, league_id)
    return {"closed": True}
```

- [ ] **Step 2: Commit**

```bash
git add backend/routes/round_robin_routes.py
git commit -m "feat(backend): admin create RR league + force-close endpoint"
```

---

### Task 7: Auto-Playoff Check

**Files:**
- Modify: `backend/routes/round_robin_routes.py`
- Modify: `backend/routes/match_routes.py`

- [ ] **Step 1: Add `_run_check_playoffs` helper + endpoint**

Append to `backend/routes/round_robin_routes.py`:

```python
async def _run_check_playoffs(db, league_id: str) -> dict:
    """Check if all RR matches complete; if so, auto-generate playoffs."""
    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        return {"triggered": False}

    if not league or league.get("league_type") != "round_robin":
        return {"triggered": False}

    rr = league.get("rr_config", {})
    if rr.get("playoff_generated"):
        return {"triggered": False, "reason": "already generated"}

    total = await db.matches.count_documents({"league_id": league_id, "is_rr": True})
    done = await db.matches.count_documents(
        {"league_id": league_id, "is_rr": True, "status": {"$in": ["completed", "cancelled"]}}
    )
    if total == 0 or done < total:
        return {"triggered": False, "reason": f"{done}/{total} matches done"}

    # Pull standings sorted
    standings = await db.standings.find({"league_id": league_id}).to_list(100)
    standings.sort(
        key=lambda s: (
            -s.get("wins", 0),
            -(s.get("games_won", 0) - s.get("games_lost", 0)),
            -s.get("points", 0),
        )
    )

    threshold = rr.get("playoff_threshold", 4)
    qualifiers = standings[:threshold]
    if len(qualifiers) < 2:
        return {"triggered": False, "reason": "not enough qualifiers"}

    # Build bracket using existing playoffs collection pattern
    now_iso = datetime.now(timezone.utc).isoformat()
    playoff_matches = []

    if len(qualifiers) >= 4:
        # Top-4: 1v4, 2v3
        pairs = [(qualifiers[0], qualifiers[3]), (qualifiers[1], qualifiers[2])]
        bracket_round = "SF"
    else:
        # 2 or 3 qualifiers → direct final (with BYE if 3)
        pairs = [(qualifiers[0], qualifiers[1])]
        bracket_round = "F"

    for p1, p2 in pairs:
        match_doc = {
            "league_id": league_id,
            "sport": league["sport"],
            "player1_id": p1["player_id"],
            "player2_id": p2["player_id"],
            "player1_name": p1["player_name"],
            "player2_name": p2["player_name"],
            "scheduled_date": now_iso,
            "status": "scheduled",
            "is_playoff": True,
            "is_rr": False,
            "bracket_round": 1,
            "round": bracket_round,
            "created_at": now_iso,
        }
        result = await db.matches.insert_one(match_doc)
        playoff_matches.append(str(result.inserted_id))

    await db.leagues.update_one(
        {"_id": ObjectId(league_id)},
        {"$set": {"rr_config.playoff_generated": True}}
    )

    # Email qualifiers
    import email_service
    for i, q in enumerate(qualifiers, start=1):
        try:
            user = await db.users.find_one({"_id": ObjectId(q["player_id"])})
            if user and user.get("email") and user.get("email_notifications", True):
                email_service.schedule(email_service.send_playoff_qualified(
                    user["email"], user["name"], league["name"], league_id, i
                ))
        except Exception:
            pass

    return {"triggered": True, "playoff_matches": playoff_matches}


@router.post("/{league_id}/check-playoffs")
async def check_playoffs_endpoint(league_id: str, request: Request):
    db = request.app.state.db
    return await _run_check_playoffs(db, league_id)
```

- [ ] **Step 2: Hook into `match_routes.py` score submission**

In `backend/routes/match_routes.py`, after the `next_round_created = None` / `_maybe_advance_playoffs` block (around line 130), add:

```python
    # RR playoff check: after every RR score, see if playoffs can be generated
    rr_playoffs_triggered = None
    try:
        if match.get("is_rr"):
            from routes.round_robin_routes import _run_check_playoffs
            rr_playoffs_triggered = await _run_check_playoffs(db, match["league_id"])
    except Exception:
        pass
```

And in the final `resp` dict construction, add:

```python
    if rr_playoffs_triggered and rr_playoffs_triggered.get("triggered"):
        resp["rr_playoffs_triggered"] = True
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/round_robin_routes.py backend/routes/match_routes.py
git commit -m "feat(backend): auto-playoff generation for RR leagues + hook in score submission"
```

---

### Task 8: Frontend — Routes + Navbar

**Files:**
- Modify: `frontend/src/App.js`
- Modify: `frontend/src/components/Navbar.jsx`

- [ ] **Step 1: Add 3 new routes to `frontend/src/App.js`**

After the existing imports block (where `Leagues`, `LeagueDetail`, etc. are imported), add:

```javascript
import RoundRobinLeagues from "./pages/RoundRobinLeagues";
import RoundRobinDetail from "./pages/RoundRobinDetail";
import RoundRobinInvite from "./pages/RoundRobinInvite";
```

Inside the `<Routes>` block, after `<Route path="/leagues/:id" ...>`, add:

```jsx
<Route path="/leagues/round-robin" element={<RoundRobinLeagues />} />
<Route path="/round-robin/invite/:token" element={<RoundRobinInvite />} />
<Route path="/round-robin/:id" element={<RoundRobinDetail />} />
```

Note: `/leagues/round-robin` must come BEFORE `/leagues/:id` in route order so it's matched first.

- [ ] **Step 2: Add Round Robin link to `frontend/src/components/Navbar.jsx`**

Find the existing Leagues link in `Navbar.jsx`. It looks like:
```jsx
<Link to="/leagues" ...>Leagues</Link>
```

Add "Round Robin" as a sibling link immediately after it:

```jsx
<Link
  to="/leagues/round-robin"
  data-testid="nav-round-robin"
  className="text-sm font-medium text-gray-700 hover:text-black transition-colors"
>
  Round Robin
</Link>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.js frontend/src/components/Navbar.jsx
git commit -m "feat(frontend): add 3 RR routes, Round Robin nav link"
```

---

### Task 9: RoundRobinLeagues.jsx — Listing Page

**Files:**
- Create: `frontend/src/pages/RoundRobinLeagues.jsx`

- [ ] **Step 1: Create the listing page**

```jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Users, Calendar, Trophy } from "lucide-react";
import { activeSports } from "../config/platformConfig";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SPORT_CONFIG = {
  tennis: { label: "Tennis", icon: "🎾", color: "text-tennis" },
  pickleball: { label: "Pickleball", icon: "🏓", color: "text-pickleball" },
};

const STATUS_COLORS = {
  registration: "bg-emerald-100 text-emerald-700",
  active: "bg-blue-100 text-blue-700",
  completed: "bg-gray-100 text-gray-600",
};

export default function RoundRobinLeagues() {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ sport: "", division: "", status: "" });

  useEffect(() => {
    fetchLeagues();
  }, [filters]);

  const fetchLeagues = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.sport) params.set("sport", filters.sport);
      if (filters.division) params.set("division", filters.division);
      if (filters.status) params.set("status", filters.status);
      const { data } = await axios.get(`${API}/round-robin?${params}`);
      setLeagues(data);
    } catch {
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900">Round Robin Leagues</h1>
          <p className="text-gray-500 mt-1">Auto-scheduled leagues for busy players. Every matchup assigned a week.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <select
            data-testid="filter-sport"
            value={filters.sport}
            onChange={e => setFilters(f => ({ ...f, sport: e.target.value }))}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="">All Sports</option>
            {activeSports.map(s => (
              <option key={s.id} value={s.id}>{SPORT_CONFIG[s.id]?.label || s.id}</option>
            ))}
          </select>
          <select
            data-testid="filter-division"
            value={filters.division}
            onChange={e => setFilters(f => ({ ...f, division: e.target.value }))}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="">Singles & Doubles</option>
            <option value="singles">Singles</option>
            <option value="doubles">Doubles</option>
          </select>
          <select
            data-testid="filter-status"
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="">All Statuses</option>
            <option value="registration">Registration Open</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading leagues...</div>
        ) : leagues.length === 0 ? (
          <div className="text-center text-gray-400 py-20">No Round Robin leagues found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leagues.map(lg => {
              const sc = SPORT_CONFIG[lg.sport] || { label: lg.sport, icon: "🏆", color: "text-gray-700" };
              const rr = lg.rr_config || {};
              return (
                <Link
                  key={lg.id}
                  to={`/round-robin/${lg.id}`}
                  data-testid={`rr-league-card-${lg.id}`}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className={`text-xs font-semibold ${sc.color} mr-2`}>{sc.icon} {sc.label}</span>
                      <span className="text-xs border border-emerald-500 text-emerald-600 rounded px-1.5 py-0.5 font-medium">Round Robin</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[lg.status] || "bg-gray-100 text-gray-600"}`}>
                      {lg.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg leading-snug mb-1">{lg.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">{lg.city}</p>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {lg.current_players}/{rr.max_players || lg.max_players}
                    </span>
                    <span className="flex items-center gap-1">
                      <Trophy size={14} />
                      {rr.division_type === "doubles" ? "Doubles" : "Singles"}
                    </span>
                    <span className="font-semibold text-black">
                      {lg.entry_fee > 0 ? `$${lg.entry_fee}` : "Free"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify listing page renders**

Start frontend (`yarn start`), navigate to `http://localhost:3000/leagues/round-robin`.
Expected: page loads with filter dropdowns and "No Round Robin leagues found." (no data yet).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/RoundRobinLeagues.jsx
git commit -m "feat(frontend): RoundRobinLeagues listing page"
```

---

### Task 10: RRScheduleView.jsx Component

**Files:**
- Create: `frontend/src/components/RRScheduleView.jsx`

- [ ] **Step 1: Create the schedule accordion component**

```jsx
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const STATUS_CHIP = {
  scheduled: "bg-gray-100 text-gray-600",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

export default function RRScheduleView({ rounds = [], currentUserId }) {
  const [openRound, setOpenRound] = useState(1);

  if (rounds.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12">
        Schedule not yet generated. Waiting for minimum players to register.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rounds.map(rnd => {
        const isOpen = openRound === rnd.round;
        return (
          <div key={rnd.round} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              data-testid={`rr-round-toggle-${rnd.round}`}
              onClick={() => setOpenRound(isOpen ? null : rnd.round)}
              className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="text-left">
                <span className="font-bold text-gray-900">Round {rnd.round}</span>
                <span className="text-sm text-gray-500 ml-3">
                  Week of {rnd.week_start} – {rnd.week_end}
                </span>
              </div>
              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {rnd.matches.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-gray-400 italic">BYE — no match this round</div>
                ) : (
                  rnd.matches.map((m, idx) => {
                    const isUser = m.player1_id === currentUserId || m.player2_id === currentUserId;
                    return (
                      <div
                        key={m.match_id || idx}
                        data-testid={`rr-match-row-${m.match_id}`}
                        className={`px-5 py-3 flex items-center justify-between ${isUser ? "bg-emerald-50" : "bg-white"}`}
                      >
                        <span className="text-sm font-medium text-gray-900">
                          {m.player1_name} <span className="text-gray-400 mx-2">vs</span> {m.player2_name}
                        </span>
                        <div className="flex items-center gap-3">
                          {m.score_data && (
                            <span className="text-xs text-gray-500">
                              {JSON.stringify(m.score_data)}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CHIP[m.status] || STATUS_CHIP.scheduled}`}>
                            {m.status || "Scheduled"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/RRScheduleView.jsx
git commit -m "feat(frontend): RRScheduleView accordion component"
```

---

### Task 11: RRBracketView.jsx Component

**Files:**
- Create: `frontend/src/components/RRBracketView.jsx`

- [ ] **Step 1: Create bracket wrapper**

```jsx
import { Trophy, Clock } from "lucide-react";

export default function RRBracketView({ matches = [], generated = false }) {
  if (!generated) {
    return (
      <div className="text-center text-gray-400 py-16 flex flex-col items-center gap-3">
        <Trophy size={32} className="text-gray-300" />
        <p className="font-medium">Playoffs begin after the Round Robin completes</p>
        <p className="text-sm">Top qualifiers will be seeded automatically</p>
      </div>
    );
  }

  const byRound = matches.reduce((acc, m) => {
    const r = m.round || "Final";
    if (!acc[r]) acc[r] = [];
    acc[r].push(m);
    return acc;
  }, {});

  const ROUND_LABELS = { SF: "Semifinals", F: "Final", "3rd": "3rd Place", QF: "Quarterfinals" };

  return (
    <div className="space-y-8">
      {Object.entries(byRound).map(([round, roundMatches]) => (
        <div key={round}>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
            {ROUND_LABELS[round] || round}
          </h3>
          <div className="space-y-3">
            {roundMatches.map((m, idx) => (
              <div
                key={m.id || idx}
                data-testid={`rr-bracket-match-${m.id}`}
                className="border border-gray-200 rounded-xl overflow-hidden"
              >
                <div className={`px-4 py-3 flex justify-between items-center ${m.winner_id === m.player1_id ? "bg-emerald-50" : "bg-white"}`}>
                  <span className="font-medium text-gray-900">{m.player1_name}</span>
                  {m.winner_id === m.player1_id && <Trophy size={14} className="text-emerald-600" />}
                </div>
                <div className="h-px bg-gray-100" />
                <div className={`px-4 py-3 flex justify-between items-center ${m.winner_id === m.player2_id ? "bg-emerald-50" : "bg-white"}`}>
                  <span className="font-medium text-gray-900">{m.player2_name}</span>
                  {m.winner_id === m.player2_id && <Trophy size={14} className="text-emerald-600" />}
                </div>
                {m.status === "scheduled" && (
                  <div className="px-4 py-2 bg-gray-50 flex items-center gap-1 text-xs text-gray-500">
                    <Clock size={12} />
                    Schedule this match with your opponent within the week
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/RRBracketView.jsx
git commit -m "feat(frontend): RRBracketView playoff bracket component"
```

---

### Task 12: RoundRobinDetail.jsx — Tabbed Detail Page

**Files:**
- Create: `frontend/src/pages/RoundRobinDetail.jsx`

- [ ] **Step 1: Create the tabbed detail page**

```jsx
import { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Users, Trophy, Calendar, Mail } from "lucide-react";
import { AuthContext } from "../contexts/AuthContext";
import RRScheduleView from "../components/RRScheduleView";
import RRBracketView from "../components/RRBracketView";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TABS = ["Overview", "Schedule", "Standings", "Playoffs"];

export default function RoundRobinDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [league, setLeague] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [standings, setStandings] = useState([]);
  const [playoffMatches, setPlayoffMatches] = useState([]);
  const [activeTab, setActiveTab] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAll();
  }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [lgRes, schedRes, standRes] = await Promise.all([
        axios.get(`${API}/round-robin/${id}`),
        axios.get(`${API}/round-robin/${id}/schedule`),
        axios.get(`${API}/round-robin/${id}/standings`),
      ]);
      setLeague(lgRes.data);
      setSchedule(schedRes.data);
      setStandings(standRes.data);

      // Fetch playoff matches (is_playoff + is_rr-adjacent)
      const matchRes = await axios.get(`${API}/round-robin/${id}/matches`);
      const allMatches = matchRes.data;
      setPlayoffMatches(allMatches.filter(m => m.is_playoff));
    } catch {
      setError("Failed to load league.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user) { navigate("/auth"); return; }
    setJoining(true);
    try {
      const res = await axios.post(`${API}/round-robin/${id}/join`, {}, { withCredentials: true });
      if (res.data.redirect) {
        window.location.href = res.data.checkout_url;
      } else {
        await fetchAll();
      }
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to join league.");
    } finally {
      setJoining(false);
    }
  };

  const handleInvitePartner = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!inviteEmail) return;
    setInviteLoading(true);
    try {
      await axios.post(
        `${API}/round-robin/${id}/invite-partner`,
        { partner_email: inviteEmail },
        { withCredentials: true }
      );
      setInviteSent(true);
      setShowInviteModal(false);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to send invite.");
    } finally {
      setInviteLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  if (!league) return <div className="min-h-screen flex items-center justify-center text-gray-400">{error || "League not found."}</div>;

  const rr = league.rr_config || {};
  const isDoubles = rr.division_type === "doubles";
  const isFull = league.current_players >= (rr.max_players || league.max_players);
  const isStarted = rr.schedule_generated;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs border border-emerald-500 text-emerald-600 rounded px-1.5 py-0.5 font-medium">Round Robin</span>
                <span className="text-xs text-gray-500">{league.sport?.toUpperCase()}</span>
              </div>
              <h1 className="text-2xl font-black text-gray-900">{league.name}</h1>
              <p className="text-gray-500 mt-1">{league.city} · {isDoubles ? "Doubles" : "Singles"}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                <span className="flex items-center gap-1"><Users size={14} /> {league.current_players}/{rr.max_players || league.max_players} players</span>
                <span className="flex items-center gap-1"><Calendar size={14} /> Starts {league.start_date}</span>
                <span className="font-semibold text-black">{league.entry_fee > 0 ? `$${league.entry_fee}` : "Free"}</span>
              </div>
            </div>
            {/* Join panel */}
            {!isStarted && !isFull && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 min-w-[200px]">
                {inviteSent ? (
                  <p className="text-emerald-600 text-sm font-medium">Invite sent! Waiting for partner.</p>
                ) : isDoubles ? (
                  <>
                    <button
                      data-testid="btn-register-team"
                      onClick={() => setShowInviteModal(true)}
                      className="w-full bg-black text-white rounded-md py-2 text-sm font-bold hover:bg-gray-800 transition"
                    >
                      Register as Team
                    </button>
                    <p className="text-xs text-gray-400 mt-2 text-center">Enter partner email to send invite</p>
                  </>
                ) : (
                  <button
                    data-testid="btn-join-league"
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full bg-black text-white rounded-md py-2 text-sm font-bold hover:bg-gray-800 transition disabled:opacity-50"
                  >
                    {joining ? "Joining..." : "Join League"}
                  </button>
                )}
                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
              </div>
            )}
            {isStarted && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 text-sm text-emerald-700 font-medium">
                League Active — {rr.playoff_generated ? "Playoffs Underway" : "Round Robin in progress"}
              </div>
            )}
            {isFull && !isStarted && (
              <div className="bg-gray-100 border border-gray-200 rounded-xl px-5 py-3 text-sm text-gray-500">
                League Full
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-6 border-b border-gray-200">
            {TABS.map(tab => (
              <button
                key={tab}
                data-testid={`tab-${tab.toLowerCase()}`}
                onClick={() => setActiveTab(tab)}
                className={`py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab
                    ? "border-black text-black"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === "Overview" && (
          <div className="space-y-6">
            {league.description && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="font-bold text-gray-900 mb-2">About</h2>
                <p className="text-gray-600 text-sm leading-relaxed">{league.description}</p>
              </div>
            )}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-bold text-gray-900 mb-3">Format</h2>
              <ul className="text-sm text-gray-600 space-y-2">
                <li><strong>Scoring:</strong> {rr.scoring_format || (league.sport === "tennis" ? "Fast-4" : "Games to 11")}</li>
                <li><strong>Division:</strong> {isDoubles ? "Fixed-Partner Doubles" : "Singles"}</li>
                <li><strong>Playoff qualifiers:</strong> Top {rr.playoff_threshold || 4}</li>
                <li><strong>Schedule:</strong> Auto-generated when minimum players ({rr.min_players}) register</li>
              </ul>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h2 className="font-bold text-amber-900 mb-2 text-sm">Scheduling</h2>
              <p className="text-amber-800 text-sm leading-relaxed">
                Players are responsible for coordinating match times within each week window.
                Offer at least 3 time slots; respond within 48 hours. The league does not assign courts.
                One reschedule credit per season. Failing to complete a match by week deadline = double default.
              </p>
            </div>
          </div>
        )}

        {activeTab === "Schedule" && (
          <RRScheduleView
            rounds={schedule?.rounds || []}
            currentUserId={user?.id}
          />
        )}

        {activeTab === "Standings" && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Rank", "Player", "W", "L", "Pts", "Game Diff"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {standings.map((s, i) => {
                  const isQualifier = i < (rr.playoff_threshold || 4) && isStarted;
                  return (
                    <tr key={s.id} className={isQualifier ? "bg-emerald-50" : ""}>
                      <td className="px-4 py-3 font-bold text-gray-900">{s.rank}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{s.player_name}</td>
                      <td className="px-4 py-3 text-gray-700">{s.wins}</td>
                      <td className="px-4 py-3 text-gray-700">{s.losses}</td>
                      <td className="px-4 py-3 text-gray-700">{s.points?.toFixed(1)}</td>
                      <td className="px-4 py-3 text-gray-700">{(s.games_won || 0) - (s.games_lost || 0)}</td>
                    </tr>
                  );
                })}
                {standings.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No standings yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "Playoffs" && (
          <RRBracketView
            matches={playoffMatches}
            generated={rr.playoff_generated || false}
          />
        )}
      </div>

      {/* Invite partner modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h2 className="font-bold text-gray-900 text-lg mb-4">Invite your partner</h2>
            <p className="text-sm text-gray-500 mb-4">Enter your partner's email. They'll receive an invite link to join as your fixed doubles partner.</p>
            <input
              data-testid="input-partner-email"
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="partner@email.com"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-black"
            />
            <div className="flex gap-3">
              <button
                data-testid="btn-send-invite"
                onClick={handleInvitePartner}
                disabled={inviteLoading || !inviteEmail}
                className="flex-1 bg-black text-white rounded-md py-2 text-sm font-bold hover:bg-gray-800 transition disabled:opacity-50"
              >
                {inviteLoading ? "Sending..." : "Send Invite"}
              </button>
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 border border-gray-300 rounded-md py-2 text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
            {error && <p className="text-red-500 text-xs mt-3">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/RoundRobinDetail.jsx
git commit -m "feat(frontend): RoundRobinDetail tabbed page (Overview/Schedule/Standings/Playoffs)"
```

---

### Task 13: RoundRobinInvite.jsx — Partner Acceptance Page

**Files:**
- Create: `frontend/src/pages/RoundRobinInvite.jsx`

- [ ] **Step 1: Create invite acceptance page**

```jsx
import { useState, useEffect, useContext } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../contexts/AuthContext";
import { Trophy, AlertCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RoundRobinInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    fetchInvite();
  }, [token]);

  useEffect(() => {
    // If user logs in while on this page, re-fetch to clear auth gate
    if (user) fetchInvite();
  }, [user]);

  const fetchInvite = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/round-robin/invite/${token}`);
      setInvite(data);
      setError("");
    } catch (e) {
      setError(e.response?.data?.detail || "Invalid or expired invite link.");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!user) {
      navigate(`/auth?next=/round-robin/invite/${token}`);
      return;
    }
    setAccepting(true);
    try {
      const res = await axios.post(
        `${API}/round-robin/invite/${token}/accept`,
        {},
        { withCredentials: true }
      );
      setAccepted(true);
      setTimeout(() => navigate(`/round-robin/${res.data.league_id}`), 1500);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to accept invite.");
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading invite...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
          <h1 className="font-bold text-gray-900 text-lg mb-2">Invite Unavailable</h1>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <p className="text-xs text-gray-400">Contact your inviter to send a new invite link.</p>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <Trophy size={40} className="text-emerald-500 mx-auto mb-4" />
          <h1 className="font-bold text-gray-900 text-lg mb-2">You're in!</h1>
          <p className="text-gray-500 text-sm">Redirecting to league...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <div className="text-3xl mb-4">{invite?.sport === "tennis" ? "🎾" : "🏓"}</div>
        <h1 className="font-black text-gray-900 text-xl mb-1">You're invited!</h1>
        <p className="text-gray-500 text-sm mb-6">
          <strong>{invite?.inviter_name}</strong> wants you as their doubles partner
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">League</span>
            <span className="font-medium text-gray-900">{invite?.league_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Sport</span>
            <span className="font-medium text-gray-900">{invite?.sport?.toUpperCase()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Entry fee</span>
            <span className="font-medium text-gray-900">
              {invite?.entry_fee > 0 ? `$${invite.entry_fee}` : "Free"}
            </span>
          </div>
        </div>

        {!user ? (
          <div>
            <p className="text-sm text-gray-500 mb-4">Log in or create an account to accept this invite.</p>
            <Link
              to={`/auth?next=/round-robin/invite/${token}`}
              data-testid="btn-login-to-accept"
              className="block w-full bg-black text-white rounded-md py-2.5 text-sm font-bold hover:bg-gray-800 transition"
            >
              Log in to accept
            </Link>
          </div>
        ) : (
          <button
            data-testid="btn-accept-invite"
            onClick={handleAccept}
            disabled={accepting}
            className="w-full bg-black text-white rounded-md py-2.5 text-sm font-bold hover:bg-gray-800 transition disabled:opacity-50"
          >
            {accepting ? "Accepting..." : "Accept & Join as Partner"}
          </button>
        )}
        {error && <p className="text-red-500 text-xs mt-3">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/RoundRobinInvite.jsx
git commit -m "feat(frontend): RoundRobinInvite partner acceptance page"
```

---

### Task 14: Admin Dashboard — Create RR League Form

**Files:**
- Modify: `frontend/src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Add "Create Round Robin League" button + form**

In `AdminDashboard.jsx`, locate the existing Create League section (look for `"Create League"` or `"New League"` button). Add a new "Create Round Robin" button alongside it. When clicked, open a modal with the RR-specific fields.

Find the section of AdminDashboard.jsx where League creation is handled and add a state variable and modal:

```jsx
// Add near other state declarations:
const [showRRForm, setShowRRForm] = useState(false);
const [rrFormData, setRRFormData] = useState({
  name: "", sport: "tennis", country: "USA", city: "",
  format: "singles", entry_fee: 0, start_date: "", end_date: "",
  description: "",
  rr_config: { min_players: 6, max_players: 12, division_type: "singles", playoff_threshold: 4 }
});
```

Add an "Create Round Robin League" button in the admin league management area:

```jsx
<button
  data-testid="btn-create-rr-league"
  onClick={() => setShowRRForm(true)}
  className="px-4 py-2 border border-emerald-500 text-emerald-600 rounded-md text-sm font-medium hover:bg-emerald-50 transition"
>
  + Create Round Robin League
</button>
```

Add the modal (place before the final closing `</div>` of AdminDashboard):

```jsx
{showRRForm && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
    <div className="bg-white rounded-2xl p-6 max-w-lg w-full my-8">
      <h2 className="font-bold text-lg text-gray-900 mb-4">Create Round Robin League</h2>
      <div className="space-y-4">
        {[
          { label: "Name", field: "name", type: "text" },
          { label: "City", field: "city", type: "text" },
          { label: "Entry Fee ($)", field: "entry_fee", type: "number" },
          { label: "Start Date", field: "start_date", type: "date" },
          { label: "End Date", field: "end_date", type: "date" },
          { label: "Description", field: "description", type: "text" },
        ].map(({ label, field, type }) => (
          <div key={field}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input
              data-testid={`rr-form-${field}`}
              type={type}
              value={rrFormData[field]}
              onChange={e => setRRFormData(d => ({ ...d, [field]: e.target.value }))}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        ))}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sport</label>
          <select
            data-testid="rr-form-sport"
            value={rrFormData.sport}
            onChange={e => setRRFormData(d => ({ ...d, sport: e.target.value }))}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
          >
            <option value="tennis">Tennis</option>
            <option value="pickleball">Pickleball</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Division Type</label>
          <select
            data-testid="rr-form-division"
            value={rrFormData.rr_config.division_type}
            onChange={e => setRRFormData(d => ({
              ...d,
              format: e.target.value,
              rr_config: { ...d.rr_config, division_type: e.target.value }
            }))}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
          >
            <option value="singles">Singles</option>
            <option value="doubles">Fixed-Partner Doubles</option>
          </select>
        </div>
        {[
          { label: "Min Players", field: "min_players" },
          { label: "Max Players", field: "max_players" },
          { label: "Playoff Qualifiers (top N)", field: "playoff_threshold" },
        ].map(({ label, field }) => (
          <div key={field}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input
              data-testid={`rr-form-${field}`}
              type="number"
              value={rrFormData.rr_config[field]}
              onChange={e => setRRFormData(d => ({
                ...d,
                rr_config: { ...d.rr_config, [field]: parseInt(e.target.value) || 0 }
              }))}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-6">
        <button
          data-testid="btn-submit-rr-league"
          onClick={async () => {
            try {
              await axios.post(`${API}/round-robin`, rrFormData, { withCredentials: true });
              setShowRRForm(false);
              // refresh league list if applicable
            } catch (e) {
              alert(e.response?.data?.detail || "Failed to create league");
            }
          }}
          className="flex-1 bg-black text-white rounded-md py-2 text-sm font-bold hover:bg-gray-800 transition"
        >
          Create League
        </button>
        <button
          onClick={() => setShowRRForm(false)}
          className="flex-1 border border-gray-300 rounded-md py-2 text-sm font-medium hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/AdminDashboard.jsx
git commit -m "feat(frontend): admin Create Round Robin League form"
```

---

### Task 15: End-to-End Smoke Test

- [ ] **Step 1: Start backend and frontend**

```bash
# Terminal 1
cd backend && uvicorn server:app --reload --port 8001

# Terminal 2
cd frontend && yarn start
```

- [ ] **Step 2: Create a test RR league via Admin**

Log in as admin (`adonllcusa@gmail.com` / `Venlaxsports1!`). Navigate to Admin Dashboard. Click "Create Round Robin League". Fill in:
- Name: "Test RR Tennis Singles"
- Sport: Tennis
- City: Austin
- Division: Singles
- Min players: 2 (for fast testing)
- Max players: 4
- Start date: today
- End date: 4 weeks from today
- Entry fee: 0

Submit. Verify league appears at `http://localhost:3000/leagues/round-robin`.

- [ ] **Step 3: Register 2 players (singles auto-start)**

In an incognito window, create a second test user. Join the league. Verify:
- Both players appear in standings
- Schedule tab shows generated rounds
- League status changes to "active"
- Console shows `[EMAIL:console]` lines for league-started emails (if SMTP not configured)

- [ ] **Step 4: Submit a score**

Use the existing `PATCH /api/matches/:id/score` endpoint (via ScoreReport page or API directly) for a match in the RR league. Verify:
- Match status → "completed"
- Standings update
- If all matches done, playoffs appear in Playoffs tab

- [ ] **Step 5: Test doubles invite flow**

Create a doubles RR league (min 2 teams). As user A, go to `/round-robin/:id`, click "Register as Team", enter user B's email. Check console for invite email log showing the invite URL. Navigate to that URL as user B (must be logged in). Accept. Verify team registered and schedule generates.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "test: verify RR end-to-end smoke test passes"
```

---

## Spec Coverage Verification

| Spec Section | Covered By Task |
|---|---|
| League model `league_type` + `rr_config` | Task 1 |
| Match model `round` + partner fields | Task 1 |
| `rr_schedules` collection | Task 4 |
| `doubles_invites` collection | Task 5 |
| GET /api/round-robin + filters | Task 3 |
| GET /:id/schedule, standings, matches | Task 3 |
| POST /:id/join (singles) | Task 4 |
| POST /:id/invite-partner | Task 5 |
| GET /invite/:token | Task 5 |
| POST /invite/:token/accept | Task 5 |
| POST /:id/generate-schedule | Task 4 |
| POST /:id/check-playoffs | Task 7 |
| POST / (admin create) | Task 6 |
| POST /:id/force-close | Task 6 |
| Circle algorithm + BYE | Task 2 |
| Week assignment | Task 4 |
| Auto-trigger on min players | Task 4, 5 |
| Auto-playoff after all matches | Task 7 |
| Hook in match_routes.py score | Task 7 |
| Partner invite email | Task 5 |
| League-started email | Task 4 |
| Playoff-qualified email | Task 7 |
| `/leagues/round-robin` listing | Task 9, 10 |
| `/round-robin/:id` tabbed detail | Task 11, 12 |
| `/round-robin/invite/:token` page | Task 13 |
| Navbar Round Robin link | Task 9 |
| Admin create form | Task 14 |
| Tiebreaker sort chain | Task 3 (standings endpoint) |
| Playoff bracket seeding (1v4, 2v3) | Task 7 |
| Scoring format auto-set | Task 4 |
| max_players lock (400 if full) | Task 4 |
| ELO updates | Existing `match_routes.py` (no change needed) |
