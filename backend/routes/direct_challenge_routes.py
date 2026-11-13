"""Direct player challenges: invite, schedule, score, confirm. See direct_challenge.py for the rules.

/api/challenges            player endpoints
/api/inbox                 the player's in-app notifications
/api/admin/direct-challenges   disputed results
"""
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

import audit_log
import challenge_invite as ci
import direct_challenge as dc
import notification_center
from auth_utils import get_current_user, require_admin

router = APIRouter()
inbox_router = APIRouter()
admin_router = APIRouter()


def _is_admin(user: dict) -> bool:
    return user.get("role") in ("admin", "city_admin")


def _wrap(fn):
    """Turn domain errors into HTTP errors."""
    async def run(*a, **kw):
        try:
            return await fn(*a, **kw)
        except dc.ChallengeError as e:
            raise HTTPException(status_code=e.status, detail=e.detail)
    return run


async def _load_visible(db, challenge_id: str, user: dict) -> dict:
    ch = await _wrap(dc.load)(db, challenge_id)
    if dc.side_of(ch, user["_id"]) is None and not _is_admin(user):
        raise HTTPException(status_code=403, detail="You are not a player in this challenge")
    return ch


async def _respond(db, ch: dict, user: dict) -> dict:
    return dc.view(await dc.load(db, str(ch["_id"])), user["_id"], _is_admin(user))


# ── Models ────────────────────────────────────────────────────────────────────

class CreateIn(BaseModel):
    opponent_id: str
    sport: str
    format: str = "singles"
    partner_id: Optional[str] = None
    message: Optional[str] = Field(default=None, max_length=500)


class EmailInviteIn(BaseModel):
    email: str = Field(max_length=200)
    sport: str
    format: str = "singles"
    partner_id: Optional[str] = None
    message: Optional[str] = Field(default=None, max_length=500)


class ClaimIn(BaseModel):
    token: str = Field(max_length=100)


class AcceptIn(BaseModel):
    partner_id: Optional[str] = None


class ProposeIn(BaseModel):
    when: str
    venue: str = Field(max_length=200)
    note: Optional[str] = Field(default=None, max_length=300)


class RespondIn(BaseModel):
    action: str


class SetIn(BaseModel):
    a: int
    b: int


class ScoreIn(BaseModel):
    sets: List[SetIn] = Field(min_length=1, max_length=10)


class DisputeIn(BaseModel):
    reason: str = Field(max_length=1000)


class ResolveIn(BaseModel):
    action: str
    sets: Optional[List[SetIn]] = None


# ── Player endpoints (fixed paths before /{id}) ───────────────────────────────

@router.get("/players")
async def find_players(request: Request, q: str = "", sport: str = "tennis", format: Optional[str] = None,
                       city: Optional[str] = None, min_level: Optional[float] = None,
                       max_level: Optional[float] = None, limit: int = 20):
    """Find players to challenge. Only public profiles appear; email is never returned."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    return await dc.search_players(db, user, q, sport, format, city, min_level, max_level, limit)


@router.get("/stats/me")
async def my_stats(request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    return await dc.stats(db, user["_id"])


@router.get("/stats/{player_id}")
async def player_stats(player_id: str, request: Request):
    """A player's challenge record, with your head-to-head against them."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    if not ObjectId.is_valid(player_id):
        raise HTTPException(status_code=404, detail="Player not found")
    target = await db.users.find_one({"_id": ObjectId(player_id)})
    if not target or target.get("profile_public", True) is False:
        raise HTTPException(status_code=404, detail="Player not found")
    return await dc.stats(db, player_id, vs=user["_id"])


@router.get("/open-count")
async def open_count(request: Request):
    """Challenges waiting on you: a badge for the dashboard."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    groups = await dc.mine(db, user)
    waiting = len(groups["received"]) + sum(1 for c in groups["active"] if c["needs_my_action"])
    return {"waiting": waiting}


@router.post("/email-invites")
async def send_email_invite(body: EmailInviteIn, request: Request):
    """Challenge someone by email. The answer is the same whether or not the address has an account."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    await _wrap(ci.send)(db, user, body.model_dump())
    return {"ok": True, "message": "Challenge sent. If they are not on VenLax yet, they get an email asking them to join."}


