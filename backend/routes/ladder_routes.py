from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from models import LadderCreate, LadderChallengeCreate
from auth_utils import get_optional_user, require_admin

router = APIRouter(redirect_slashes=False)


@router.get("")
@router.get("/")
async def list_ladders(
    request: Request,
    city: Optional[str] = None,
    sport: Optional[str] = None,
    division: Optional[str] = None,
    format: Optional[str] = None,
):
    db = request.app.state.db
    query: dict = {"is_active": True}
    if city:
        query["city"] = city
    if sport:
        query["sport"] = sport
    if division:
        query["division_label"] = division
    if format:
        query["format"] = format
    ladders = await db.ladders.find(query).sort("created_at", -1).to_list(50)
    result = []
    for l in ladders:
        l["id"] = str(l.pop("_id"))
        l["entry_count"] = len(l.get("entries", []))
        l["top_players"] = l.get("entries", [])[:3]
        result.append(l)
    return result


@router.post("")
@router.post("/")
async def create_ladder(data: LadderCreate, request: Request):
    db = request.app.state.db
    await require_admin(request, db)
    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "city": data.city,
        "sport": data.sport,
        "division_label": data.division_label,
        "format": data.format,
        "entries": [],
        "is_active": True,
        "created_at": now_iso,
    }
    result = await db.ladders.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.get("/{ladder_id}")
async def get_ladder(ladder_id: str, request: Request):
    db = request.app.state.db
    try:
        ladder = await db.ladders.find_one({"_id": ObjectId(ladder_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Ladder not found")
    if not ladder:
        raise HTTPException(status_code=404, detail="Ladder not found")

    ladder["id"] = str(ladder.pop("_id"))
    entries = ladder.get("entries", [])
    now = datetime.now(timezone.utc)

    user = await get_optional_user(request, db)
    uid = str(user["_id"]) if user else None

    if uid:
        my_rank = next((e["rank"] for e in entries if e["player_id"] == uid), None)
        active_challenge = await db.ladder_challenges.find_one({
            "ladder_id": ladder_id,
            "challenger_id": uid,
            "status": "pending",
        })
        my_entry = next((e for e in entries if e["player_id"] == uid), None)
        cooldown_until = my_entry.get("challenge_cooldown_until") if my_entry else None
        on_cooldown = bool(cooldown_until and datetime.fromisoformat(cooldown_until) > now)

        for entry in entries:
            is_above = bool(my_rank and entry["rank"] < my_rank)
            entry["can_challenge"] = bool(is_above and not active_challenge and not on_cooldown)

        ladder["my_rank"] = my_rank
        ladder["my_cooldown_until"] = next(
            (e.get("challenge_cooldown_until") for e in entries if e["player_id"] == uid), None
        )
    else:
        for entry in entries:
            entry["can_challenge"] = False

    ladder["entry_count"] = len(entries)
    return ladder
