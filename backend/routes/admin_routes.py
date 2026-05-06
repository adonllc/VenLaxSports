from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from bson import ObjectId
from auth_utils import require_admin
from models import LeagueUpdate

router = APIRouter()


@router.get("/stats")
async def get_stats(request: Request):
    db = request.app.state.db
    await require_admin(request, db)

    total_users = await db.users.count_documents({})
    total_leagues = await db.leagues.count_documents({})
    total_matches = await db.matches.count_documents({})

    rev_agg = await db.payment_transactions.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    revenue = rev_agg[0]["total"] if rev_agg else 0.0

    sport_agg = await db.leagues.aggregate([
        {"$group": {"_id": "$sport", "count": {"$sum": 1}}}
    ]).to_list(10)
    country_agg = await db.users.aggregate([
        {"$group": {"_id": "$country", "count": {"$sum": 1}}}
    ]).to_list(10)

    active_leagues = await db.leagues.count_documents({"status": "active"})
    reg_leagues = await db.leagues.count_documents({"status": "registration"})

    return {
        "total_users": total_users,
        "total_leagues": total_leagues,
        "total_matches": total_matches,
        "total_revenue": round(revenue, 2),
        "active_leagues": active_leagues,
        "registration_leagues": reg_leagues,
        "sport_breakdown": {s["_id"]: s["count"] for s in sport_agg if s["_id"]},
        "country_breakdown": {c["_id"]: c["count"] for c in country_agg if c["_id"]},
    }


@router.get("/users")
async def get_users(request: Request, skip: int = 0, limit: int = 50):
    db = request.app.state.db
    await require_admin(request, db)
    users = await db.users.find({}, {"password_hash": 0}).skip(skip).limit(limit).to_list(limit)
    result = []
    for u in users:
        u["id"] = str(u.pop("_id"))
        result.append(u)
    return result


@router.get("/leagues")
async def get_all_leagues(request: Request, skip: int = 0, limit: int = 50):
    db = request.app.state.db
    await require_admin(request, db)
    leagues = await db.leagues.find({}).skip(skip).limit(limit).to_list(limit)
    result = []
    for l in leagues:
        l["id"] = str(l.pop("_id"))
        result.append(l)
    return result


@router.put("/leagues/{league_id}")
async def update_league(league_id: str, data: LeagueUpdate, request: Request):
    db = request.app.state.db
    await require_admin(request, db)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        result = await db.leagues.update_one({"_id": ObjectId(league_id)}, {"$set": update_data})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="League not found")
    return {"message": "League updated"}


@router.delete("/leagues/{league_id}")
async def delete_league(league_id: str, request: Request):
    db = request.app.state.db
    await require_admin(request, db)
    try:
        result = await db.leagues.delete_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="League not found")
    return {"message": "League deleted"}


@router.get("/payments")
async def get_payments(request: Request, skip: int = 0, limit: int = 50):
    db = request.app.state.db
    await require_admin(request, db)
    txns = await db.payment_transactions.find({}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    result = []
    for t in txns:
        t["id"] = str(t.pop("_id"))
        result.append(t)
    return result


@router.post("/seed-data")
async def seed_data(request: Request):
    db = request.app.state.db
    await require_admin(request, db)

    cities_data = [
        {"name": "New York", "country": "USA", "state": "NY"},
        {"name": "Los Angeles", "country": "USA", "state": "CA"},
        {"name": "Chicago", "country": "USA", "state": "IL"},
        {"name": "San Francisco", "country": "USA", "state": "CA"},
        {"name": "Atlanta", "country": "USA", "state": "GA"},
        {"name": "Houston", "country": "USA", "state": "TX"},
        {"name": "Mumbai", "country": "India", "state": "Maharashtra"},
        {"name": "Delhi", "country": "India", "state": "Delhi"},
        {"name": "Bangalore", "country": "India", "state": "Karnataka"},
        {"name": "Chennai", "country": "India", "state": "Tamil Nadu"},
        {"name": "Hyderabad", "country": "India", "state": "Telangana"},
        {"name": "Pune", "country": "India", "state": "Maharashtra"},
    ]
    for city in cities_data:
        existing = await db.cities.find_one({"name": city["name"], "country": city["country"]})
        if not existing:
            await db.cities.insert_one(city)

    return {"message": "Seed data added"}
