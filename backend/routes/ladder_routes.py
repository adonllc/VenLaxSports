from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from models import LadderCreate, LadderChallengeCreate
from auth_utils import get_current_user, get_optional_user, require_admin

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


@router.post("/challenges")
async def create_challenge(data: LadderChallengeCreate, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    uid = str(user["_id"])
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    try:
        ladder = await db.ladders.find_one({"_id": ObjectId(data.ladder_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Ladder not found")
    if not ladder:
        raise HTTPException(status_code=404, detail="Ladder not found")

    entries = ladder.get("entries", [])
    my_entry = next((e for e in entries if e["player_id"] == uid), None)
    if not my_entry:
        raise HTTPException(status_code=400, detail="You are not in this ladder")

    challenged_entry = next((e for e in entries if e["player_id"] == data.challenged_player_id), None)
    if not challenged_entry:
        raise HTTPException(status_code=400, detail="Challenged player is not in this ladder")

    if challenged_entry["rank"] >= my_entry["rank"]:
        raise HTTPException(status_code=400, detail="You can only challenge players ranked above you")

    cooldown = my_entry.get("challenge_cooldown_until")
    if cooldown and datetime.fromisoformat(cooldown) > now:
        raise HTTPException(status_code=400, detail=f"Challenge cooldown active until {cooldown}")

    existing = await db.ladder_challenges.find_one({
        "ladder_id": data.ladder_id,
        "challenger_id": uid,
        "status": "pending",
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active outgoing challenge")

    from datetime import timedelta
    expires_at = (now + timedelta(hours=72)).isoformat()
    challenge_doc = {
        "ladder_id": data.ladder_id,
        "challenger_id": uid,
        "challenged_id": data.challenged_player_id,
        "challenger_rank": my_entry["rank"],
        "challenged_rank": challenged_entry["rank"],
        "status": "pending",
        "match_id": None,
        "expires_at": expires_at,
        "created_at": now_iso,
    }
    result = await db.ladder_challenges.insert_one(challenge_doc)
    challenge_doc["id"] = str(result.inserted_id)
    challenge_doc.pop("_id", None)

    # Notify challenged player
    import email_service
    challenged_user = await db.users.find_one(
        {"_id": ObjectId(data.challenged_player_id)},
        {"email": 1, "name": 1, "email_notifications": 1}
    )
    challenger_name = user.get("name", "A player")
    ladder_name = f"{ladder['city']} {ladder['division_label']} {ladder['sport'].title()} Ladder"
    if challenged_user and challenged_user.get("email") and challenged_user.get("email_notifications", True):
        expires_display = (now + timedelta(hours=72)).strftime("%b %d at %I:%M %p UTC")
        await email_service.send_email(
            to=challenged_user["email"],
            subject=f"{challenger_name} has challenged you on the VENLAX Ladder",
            body=f"You've been challenged on the {ladder_name}. Accept by {expires_display}.",
        )

    return challenge_doc


@router.patch("/challenges/{challenge_id}/accept")
async def accept_challenge(challenge_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    uid = str(user["_id"])

    try:
        challenge = await db.ladder_challenges.find_one({"_id": ObjectId(challenge_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if challenge["challenged_id"] != uid:
        raise HTTPException(status_code=403, detail="Not your challenge to accept")
    if challenge["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Challenge is {challenge['status']}")

    if datetime.fromisoformat(challenge["expires_at"]) < datetime.now(timezone.utc):
        await db.ladder_challenges.update_one(
            {"_id": ObjectId(challenge_id)}, {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=400, detail="Challenge has expired")

    ladder = await db.ladders.find_one({"_id": ObjectId(challenge["ladder_id"])})
    sport = ladder["sport"] if ladder else "tennis"

    challenger = await db.users.find_one({"_id": ObjectId(challenge["challenger_id"])}, {"name": 1})
    challenged = await db.users.find_one({"_id": ObjectId(uid)}, {"name": 1})

    now_iso = datetime.now(timezone.utc).isoformat()
    match_doc = {
        "league_id": challenge["ladder_id"],
        "sport": sport,
        "player1_id": challenge["challenger_id"],
        "player2_id": uid,
        "player1_name": challenger.get("name", "") if challenger else "",
        "player2_name": challenged.get("name", "") if challenged else "",
        "scheduled_date": now_iso,
        "status": "scheduled",
        "source": "ladder",
        "ladder_challenge_id": challenge_id,
        "created_at": now_iso,
    }
    match_result = await db.matches.insert_one(match_doc)
    match_id = str(match_result.inserted_id)

    await db.ladder_challenges.update_one(
        {"_id": ObjectId(challenge_id)},
        {"$set": {"status": "accepted", "match_id": match_id}},
    )

    match_doc["id"] = match_id
    match_doc.pop("_id", None)
    return match_doc


@router.patch("/challenges/{challenge_id}/decline")
async def decline_challenge(challenge_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    uid = str(user["_id"])

    try:
        challenge = await db.ladder_challenges.find_one({"_id": ObjectId(challenge_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if challenge["challenged_id"] != uid:
        raise HTTPException(status_code=403, detail="Not your challenge to decline")
    if challenge["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Challenge is {challenge['status']}")

    await db.ladder_challenges.update_one(
        {"_id": ObjectId(challenge_id)},
        {"$set": {"status": "declined"}},
    )
    return {"status": "declined"}


@router.post("/{ladder_id}/join")
async def join_ladder(ladder_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    uid = str(user["_id"])

    try:
        ladder = await db.ladders.find_one({"_id": ObjectId(ladder_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Ladder not found")
    if not ladder:
        raise HTTPException(status_code=404, detail="Ladder not found")

    entries = ladder.get("entries", [])
    if any(e["player_id"] == uid for e in entries):
        raise HTTPException(status_code=400, detail="Already in this ladder")

    sport = ladder.get("sport", "tennis")
    elo_field = f"{sport}_rating"
    my_elo = user.get(elo_field, 1500)
    now_iso = datetime.now(timezone.utc).isoformat()

    new_entry = {
        "player_id": uid,
        "name": user.get("name", ""),
        "elo": my_elo,
        "joined_at": now_iso,
        "challenge_cooldown_until": None,
    }

    insert_pos = len(entries)
    for i, e in enumerate(entries):
        if my_elo > e.get("elo", 0):
            insert_pos = i
            break

    entries.insert(insert_pos, new_entry)

    for i, e in enumerate(entries):
        e["rank"] = i + 1

    await db.ladders.update_one(
        {"_id": ObjectId(ladder_id)},
        {"$set": {"entries": entries}},
    )

    new_entry["rank"] = insert_pos + 1
    return new_entry


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
