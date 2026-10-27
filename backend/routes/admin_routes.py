from fastapi import APIRouter, HTTPException, Request, Body
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import os
from auth_utils import require_admin, get_current_user
import audit_log
import permissions
from models import LeagueUpdate, PlayerLeague, Standing
import email_service
import league_schedule

router = APIRouter()


async def _need(request: Request, permission: str) -> dict:
    """Signed-in admin holding `permission`, else 401/403. Server-side check for sensitive routes."""
    return permissions.ensure(await get_current_user(request, request.app.state.db), permission)


# Background jobs that can be individually enabled/disabled at runtime (no redeploy).
# Anything not listed here is a build-time env var — see /admin/flags's env_flags.
JOB_FLAGS = {
    "weekly_referral_campaign": {
        "label": "Weekly Referral Campaign",
        "description": "Emails all registered users every Monday to refer friends for $5/$5 credit.",
    },
    "auto_open_leagues": {
        "label": "Auto-Open Leagues to Play",
        "description": "On each league's start date, generates every player's matches and opens it to play if it has 8+ players. Daily 00:10 UTC.",
    },
    "schedule_housekeeping": {
        "label": "Match Scheduling Housekeeping",
        "description": "Expires unanswered time proposals after 48h, reminds at 24h, alerts players and the organizer when a match is 48h from its play-by date with no confirmed time, and awards a match to Away when the play-by date passes and Home never proposed a time. Hourly.",
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
    "refund_unpaired_teams": {
        "label": "Auto-Refund Doubles Teams Without a Partner",
        "description": "On the league start date, refunds the full entry fee (Stripe) of any doubles team whose first player paid but has no partner, and emails them. OFF until you turn it on. Zelle payments are never refunded automatically. Daily 00:20 UTC.",
        "default": False,
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
            "enabled": state.get(flag_id, {}).get("enabled", meta.get("default", True)),
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

    return {"jobs": jobs, "env_flags": env_flags}


@router.get("/incomplete-teams")
async def incomplete_teams(request: Request):
    """Doubles teams still missing a partner (admin only). Paid ones may need a refund if no partner is found."""
    db = request.app.state.db
    await require_admin(request, db)
    invites = await db.doubles_invites.find({"status": {"$in": ["pending", "initiator_paid"]}}).sort("created_at", 1).to_list(500)
    leagues = {}
    rows = []
    for inv in invites:
        lid = inv.get("league_id", "")
        if lid not in leagues:
            try:
                leagues[lid] = await db.leagues.find_one({"_id": ObjectId(lid)}) or {}
            except Exception:
                leagues[lid] = {}
        lg = leagues[lid]
        user = None
        try:
            user = await db.users.find_one({"_id": ObjectId(inv["initiator_id"])}, {"email": 1, "name": 1})
        except Exception:
            pass
        rows.append({
            "token_tail": inv["token"][-6:],
            "league_id": lid,
            "league_name": lg.get("name", ""),
            "league_start": lg.get("start_date", ""),
            "player_name": inv.get("initiator_name", ""),
            "player_email": (user or {}).get("email", ""),
            "paid": inv.get("status") == "initiator_paid",
            "partner_email": inv.get("partner_email", ""),
            "created_at": inv.get("created_at", ""),
        })
    return {"teams": rows}


@router.get("/marketing-report")
async def marketing_report(request: Request, days: int = 30):
    """New accounts in the last N days grouped by where they came from, with how many joined a league and played."""
    from attribution import build_report
    db = request.app.state.db
    await require_admin(request, db)
    days = max(1, min(int(days), 365))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    users = await db.users.find({"created_at": {"$gte": since}, "role": {"$ne": "admin"}}, {"attribution": 1}).to_list(5000)
    ids = [str(u["_id"]) for u in users]
    joined = {r["player_id"] for r in await db.player_leagues.find(
        {"player_id": {"$in": ids}, "payment_status": {"$in": ["paid", "free"]}}, {"player_id": 1}).to_list(20000)}
    played = {r["user_id"] for r in await db.rating_history.find({"user_id": {"$in": ids}}, {"user_id": 1}).to_list(20000)}
    rows = build_report(users, joined, played)
    signups = sum(r["signups"] for r in rows)
    return {
        "days": days,
        "rows": rows,
        "totals": {"signups": signups, "joined": sum(r["joined"] for r in rows), "played": sum(r["played"] for r in rows)},
        "untracked": sum(r["signups"] for r in rows if r["source"] == "(direct)"),
    }


@router.get("/site-settings")
async def get_site_settings(request: Request):
    """Runtime switches an admin can change without a deploy: which cities are open, and Google tracking."""
    from launch_city import get_open_cities, get_google_analytics_enabled, invalidate_cache
    db = request.app.state.db
    await require_admin(request, db)
    invalidate_cache()
    open_cities = await get_open_cities(db)
    return {
        "all_open": open_cities is None,
        "open_cities": open_cities or [],
        "google_analytics": await get_google_analytics_enabled(db),
    }


@router.put("/site-settings")
async def set_site_settings(request: Request, body: dict = Body(...)):
    from launch_city import invalidate_cache
    db = request.app.state.db
    admin = await _need(request, "settings.write")
    stamp = {"updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": str(admin.get("_id", ""))}

    if "open_cities" in body or "all_open" in body:
        cities = body.get("open_cities") or []
        if not isinstance(cities, list) or len(cities) > 100 or any(not isinstance(c, str) or not c.strip() for c in cities):
            raise HTTPException(status_code=400, detail="open_cities must be a list of city names")
        await db.feature_flags.update_one(
            {"_id": "open_cities"},
            {"$set": {"cities": [c.strip() for c in cities], "all_open": bool(body.get("all_open")), **stamp}},
            upsert=True,
        )
    if "google_analytics" in body:
        await db.feature_flags.update_one(
            {"_id": "google_analytics"}, {"$set": {"enabled": bool(body["google_analytics"]), **stamp}}, upsert=True,
        )
    invalidate_cache()
    await audit_log.record(db, admin, "settings.site", "feature_flags", "site-settings", after=body, request=request)
    return {"ok": True}


@router.patch("/flags/{flag_id}")
async def set_flag(flag_id: str, request: Request, body: dict = Body(...)):
    db = request.app.state.db
    admin = await _need(request, "settings.write")

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
    await audit_log.record(db, admin, "settings.flag", "feature_flags", flag_id, JOB_FLAGS[flag_id]["label"], after={"enabled": enabled}, request=request)
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
    admin = await _need(request, "players.read")
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
    admin = await _need(request, "leagues.write")

    # Capture previous status to detect activation
    prev = await db.leagues.find_one({"_id": ObjectId(league_id)}, {"status": 1, "name": 1, "league_type": 1, "max_players": 1})
    if not prev:
        raise HTTPException(status_code=404, detail="League not found")

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if "min_players_to_start" in update_data:
        effective_max = update_data.get("max_players", prev.get("max_players", 16))
        if not 2 <= update_data["min_players_to_start"] <= effective_max:
            raise HTTPException(status_code=400, detail="min_players_to_start must be between 2 and max_players")
    if "qualification" in update_data:
        import qualification
        try:
            update_data["qualification"] = qualification.validate_rule(update_data["qualification"])
        except (ValueError, TypeError) as e:
            raise HTTPException(status_code=400, detail=str(e))
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    before_doc = await db.leagues.find_one({"_id": ObjectId(league_id)}, {k: 1 for k in update_data}) or {}
    try:
        result = await db.leagues.update_one({"_id": ObjectId(league_id)}, {"$set": update_data})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="League not found")

    # Flex leagues have no pre-built schedule: players are told their opponent when the admin
    # creates a round (POST /leagues/{id}/pairings), so no generic "schedule released" email here.

    changed_before, changed_after = audit_log.diff(before_doc, update_data)
    changed_before.pop("updated_at", None)
    changed_after.pop("updated_at", None)
    await audit_log.record(db, admin, "league.update", "league", league_id, prev.get("name", ""),
                           before=changed_before, after=changed_after, request=request)
    return {"message": "League updated"}


@router.post("/leagues/{league_id}/open-to-play")
async def open_to_play(league_id: str, request: Request, body: dict = Body(default={})):
    """Generate every player's season matches and open the league to play (flex leagues).

    confirm=false returns a preview and changes nothing. confirm=true creates the matches and
    emails each player their opponents. regenerate=true replaces an existing schedule, allowed
    only until a match has been scheduled or played.
    """
    db = request.app.state.db
    await require_admin(request, db)
    league = await _get_league_or_404(db, league_id)
    if league.get("league_type", "flex") != "flex":
        raise HTTPException(status_code=400, detail="Open to Play is for flex leagues only")
    if league.get("status") not in ("registration", "active"):
        raise HTTPException(status_code=400, detail="League is not open or active")
    try:
        return await league_schedule.open_league_to_play(
            db, league,
            matches_per_player=body.get("matches_per_player"),
            preview=not bool(body.get("confirm")),
            regenerate=bool(body.get("regenerate")),
        )
    except league_schedule.ScheduleLocked as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/leagues/{league_id}/schedule")
async def league_schedule_overview(league_id: str, request: Request):
    """Every generated match in the league, for the admin to review and adjust."""
    db = request.app.state.db
    await require_admin(request, db)
    await _get_league_or_404(db, league_id)
    ms = await db.matches.find({"league_id": league_id, "deadline": {"$ne": None}}).sort("round", 1).to_list(2000)
    return [{
        "id": str(m["_id"]), "round": m.get("round"),
        "home": m.get("player1_name"), "away": m.get("player2_name"),
        "home_id": m["player1_id"], "away_id": m["player2_id"],
        "deadline": m.get("deadline"), "schedule_status": m.get("schedule_status"),
        "scheduled_date": m.get("scheduled_date"), "venue": m.get("venue"),
        "needs_help": bool(m.get("needs_help")),
        "status": m.get("status"), "locked": league_schedule._has_activity(m),
    } for m in ms]


@router.patch("/matches/{match_id}/adjust")
async def adjust_match(match_id: str, request: Request, body: dict = Body(...)):
    """Swap Home/Away or change opponents of one generated match, before it is scheduled or played."""
    db = request.app.state.db
    admin = await _need(request, "matches.write")
    try:
        match = await db.matches.find_one({"_id": ObjectId(match_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Match not found")
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    league = await _get_league_or_404(db, match["league_id"])
    try:
        result = await league_schedule.adjust_match(
            db, league, match,
            body.get("home_id") or match["player1_id"],
            body.get("away_id") or match["player2_id"],
        )
        await audit_log.record(db, admin, "match.adjust", "match", match_id, league.get("name", ""),
                               before={"home_id": match.get("player1_id"), "away_id": match.get("player2_id")},
                               after={"home_id": body.get("home_id") or match["player1_id"], "away_id": body.get("away_id") or match["player2_id"]},
                               request=request)
        return result
    except league_schedule.ScheduleLocked as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/matches/{match_id}/set-time")
async def set_match_time(match_id: str, request: Request, body: dict = Body(...)):
    """Organizer books a match directly, for pairs who could not agree. Both players are notified."""
    import match_scheduling
    db = request.app.state.db
    admin = await _need(request, "matches.write")
    try:
        match = await db.matches.find_one({"_id": ObjectId(match_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Match not found")
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    league = await _get_league_or_404(db, match["league_id"])
    try:
        result = await match_scheduling.organizer_set_time(
            db, match, league, str(admin.get("_id", "")), body.get("date", ""), body.get("venue", ""))
        await audit_log.record(db, admin, "match.set_time", "match", match_id, league.get("name", ""),
                               after={"date": body.get("date", ""), "venue": body.get("venue", "")}, request=request)
        return result
    except match_scheduling.SchedulingError as e:
        raise HTTPException(status_code=e.status, detail=e.detail)


async def _get_league_or_404(db, league_id: str) -> dict:
    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    return league


@router.delete("/leagues/{league_id}")
async def delete_league(league_id: str, request: Request):
    db = request.app.state.db
    admin = await _need(request, "leagues.delete")
    try:
        before_doc = await db.leagues.find_one({"_id": ObjectId(league_id)}, {"name": 1, "city": 1, "sport": 1, "status": 1}) or {}
        result = await db.leagues.delete_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="League not found")
    await audit_log.record(db, admin, "league.delete", "league", league_id, before_doc.get("name", ""),
                           before={k: v for k, v in before_doc.items() if k != "_id"}, request=request)
    return {"message": "League deleted"}


@router.get("/payments")
async def get_payments(request: Request, skip: int = 0, limit: int = 50):
    db = request.app.state.db
    admin = await _need(request, "payments.read")
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
    admin = await _need(request, "payments.write")

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
    await audit_log.record(db, admin, "payment.zelle_approve", "payment", session_id, after={"user_id": user_id, "league_id": league_id}, request=request)
    return {"message": "Approved", "user_id": user_id, "league_id": league_id}


@router.post("/zelle/{session_id}/reject")
async def reject_zelle(session_id: str, request: Request):
    """Admin rejects Zelle — marks transaction rejected, player NOT registered."""
    db = request.app.state.db
    admin = await _need(request, "payments.write")

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

    await audit_log.record(db, admin, "payment.zelle_reject", "payment", session_id, request=request)
    return {"message": "Rejected", "session_id": session_id}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    """Delete a user and all related data (matches, player_leagues, ratings, etc)."""
    db = request.app.state.db
    admin = await _need(request, "players.delete")

    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == str(admin.get("_id", "")):
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    # Written first: the deletion cannot be undone, so the record exists even if a cleanup step below fails.
    await audit_log.record(db, admin, "player.delete", "user", user_id, user.get("email", ""),
                           before={"email": user.get("email"), "name": user.get("name"), "role": user.get("role"), "city": user.get("city")},
                           request=request)
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
