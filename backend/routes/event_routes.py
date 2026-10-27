"""POST /api/events: the browser reports a funnel stage. Public, tiny, rate limited, stores no visitor identity."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

import funnel_events
from auth_utils import check_rate_limit, get_optional_user, record_attempt

router = APIRouter()


class EventIn(BaseModel):
    event: str
    sport: str = ""
    league_id: str = ""


@router.post("", status_code=202)
async def track(body: EventIn, request: Request):
    db = request.app.state.db
    ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "x"))
    key = f"evt:{ip}"                      # only the rate limiter sees the address, and its rows expire on their own
    await check_rate_limit(db, key, max_attempts=60, window_minutes=15)
    try:
        user = await get_optional_user(request, db)
        doc = funnel_events.build(body.event, body.sport, body.league_id, str(user["_id"]) if user else "")
    except funnel_events.EventError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await record_attempt(db, key, window_minutes=15)
    await db.funnel_events.insert_one(doc)
    return {"ok": True}
