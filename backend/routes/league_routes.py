from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from models import League, LeagueCreate, PlayerLeague, Standing
from auth_utils import get_current_user, require_admin
from phase_config import ACTIVE_SPORTS, ACTIVE_COUNTRY
import email_service

router = APIRouter(redirect_slashes=False)


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
@router.get("/")
async def get_leagues(
    request: Request,
    sport: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    status: Optional[str] = None,
    season_id: Optional[str] = None,
    limit: int = 24,
    skip: int = 0,
):
    db = request.app.state.db
    query: dict = {}
    # Phase gating — only show leagues for sports & country active in the current phase
    if sport:
        if sport not in ACTIVE_SPORTS:
            return []
        query["sport"] = sport
    else:
        query["sport"] = {"$in": ACTIVE_SPORTS}
    if country:
        if country != ACTIVE_COUNTRY:
            return []
        query["country"] = country
    else:
        query["country"] = ACTIVE_COUNTRY
    if city:
        query["city"] = city
    if status:
        query["status"] = status
    if season_id:
        query["season_id"] = season_id

    leagues = await db.leagues.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [_serialize(l) for l in leagues]


@router.get("/my")
async def my_leagues(request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    regs = await db.player_leagues.find(
        {"player_id": user["_id"], "payment_status": {"$in": ["paid", "free"]}},
        {"league_id": 1, "_id": 0},
    ).to_list(50)
    league_ids = [ObjectId(r["league_id"]) for r in regs]
    if not league_ids:
        return []
    leagues = await db.leagues.find({"_id": {"$in": league_ids}}).to_list(50)
    return [_serialize(l) for l in leagues]


@router.get("/{league_id}")
async def get_league(league_id: str, request: Request):
    db = request.app.state.db
    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    return _serialize(league)


@router.post("")
@router.post("/")
async def create_league(data: LeagueCreate, request: Request):
    db = request.app.state.db
    user = await require_admin(request, db)
    # Phase gating — keep league creation consistent with season creation
    if data.sport not in ACTIVE_SPORTS:
        raise HTTPException(status_code=400, detail="Sport not active in the current phase")
    if data.country != ACTIVE_COUNTRY:
        raise HTTPException(status_code=400, detail="Country not active in the current phase")
    league = League(
        **data.model_dump(),
        admin_id=user["_id"],
    )
    result = await db.leagues.insert_one(league.to_mongo())
    return {"id": str(result.inserted_id), "message": "League created", **data.model_dump()}


@router.post("/{league_id}/join")
async def join_league(league_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    if league["status"] != "registration":
        raise HTTPException(status_code=400, detail="League registration is closed")
    if league["current_players"] >= league["max_players"]:
        raise HTTPException(status_code=400, detail="League is full")

    existing = await db.player_leagues.find_one({"player_id": user["_id"], "league_id": league_id})
    if existing and existing.get("payment_status") in ["paid", "free"]:
        raise HTTPException(status_code=400, detail="Already registered in this league")

    entry_fee = float(league.get("entry_fee", 0))
    if entry_fee > 0:
        return {
            "requires_payment": True,
            "league_id": league_id,
            "league_name": league["name"],
            "entry_fee": entry_fee,
            "currency": league.get("currency", "USD"),
        }

    # Free — join immediately
    pl = PlayerLeague(
        player_id=user["_id"],
        player_name=user["name"],
        league_id=league_id,
        sport=league["sport"],
        payment_status="free",
    )
    await db.player_leagues.insert_one(pl.to_mongo())
    await db.leagues.update_one({"_id": ObjectId(league_id)}, {"$inc": {"current_players": 1}})

    # Upsert standing
    await _upsert_standing(db, league_id, user["_id"], user["name"], league["sport"], user.get("country", "USA"))

    # Notify player of free registration
    if user.get("email") and user.get("email_notifications", True):
        email_service.schedule(email_service.send_registration_confirmed(
            user["email"], user["name"], league["name"], league["sport"],
            league_id, paid=False))

    return {"message": f"Joined {league['name']} successfully", "requires_payment": False}


@router.get("/{league_id}/players")
async def get_league_players(league_id: str, request: Request):
    db = request.app.state.db
    players = await db.player_leagues.find(
        {"league_id": league_id, "payment_status": {"$in": ["paid", "free"]}},
        {"_id": 0},
    ).to_list(100)
    return players


@router.get("/{league_id}/standings")
async def get_league_standings(league_id: str, request: Request):
    db = request.app.state.db
    standings = await db.standings.find(
        {"league_id": league_id}, {"_id": 0}
    ).to_list(100)

    # Sort: points → set differential → game differential → wins (tiebreak chain)
    def _sort_key(s):
        set_diff = s.get("sets_won", 0) - s.get("sets_lost", 0)
        game_diff = s.get("games_won", 0) - s.get("games_lost", 0)
        return (-round(s.get("points", 0), 4), -set_diff, -game_diff, -s.get("wins", 0))

    standings.sort(key=_sort_key)
    return standings


@router.get("/{league_id}/matches")
async def get_league_matches(league_id: str, request: Request):
    db = request.app.state.db
    matches = await db.matches.find({"league_id": league_id}).sort("scheduled_date", 1).to_list(100)
    return [_serialize(m) for m in matches]


@router.post("/{league_id}/close")
async def close_league(league_id: str, request: Request):
    """Finalize season: award +2 bonus to players who completed all matches, set league status=completed."""
    db = request.app.state.db
    await require_admin(request, db)

    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    if league.get("status") == "completed":
        raise HTTPException(status_code=400, detail="League already closed")

    # All registered players
    registrations = await db.player_leagues.find(
        {"league_id": league_id, "payment_status": {"$in": ["paid", "free"]}},
        {"player_id": 1, "_id": 0},
    ).to_list(200)

    now = datetime.now(timezone.utc).isoformat()
    awarded: list[str] = []

    for reg in registrations:
        pid = reg["player_id"]
        player_filter = {
            "league_id": league_id,
            "status": {"$ne": "cancelled"},
            "$or": [{"player1_id": pid}, {"player2_id": pid}],
        }
        total = await db.matches.count_documents(player_filter)
        if total == 0:
            continue
        completed = await db.matches.count_documents({**player_filter, "status": "completed"})
        if completed == total:
            await db.standings.update_one(
                {"league_id": league_id, "player_id": pid},
                {"$inc": {"bonus_points": 2.0, "points": 2.0}, "$set": {"updated_at": now}},
            )
            awarded.append(pid)

    await db.leagues.update_one(
        {"_id": ObjectId(league_id)},
        {"$set": {"status": "completed", "updated_at": now}},
    )

    return {
        "message": "League closed",
        "players_awarded_bonus": len(awarded),
        "awarded_player_ids": awarded,
    }


async def _upsert_standing(db, league_id: str, player_id: str, player_name: str, sport: str, country: str):
    existing = await db.standings.find_one({"league_id": league_id, "player_id": player_id})
    if not existing:
        s = Standing(
            league_id=league_id,
            player_id=player_id,
            player_name=player_name,
            sport=sport,
            country=country,
        )
        await db.standings.insert_one(s.to_mongo())
