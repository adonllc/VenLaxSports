from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from bson import ObjectId
from models import Match, MatchCreate, MatchScore
from auth_utils import get_current_user
import email_service

router = APIRouter()


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


def _should_notify(user: dict) -> bool:
    return bool(user and user.get("email") and user.get("email_notifications", True))


@router.get("/my")
async def my_matches(request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    uid = user["_id"]
    matches = await db.matches.find(
        {"$or": [{"player1_id": uid}, {"player2_id": uid}]}
    ).sort("scheduled_date", -1).to_list(50)
    return [_serialize(m) for m in matches]


@router.post("/")
async def create_match(data: MatchCreate, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)

    try:
        league = await db.leagues.find_one({"_id": ObjectId(data.league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    in_league = await db.player_leagues.find_one({"player_id": user["_id"], "league_id": data.league_id})
    if not in_league:
        raise HTTPException(status_code=400, detail="You are not registered in this league")

    try:
        opponent = await db.users.find_one({"_id": ObjectId(data.player2_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Opponent not found")
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent not found")

    match = Match(
        league_id=data.league_id,
        sport=league["sport"],
        player1_id=user["_id"],
        player2_id=data.player2_id,
        player1_name=user["name"],
        player2_name=opponent["name"],
        scheduled_date=data.scheduled_date,
        venue=data.venue or league.get("venue"),
        notes=data.notes,
    )
    result = await db.matches.insert_one(match.to_mongo())
    match_id = str(result.inserted_id)

    # Notify both players (fire-and-forget)
    if _should_notify(user):
        email_service.schedule(email_service.send_match_scheduled(
            user["email"], user["name"], opponent["name"], league["sport"],
            data.scheduled_date, data.venue or league.get("venue"), match_id))
    if _should_notify(opponent):
        email_service.schedule(email_service.send_match_scheduled(
            opponent["email"], opponent["name"], user["name"], league["sport"],
            data.scheduled_date, data.venue or league.get("venue"), match_id))

    return {"id": match_id, "message": "Match scheduled"}


@router.post("/{match_id}/score")
async def report_score(match_id: str, score_data: MatchScore, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)

    try:
        match = await db.matches.find_one({"_id": ObjectId(match_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Match not found")
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if user["_id"] not in [match["player1_id"], match["player2_id"]]:
        raise HTTPException(status_code=403, detail="Not a player in this match")
    if match["status"] == "completed":
        raise HTTPException(status_code=400, detail="Match already completed")

    winner_name = (
        match["player1_name"] if score_data.winner_id == match["player1_id"] else match["player2_name"]
    )
    await db.matches.update_one(
        {"_id": ObjectId(match_id)},
        {
            "$set": {
                "status": "completed",
                "winner_id": score_data.winner_id,
                "winner_name": winner_name,
                "score_data": score_data.score_data,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    await _update_standings(db, match["league_id"], match, score_data.winner_id)

    # Notify both players with the result
    try:
        league = await db.leagues.find_one({"_id": ObjectId(match["league_id"])})
        league_name = league.get("name", "your league") if league else "your league"
        p1 = await db.users.find_one({"_id": ObjectId(match["player1_id"])})
        p2 = await db.users.find_one({"_id": ObjectId(match["player2_id"])})
        for p, opp_name in ((p1, match["player2_name"]), (p2, match["player1_name"])):
            if _should_notify(p):
                won = str(p["_id"]) == str(score_data.winner_id)
                email_service.schedule(email_service.send_score_reported(
                    p["email"], p["name"], opp_name, match["sport"],
                    won, match["league_id"], league_name))
    except Exception:
        pass

    return {"message": "Score reported successfully"}


@router.get("/{match_id}")
async def get_match(match_id: str, request: Request):
    db = request.app.state.db
    try:
        match = await db.matches.find_one({"_id": ObjectId(match_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Match not found")
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return _serialize(match)


async def _update_standings(db, league_id: str, match: dict, winner_id: str):
    loser_id = match["player2_id"] if winner_id == match["player1_id"] else match["player1_id"]
    now = datetime.now(timezone.utc).isoformat()
    await db.standings.update_one(
        {"league_id": league_id, "player_id": winner_id},
        {"$inc": {"wins": 1, "matches_played": 1, "points": 2}, "$set": {"updated_at": now}},
    )
    await db.standings.update_one(
        {"league_id": league_id, "player_id": loser_id},
        {"$inc": {"losses": 1, "matches_played": 1}, "$set": {"updated_at": now}},
    )
