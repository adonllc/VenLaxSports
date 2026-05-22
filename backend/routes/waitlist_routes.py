from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone

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
