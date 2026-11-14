"""Admin: one league in full (players, payments, teams, coupons, matches) and the roster actions on it.
Mounted under /api/admin/leagues. Email and phone are returned to the top admin role only.
"""
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

import audit_log
import league_overview
import league_roster
import permissions
from auth_utils import get_current_user

router = APIRouter()


async def _need(request: Request, *perms: str) -> dict:
    admin = await get_current_user(request, request.app.state.db)
    for p in perms:
        permissions.ensure(admin, p)
    return admin


async def _league(db, league_id: str) -> dict:
    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        league = None
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    return league


def _fail(e: league_roster.RosterError):
    return HTTPException(status_code=e.status, detail=e.message)


class MarkPaidIn(BaseModel):
    amount: float | None = None
    note: str = ""


class RemoveIn(BaseModel):
    refund: str = "none"


class MoveIn(BaseModel):
    to_league_id: str


@router.get("/{league_id}/overview")
async def overview(league_id: str, request: Request):
    admin = await _need(request, "leagues.read", "payments.read")
    db = request.app.state.db
    league = await _league(db, league_id)
    data = await league_overview.build(db, league, include_contact=permissions.effective_role(admin) == "super_admin")
    data["can"] = {
        "mark_paid": permissions.has(admin, "payments.write"),
        "remove": permissions.has(admin, "leagues.write") and permissions.has(admin, "payments.write"),
        "move": permissions.has(admin, "leagues.write"),
    }
    return data


@router.post("/{league_id}/players/{player_id}/mark-paid")
async def mark_paid(league_id: str, player_id: str, body: MarkPaidIn, request: Request):
    admin = await _need(request, "payments.write")
    db = request.app.state.db
    league = await _league(db, league_id)
    try:
        out = await league_roster.mark_paid(db, league, player_id, body.amount, body.note)
    except league_roster.RosterError as e:
        raise _fail(e)
    await audit_log.record(db, admin, "league.player_mark_paid", "league", league_id, league.get("name", ""),
                           after={"player_id": player_id, "amount": out["amount"], "note": body.note}, request=request)
    return out


@router.post("/{league_id}/players/{player_id}/remove")
async def remove(league_id: str, player_id: str, body: RemoveIn, request: Request):
    admin = await _need(request, "leagues.write", "payments.write")
    db = request.app.state.db
    league = await _league(db, league_id)
    try:
        out = await league_roster.remove_player(db, league, player_id, body.refund)
    except league_roster.RosterError as e:
        raise _fail(e)
    await audit_log.record(db, admin, "league.player_remove", "league", league_id, league.get("name", ""),
                           after={"player_id": player_id, "refund": out["refund"], "credited": out["credited"],
                                  "stripe_refund_id": out["stripe_refund_id"]}, request=request)
    return out


@router.post("/{league_id}/players/{player_id}/move")
async def move(league_id: str, player_id: str, body: MoveIn, request: Request):
    admin = await _need(request, "leagues.write")
    db = request.app.state.db
    league = await _league(db, league_id)
    try:
        out = await league_roster.move_player(db, league, player_id, body.to_league_id)
    except league_roster.RosterError as e:
        raise _fail(e)
    await audit_log.record(db, admin, "league.player_move", "league", league_id, league.get("name", ""),
                           after={"player_id": player_id, "to_league_id": body.to_league_id, "to_league": out["to_league"]}, request=request)
    return out
