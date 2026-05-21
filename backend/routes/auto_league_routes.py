"""Auto-generate leagues for monthly / quarterly / half-yearly / yearly cadences.

Each cadence × active sport × format produces ONE league per cycle, open to
players in any city across the active country (Phase 1: USA).
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional
from bson import ObjectId

from auth_utils import require_admin
from phase_config import ACTIVE_SPORTS, ACTIVE_COUNTRY, CURRENCY
from pricing_config import CADENCES, fee_for_format, ALL_CITIES_LABEL

router = APIRouter()

FORMATS_BY_SPORT = {
    "tennis": ["singles", "doubles", "mixed"],
    "pickleball": ["singles", "doubles", "mixed"],
    "cricket": ["T20"],  # only when phase 2+ activates cricket
}


class AutoGenerateIn(BaseModel):
    cadence: str  # monthly | quarterly | half_yearly | yearly | all
    start_date: Optional[str] = None  # ISO date; defaults to today
    sports: Optional[list[str]] = None  # defaults to ACTIVE_SPORTS


def _add_months(d: datetime, months: int) -> datetime:
    """Naive month-add (handles year rollover, ignores end-of-month edge cases)."""
    new_month = d.month - 1 + months
    new_year = d.year + new_month // 12
    new_month = new_month % 12 + 1
    new_day = min(d.day, 28)  # safe for Feb
    return d.replace(year=new_year, month=new_month, day=new_day)


def _league_name(sport: str, fmt: str, cadence: str, start: datetime) -> str:
    sport_label = sport.title()
    fmt_label = fmt.title()
    cadence_label = CADENCES[cadence]["label"]
    period = start.strftime("%b %Y") if cadence == "monthly" else start.strftime("Q%q %Y") if cadence == "quarterly" else start.strftime("%Y")
    # %q isn't a real strftime — compute quarter manually
    if cadence == "quarterly":
        q = (start.month - 1) // 3 + 1
        period = f"Q{q} {start.year}"
    elif cadence == "half_yearly":
        h = "H1" if start.month <= 6 else "H2"
        period = f"{h} {start.year}"
    return f"USA {cadence_label} {sport_label} {fmt_label} — {period}"


@router.post("/leagues")
async def auto_generate_leagues(data: AutoGenerateIn, request: Request):
    """Generate the next cycle of leagues for the given cadence (or all cadences if 'all').

    Idempotent — if a league for this cadence/sport/format/start_date already exists,
    it is skipped.
    """
    db = request.app.state.db
    admin = await require_admin(request, db)

    cadences = list(CADENCES.keys()) if data.cadence == "all" else [data.cadence]
    for c in cadences:
        if c not in CADENCES:
            raise HTTPException(status_code=400, detail=f"Unknown cadence: {c}")

    sports = data.sports or ACTIVE_SPORTS
    for s in sports:
        if s not in ACTIVE_SPORTS:
            raise HTTPException(status_code=400, detail=f"Sport '{s}' not active in current phase")

    if data.start_date:
        start_dt = datetime.fromisoformat(data.start_date)
    else:
        start_dt = datetime.now(timezone.utc)
    # Use the first day of the period for tidy naming
    start_dt = start_dt.replace(day=1)

    now_iso = datetime.now(timezone.utc).isoformat()
    created: list[dict] = []
    skipped: list[str] = []

    for cadence in cadences:
        months = CADENCES[cadence]["months"]
        end_dt = _add_months(start_dt, months) - timedelta(days=1)

        for sport in sports:
            for fmt in FORMATS_BY_SPORT.get(sport, []):
                name = _league_name(sport, fmt, cadence, start_dt)
                # Idempotency check — same cadence/sport/format/start_date
                existing = await db.leagues.find_one({
                    "auto_cadence": cadence,
                    "sport": sport,
                    "format": fmt,
                    "start_date": start_dt.strftime("%Y-%m-%d"),
                })
                if existing:
                    skipped.append(name)
                    continue

                fee = fee_for_format(fmt)
                cadence_label = CADENCES[cadence]["label"]
                doc = {
                    "name": name,
                    "sport": sport,
                    "country": ACTIVE_COUNTRY,
                    "city": ALL_CITIES_LABEL,
                    "format": fmt,
                    "entry_fee": fee,
                    "currency": CURRENCY,
                    "max_players": 32 if cadence == "yearly" else 16,
                    "current_players": 0,
                    "start_date": start_dt.strftime("%Y-%m-%d"),
                    "end_date": end_dt.strftime("%Y-%m-%d"),
                    "status": "registration",
                    "admin_id": str(admin["_id"]),
                    "description": (
                        f"Open {cadence_label} {sport.title()} {fmt} league — players from any USA city welcome. "
                        f"Standardized entry fee of ${fee:.2f}."
                    ),
                    "venue": "Multiple — see league page",
                    "season": CADENCES[cadence]["season_label"],
                    "auto_generated": True,
                    "auto_cadence": cadence,
                    "created_at": now_iso,
                }
                result = await db.leagues.insert_one(doc)
                created.append({"id": str(result.inserted_id), "name": name, "fee": fee})

                if doc.get("league_type") == "round_robin":
                    try:
                        from routes.round_robin_routes import _run_generate_schedule
                        await _run_generate_schedule(db, str(result.inserted_id))
                    except Exception as _exc:
                        import logging as _log
                        _log.getLogger(__name__).warning(
                            "Auto-schedule for RR league %s failed: %s",
                            result.inserted_id, _exc,
                        )

    return {
        "message": f"Auto-generated {len(created)} leagues, skipped {len(skipped)} existing",
        "created": created,
        "skipped": skipped,
    }


@router.post("/normalize-pricing")
async def normalize_existing_pricing(request: Request):
    """One-shot: update entry_fee on existing tennis/pickleball leagues to match the
    standardized pricing tiers. Cricket leagues are not touched.
    """
    db = request.app.state.db
    await require_admin(request, db)
    updated = 0
    cursor = db.leagues.find({"sport": {"$in": ["tennis", "pickleball"]}})
    async for l in cursor:
        new_fee = fee_for_format(l.get("format", "singles"))
        if abs(float(l.get("entry_fee", 0)) - new_fee) > 0.001:
            await db.leagues.update_one(
                {"_id": l["_id"]},
                {"$set": {"entry_fee": new_fee, "currency": "USD",
                          "updated_at": datetime.now(timezone.utc).isoformat()}},
            )
            updated += 1
    return {"message": f"Normalized pricing on {updated} leagues"}
