"""Waitlist for leagues that have already started.

A player who missed registration joins the waitlist for nothing. If a registered player drops out, the admin places
the next person: they become a league member (the admin settles any entry fee with them by hand) and get an email.
"""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request

import email_service
from auth_utils import get_current_user, require_admin
from models import PlayerLeague
from routes.league_routes import _upsert_standing

router = APIRouter()

WAITING = "waiting"


async def _active_league(db, league_id: str) -> dict:
    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        league = None
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    return league


@router.get("/my")
async def my_waitlist(request: Request):
    """League ids the signed-in player is waiting for."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    rows = await db.league_waitlist.find({"player_id": user["_id"], "status": WAITING}).to_list(200)
    return {"league_ids": [r["league_id"] for r in rows]}


@router.post("/{league_id}")
async def join_waitlist(league_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    league = await _active_league(db, league_id)
    if league.get("status") != "active":
        raise HTTPException(status_code=400, detail="The waitlist is only for leagues that have already started")
    if await db.player_leagues.find_one({"league_id": league_id, "player_id": user["_id"],
                                         "payment_status": {"$in": ["paid", "free"]}}):
        raise HTTPException(status_code=409, detail="You are already in this league")
    if await db.league_waitlist.find_one({"league_id": league_id, "player_id": user["_id"], "status": WAITING}):
        return {"waitlisted": True}
    await db.league_waitlist.insert_one({
        "league_id": league_id, "player_id": user["_id"], "player_name": user.get("name", ""),
        "player_email": user.get("email", ""), "status": WAITING,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"waitlisted": True}


@router.delete("/{league_id}")
async def leave_waitlist(league_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    await db.league_waitlist.update_one({"league_id": league_id, "player_id": user["_id"], "status": WAITING},
                                        {"$set": {"status": "left"}})
    return {"waitlisted": False}


@router.get("/admin/list")
async def admin_list(request: Request):
    """Everyone waiting, grouped by league, oldest first."""
    db = request.app.state.db
    await require_admin(request, db)
    rows = await db.league_waitlist.find({"status": WAITING}).sort("created_at", 1).to_list(1000)
    leagues: dict[str, dict] = {}
    out = []
    for r in rows:
        lid = r["league_id"]
        if lid not in leagues:
            try:
                leagues[lid] = await db.leagues.find_one({"_id": ObjectId(lid)}) or {}
            except Exception:
                leagues[lid] = {}
        lg = leagues[lid]
        out.append({
            "league_id": lid, "league_name": lg.get("name", ""), "player_id": r["player_id"],
            "player_name": r.get("player_name", ""), "player_email": r.get("player_email", ""),
            "since": r.get("created_at", ""),
            "spots_left": max((lg.get("max_players") or 0) - (lg.get("current_players") or 0), 0),
        })
    return {"rows": out}


@router.post("/admin/{league_id}/{player_id}/place")
async def place_player(league_id: str, player_id: str, request: Request):
    """Put a waitlisted player in the league. Needs a free spot; the admin settles any fee with them by hand."""
    db = request.app.state.db
    await require_admin(request, db)
    league = await _active_league(db, league_id)
    if league.get("status") != "active":
        raise HTTPException(status_code=409, detail="This league is not running")
    row = await db.league_waitlist.find_one({"league_id": league_id, "player_id": player_id, "status": WAITING})
    if not row:
        raise HTTPException(status_code=404, detail="This player is no longer on the waitlist")
    try:
        user = await db.users.find_one({"_id": ObjectId(player_id)})
    except Exception:
        user = None
    if not user:
        raise HTTPException(status_code=404, detail="Player account not found")
    reserved = await db.leagues.find_one_and_update(
        {"_id": league["_id"], "$expr": {"$lt": ["$current_players", "$max_players"]}},
        {"$inc": {"current_players": 1}},
    )
    if not reserved:
        raise HTTPException(status_code=409, detail="The league is full. Free a spot first")
    pl = PlayerLeague(player_id=player_id, player_name=user.get("name", ""), league_id=league_id,
                      sport=league["sport"], payment_status="free")
    doc = pl.to_mongo()
    doc["placed_from_waitlist"] = True
    try:
        await db.player_leagues.insert_one(doc)
        await _upsert_standing(db, league_id, player_id, user.get("name", ""), league["sport"], user.get("country", "USA"))
    except Exception:
        await db.leagues.update_one({"_id": league["_id"]}, {"$inc": {"current_players": -1}})
        raise
    await db.league_waitlist.update_one({"_id": row["_id"]}, {"$set": {
        "status": "placed", "placed_at": datetime.now(timezone.utc).isoformat()}})
    if user.get("email"):
        fee = float(league.get("entry_fee") or 0)
        email_service.schedule(email_service.send_waitlist_placed(
            user["email"], user.get("name", ""), league.get("name", "the league"), fee))
    return {"placed": True, "player": user.get("name", "")}


@router.delete("/admin/{league_id}/{player_id}")
async def remove_from_waitlist(league_id: str, player_id: str, request: Request):
    db = request.app.state.db
    await require_admin(request, db)
    await db.league_waitlist.update_one({"league_id": league_id, "player_id": player_id, "status": WAITING},
                                        {"$set": {"status": "removed"}})
    return {"removed": True}
