from fastapi import APIRouter, HTTPException, Request, Body
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import os
from auth_utils import require_admin
from models import LeagueUpdate, PlayerLeague, Standing, Match
import email_service
from pairing_utils import pair_units

router = APIRouter()


# Background jobs that can be individually enabled/disabled at runtime (no redeploy).
# Anything not listed here is a build-time env var — see /admin/flags's env_flags.
JOB_FLAGS = {
    "weekly_referral_campaign": {
        "label": "Weekly Referral Campaign",
        "description": "Emails all users + waitlist every Monday to refer friends for $5/$5 credit.",
    },
    "auto_status_transitions": {
        "label": "League Auto Status Transitions",
        "description": "Flips league status upcoming→active→completed based on start/end dates. Daily 00:05 UTC.",
    },
    "send_match_reminders": {
        "label": "Match Reminders",
        "description": "Email + WhatsApp reminder ~24h before a scheduled match. Hourly.",
    },
    "auto_forfeit_stale_matches": {
        "label": "Auto-Forfeit Stale Matches",
        "description": "Marks matches unscored 7+ days past their date as a walkover. Daily 01:00 UTC.",
    },
    "send_credit_expiry_reminders": {
        "label": "Credit Expiry Reminders",
        "description": "Nudges users whose credit balance expires within 30 days. Daily 10:00 UTC.",
    },
}


@router.get("/flags")
async def get_flags(request: Request):
    """Runtime-toggleable job flags + a read-only view of build-time env flags."""
    db = request.app.state.db
    await require_admin(request, db)

    docs = await db.feature_flags.find({"_id": {"$in": list(JOB_FLAGS.keys())}}).to_list(len(JOB_FLAGS))
    state = {d["_id"]: d for d in docs}

    jobs = [
        {
            "id": flag_id,
            "label": meta["label"],
            "description": meta["description"],
            "enabled": state.get(flag_id, {}).get("enabled", True),
            "updated_at": state.get(flag_id, {}).get("updated_at"),
        }
        for flag_id, meta in JOB_FLAGS.items()
    ]

    env_flags = [
        {"name": "PHASE", "value": os.environ.get("PHASE", "1"), "controls": "Active sports/country/currency"},
        {"name": "ENV", "value": os.environ.get("ENV", "development"), "controls": "Secure cookies (production only)"},
        {"name": "CRICKET_ENABLED", "value": os.environ.get("CRICKET_ENABLED", "false"), "controls": "Adds Cricket regardless of phase"},
        {"name": "SMTP_HOST", "value": "configured" if os.environ.get("SMTP_HOST") else "not set (console fallback)", "controls": "Real email delivery vs. console logging"},
        {"name": "WHATSAPP_API_TOKEN", "value": "configured" if os.environ.get("WHATSAPP_API_TOKEN") else "not set", "controls": "WhatsApp notifications on/off"},
        {"name": "STRIPE_API_KEY", "value": "configured" if os.environ.get("STRIPE_API_KEY") else "not set", "controls": "Payment processing"},
    ]

    site_live = await db.feature_flags.find_one({"_id": "site_live"})
    return {"jobs": jobs, "env_flags": env_flags, "site_live": bool(site_live and site_live.get("enabled"))}


@router.patch("/site-live")
async def set_site_live(request: Request, body: dict = Body(...)):
    """Launch switch: true shows the real Home at /, false shows the pre-launch waitlist page."""
    db = request.app.state.db
    admin = await require_admin(request, db)
    live = bool(body.get("live"))
    await db.feature_flags.update_one(
        {"_id": "site_live"},
        {"$set": {
            "enabled": live,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": str(admin.get("_id", "")),
        }},
        upsert=True,
    )
    return {"live": live}


@router.patch("/flags/{flag_id}")
async def set_flag(flag_id: str, request: Request, body: dict = Body(...)):
    db = request.app.state.db
    admin = await require_admin(request, db)

    if flag_id not in JOB_FLAGS:
        raise HTTPException(status_code=404, detail="Unknown flag")
    enabled = bool(body.get("enabled"))

    await db.feature_flags.update_one(
        {"_id": flag_id},
        {"$set": {
            "enabled": enabled,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": str(admin.get("_id", "")),
        }},
        upsert=True,
    )
    return {"id": flag_id, "enabled": enabled}


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


