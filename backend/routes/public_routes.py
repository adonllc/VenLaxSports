"""Public (no-auth) endpoints — city leaderboards, league spectator, player profiles, challenge."""
import os
from datetime import datetime, timezone, date
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth_utils import get_optional_user, serialize_public_user
from models import Challenge
import email_service

router = APIRouter()

_VALID_SPORTS = {"tennis", "pickleball", "cricket"}


@router.get("/city/{city}/sport/{sport}")
async def city_leaderboard(city: str, sport: str, request: Request, limit: int = 20):
    """Public city leaderboard. No auth required. Returns empty lists for unknown cities."""
    db = request.app.state.db
    if sport not in _VALID_SPORTS:
        raise HTTPException(status_code=400, detail=f"sport must be one of {sorted(_VALID_SPORTS)}")
    limit = min(limit, 50)

    rating_field = f"{sport}_rating"
    users = await db.users.find(
        {"city": city, "is_active": {"$ne": False}},
        {"name": 1, rating_field: 1, "profile_public": 1},
    ).sort(rating_field, -1).limit(limit).to_list(limit)

    leaders = []
    for u in users:
        if not u.get("profile_public", True):
            leaders.append({
                "id": str(u["_id"]),
                "name": "Anonymous Player",
                "rating": u.get(rating_field, 3.0),
                "profile_public": False,
            })
        else:
            leaders.append({
                "id": str(u["_id"]),
                "name": u.get("name"),
                "rating": u.get(rating_field, 3.0),
                "profile_public": True,
            })

    leagues = await db.leagues.find(
        {"city": city, "sport": sport, "status": {"$in": ["registration", "active"]}},
        {"name": 1, "status": 1, "current_players": 1, "max_players": 1, "entry_fee": 1, "league_type": 1},
    ).limit(6).to_list(6)

    active_leagues = [
        {
            "id": str(l["_id"]),
            "name": l.get("name"),
            "status": l.get("status"),
            "current_players": l.get("current_players", 0),
            "max_players": l.get("max_players"),
            "entry_fee": l.get("entry_fee", 0),
            "league_type": l.get("league_type", "flex"),
        }
        for l in leagues
    ]

    return {"city": city, "sport": sport, "leaders": leaders, "active_leagues": active_leagues}


@router.get("/league/{league_id}")
async def league_spectator(league_id: str, request: Request):
    """Public league view — no auth required. Returns 404 for private or nonexistent leagues."""
    db = request.app.state.db
    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league or not league.get("is_public", True):
        raise HTTPException(status_code=404, detail="League not found")

    standings = await db.standings.find(
        {"league_id": league_id},
        {"player_id": 1, "player_name": 1, "wins": 1, "losses": 1, "points": 1, "matches_played": 1, "_id": 0},
    ).sort("points", -1).to_list(50)

    recent_matches = await db.matches.find(
        {"league_id": league_id, "status": "completed"},
        {"player1_name": 1, "player2_name": 1, "winner_name": 1, "score_data": 1, "scheduled_date": 1, "sport": 1, "_id": 0},
    ).sort("updated_at", -1).limit(10).to_list(10)

    return {
        "id": league_id,
        "name": league.get("name"),
        "sport": league.get("sport"),
        "city": league.get("city"),
        "format": league.get("format"),
        "league_type": league.get("league_type", "flex"),
        "status": league.get("status"),
        "current_players": league.get("current_players", 0),
        "max_players": league.get("max_players"),
        "start_date": league.get("start_date"),
        "end_date": league.get("end_date"),
        "description": league.get("description"),
        "standings": standings,
        "recent_matches": recent_matches,
    }


@router.get("/player/{player_id}")
async def public_player_profile(player_id: str, request: Request):
    """Public player profile — no auth required. Returns 404 for private profiles."""
    db = request.app.state.db
    if not ObjectId.is_valid(player_id):
        raise HTTPException(status_code=404, detail="Player not found")
    user = await db.users.find_one({"_id": ObjectId(player_id)})
    if not user or not user.get("profile_public", True):
        raise HTTPException(status_code=404, detail="Player not found")

    user["_id"] = str(user["_id"])
    public_user = serialize_public_user(user)

    matches = await db.matches.find(
        {"$or": [{"player1_id": player_id}, {"player2_id": player_id}], "status": "completed"},
        {"player1_name": 1, "player2_name": 1, "winner_name": 1, "winner_id": 1,
         "score_data": 1, "sport": 1, "scheduled_date": 1, "_id": 0},
    ).sort("scheduled_date", -1).limit(20).to_list(20)

    rating_history = await db.rating_history.find(
        {"user_id": player_id},
        {"sport": 1, "rating": 1, "delta": 1, "result": 1, "created_at": 1, "_id": 0},
    ).sort("created_at", 1).limit(50).to_list(50)

    wins = sum(1 for m in matches if m.get("winner_id") == player_id)
    losses = len(matches) - wins

    return {
        **public_user,
        "wins": wins,
        "losses": losses,
        "recent_matches": matches,
        "rating_history": rating_history,
    }


class ChallengeIn(BaseModel):
    challenged_id: str
    league_id: Optional[str] = None


@router.post("/challenge")
async def send_challenge(data: ChallengeIn, request: Request):
    """Send a match challenge. Auth required. Rate-limited to 3 per calendar day."""
    db = request.app.state.db
    challenger = await get_optional_user(request, db)
    if not challenger:
        raise HTTPException(status_code=401, detail="Login to send a challenge")

    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc).isoformat()
    count = await db.challenges.count_documents({
        "challenger_id": challenger["_id"],
        "created_at": {"$gte": today_start},
    })
    if count >= 3:
        raise HTTPException(status_code=429, detail="Challenge limit reached (3 per day). Try again tomorrow.")

    if challenger["_id"] == data.challenged_id:
        raise HTTPException(status_code=400, detail="Cannot challenge yourself")

    if not ObjectId.is_valid(data.challenged_id):
        raise HTTPException(status_code=404, detail="Player not found")
    challenged = await db.users.find_one({"_id": ObjectId(data.challenged_id)})
    if not challenged:
        raise HTTPException(status_code=404, detail="Player not found")

    challenge = Challenge(
        challenger_id=challenger["_id"],
        challenger_name=challenger["name"],
        challenged_id=data.challenged_id,
        league_id=data.league_id,
    )
    await db.challenges.insert_one(challenge.to_mongo())

    if challenged.get("email") and challenged.get("email_notifications", True):
        frontend_url = os.environ.get("FRONTEND_URL", "https://venlaxsports.com")
        email_service.schedule(email_service.send_generic(
            challenged["email"],
            subject=f"{challenger['name']} challenged you on VENLAX Sports!",
            body=(
                f"Hi {challenged.get('name')},\n\n"
                f"{challenger['name']} wants to play you on VENLAX Sports.\n\n"
                f"View their profile: {frontend_url}/players/{challenger['_id']}\n\n"
                f"— VENLAX Sports"
            ),
        ))

    return {"message": "Challenge sent!", "challenged_name": challenged.get("name")}
