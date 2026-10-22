from bson import ObjectId
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from datetime import datetime, timezone
from auth_utils import get_current_user
from email_service import send_early_access_confirmed, schedule

router = APIRouter()

FOUNDING_MEMBER_LIMIT = 200


class WaitlistEntry(BaseModel):
    email: str
    city: str
    sport: str = "tennis"
    skill_level: str = "intermediate"
    referred_by: str = ""


@router.post("")
async def join_waitlist(entry: WaitlistEntry, request: Request):
    db = request.app.state.db
    email = entry.email.lower().strip()
    city = entry.city.strip()

    if not email or not city:
        raise HTTPException(400, "Email and city are required")

    existing = await db.waitlist.find_one({"email": email})
    if existing:
        return {
            "message": "You're already on the list!",
            "already_registered": True,
            "waitlist_id": str(existing["_id"]),
        }

    doc = {
        "email": email,
        "city": city,
        "sport": entry.sport,
        "skill_level": entry.skill_level,
        "referred_by": entry.referred_by.strip() if entry.referred_by else "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.waitlist.insert_one(doc)
    schedule(send_early_access_confirmed(email))
    return {
        "message": "You're on the list!",
        "already_registered": False,
        "waitlist_id": str(result.inserted_id),
    }


@router.get("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe(request: Request, token: str):
    """One-click unsubscribe from waitlist emails (linked from the launch announcement)."""
    import launch_announcement
    db = request.app.state.db
    wid = launch_announcement.decode_unsub_token(token)
    ok = False
    if wid:
        try:
            res = await db.waitlist.update_one({"_id": ObjectId(wid)},
                                               {"$set": {"unsubscribed_at": datetime.now(timezone.utc).isoformat()}})
            ok = res.matched_count > 0
        except Exception:
            ok = False
    msg = "You have been unsubscribed. You will not get more waitlist emails from VenLax Sports." if ok else \
          "This unsubscribe link is not valid. Reply to any of our emails and we will remove you."
    return HTMLResponse(f"<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'>"
                        f"<body style='font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;color:#3D3D3D'>"
                        f"<h2>VenLax Sports</h2><p>{msg}</p></body>")


@router.get("/count")
async def waitlist_count(request: Request):
    db = request.app.state.db
    count = await db.waitlist.count_documents({})
    remaining = max(FOUNDING_MEMBER_LIMIT - count, 0)
    return {"count": count, "founding_limit": FOUNDING_MEMBER_LIMIT, "remaining": remaining}


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


@router.delete("")
async def delete_waitlist_entry(request: Request):
    db = request.app.state.db
    current_user = await get_current_user(request, db)
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Admin only")

    body = await request.json()
    email = body.get("email", "").lower().strip()

    if not email:
        raise HTTPException(400, "Email required")

    result = await db.waitlist.delete_one({"email": email})
    if result.deleted_count == 0:
        raise HTTPException(404, "Waitlist entry not found")

    return {"message": f"Removed {email} from waitlist", "deleted": True}
