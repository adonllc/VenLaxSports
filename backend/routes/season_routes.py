"""Seasons management — admin creates seasons; leagues can reference season_id."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, List
from bson import ObjectId
from auth_utils import require_admin, get_current_user
from phase_config import ACTIVE_SPORTS

router = APIRouter()


class SeasonCreate(BaseModel):
    name: str
    sport: str
    start_date: str
    end_date: str
    description: Optional[str] = None


class SeasonUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None  # upcoming | active | completed
    description: Optional[str] = None


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
@router.get("/")
async def list_seasons(request: Request, sport: Optional[str] = None, status: Optional[str] = None):
    db = request.app.state.db
    await get_current_user(request, db)
    query: dict = {}
    if sport:
        query["sport"] = sport
    else:
        query["sport"] = {"$in": ACTIVE_SPORTS}
    if status:
        query["status"] = status
    cursor = db.seasons.find(query).sort("start_date", -1)
    return [_serialize(s) async for s in cursor]


@router.post("")
@router.post("/")
async def create_season(data: SeasonCreate, request: Request):
    db = request.app.state.db
    admin = await require_admin(request, db)
    if data.sport not in ACTIVE_SPORTS:
        raise HTTPException(status_code=400, detail="Sport not active in the current phase")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "name": data.name,
        "sport": data.sport,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "description": data.description,
        "status": "upcoming",
        "admin_id": str(admin["_id"]),
        "created_at": now,
    }
    result = await db.seasons.insert_one(doc)
    return {"id": str(result.inserted_id), "message": "Season created"}


@router.patch("/{season_id}")
async def update_season(season_id: str, data: SeasonUpdate, request: Request):
    db = request.app.state.db
    await require_admin(request, db)
    if not ObjectId.is_valid(season_id):
        raise HTTPException(status_code=404, detail="Season not found")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.seasons.update_one({"_id": ObjectId(season_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Season not found")
    return {"message": "Season updated"}


@router.delete("/{season_id}")
async def delete_season(season_id: str, request: Request):
    db = request.app.state.db
    await require_admin(request, db)
    if not ObjectId.is_valid(season_id):
        raise HTTPException(status_code=404, detail="Season not found")
    result = await db.seasons.delete_one({"_id": ObjectId(season_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Season not found")
    return {"message": "Season deleted"}
