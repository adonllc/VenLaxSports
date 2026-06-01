from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from pydantic import BaseModel
from models import League, LeagueCreate, PlayerLeague, Standing
from auth_utils import get_current_user, require_admin, get_optional_user
from phase_config import ACTIVE_SPORTS, ACTIVE_COUNTRY
import email_service
import asyncio
import notification_dispatch
import secrets

router = APIRouter(redirect_slashes=False)


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
@router.get("/")
async def get_leagues(
    request: Request,
    sport: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    status: Optional[str] = None,
    season_id: Optional[str] = None,
    division: Optional[str] = None,
    limit: int = 24,
    skip: int = 0,
):
    db = request.app.state.db
    query: dict = {}
    # Phase gating — only show leagues for sports & country active in the current phase
    if sport:
        if sport not in ACTIVE_SPORTS:
            return []
        query["sport"] = sport
    else:
        query["sport"] = {"$in": ACTIVE_SPORTS}
    if country:
        if country != ACTIVE_COUNTRY:
            return []
        query["country"] = country
    else:
        query["country"] = ACTIVE_COUNTRY
    if city:
        query["city"] = city
    if status:
        query["status"] = status
    if season_id:
        query["season_id"] = season_id
    if division:
        query["division_label"] = division

    leagues = await db.leagues.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [_serialize(l) for l in leagues]