@router.get("/referrals")
async def get_referrals(request: Request, skip: int = 0, limit: int = 100):
    """Referral activity — who referred whom, by which code, and credit status."""
    db = request.app.state.db
    await require_admin(request, db)

    total = await db.referral_credits.count_documents({"type": "referral"})
    total_credited = await db.referral_credits.count_documents({"status": "applied", "type": "referral"})
    total_bonus_paid = await db.referral_credits.count_documents({"type": "tier_bonus"})

    top_referrers_agg = await db.referral_credits.aggregate([
        {"$match": {"status": "applied", "type": "referral"}},
        {"$group": {"_id": "$referrer_id", "referrals": {"$sum": 1}}},
        {"$sort": {"referrals": -1}},
        {"$limit": 10},
    ]).to_list(10)
    referrer_ids = [ObjectId(r["_id"]) for r in top_referrers_agg if ObjectId.is_valid(r["_id"])]
    referrer_docs = await db.users.find({"_id": {"$in": referrer_ids}}, {"name": 1, "email": 1}).to_list(len(referrer_ids))
    referrer_map = {str(u["_id"]): u for u in referrer_docs}
    top_referrers = [
        {
            "referrer_id": r["_id"],
            "referrer_name": referrer_map.get(r["_id"], {}).get("name", "Unknown"),
            "referrer_email": referrer_map.get(r["_id"], {}).get("email", ""),
            "referrals": r["referrals"],
        }
        for r in top_referrers_agg
    ]

    credits = await db.referral_credits.find({}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    all_ids = set()
    for c in credits:
        if ObjectId.is_valid(c.get("referrer_id", "")):
            all_ids.add(c["referrer_id"])
        if c.get("referee_id") and ObjectId.is_valid(c["referee_id"]):
            all_ids.add(c["referee_id"])
    user_docs = await db.users.find({"_id": {"$in": [ObjectId(i) for i in all_ids]}}, {"name": 1, "email": 1}).to_list(len(all_ids))
    user_map = {str(u["_id"]): u for u in user_docs}

    entries = []
    for c in credits:
        referrer = user_map.get(c.get("referrer_id"), {})
        referee = user_map.get(c.get("referee_id"), {}) if c.get("referee_id") else {}
        is_bonus = c.get("type") == "tier_bonus"
        entries.append({
            "id": str(c["_id"]),
            "referral_code": c.get("referral_code"),
            "referrer_name": referrer.get("name", "Unknown"),
            "referrer_email": referrer.get("email", ""),
            "referee_name": "— Tier Bonus —" if is_bonus else referee.get("name", "Pending"),
            "referee_email": "" if is_bonus else referee.get("email", ""),
            "credit_amount": c.get("credit_amount", 0),
            "status": c.get("status", "pending"),
            "type": c.get("type", "referral"),
            "created_at": c.get("created_at"),
            "applied_at": c.get("applied_at"),
        })

    return {
        "total_referrals": total,
        "total_credited": total_credited,
        "total_bonus_paid": total_bonus_paid,
        "top_referrers": top_referrers,
        "entries": entries,
    }


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

    # Flex leagues have no pre-built schedule: players are told their opponent when the admin
    # creates a round (POST /leagues/{id}/pairings), so no generic "schedule released" email here.

    return {"message": "League updated"}


@router.post("/leagues/{league_id}/pairings")
async def create_round_pairings(league_id: str, request: Request, body: dict = Body(default={})):
    """Pair the league's players for the next round (flex leagues).

    confirm=false returns a preview and changes nothing. confirm=true creates the matches,
    activates the league if it is still in registration, and emails every player their
    opponent. Doubles leagues pair teams.
    """
    db = request.app.state.db
    await require_admin(request, db)
    confirm = bool(body.get("confirm"))
    force = bool(body.get("force"))

    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    if league.get("league_type", "flex") != "flex":
        raise HTTPException(status_code=400, detail="Pairings are for flex leagues only")
    if league.get("status") not in ("registration", "active"):
        raise HTTPException(status_code=400, detail="League is not open or active")

    sport = league["sport"]
    is_doubles = league.get("format") in ("doubles", "mixed")
    regs = await db.player_leagues.find(
        {"league_id": league_id, "payment_status": {"$in": ["paid", "free"]}}
    ).to_list(500)

    user_ids = {r["player_id"] for r in regs} | {r["partner_id"] for r in regs if r.get("partner_id")}
    users = {}
    async for u in db.users.find({"_id": {"$in": [ObjectId(i) for i in user_ids if ObjectId.is_valid(i)]}}):
        users[str(u["_id"])] = u

    def rating_of(uid: str) -> float:
        return float(users.get(uid, {}).get(f"{sport}_rating") or 3.0)

    units = []
    for r in regs:
        pid = r["player_id"]
        if is_doubles:
            partner = r.get("partner_id")
            if not partner or pid > partner:
                continue  # one record per team; the other member is covered by the partner
            units.append({
                "id": pid, "partner_id": partner,
                "members": [pid, partner],
                "name": f"{users.get(pid, {}).get('name', r['player_name'])} & {users.get(partner, {}).get('name', r.get('partner_name', ''))}",
                "rating": (rating_of(pid) + rating_of(partner)) / 2,
            })
        else:
            units.append({"id": pid, "members": [pid], "name": users.get(pid, {}).get("name", r["player_name"]), "rating": rating_of(pid)})
    if len(units) < 2:
        raise HTTPException(status_code=400, detail="At least two registered players (or teams) are needed")

    prior = await db.matches.find({"league_id": league_id, "is_rr": {"$ne": True}}).to_list(2000)
    played = {frozenset({m["player1_id"], m["player2_id"]}) for m in prior}
    round_no = max([m.get("round") or 0 for m in prior] + [0]) + 1
    pending = sum(1 for m in prior if m.get("round") == round_no - 1 and m.get("status") == "scheduled")

    pairs, bye = pair_units(units, played, set(league.get("byes") or []))
    preview = {
        "round": round_no,
        "matches": [{"player1": a["name"], "player2": b["name"]} for a, b in pairs],
        "bye": bye["name"] if bye else None,
        "unplayed_previous_round": pending,
    }
    if not confirm:
        return {"preview": True, **preview}
    if pending and not force:
        raise HTTPException(status_code=409, detail=f"{pending} match(es) from round {round_no - 1} are still unplayed")

    now = datetime.now(timezone.utc)
    play_by_dt = (now + timedelta(days=7)).replace(hour=23, minute=59, second=0, microsecond=0)
    play_by = play_by_dt.isoformat()
    play_by_label = play_by_dt.strftime("%b %d, %Y")

    docs = []
    for a, b in pairs:
        docs.append(Match(
            league_id=league_id, sport=sport,
            player1_id=a["id"], player2_id=b["id"],
            player1_name=users.get(a["id"], {}).get("name", a["name"]) if not is_doubles else a["name"].split(" & ")[0],
            player2_name=users.get(b["id"], {}).get("name", b["name"]) if not is_doubles else b["name"].split(" & ")[0],
            scheduled_date=play_by, notes=f"Round {round_no} pairing", round=round_no,
            team1_partner_id=a.get("partner_id"), team2_partner_id=b.get("partner_id"),
            team1_partner_name=users.get(a.get("partner_id"), {}).get("name") if is_doubles else None,
            team2_partner_name=users.get(b.get("partner_id"), {}).get("name") if is_doubles else None,
        ).to_mongo())
    if docs:
        await db.matches.insert_many(docs)

    update = {"$set": {"updated_at": now.isoformat()}}
    if league.get("status") == "registration":
        update["$set"].update({"status": "active", "activated_at": now.isoformat()})
    if bye:
        update["$addToSet"] = {"byes": bye["id"]}
    await db.leagues.update_one({"_id": league["_id"]}, update)

    # Pairing emails are transactional (the player cannot play without them), so they
    # are sent regardless of the marketing-notification toggle.
    def addr(uid: str) -> str:
        return users.get(uid, {}).get("email", "")

    for a, b in pairs:
        for me, other in ((a, b), (b, a)):
            other_emails = ", ".join(e for e in (addr(m) for m in other["members"]) if e)
            for uid in me["members"]:
                u = users.get(uid)
                if u and u.get("email"):
                    email_service.schedule(email_service.send_round_pairing(
                        u["email"], u.get("name", ""), league["name"], league_id, round_no,
                        other["name"], other_emails, play_by_label))
    if bye:
        for uid in bye["members"]:
            u = users.get(uid)
            if u and u.get("email"):
                email_service.schedule(email_service.send_round_bye(
                    u["email"], u.get("name", ""), league["name"], league_id, round_no))

    return {"preview": False, "created": len(docs), **preview}


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


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    """Delete a user and all related data (matches, player_leagues, ratings, etc)."""
    db = request.app.state.db
    await require_admin(request, db)

    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Delete user
    await db.users.delete_one({"_id": oid})

    # Clean up related data
    await db.player_leagues.delete_many({"player_id": user_id})
    await db.matches.delete_many({"$or": [{"player1_id": user_id}, {"player2_id": user_id}]})
    await db.rating_history.delete_many({"user_id": user_id})
    await db.payment_transactions.delete_many({"user_id": user_id})
    await db.challenges.delete_many({"$or": [{"challenger_id": user_id}, {"challenged_id": user_id}]})
    await db.referral_credits.delete_many({"$or": [{"referrer_id": oid}, {"referee_id": oid}]})
    await db.ladder_challenges.delete_many({"$or": [{"challenger_id": user_id}, {"challenged_id": user_id}]})

    return {"message": f"User {user['email']} deleted successfully"}
