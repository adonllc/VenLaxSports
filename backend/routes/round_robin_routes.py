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