@router.get("/my")
async def my_leagues(request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    regs = await db.player_leagues.find(
        {"player_id": user["_id"], "payment_status": {"$in": ["paid", "free"]}},
        {"league_id": 1, "_id": 0},
    ).to_list(50)
    league_ids = [ObjectId(r["league_id"]) for r in regs]
    if not league_ids:
        return []
    leagues = await db.leagues.find({"_id": {"$in": league_ids}}).to_list(50)
    return [_serialize(l) for l in leagues]


@router.get("/{league_id}")
async def get_league(league_id: str, request: Request):
    db = request.app.state.db
    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    serialized = _serialize(league)
    user = await get_optional_user(request, db)
    if user:
        reg = await db.player_leagues.find_one({
            "league_id": league_id,
            "player_id": str(user["_id"]),
            "payment_status": {"$in": ["paid", "free"]},
        })
        serialized["is_registered"] = reg is not None
    else:
        serialized["is_registered"] = False
    return serialized


@router.post("")
@router.post("/")
async def create_league(data: LeagueCreate, request: Request):
    db = request.app.state.db
    user = await require_admin(request, db)
    # Phase gating — keep league creation consistent with season creation
    if data.sport not in ACTIVE_SPORTS:
        raise HTTPException(status_code=400, detail="Sport not active in the current phase")
    if data.country != ACTIVE_COUNTRY:
        raise HTTPException(status_code=400, detail="Country not active in the current phase")
    league = League(
        **data.model_dump(),
        admin_id=user["_id"],
    )
    result = await db.leagues.insert_one(league.to_mongo())
    league_id = str(result.inserted_id)

    # Trigger 1 — notify interested players that a new season opened
    league_dict = {"id": league_id, **data.model_dump()}
    asyncio.create_task(notification_dispatch.dispatch_season_open(db, league_dict))

    return {"id": league_id, "message": "League created", **data.model_dump()}


class JoinLeagueRequest(BaseModel):
    waiver_accepted: bool = False
    partner_email: Optional[str] = None
    partner_id: Optional[str] = None


@router.post("/{league_id}/join")
async def join_league(league_id: str, body: JoinLeagueRequest, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)

    if not body.waiver_accepted:
        raise HTTPException(status_code=400, detail="You must accept the Liability Waiver to register")

    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    if league["status"] != "registration":
        raise HTTPException(status_code=400, detail="League registration is closed")
    if league["current_players"] >= league["max_players"]:
        raise HTTPException(status_code=400, detail="League is full")

    # ── Doubles branch ────────────────────────────────────────────────────────
    if league.get("format") == "doubles":
        partner_id = getattr(body, "partner_id", None)
        partner_email_raw = getattr(body, "partner_email", None)

        if not partner_id and not partner_email_raw:
            raise HTTPException(status_code=400, detail="Select a partner or enter partner email")

        already_reg = await db.player_leagues.find_one(
            {"league_id": league_id, "player_id": user["_id"]}
        )
        if already_reg:
            raise HTTPException(status_code=409, detail="Already registered in this league")

        now = datetime.now(timezone.utc)
        league_name = league.get("name", "the league")
        sport = league.get("sport", "tennis")
        entry_fee = float(league.get("entry_fee", 0))
        initiator_name = (
            f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
            or user.get("name", "")
        )

        if partner_id:
            # ── Direct registration — partner found in system ─────────────────
            try:
                partner = await db.users.find_one({"_id": ObjectId(partner_id)})
            except Exception:
                raise HTTPException(status_code=404, detail="Partner not found")
            if not partner:
                raise HTTPException(status_code=404, detail="Partner not found")
            if str(partner["_id"]) == str(user["_id"]):
                raise HTTPException(status_code=400, detail="Cannot partner with yourself")

            partner_reg = await db.player_leagues.find_one(
                {"league_id": league_id, "player_id": str(partner["_id"])}
            )
            if partner_reg:
                raise HTTPException(status_code=409, detail="Partner already registered in this league")

            p2_name = (
                f"{partner.get('first_name', '')} {partner.get('last_name', '')}".strip()
                or partner.get("name", "")
            )

            # Reuse existing pending invite on retries (avoids duplicate key + double spot reservation)
            existing_invite = await db.doubles_invites.find_one({
                "initiator_id": user["_id"],
                "league_id": league_id,
                "status": {"$in": ["pending", "initiator_paid"]},
            })
            if existing_invite:
                if existing_invite.get("partner_user_id") and existing_invite["partner_user_id"] != partner_id:
                    raise HTTPException(
                        status_code=409,
                        detail="You already have a pending invite for another partner. Cancel it first.",
                    )
                token = existing_invite["token"]
            else:
                # Atomic spot reservation
                reserved = await db.leagues.find_one_and_update(
                    {
                        "_id": ObjectId(league_id),
                        "$expr": {"$lte": [{"$add": ["$current_players", 2]}, "$max_players"]},
                    },
                    {"$inc": {"current_players": 2}},
                )
                if not reserved:
                    raise HTTPException(status_code=409, detail="Not enough spots — league is full")

                token = secrets.token_hex(32)
                invite_doc = {
                    "league_id": league_id,
                    "initiator_id": user["_id"],
                    "initiator_name": initiator_name,
                    "partner_email": partner.get("email", ""),
                    "partner_user_id": str(partner["_id"]),
                    "token": token,
                    "status": "pending",
                    "waiver_p1_at": now.isoformat(),
                    "created_at": now.isoformat(),
                    "expires_at": (now + timedelta(hours=72)).isoformat(),
                }
                await db.doubles_invites.insert_one(invite_doc)

            if entry_fee == 0:
                # Free — register both now
                await db.player_leagues.insert_one({
                    "league_id": league_id, "player_id": user["_id"], "player_name": initiator_name,
                    "sport": sport, "payment_status": "free", "partner_id": str(partner["_id"]),
                    "partner_name": p2_name, "invite_token": token, "registered_at": now.isoformat(),
                })
                try:
                    await db.player_leagues.insert_one({
                        "league_id": league_id, "player_id": str(partner["_id"]), "player_name": p2_name,
                        "sport": sport, "payment_status": "free", "partner_id": user["_id"],
                        "partner_name": initiator_name, "invite_token": token, "registered_at": now.isoformat(),
                    })
                except Exception:
                    pass
                await db.doubles_invites.update_one({"token": token}, {"$set": {"status": "accepted"}})
                email_service.schedule(email_service.send_registration_confirmed(
                    user["email"], initiator_name, league_name, sport, league_id, False
                ))
                if partner.get("email"):
                    email_service.schedule(email_service.send_registration_confirmed(
                        partner["email"], p2_name, league_name, sport, league_id, False
                    ))
                return {"registered": True, "message": "Team registered successfully!"}

            # Paid — let frontend show PaymentMethodModal (same as singles)
            return {
                "requires_payment": True,
                "invite_token": token,
                "entry_fee": float(entry_fee),
                "league_name": league_name,
                "invite_existed": existing_invite is not None,
            }

        else:
            # ── Invite by email — partner not yet on VenLax ──────────────────
            partner_email = partner_email_raw.lower().strip()
            if partner_email == user["email"].lower():
                raise HTTPException(status_code=400, detail="Cannot invite yourself as partner")

            available = league.get("max_players", 0) - league.get("current_players", 0)
            if available < 2:
                raise HTTPException(
                    status_code=400,
                    detail=f"Not enough spots — only {available} remaining (need 2 for doubles)",
                )

            existing_invite = await db.doubles_invites.find_one(
                {"initiator_id": user["_id"], "league_id": league_id, "status": {"$in": ["pending", "initiator_paid"]}}
            )
            if existing_invite:
                resp = {
                    "has_pending_invite": True,
                    "invite_token": existing_invite["token"],
                    "partner_email": existing_invite.get("partner_email", ""),
                    "expires_at": existing_invite.get("expires_at", ""),
                }
                if entry_fee > 0 and existing_invite.get("status") in ("pending", "initiator_paid"):
                    resp["requires_payment"] = True
                    resp["entry_fee"] = float(entry_fee)
                return resp

            token = secrets.token_hex(32)
            invite_doc = {
                "league_id": league_id,
                "initiator_id": user["_id"],
                "initiator_name": initiator_name,
                "partner_email": partner_email,
                "partner_user_id": None,
                "token": token,
                "status": "pending",
                "waiver_p1_at": now.isoformat(),
                "created_at": now.isoformat(),
                "expires_at": (now + timedelta(hours=72)).isoformat(),
            }
            await db.doubles_invites.insert_one(invite_doc)

            frontend_url = email_service._get_frontend_url() or "https://venlaxsports.com"
            confirm_url = f"{frontend_url}/doubles-invite/confirm?token={token}"
            email_service.schedule(email_service.send_partner_invite(
                partner_email, initiator_name, league_name, sport, entry_fee, confirm_url
            ))
            if entry_fee > 0:
                return {
                    "pending_partner": True,
                    "requires_payment": True,
                    "invite_token": token,
                    "entry_fee": float(entry_fee),
                    "expires_at": invite_doc["expires_at"],
                }
            return {
                "pending_partner": True,
                "invite_token": token,
                "expires_at": invite_doc["expires_at"],
                "message": f"Invite sent to {partner_email}. Registration completes when your partner confirms.",
            }
    # ── End doubles branch ─────────────────────────────────────────────────────

    existing = await db.player_leagues.find_one({"player_id": user["_id"], "league_id": league_id})
    if existing and existing.get("payment_status") in ["paid", "free"]:
        raise HTTPException(status_code=400, detail="Already registered in this league")

    waiver_ts = datetime.now(timezone.utc).isoformat()

    entry_fee = float(league.get("entry_fee", 0))
    if entry_fee > 0:
        # Persist waiver intent so the payment route can stamp it on confirmation
        await db.waiver_consents.insert_one({
            "user_id": user["_id"],
            "league_id": league_id,
            "waiver_accepted_at": waiver_ts,
            "ip": request.client.host if request.client else None,
        })
        return {
            "requires_payment": True,
            "league_id": league_id,
            "league_name": league["name"],
            "entry_fee": entry_fee,
            "currency": league.get("currency", "USD"),
        }

    # Free — join immediately
    pl = PlayerLeague(
        player_id=user["_id"],
        player_name=user["name"],
        league_id=league_id,
        sport=league["sport"],
        payment_status="free",
        waiver_accepted_at=waiver_ts,
    )
    await db.player_leagues.insert_one(pl.to_mongo())
    old_count = league["current_players"]
    new_count = old_count + 1
    max_p = league.get("max_players", 0)

    await db.leagues.update_one({"_id": ObjectId(league_id)}, {"$inc": {"current_players": 1}})

    # Capacity milestone dispatch (fire-and-forget)
    _league_info = {
        "id": league_id,
        "name": league["name"],
        "city": league.get("city", ""),
        "sport": league.get("sport", ""),
    }
    if max_p > 0:
        if new_count >= max_p:
            asyncio.create_task(notification_dispatch.dispatch_waitlist_open(db, _league_info))
        elif old_count < int(max_p * 0.8) and new_count >= int(max_p * 0.8):
            spots_left = max_p - new_count
            asyncio.create_task(notification_dispatch.dispatch_last_spots(db, _league_info, spots_left))
        elif old_count < int(max_p * 0.5) and new_count >= int(max_p * 0.5):
            asyncio.create_task(notification_dispatch.dispatch_filling_fast(db, _league_info))

    # Upsert standing
    await _upsert_standing(db, league_id, user["_id"], user["name"], league["sport"], user.get("country", "USA"))

    # Notify player of free registration
    if user.get("email") and user.get("email_notifications", True):
        email_service.schedule(email_service.send_registration_confirmed(
            user["email"], user["name"], league["name"], league["sport"],
            league_id, paid=False))

    return {"message": f"Joined {league['name']} successfully", "requires_payment": False}


@router.get("/{league_id}/players")
async def get_league_players(league_id: str, request: Request):
    db = request.app.state.db
    await get_current_user(request, db)
    players = await db.player_leagues.find(
        {"league_id": league_id, "payment_status": {"$in": ["paid", "free"]}},
        {"_id": 0},
    ).to_list(100)
    return players


@router.get("/{league_id}/standings")
async def get_league_standings(league_id: str, request: Request):
    db = request.app.state.db
    standings = await db.standings.find(
        {"league_id": league_id}, {"_id": 0}
    ).to_list(100)

    # Sort: points → set differential → game differential → wins (tiebreak chain)
    def _sort_key(s):
        set_diff = s.get("sets_won", 0) - s.get("sets_lost", 0)
        game_diff = s.get("games_won", 0) - s.get("games_lost", 0)
        return (-round(s.get("points", 0), 4), -set_diff, -game_diff, -s.get("wins", 0))

    standings.sort(key=_sort_key)
    return standings


@router.get("/{league_id}/matches")
async def get_league_matches(league_id: str, request: Request):
    db = request.app.state.db
    matches = await db.matches.find({"league_id": league_id}).sort("scheduled_date", 1).to_list(100)
    return [_serialize(m) for m in matches]


@router.post("/{league_id}/close")
async def close_league(league_id: str, request: Request):
    """Finalize season: award +2 bonus to players who completed all matches, set league status=completed."""
    db = request.app.state.db
    await require_admin(request, db)

    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    if league.get("status") == "completed":
        raise HTTPException(status_code=400, detail="League already closed")

    # All registered players
    registrations = await db.player_leagues.find(
        {"league_id": league_id, "payment_status": {"$in": ["paid", "free"]}},
        {"player_id": 1, "_id": 0},
    ).to_list(200)

    now = datetime.now(timezone.utc).isoformat()
    awarded: list[str] = []

    for reg in registrations:
        pid = reg["player_id"]
        player_filter = {
            "league_id": league_id,
            "status": {"$ne": "cancelled"},
            "$or": [{"player1_id": pid}, {"player2_id": pid}],
        }
        total = await db.matches.count_documents(player_filter)
        if total == 0:
            continue
        completed = await db.matches.count_documents({**player_filter, "status": "completed"})
        if completed == total:
            await db.standings.update_one(
                {"league_id": league_id, "player_id": pid},
                {"$inc": {"bonus_points": 2.0, "points": 2.0}, "$set": {"updated_at": now}},
            )
            awarded.append(pid)

    await db.leagues.update_one(
        {"_id": ObjectId(league_id)},
        {"$set": {"status": "completed", "updated_at": now}},
    )

    return {
        "message": "League closed",
        "players_awarded_bonus": len(awarded),
        "awarded_player_ids": awarded,
    }


async def _upsert_standing(db, league_id: str, player_id: str, player_name: str, sport: str, country: str):
    existing = await db.standings.find_one({"league_id": league_id, "player_id": player_id})
    if not existing:
        s = Standing(
            league_id=league_id,
            player_id=player_id,
            player_name=player_name,
            sport=sport,
            country=country,
        )
        await db.standings.insert_one(s.to_mongo())
