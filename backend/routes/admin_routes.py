from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from bson import ObjectId
from auth_utils import require_admin
from models import LeagueUpdate, PlayerLeague, Standing
import email_service

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

    # Capture previous status to detect activation
    prev = await db.leagues.find_one({"_id": ObjectId(league_id)}, {"status": 1, "name": 1, "league_type": 1})
    if not prev:
        raise HTTPException(status_code=404, detail="League not found")

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        result = await db.leagues.update_one({"_id": ObjectId(league_id)}, {"$set": update_data})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="League not found")

    # If status just became active, notify all registered flex-league players
    if update_data.get("status") == "active" and prev.get("status") != "active":
        league_type = prev.get("league_type", "flex")
        if league_type == "flex":
            regs = await db.player_leagues.find(
                {"league_id": league_id, "payment_status": {"$in": ["paid", "free"]}},
            ).to_list(200)
            valid_pids = [ObjectId(r["player_id"]) for r in regs if ObjectId.is_valid(r["player_id"])]
            notif_players = await db.users.find(
                {"_id": {"$in": valid_pids}}, {"email": 1, "name": 1, "email_notifications": 1}
            ).to_list(len(valid_pids))
            for player in notif_players:
                if player.get("email_notifications", True):
                    email_service.schedule(email_service.send_schedule_released(
                        player["email"], player["name"],
                        prev["name"], league_id, league_type,
                    ))

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


# ─── Zelle admin approval queue ──────────────────────────────

@router.get("/zelle/pending")
async def list_pending_zelle(request: Request):
    """Return all payment_transactions with status=pending_admin (Zelle awaiting verification)."""
    db = request.app.state.db
    await require_admin(request, db)
    txns = await db.payment_transactions.find(
        {"status": "pending_admin", "method": "zelle"},
        {"_id": 0},
    ).sort("created_at", -1).to_list(200)
    return txns


@router.post("/zelle/{session_id}/approve")
async def approve_zelle(session_id: str, request: Request):
    """Admin approves Zelle deposit — registers player and marks transaction paid."""
    db = request.app.state.db
    await require_admin(request, db)

    txn = await db.payment_transactions.find_one({"session_id": session_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.get("status") not in ("pending_admin", "pending_zelle"):
        raise HTTPException(status_code=400, detail=f"Transaction status is '{txn.get('status')}', cannot approve")

    league_id = txn["league_id"]
    user_id = txn["user_id"]

    league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    player = await db.users.find_one({"_id": ObjectId(user_id)})
    if not league or not player:
        raise HTTPException(status_code=404, detail="League or player not found")

    already = await db.player_leagues.find_one(
        {"player_id": user_id, "league_id": league_id, "payment_status": "paid"}
    )
    if not already:
        consent = await db.waiver_consents.find_one(
            {"user_id": user_id, "league_id": league_id},
            sort=[("waiver_accepted_at", -1)],
        )
        pl = PlayerLeague(
            player_id=user_id,
            player_name=player["name"],
            league_id=league_id,
            sport=league["sport"],
            payment_status="paid",
            session_id=session_id,
            waiver_accepted_at=consent["waiver_accepted_at"] if consent else datetime.now(timezone.utc).isoformat(),
        )
        await db.player_leagues.insert_one(pl.to_mongo())
        await db.leagues.update_one({"_id": ObjectId(league_id)}, {"$inc": {"current_players": 1}})

        standing = Standing(
            league_id=league_id,
            player_id=user_id,
            player_name=player["name"],
            sport=league["sport"],
            country=player.get("country", "USA"),
        )
        await db.standings.insert_one(standing.to_mongo())

        if player.get("email") and player.get("email_notifications", True):
            email_service.schedule(email_service.send_registration_confirmed(
                player["email"], player["name"], league["name"], league["sport"],
                league_id, paid=True, amount=float(txn.get("amount", 0)), currency="USD"))

    now = datetime.now(timezone.utc).isoformat()
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"status": "complete", "payment_status": "paid", "admin_approved": True, "updated_at": now}},
    )
    return {"message": "Approved", "user_id": user_id, "league_id": league_id}


@router.post("/zelle/{session_id}/reject")
async def reject_zelle(session_id: str, request: Request):
    """Admin rejects Zelle — marks transaction rejected, player NOT registered."""
    db = request.app.state.db
    await require_admin(request, db)

    txn = await db.payment_transactions.find_one({"session_id": session_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    now = datetime.now(timezone.utc).isoformat()
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"status": "rejected", "payment_status": "failed", "admin_approved": False, "updated_at": now}},
    )

    # Notify player their Zelle was not verified
    player = await db.users.find_one({"_id": ObjectId(txn["user_id"])})
    if player and player.get("email") and player.get("email_notifications", True):
        league_name = txn.get("league_name", "the league")
        email_service.schedule(email_service.send_generic(
            player["email"],
            subject=f"Zelle payment not verified — {league_name}",
            body=(
                f"Hi {player['name']},\n\n"
                f"We could not verify your Zelle payment for {league_name}. "
                f"Your registration has not been confirmed.\n\n"
                f"Please contact support@venlaxsports.com if you believe this is an error "
                f"and include your Zelle reference number: {txn.get('reference_number', 'N/A')}.\n\n"
                f"— VENLAX Sports"
            ),
        ))

    return {"message": "Rejected", "session_id": session_id}
