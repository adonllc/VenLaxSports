from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime, timezone
from auth_utils import get_current_user

router = APIRouter(redirect_slashes=False)


def _ser(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


def _require_rr(league: dict) -> None:
    if not league or league.get("league_type") != "round_robin":
        raise HTTPException(status_code=404, detail="Round Robin league not found")


@router.get("/invite/{token}")
async def get_invite(token: str, request: Request):
    db = request.app.state.db
    invite = await db.doubles_invites.find_one({"token": token})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    if invite.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Invite already used or expired")

    now = datetime.now(timezone.utc)
    expires_raw = invite.get("expires_at", "")
    try:
        exp = datetime.fromisoformat(expires_raw.replace("Z", "+00:00"))
        if now > exp:
            await db.doubles_invites.update_one({"token": token}, {"$set": {"status": "expired"}})
            raise HTTPException(status_code=400, detail="Invite has expired")
    except HTTPException:
        raise
    except Exception:
        pass

    try:
        league = await db.leagues.find_one({"_id": ObjectId(invite["league_id"])})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")

    return {
        "inviter_name": invite["inviter_name"],
        "league_id": invite["league_id"],
        "league_name": league.get("name") if league else "",
        "sport": league.get("sport") if league else "",
        "entry_fee": league.get("entry_fee", 0) if league else 0,
        "status": invite["status"],
    }


@router.get("")
@router.get("/")
async def list_rr_leagues(
    request: Request,
    sport: str = None,
    country: str = None,
    city: str = None,
    division: str = None,
    status: str = None,
):
    db = request.app.state.db
    from phase_config import ACTIVE_SPORTS, ACTIVE_COUNTRY

    q: dict = {"league_type": "round_robin"}
    effective_country = country or ACTIVE_COUNTRY
    q["country"] = effective_country

    sport_filter = sport if sport and sport in ACTIVE_SPORTS else None
    if sport_filter:
        q["sport"] = sport_filter
    else:
        q["sport"] = {"$in": ACTIVE_SPORTS}

    if city:
        q["city"] = city
    if status:
        q["status"] = status
    if division:
        q["rr_config.division_type"] = division

    leagues = await db.leagues.find(q).sort("created_at", -1).to_list(100)
    return [_ser(lg) for lg in leagues]


@router.get("/{league_id}")
async def get_rr_league(league_id: str, request: Request):
    db = request.app.state.db
    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    _require_rr(league)
    return _ser(league)


@router.get("/{league_id}/schedule")
async def get_rr_schedule(league_id: str, request: Request):
    db = request.app.state.db
    schedule = await db.rr_schedules.find_one({"league_id": league_id})
    if not schedule:
        return {"rounds": [], "generated": False}
    schedule.pop("_id", None)
    for rnd in schedule.get("rounds", []):
        enriched = []
        for m in rnd.get("matches", []):
            if m.get("match_id"):
                try:
                    doc = await db.matches.find_one({"_id": ObjectId(m["match_id"])})
                    if doc:
                        m["status"] = doc.get("status", "scheduled")
                        m["score_data"] = doc.get("score_data")
                        m["winner_id"] = doc.get("winner_id")
                except Exception:
                    pass
            enriched.append(m)
        rnd["matches"] = enriched
    return schedule


@router.get("/{league_id}/standings")
async def get_rr_standings(league_id: str, request: Request):
    db = request.app.state.db
    standings = await db.standings.find({"league_id": league_id}).to_list(100)
    standings.sort(
        key=lambda s: (
            -s.get("wins", 0),
            -(s.get("games_won", 0) - s.get("games_lost", 0)),
            -s.get("points", 0),
        )
    )
    for i, s in enumerate(standings):
        s["id"] = str(s.pop("_id"))
        s["rank"] = i + 1
    return standings


@router.get("/{league_id}/matches")
async def get_rr_matches(league_id: str, request: Request):
    db = request.app.state.db
    matches = await db.matches.find({"league_id": league_id, "is_rr": True}).to_list(500)
    return [_ser(m) for m in matches]


async def _run_generate_schedule(db, league_id: str) -> dict:
    """Generate the round-robin schedule and create Match documents.
    Called internally after join/accept when min_players is reached.
    """
    from rr_scheduler import generate_schedule, scoring_format_for
    from datetime import timedelta

    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        return {"generated": False, "reason": "league not found"}

    rr = league.get("rr_config", {})
    if rr.get("schedule_generated"):
        return {"generated": False, "reason": "already generated"}

    division_type = rr.get("division_type", "singles")

    if division_type == "singles":
        regs = await db.player_leagues.find({"league_id": league_id}).to_list(100)
        players = [{"id": r["player_id"], "name": r["player_name"]} for r in regs]
    else:
        regs = await db.player_leagues.find(
            {"league_id": league_id, "partner_id": {"$exists": True, "$ne": None}}
        ).to_list(100)
        players = [
            {
                "id": r["player_id"],
                "name": r["player_name"],
                "partner_id": r.get("partner_id"),
                "partner_name": r.get("partner_name"),
            }
            for r in regs
        ]

    if len(players) < rr.get("min_players", 6):
        return {"generated": False, "reason": "not enough players"}

    scoring_format = scoring_format_for(league["sport"])
    start_date = datetime.fromisoformat(league["start_date"].replace("Z", "+00:00"))

    rounds_raw = generate_schedule(players)
    rounds_doc = []
    for k, pairs in enumerate(rounds_raw, start=1):
        week_start = start_date + timedelta(days=(k - 1) * 7)
        week_end = week_start + timedelta(days=6)
        round_matches = []
        for p1, p2 in pairs:
            if p1 is None or p2 is None:
                continue                        # BYE — skip match creation
            match_doc = {
                "league_id": league_id,
                "sport": league["sport"],
                "player1_id": p1["id"],
                "player2_id": p2["id"],
                "player1_name": p1["name"],
                "player2_name": p2["name"],
                "scheduled_date": week_start.isoformat(),
                "status": "scheduled",
                "round": k,
                "is_rr": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            if division_type == "doubles":
                match_doc.update({
                    "team1_partner_id": p1.get("partner_id"),
                    "team1_partner_name": p1.get("partner_name"),
                    "team2_partner_id": p2.get("partner_id"),
                    "team2_partner_name": p2.get("partner_name"),
                })
            result = await db.matches.insert_one(match_doc)
            round_matches.append({
                "player1_id": p1["id"],
                "player1_name": p1["name"],
                "player2_id": p2["id"],
                "player2_name": p2["name"],
                "match_id": str(result.inserted_id),
            })
        rounds_doc.append({
            "round": k,
            "week_start": week_start.date().isoformat(),
            "week_end": week_end.date().isoformat(),
            "matches": round_matches,
        })

    await db.rr_schedules.insert_one({
        "league_id": league_id,
        "rounds": rounds_doc,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await db.leagues.update_one(
        {"_id": ObjectId(league_id)},
        {
            "$set": {
                "status": "active",
                "rr_config.schedule_generated": True,
                "rr_config.scoring_format": scoring_format,
                "rr_config.auto_started_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    import email_service
    all_player_ids = [p["id"] for p in players]
    for pid in all_player_ids:
        try:
            user = await db.users.find_one({"_id": ObjectId(pid)})
            if user and user.get("email") and user.get("email_notifications", True):
                email_service.schedule(email_service.send_league_started(
                    user["email"], user["name"], league["name"], league_id
                ))
        except Exception:
            pass

    return {"generated": True, "rounds": len(rounds_doc)}


@router.post("/{league_id}/generate-schedule")
async def generate_schedule_endpoint(league_id: str, request: Request):
    db = request.app.state.db
    return await _run_generate_schedule(db, league_id)


@router.post("/{league_id}/join")
async def join_rr_league(league_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)

    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    _require_rr(league)

    rr = league.get("rr_config", {})
    if rr.get("division_type") != "singles":
        raise HTTPException(status_code=400, detail="Use invite-partner for doubles leagues")
    if rr.get("schedule_generated"):
        raise HTTPException(status_code=400, detail="League already started — registration closed")

    current = league.get("current_players", 0)
    if current >= rr.get("max_players", 12):
        raise HTTPException(status_code=400, detail="League is full")

    existing = await db.player_leagues.find_one({"player_id": user["_id"], "league_id": league_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already registered")

    entry_fee = league.get("entry_fee", 0)
    if entry_fee > 0:
        try:
            from routes.payment_routes import _create_checkout_session
            session = await _create_checkout_session(
                user, league_id, league["name"], entry_fee, league.get("currency", "USD"),
                request
            )
            return {"redirect": True, "checkout_url": session["url"]}
        except Exception:
            raise HTTPException(status_code=503, detail="Payment service unavailable")

    await db.player_leagues.insert_one({
        "player_id": user["_id"],
        "player_name": user["name"],
        "league_id": league_id,
        "sport": league["sport"],
        "payment_status": "free",
        "joined_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.leagues.update_one(
        {"_id": ObjectId(league_id)},
        {"$inc": {"current_players": 1}}
    )

    import email_service
    email_service.schedule(email_service.send_registration_confirmed(
        user["email"], user["name"], league["name"], league["sport"], league_id, False
    ))

    new_count = current + 1
    if new_count >= rr.get("min_players", 6) and not rr.get("schedule_generated"):
        await _run_generate_schedule(db, league_id)

    return {"registered": True, "message": "Joined league"}


@router.post("/{league_id}/invite-partner")
async def invite_partner(league_id: str, request: Request):
    import uuid
    from datetime import timedelta
    db = request.app.state.db
    user = await get_current_user(request, db)

    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    _require_rr(league)

    rr = league.get("rr_config", {})
    if rr.get("division_type") != "doubles":
        raise HTTPException(status_code=400, detail="Not a doubles league")
    if rr.get("schedule_generated"):
        raise HTTPException(status_code=400, detail="League already started")

    body = await request.json()
    partner_email = body.get("partner_email", "").strip().lower()
    if not partner_email:
        raise HTTPException(status_code=400, detail="partner_email required")

    existing = await db.player_leagues.find_one({"player_id": user["_id"], "league_id": league_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already registered in this league")

    token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(hours=72)

    await db.doubles_invites.insert_one({
        "league_id": league_id,
        "inviter_id": user["_id"],
        "inviter_name": user["name"],
        "partner_email": partner_email,
        "token": token,
        "status": "pending",
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    import email_service
    frontend_url = email_service._get_frontend_url()
    accept_url = f"{frontend_url}/round-robin/invite/{token}" if frontend_url else f"/round-robin/invite/{token}"
    email_service.schedule(email_service.send_partner_invite(
        partner_email, user["name"], league["name"],
        league["sport"], league.get("entry_fee", 0), accept_url
    ))

    return {"invited": True, "message": "Invite sent to " + partner_email}


@router.post("/invite/{token}/accept")
async def accept_invite(token: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)

    invite = await db.doubles_invites.find_one({"token": token})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Invite already used or expired")

    now = datetime.now(timezone.utc)
    try:
        exp = datetime.fromisoformat(invite["expires_at"].replace("Z", "+00:00"))
        if now > exp:
            await db.doubles_invites.update_one({"token": token}, {"$set": {"status": "expired"}})
            raise HTTPException(status_code=400, detail="Invite has expired")
    except HTTPException:
        raise
    except Exception:
        pass

    league_id = invite["league_id"]
    inviter_id = invite["inviter_id"]

    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    _require_rr(league)

    rr = league.get("rr_config", {})
    if rr.get("schedule_generated"):
        raise HTTPException(status_code=400, detail="League already started — invite no longer valid")

    current = league.get("current_players", 0)
    if current >= rr.get("max_players", 12):
        raise HTTPException(status_code=400, detail="League is full")

    now_iso = datetime.now(timezone.utc).isoformat()
    team_entry = {
        "player_id": inviter_id,
        "player_name": invite["inviter_name"],
        "league_id": league_id,
        "sport": league["sport"],
        "payment_status": "free",
        "partner_id": user["_id"],
        "partner_name": user["name"],
        "joined_at": now_iso,
    }
    existing = await db.player_leagues.find_one({"player_id": inviter_id, "league_id": league_id})
    if not existing:
        await db.player_leagues.insert_one(team_entry)
        await db.leagues.update_one({"_id": ObjectId(league_id)}, {"$inc": {"current_players": 1}})

    await db.doubles_invites.update_one({"token": token}, {"$set": {"status": "accepted"}})

    import email_service
    try:
        inviter = await db.users.find_one({"_id": ObjectId(inviter_id)})
        if inviter and inviter.get("email"):
            email_service.schedule(email_service.send_registration_confirmed(
                inviter["email"], inviter["name"], league["name"], league["sport"], league_id, False
            ))
    except Exception:
        pass

    new_count = current + 1
    if new_count >= rr.get("min_players", 6) and not rr.get("schedule_generated"):
        await _run_generate_schedule(db, league_id)

    return {"accepted": True, "league_id": league_id}
