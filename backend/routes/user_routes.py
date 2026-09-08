"""User search and profile lookups (non-admin)."""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional, List
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from auth_utils import get_current_user
from models import UserFollow

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
            "city": u.get("city"),
            "gender": u.get("gender"),
            "tennis_rating": u.get("tennis_rating"),
            "cricket_rating": u.get("cricket_rating"),
            "pickleball_rating": u.get("pickleball_rating"),
        })
    return results


class UserProfileUpdate(BaseModel):
    city: Optional[str] = None
    phone: Optional[str] = None
    home_court: Optional[str] = None
    email_notifications: Optional[bool] = None
    profile_public: Optional[bool] = None
    dupr_rating: Optional[str] = None
    gender: Optional[str] = None
    sport_preferences: Optional[List[str]] = None


class ProfileSetupIn(BaseModel):
    sport_preferences: Optional[List[str]] = None
    skill_level: Optional[str] = None
    home_court: Optional[str] = None
    city: Optional[str] = None


@router.patch("/me/setup")
async def profile_setup(body: ProfileSetupIn, request: Request):
    """Complete player profile setup after registration."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    update: dict = {"profile_complete": True}
    if body.sport_preferences is not None:
        update["sport_preferences"] = body.sport_preferences
    if body.skill_level is not None:
        update["skill_level"] = body.skill_level
    if body.home_court is not None:
        update["home_court"] = body.home_court
    if body.city is not None:
        update["city"] = body.city
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": update})
    return {"message": "Profile updated", "profile_complete": True}


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


@router.patch("/me")
async def update_profile(data: UserProfileUpdate, request: Request):
    """Update the current user's profile fields."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    payload = data.model_dump(exclude_unset=True)
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_fields = {k: v for k, v in payload.items() if v is not None}
    unset_fields = {k: "" for k, v in payload.items() if v is None}
    ops: dict = {}
    if set_fields:
        ops["$set"] = set_fields
    if unset_fields:
        ops["$unset"] = unset_fields
    await db.users.update_one({"_id": ObjectId(user["_id"])}, ops)
    updated = await db.users.find_one({"_id": ObjectId(user["_id"])}, {"password_hash": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    updated["id"] = str(updated.pop("_id"))
    return updated


@router.get("/me/following")
async def my_following(request: Request):
    """List of players the current user follows."""
    db = request.app.state.db
    user = await get_current_user(request, db)

    follows = await db.user_follows.find(
        {"follower_id": str(user["_id"])}, {"followee_id": 1, "_id": 0}
    ).to_list(500)
    followee_ids = [ObjectId(f["followee_id"]) for f in follows if ObjectId.is_valid(f["followee_id"])]
    if not followee_ids:
        return []

    players = await db.users.find(
        {"_id": {"$in": followee_ids}},
        {"name": 1, "city": 1, "tennis_rating": 1, "pickleball_rating": 1},
    ).to_list(len(followee_ids))
    return [
        {
            "id": str(p["_id"]),
            "name": p.get("name"),
            "city": p.get("city"),
            "tennis_rating": p.get("tennis_rating"),
            "pickleball_rating": p.get("pickleball_rating"),
        }
        for p in players
    ]


@router.get("/me/feed")
async def my_follow_feed(request: Request, limit: int = 20):
    """Recent completed matches of players the current user follows."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    limit = min(limit, 50)

    follows = await db.user_follows.find(
        {"follower_id": str(user["_id"])}, {"followee_id": 1, "_id": 0}
    ).to_list(500)
    followee_ids = [f["followee_id"] for f in follows]
    if not followee_ids:
        return []

    matches = await db.matches.find(
        {
            "status": "completed",
            "$or": [{"player1_id": {"$in": followee_ids}}, {"player2_id": {"$in": followee_ids}}],
        },
        {"player1_id": 1, "player2_id": 1, "player1_name": 1, "player2_name": 1,
         "winner_id": 1, "winner_name": 1, "sport": 1, "league_id": 1, "scheduled_date": 1,
         "score_data": 1, "_id": 0},
    ).sort("scheduled_date", -1).limit(limit).to_list(limit)

    return matches


@router.post("/{user_id}/follow")
async def follow_player(user_id: str, request: Request):
    """Follow another player. Idempotent."""
    db = request.app.state.db
    user = await get_current_user(request, db)

    if str(user["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=404, detail="Player not found")
    followee = await db.users.find_one({"_id": ObjectId(user_id)}, {"_id": 1})
    if not followee:
        raise HTTPException(status_code=404, detail="Player not found")

    follow = UserFollow(
        follower_id=str(user["_id"]),
        followee_id=user_id,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    try:
        await db.user_follows.insert_one(follow.to_mongo())
    except Exception:
        pass  # already following — idempotent

    return {"following": True}


@router.delete("/{user_id}/follow")
async def unfollow_player(user_id: str, request: Request):
    """Unfollow a player."""
    db = request.app.state.db
    user = await get_current_user(request, db)

    await db.user_follows.delete_one({"follower_id": str(user["_id"]), "followee_id": user_id})
    return {"following": False}


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
        "city": u.get("city"),
        "country": u.get("country"),
        "tennis_rating": u.get("tennis_rating"),
        "cricket_rating": u.get("cricket_rating"),
        "pickleball_rating": u.get("pickleball_rating"),
    }
