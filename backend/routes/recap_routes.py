"""Season recap cards: players read their own, an admin can (re)generate a finished league's cards."""
import os

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

import season_recap
from auth_utils import get_current_user

router = APIRouter()


@router.get("/mine")
async def my_recaps(request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    rows = await db.season_recaps.find({"player_id": str(user["_id"])}).sort("created_at", -1).to_list(50)
    return {"recaps": [{
        "league_id": r["league_id"], "league_name": r.get("league_name", ""), "sport": r.get("sport", ""),
        "rank": r["rank"], "players": r["players"], "wins": r["wins"], "losses": r["losses"],
        "rating_delta": r.get("rating_delta"),
        "badges": [{"key": k, "title": season_recap.BADGES[k][0], "why": season_recap.BADGES[k][1]} for k in r.get("badges", [])],
        "image_url": f"/api/recaps/{r['league_id']}/mine/image",
    } for r in rows]}


@router.get("/{league_id}/mine/image")
async def my_recap_image(league_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    row = await db.season_recaps.find_one({"league_id": league_id, "player_id": str(user["_id"])})
    if not row or not os.path.exists(row.get("image_path", "")):
        raise HTTPException(status_code=404, detail="No recap card yet")
    return FileResponse(row["image_path"], media_type="image/png", filename="venlax-season-recap.png")


@router.post("/admin/{league_id}")
async def generate(league_id: str, request: Request, force: bool = False):
    """Create the recap cards of a finished league. Safe to run again: existing cards are kept unless force=true."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        league = None
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    if league.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Recap cards are made once the league is completed")
    return await season_recap.generate_for_league(db, {**league, "id": league_id}, force=force)
