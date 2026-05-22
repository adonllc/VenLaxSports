from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
from auth_utils import get_current_user

router = APIRouter()


class WaitlistEntry(BaseModel):
    email: str
    city: str
    sport: str = "tennis"


@router.post("")
async def join_waitlist(entry: WaitlistEntry, request: Request):
    db = request.app.state.db
    email = entry.email.lower().strip()
    city = entry.city.strip()

    if not email or not city:
        raise HTTPException(400, "Email and city are required")

    existing = await db.waitlist.find_one({"email": email})
    if existing:
        return {"message": "You're already on the list!", "already_registered": True}

    await db.waitlist.insert_one({
        "email": email,
        "city": city,
        "sport": entry.sport,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"message": "You're on the list!", "already_registered": False}


@router.get("/count")
async def waitlist_count(request: Request):
    db = request.app.state.db
    count = await db.waitlist.count_documents({})
    return {"count": count}


@router.get("/list")
async def list_waitlist(request: Request):
    db = request.app.state.db
    current_user = await get_current_user(request, db)
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    entries = await db.waitlist.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    by_city = {}
    by_sport = {}
    for e in entries:
        by_city[e.get("city", "Unknown")] = by_city.get(e.get("city", "Unknown"), 0) + 1
        by_sport[e.get("sport", "tennis")] = by_sport.get(e.get("sport", "tennis"), 0) + 1
    return {
        "total": len(entries),
        "entries": entries,
        "by_city": sorted(by_city.items(), key=lambda x: -x[1]),
        "by_sport": by_sport,
    }
