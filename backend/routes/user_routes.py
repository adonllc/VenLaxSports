"""User search and profile lookups (non-admin)."""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from bson import ObjectId
from auth_utils import get_current_user

router = APIRouter()


@router.get("/search")
async def search_users(request: Request, q: str = "", league_id: Optional[str] = None, limit: int = 10):
    """Search users by name or email (min 2 chars). Optionally filter to a league's members.

    Requires auth. Returns at most `limit` matches. Never exposes password_hash.
    """
    db = request.app.state.db
    await get_current_user(request, db)

    q = (q or "").strip()
    if len(q) < 2:
        return []

    # Build a case-insensitive prefix match on name + exact/prefix on email
    # Escape regex specials to prevent ReDoS abuse via user input
    import re
    safe = re.escape(q)
    query: dict = {
        "$or": [
            {"name": {"$regex": safe, "$options": "i"}},
            {"email": {"$regex": f"^{safe}", "$options": "i"}},
        ],
        "is_active": {"$ne": False},
    }

    if league_id:
        # Restrict to players registered in that league
        regs = await db.player_leagues.find(
            {"league_id": league_id, "payment_status": {"$in": ["paid", "free"]}},
            {"player_id": 1, "_id": 0},
        ).to_list(200)
        member_ids = [ObjectId(r["player_id"]) for r in regs if ObjectId.is_valid(r["player_id"])]
        if not member_ids:
            return []
        query["_id"] = {"$in": member_ids}

    cursor = db.users.find(query, {"password_hash": 0}).limit(limit)
    results = []
    async for u in cursor:
        results.append({
            "id": str(u["_id"]),
            "name": u.get("name"),
            "email": u.get("email"),
            "city": u.get("city"),
            "tennis_rating": u.get("tennis_rating"),
            "cricket_rating": u.get("cricket_rating"),
            "pickleball_rating": u.get("pickleball_rating"),
        })
    return results


@router.get("/me/rating-history")
async def my_rating_history(request: Request, sport: Optional[str] = None, limit: int = 50):
    """Return the current user's rating history (most recent `limit` snapshots).

    Optionally filtered by sport. Snapshots are written by `_update_ratings`
    inside match score reporting, so cricket is excluded by design.
    """
    db = request.app.state.db
    user = await get_current_user(request, db)
    query: dict = {"user_id": user["_id"]}
    if sport:
        query["sport"] = sport
    cursor = db.rating_history.find(query, {"_id": 0}).sort("created_at", 1).limit(limit)
    return await cursor.to_list(limit)


@router.get("/{user_id}")
async def get_user(user_id: str, request: Request):
    """Look up a public user profile by id. Auth required; password never exposed."""
    db = request.app.state.db
    await get_current_user(request, db)
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    u = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": str(u["_id"]),
        "name": u.get("name"),
        "email": u.get("email"),
        "city": u.get("city"),
        "country": u.get("country"),
        "tennis_rating": u.get("tennis_rating"),
        "cricket_rating": u.get("cricket_rating"),
        "pickleball_rating": u.get("pickleball_rating"),
    }
