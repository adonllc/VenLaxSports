"""Admin dashboard: real KPIs with filters. GET /api/admin/dashboard (needs dashboard.read).

Reads are capped so one request cannot pull the whole database into memory. Names and emails in the recent-activity
lists are only returned to admins who may read player data.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request

import dashboard_kpis as kpis
import match_view
import permissions
from auth_utils import get_current_user

router = APIRouter()


@router.get("/dashboard")
async def dashboard(request: Request, date_from: str = "", date_to: str = "", sport: str = "", league_id: str = "", source: str = ""):
    db = request.app.state.db
    admin = permissions.ensure(await get_current_user(request, db), "dashboard.read")
    now = datetime.now(timezone.utc)
    try:
        start, end = kpis.parse_params(date_from, date_to, now)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    users = await db.users.find(
        {"role": {"$ne": "admin"}},
        {"name": 1, "email": 1, "role": 1, "is_active": 1, "created_at": 1, "email_verified": 1, "profile_complete": 1, "attribution": 1},
    ).to_list(20000)
    regs = await db.player_leagues.find({}).to_list(100000)
    leagues = await db.leagues.find({}, {"name": 1, "sport": 1, "status": 1, "city": 1}).to_list(5000)
    matches = await db.matches.find({"status": "completed"}, {"player1_id": 1, "player2_id": 1, "updated_at": 1}).to_list(200000)
    sends = await db.email_campaigns.find({}, {"campaign": 1}).to_list(200000)
    events = await db.funnel_events.find({"at": {"$gte": start - timedelta(days=1)}}).to_list(200000)
    first_event = await db.funnel_events.find({}).sort("at", 1).to_list(1)
    if first_event and not any(e.get("_id") == first_event[0].get("_id") for e in events):
        events.append(first_event[0])      # only so "tracked since" is right when the range starts later

    referred = {str(c.get("referee_id")) for c in await db.referral_credits.find({}, {"referee_id": 1}).to_list(50000)}
    referred |= {str(u["_id"]) for u in users if ((u.get("attribution") or {}).get("first") or {}).get("ref")}

    data = kpis.compute(users, regs, leagues, matches, sends, referred, events, now, start, end, sport, league_id, source)

    # Things that need an admin's attention, straight from the queues that hold them.
    data["pending"] = {
        "zelle_payments": await db.payment_transactions.count_documents({"status": {"$in": ["pending_admin", "pending_zelle"]}}),
        "open_disputes": await db.disputes.count_documents({"status": {"$in": list(match_view.OPEN_DISPUTE)}}),
        "doubles_waiting_for_partner": await db.doubles_invites.count_documents({"status": {"$in": ["pending", "initiator_paid"]}}),
    }
    failed_jobs = await db.email_jobs.find({"failed": {"$gt": 0}, "started_at": {"$gte": (now - timedelta(days=30)).isoformat()}}).to_list(50)
    data["alerts"] = {
        "email_send_failures_30d": sum(j.get("failed", 0) for j in failed_jobs),
        "email_jobs_with_failures_30d": len(failed_jobs),
        "registration_errors": None,        # not recorded anywhere yet; shown as "not tracked", never as zero
    }
    if not permissions.has(admin, "players.read"):
        data["recent"] = {"signups": [], "joins": []}
    return data
