"""Admin: player insights (funnel, who joined what and how, who has not joined, promo codes, CSV export).

Admin only (not city admins): the lists contain player email addresses.
"""
import csv
import io
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

import player_crm as crm
import player_insights as pi
import audit_log
import permissions
from auth_utils import get_current_user

router = APIRouter()
MAX_PAGE = 200
MAX_EXPORT = 5000


async def _admin(request: Request, permission: str = "players.read") -> dict:
    user = await get_current_user(request, request.app.state.db)
    return permissions.ensure(user, permission)


async def _load(db, include_deactivated=False):
    base = {"role": {"$nin": ["admin", "city_admin"]}}
    if not include_deactivated:
        base["is_active"] = {"$ne": False}
    users = await db.users.find(
        base,
        {"name": 1, "email": 1, "city": 1, "created_at": 1, "email_verified": 1, "profile_complete": 1, "attribution": 1,
         "tags": 1, "suspended_at": 1, "is_active": 1},
    ).to_list(10000)
    leagues = await db.leagues.find({}).to_list(2000)
    regs = await db.player_leagues.find({}).to_list(50000)
    txns = await db.payment_transactions.find({"payment_status": "paid"}).to_list(50000)
    promo_uses = await db.promo_uses.find({}).to_list(50000)
    invites = await db.doubles_invites.find({"status": {"$in": ["pending", "initiator_paid"]}}).to_list(5000)
    played: dict = {}
    for m in await db.matches.find({"status": "completed"}, {"player1_id": 1, "player2_id": 1}).to_list(100000):
        for pid in (m.get("player1_id"), m.get("player2_id")):
            if pid:
                played[str(pid)] = played.get(str(pid), 0) + 1
    return users, leagues, regs, txns, promo_uses, invites, played


def _attach_crm(rows, users):
    by_id = {str(u["_id"]): u for u in users}
    for r in rows:
        u = by_id.get(r["id"], {})
        r["tags"] = sorted(u.get("tags") or [])
        r["status"] = crm.status_of(u)
    return rows


def _filter(rows, segment, q, city, league_id, not_in_league, regs, leagues, tag=None, status=None):
    if segment not in pi.SEGMENTS:
        raise HTTPException(status_code=400, detail="Unknown segment")
    if status and status not in crm.STATUSES:
        raise HTTPException(status_code=400, detail="Unknown status")
    if tag:
        rows = [r for r in rows if tag.strip().lower() in r.get("tags", [])]
    if status:
        rows = [r for r in rows if r.get("status") == status]
    rows = [r for r in rows if pi.in_segment(r, segment)]
    if q:
        needle = q.strip().lower()
        rows = [r for r in rows if needle in r["name"].lower() or needle in r["email"].lower()]
    if city:
        rows = [r for r in rows if r["city"].strip().lower() == city.strip().lower()]
    if league_id:
        rows = [r for r in rows if any(j["league_id"] == league_id for j in r["leagues"])]
    if not_in_league:
        lg = next((x for x in leagues if str(x["_id"]) == not_in_league), None)
        if not lg:
            raise HTTPException(status_code=404, detail="League not found")
        lcity = (lg.get("city") or "").strip().lower()
        rows = [r for r in rows if r["city"].strip().lower() == lcity and not any(j["league_id"] == not_in_league for j in r["leagues"])]
    return rows


@router.get("/overview")
async def overview(request: Request):
    """Funnel, segment counts, one row per league and promo code usage."""
    await _admin(request)
    db = request.app.state.db
    users, leagues, regs, txns, promo_uses, invites, played = await _load(db)
    rows = pi.build_player_rows(users, regs, leagues, txns, promo_uses, played, invites)
    codes = await db.promo_codes.find({}).to_list(500)
    return {
        "total_players": len(rows),
        "funnel": pi.funnel(rows),
        "segments": [{"id": k, "label": v, "count": sum(pi.in_segment(r, k) for r in rows)} for k, v in pi.SEGMENTS.items()],
        "leagues": pi.league_summary(leagues, regs, txns, promo_uses, users, invites),
        "promos": pi.promo_summary(promo_uses, codes),
        "revenue": round(sum(r["total_paid"] for r in rows), 2),
    }


@router.get("")
async def players(request: Request, segment: str = "all", q: Optional[str] = None, city: Optional[str] = None,
                  league_id: Optional[str] = None, not_in_league: Optional[str] = None, tag: Optional[str] = None,
                  status: Optional[str] = None, skip: int = 0, limit: int = 50):
    await _admin(request)
    db = request.app.state.db
    users, leagues, regs, txns, promo_uses, invites, played = await _load(db, include_deactivated=status == "deactivated")
    rows = _attach_crm(pi.build_player_rows(users, regs, leagues, txns, promo_uses, played, invites), users)
    rows = _filter(rows, segment, q, city, league_id, not_in_league, regs, leagues, tag, status)
    limit = max(1, min(limit, MAX_PAGE))
    return {"total": len(rows), "players": rows[max(0, skip):max(0, skip) + limit]}


def _cell(v):
    s = str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s   # a spreadsheet must not run a name as a formula


@router.get("/export.csv")
async def export(request: Request, segment: str = "all", q: Optional[str] = None, city: Optional[str] = None,
                 league_id: Optional[str] = None, not_in_league: Optional[str] = None, tag: Optional[str] = None,
                 status: Optional[str] = None):
    admin = await _admin(request, "players.export")
    db = request.app.state.db
    users, leagues, regs, txns, promo_uses, invites, played = await _load(db, include_deactivated=status == "deactivated")
    rows = _attach_crm(pi.build_player_rows(users, regs, leagues, txns, promo_uses, played, invites), users)
    rows = _filter(rows, segment, q, city, league_id, not_in_league, regs, leagues, tag, status)[:MAX_EXPORT]
    await audit_log.record(db, admin, "player.export", "players", segment, "players CSV",
                           meta={"rows": len(rows), "segment": segment, "q": q, "city": city, "league_id": league_id}, request=request)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(pi.CSV_COLUMNS)
    for r in rows:
        w.writerow([_cell(c) for c in pi.csv_row(r)])
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="players-{segment}.csv"'})