@router.get("/email-invites")
async def waiting_email_invites(request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    return await ci.list_waiting(db, user)


@router.get("/email-invites/preview")
async def email_invite_preview(token: str, request: Request):
    """Public: what the invitation link shows before the person signs up."""
    return await ci.preview_by_token(request.app.state.db, token)


@router.post("/email-invites/claim")
async def claim_email_invite(body: ClaimIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    inv = await _wrap(ci.claim)(db, user, body.token)
    return {"challenge_id": inv["challenge_id"]}


@router.get("/email-invites/unsubscribe", response_class=HTMLResponse)
async def email_invite_unsubscribe(token: str, request: Request):
    ok = await ci.unsubscribe(request.app.state.db, token)
    msg = ("You will not get any more challenge emails from VenLax Sports at this address." if ok
           else "This unsubscribe link is not valid. Reply to the email and we will remove you.")
    return HTMLResponse("<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'>"
                        "<body style='font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;color:#3D3D3D'>"
                        f"<h2>VenLax Sports</h2><p>{msg}</p></body>")


@router.post("/email-invites/{invite_id}/cancel")
async def cancel_email_invite(invite_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    await _wrap(ci.cancel)(db, user, invite_id)
    return {"ok": True}


@router.post("/email-invites/{invite_id}/resend")
async def resend_email_invite(invite_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    await _wrap(ci.resend)(db, user, invite_id)
    return {"ok": True}


@router.post("")
@router.post("/")
async def create_challenge(body: CreateIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ch = await _wrap(dc.create)(db, user, body.model_dump())
    return dc.view(ch, user["_id"])


@router.get("")
@router.get("/")
async def my_challenges(request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    out = await dc.mine(db, user)
    out["waiting"] = await ci.list_waiting(db, user)      # emailed to people who have not joined yet
    return out


@router.get("/{challenge_id}")
async def get_challenge(challenge_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ch = await _load_visible(db, challenge_id, user)
    return dc.view(ch, user["_id"], _is_admin(user))


@router.post("/{challenge_id}/accept")
async def accept(challenge_id: str, body: AcceptIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ch = await _load_visible(db, challenge_id, user)
    await _wrap(dc.accept)(db, ch, user, body.partner_id)
    return await _respond(db, ch, user)


@router.post("/{challenge_id}/decline")
async def decline(challenge_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ch = await _load_visible(db, challenge_id, user)
    await _wrap(dc.decline)(db, ch, user)
    return await _respond(db, ch, user)


@router.post("/{challenge_id}/cancel")
async def cancel(challenge_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ch = await _load_visible(db, challenge_id, user)
    await _wrap(dc.cancel)(db, ch, user, _is_admin(user))
    return await _respond(db, ch, user)


@router.post("/{challenge_id}/propose")
async def propose(challenge_id: str, body: ProposeIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ch = await _load_visible(db, challenge_id, user)
    await _wrap(dc.propose)(db, ch, user, body.when, body.venue, body.note)
    return await _respond(db, ch, user)


@router.post("/{challenge_id}/proposals/{proposal_id}/respond")
async def respond_to_proposal(challenge_id: str, proposal_id: str, body: RespondIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ch = await _load_visible(db, challenge_id, user)
    await _wrap(dc.respond)(db, ch, user, proposal_id, body.action)
    return await _respond(db, ch, user)


@router.post("/{challenge_id}/score")
async def submit_score(challenge_id: str, body: ScoreIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ch = await _load_visible(db, challenge_id, user)
    await _wrap(dc.submit_score)(db, ch, user, [s.model_dump() for s in body.sets])
    return await _respond(db, ch, user)


@router.post("/{challenge_id}/confirm")
async def confirm(challenge_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ch = await _load_visible(db, challenge_id, user)
    await _wrap(dc.confirm_score)(db, ch, user)
    return await _respond(db, ch, user)


@router.post("/{challenge_id}/dispute")
async def dispute(challenge_id: str, body: DisputeIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ch = await _load_visible(db, challenge_id, user)
    await _wrap(dc.dispute_score)(db, ch, user, body.reason)
    return await _respond(db, ch, user)


# ── In-app notifications ──────────────────────────────────────────────────────

@inbox_router.get("")
@inbox_router.get("/")
async def inbox(request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    return await notification_center.list_for(db, user["_id"])


@inbox_router.post("/read-all")
async def read_all(request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    await notification_center.mark_read(db, user["_id"])
    return {"ok": True}


@inbox_router.post("/{notification_id}/read")
async def read_one(notification_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    await notification_center.mark_read(db, user["_id"], notification_id)
    return {"ok": True}


# ── Admin: disputes ───────────────────────────────────────────────────────────

@admin_router.get("")
@admin_router.get("/")
async def admin_list(request: Request, status: str = "disputed"):
    db = request.app.state.db
    admin = await require_admin(request, db)
    rows = await db.direct_challenges.find({"status": status}).sort("updated_at", -1).to_list(200)
    return [dc.view(c, admin["_id"], True) for c in rows]


@admin_router.post("/{challenge_id}/resolve")
async def admin_resolve(challenge_id: str, body: ResolveIn, request: Request):
    db = request.app.state.db
    admin = await require_admin(request, db)
    ch = await _wrap(dc.load)(db, challenge_id)
    sets = [s.model_dump() for s in body.sets] if body.sets else None
    await _wrap(dc.admin_resolve)(db, ch, admin, body.action, sets)
    await audit_log.record(db, admin, "challenge.resolve", "direct_challenge", challenge_id,
                           " vs ".join(ch["names"].get(p, "") for p in (ch["challenger_id"], ch["challenged_id"])),
                           after={"action": body.action}, request=request)
    return dc.view(await dc.load(db, challenge_id), admin["_id"], True)
