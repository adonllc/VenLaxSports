"""Playoffs bracket generation — single-elimination from top N standings.

Given a league and a top-N size (4 or 8), generates first-round matches
seeded #1 vs #N, #2 vs N-1, etc. Matches are written with status="scheduled"
and a bracket_round field so the UI can render a bracket view.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import List
from bson import ObjectId
from auth_utils import require_admin
from models import Match

router = APIRouter()


class BracketCreate(BaseModel):
    league_id: str
    top_n: int = 8  # must be a power of 2 (2, 4, 8, 16)
    first_round_date: str  # ISO date string (YYYY-MM-DD)


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


def _is_power_of_two(n: int) -> bool:
    return n >= 2 and (n & (n - 1)) == 0


def _seed_pairs(n: int) -> list[tuple[int, int]]:
    """Return list of (seed_a, seed_b) pairs for round-1 matchups.
    e.g. n=8 -> [(1,8),(4,5),(3,6),(2,7)]  → standard single-elim seeding.
    """
    seeds = list(range(1, n + 1))
    pairs = []
    while seeds:
        hi = seeds.pop(0)
        lo = seeds.pop(-1)
        pairs.append((hi, lo))
    # Re-order to bracket-friendly order (top half plays top, bottom half plays bottom)
    half = len(pairs) // 2
    if half > 0:
        top = pairs[:half]
        bot = list(reversed(pairs[half:]))
        # interleave so (1 vs n) meets (4 vs n-3) in semis, (2 vs n-1) meets (3 vs n-2)
        result = []
        for i in range(half):
            result.append(top[i])
            if i < len(bot):
                result.append(bot[i])
        pairs = result
    return pairs


@router.post("")
@router.post("/")
async def generate_bracket(data: BracketCreate, request: Request):
    db = request.app.state.db
    await require_admin(request, db)

    if not _is_power_of_two(data.top_n):
        raise HTTPException(status_code=400, detail="top_n must be 2, 4, 8, or 16")
    if not ObjectId.is_valid(data.league_id):
        raise HTTPException(status_code=404, detail="League not found")

    league = await db.leagues.find_one({"_id": ObjectId(data.league_id)})
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    # Qualification thresholds: ≤12 players → Top 4, >12 → Top 8
    player_count = await db.player_leagues.count_documents({
        "league_id": data.league_id,
        "payment_status": {"$in": ["paid", "free"]},
    })
    recommended_top_n = 4 if player_count <= 12 else 8
    if data.top_n > recommended_top_n:
        raise HTTPException(
            status_code=400,
            detail=(
                f"League has {player_count} players. "
                f"Maximum qualifying spots: {recommended_top_n} "
                f"({'≤12 players → Top 4' if player_count <= 12 else '>12 players → Top 8'}). "
                f"Set top_n ≤ {recommended_top_n}."
            ),
        )

    # Pull top-N standings
    standings = await db.standings.find(
        {"league_id": data.league_id},
        {"_id": 0},
    ).sort([("points", -1), ("wins", -1)]).limit(data.top_n).to_list(data.top_n)

    if len(standings) < data.top_n:
        raise HTTPException(
            status_code=400,
            detail=f"Only {len(standings)} players have standings — need {data.top_n}",
        )

    # Avoid duplicate bracket generation
    existing = await db.matches.count_documents(
        {"league_id": data.league_id, "is_playoff": True}
    )
    if existing > 0:
        raise HTTPException(status_code=400, detail="Playoff bracket already generated for this league")

    pairs = _seed_pairs(data.top_n)
    now = datetime.now(timezone.utc).isoformat()
    created_ids: list[str] = []

    for idx, (a, b) in enumerate(pairs, start=1):
        p1 = standings[a - 1]
        p2 = standings[b - 1]
        m = Match(
            league_id=data.league_id,
            sport=league["sport"],
            player1_id=p1["player_id"],
            player2_id=p2["player_id"],
            player1_name=p1["player_name"],
            player2_name=p2["player_name"],
            scheduled_date=data.first_round_date,
            venue=league.get("venue"),
            notes=f"Playoff Round 1 — Match {idx}",
        )
        doc = m.to_mongo()
        doc["is_playoff"] = True
        doc["bracket_round"] = 1
        doc["bracket_position"] = idx
        doc["created_at"] = now
        result = await db.matches.insert_one(doc)
        created_ids.append(str(result.inserted_id))

    # Flag the league as in playoffs
    await db.leagues.update_one(
        {"_id": ObjectId(data.league_id)},
        {"$set": {"playoffs_status": "round_1", "updated_at": now}},
    )

    return {
        "message": f"Playoff bracket generated — {len(created_ids)} matches",
        "match_ids": created_ids,
        "rounds_total": data.top_n.bit_length() - 1,  # e.g., 8 → 3 rounds
    }


@router.get("/{league_id}")
async def get_bracket(league_id: str, request: Request):
    """Return all playoff matches for a league grouped by round."""
    db = request.app.state.db
    cursor = db.matches.find({"league_id": league_id, "is_playoff": True}).sort([
        ("bracket_round", 1),
        ("bracket_position", 1),
    ])
    matches = [_serialize(m) async for m in cursor]
    rounds: dict[int, list] = {}
    for m in matches:
        r = m.get("bracket_round", 1)
        rounds.setdefault(r, []).append(m)
    return {
        "league_id": league_id,
        "rounds": [{"round": r, "matches": rounds[r]} for r in sorted(rounds.keys())],
    }
