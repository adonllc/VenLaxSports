"""Community ladders (player-created). See community_ladder.py for the rules.

Official, admin-created ladders stay in ladder_routes.py and are not changed by anything here.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

import audit_log
import community_ladder as cl
import direct_challenge as dc
from auth_utils import get_current_user, get_optional_user

router = APIRouter()


def _wrap(fn):
    """Turn domain errors into HTTP errors."""
    async def run(*a, **kw):
        try:
            return await fn(*a, **kw)
        except dc.ChallengeError as e:
            raise HTTPException(status_code=e.status, detail=e.detail)
    return run


async def _audit_admin(db, user: dict, request: Request, ladder: dict, action: str, reason: str = "") -> None:
    """Admin moderation of someone else's ladder goes in the audit log."""
    if cl.is_admin(user) and not cl.is_owner(ladder, user):
        await audit_log.record(db, user, f"community_ladder.{action}", "ladder", str(ladder["_id"]), ladder["name"],
                               meta={"reason": reason}, request=request)


# ── Models ────────────────────────────────────────────────────────────────────

class LadderIn(BaseModel):
    name: str = Field(max_length=60)
    sport: str
    format: str = "singles"
    division_label: str
    city: str = Field(max_length=80)
    zip_code: Optional[str] = None
    max_participants: int = 16
    visibility: str = "public"
    join_mode: str = "open"
    ranking_method: str = "leapfrog"
    duration_days: int = 60
    description: Optional[str] = Field(default=None, max_length=500)


class LadderPatch(BaseModel):
    name: Optional[str] = Field(default=None, max_length=60)
    sport: Optional[str] = None
    format: Optional[str] = None
    division_label: Optional[str] = None
    city: Optional[str] = Field(default=None, max_length=80)
    zip_code: Optional[str] = None
    max_participants: Optional[int] = None
    visibility: Optional[str] = None
    join_mode: Optional[str] = None
    ranking_method: Optional[str] = None
    duration_days: Optional[int] = None
    description: Optional[str] = Field(default=None, max_length=500)


class PartnerIn(BaseModel):
    partner_id: Optional[str] = None


class InviteIn(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = Field(default=None, max_length=200)


class TokenIn(BaseModel):
    token: str
    action: str = "accept"
    partner_id: Optional[str] = None


class ChallengeIn(BaseModel):
    opponent_id: str
    message: Optional[str] = Field(default=None, max_length=500)


class ReasonIn(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=200)


class AnswerIn(BaseModel):
    action: str


# ── Create, review, publish ───────────────────────────────────────────────────

@router.post("")
@router.post("/")
async def create_ladder(body: LadderIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ladder = await _wrap(cl.create_draft)(db, user, body.model_dump())
    return await cl.view(db, ladder, user)


@router.get("/mine")
async def my_ladders(request: Request):
    """Ladders you run or play in, newest first."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    uid = user["_id"]
    rows = await db.ladders.find({"type": "community"}).sort("updated_at", -1).to_list(300)
    out = []
    for ladder in rows:
        me = cl.member_entry(ladder, uid)
        if ladder["owner_id"] != uid and not me:
            continue
        out.append({"id": str(ladder["_id"]), "name": ladder["name"], "sport": ladder["sport"], "format": ladder["format"],
                    "status": ladder["status"], "city": ladder["city"], "is_owner": ladder["owner_id"] == uid,
                    "my_rank": me.get("rank") if me else None, "participants": len(cl.lr.live(ladder.get("entries", [])))})
    return out


@router.get("/invites/preview")
async def preview_invite(request: Request, token: str):
    """What an invitation or share link points at. No login needed: people read this before they sign up."""
    db = request.app.state.db
    found = await cl.resolve_token(db, token)
    if not found or found[2]["status"] in ("draft", "expired"):
        raise HTTPException(status_code=404, detail="This invitation is not valid any more")
    kind, invite, ladder = found
    return cl.preview(ladder, invite)


@router.post("/join-with-token")
async def join_with_token(body: TokenIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ladder = await _wrap(cl.join_with_token)(db, user, body.token, body.action, body.partner_id)
    return {"id": str(ladder["_id"]), "action": body.action}


@router.get("/{ladder_id}")
async def get_ladder(ladder_id: str, request: Request, token: Optional[str] = None):
    db = request.app.state.db
    viewer = await get_optional_user(request, db)
    ladder = await _wrap(cl.load)(db, ladder_id)
    token_ok = False
    if token:
        found = await cl.resolve_token(db, token)
        token_ok = bool(found and str(found[2]["_id"]) == ladder_id)
    if not cl.can_view(ladder, viewer, token_ok):
        raise HTTPException(status_code=404, detail="Ladder not found")   # private ladders do not admit they exist
    return await cl.view(db, ladder, viewer)


@router.get("/{ladder_id}/history")
async def ranking_history(ladder_id: str, request: Request):
    """Every applied result with the standings before and after: the ranking audit trail."""
    db = request.app.state.db
    viewer = await get_optional_user(request, db)
    ladder = await _wrap(cl.load)(db, ladder_id)
    if not cl.can_view(ladder, viewer):
        raise HTTPException(status_code=404, detail="Ladder not found")
    return await cl.history(db, ladder)


@router.patch("/{ladder_id}")
async def update_ladder(ladder_id: str, body: LadderPatch, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ladder = await _wrap(cl.load)(db, ladder_id)
    await _wrap(cl.update_settings)(db, ladder, user, body.model_dump(exclude_unset=True))
    await _audit_admin(db, user, request, ladder, "update")
    return await cl.view(db, ladder, user)


@router.post("/{ladder_id}/publish")
async def publish(ladder_id: str, body: PartnerIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ladder = await _wrap(cl.load)(db, ladder_id)
    await _wrap(cl.publish)(db, ladder, user, body.partner_id)
    return await cl.view(db, ladder, user)


# ── Invitations and joining ───────────────────────────────────────────────────

@router.post("/{ladder_id}/invites")
async def invite(ladder_id: str, body: InviteIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ladder = await _wrap(cl.load)(db, ladder_id)
    if body.user_id:
        await _wrap(cl.invite_user)(db, ladder, user, body.user_id)
    elif body.email:
        await _wrap(cl.invite_email)(db, ladder, user, body.email)
    else:
        raise HTTPException(status_code=400, detail="Pick a player or enter an email")
    return await cl.view(db, ladder, user)


@router.post("/{ladder_id}/invites/{invite_id}/revoke")
async def revoke(ladder_id: str, invite_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ladder = await _wrap(cl.load)(db, ladder_id)
    await _wrap(cl.revoke_invite)(db, ladder, user, invite_id)
    return await cl.view(db, ladder, user)


@router.post("/{ladder_id}/link/rotate")
async def rotate_link(ladder_id: str, request: Request):
    """Make a new share link. The old one stops working."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    ladder = await _wrap(cl.load)(db, ladder_id)
    await _wrap(cl.rotate_link)(db, ladder, user)
    return await cl.view(db, ladder, user)


@router.post("/{ladder_id}/join")
async def join(ladder_id: str, body: PartnerIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ladder = await _wrap(cl.load)(db, ladder_id)
    if not cl.can_view(ladder, user):
        raise HTTPException(status_code=404, detail="Ladder not found")
    return await _wrap(cl.join_public)(db, ladder, user, body.partner_id)


@router.post("/{ladder_id}/requests/{request_id}")
async def answer_request(ladder_id: str, request_id: str, body: AnswerIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ladder = await _wrap(cl.load)(db, ladder_id)
    await _wrap(cl.answer_request)(db, ladder, user, request_id, body.action)
    return await cl.view(db, ladder, user)


@router.post("/{ladder_id}/withdraw")
async def withdraw(ladder_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ladder = await _wrap(cl.load)(db, ladder_id)
    await _wrap(cl.withdraw)(db, ladder, user)
    return await cl.view(db, ladder, user)


@router.post("/{ladder_id}/participants/{player_id}/remove")
async def remove_participant(ladder_id: str, player_id: str, body: ReasonIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ladder = await _wrap(cl.load)(db, ladder_id)
    await _wrap(cl.remove_participant)(db, ladder, user, player_id, body.reason or "")
    await _audit_admin(db, user, request, ladder, "remove_participant", body.reason or "")
    return await cl.view(db, ladder, user)


# ── Status ────────────────────────────────────────────────────────────────────

@router.post("/{ladder_id}/pause")
async def pause(ladder_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ladder = await _wrap(cl.load)(db, ladder_id)
    await _wrap(cl.set_paused)(db, ladder, user, True)
    await _audit_admin(db, user, request, ladder, "pause")
    return await cl.view(db, ladder, user)


@router.post("/{ladder_id}/resume")
async def resume(ladder_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ladder = await _wrap(cl.load)(db, ladder_id)
    await _wrap(cl.set_paused)(db, ladder, user, False)
    await _audit_admin(db, user, request, ladder, "resume")
    return await cl.view(db, ladder, user)


@router.post("/{ladder_id}/close")
async def close(ladder_id: str, body: ReasonIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ladder = await _wrap(cl.load)(db, ladder_id)
    reason = body.reason or ("closed by an admin" if cl.is_admin(user) and not cl.is_owner(ladder, user) else "closed by the creator")
    await _wrap(cl.close)(db, ladder, user, reason)
    await _audit_admin(db, user, request, ladder, "close", reason)
    return await cl.view(db, ladder, user)


# ── Challenges ────────────────────────────────────────────────────────────────

@router.post("/{ladder_id}/challenges")
async def challenge(ladder_id: str, body: ChallengeIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    ladder = await _wrap(cl.load)(db, ladder_id)
    ch = await _wrap(cl.challenge)(db, ladder, user, body.opponent_id, body.message)
    return dc.view(ch, user["_id"])


# ── Admin moderation list ─────────────────────────────────────────────────────

@router.get("/admin/all")
async def admin_list(request: Request):
    """Every community ladder, for the admin panel."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    if not cl.is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    rows = await db.ladders.find({"type": "community"}).sort("updated_at", -1).to_list(500)
    return [{"id": str(r["_id"]), "name": r["name"], "owner_name": r.get("owner_name", ""), "sport": r["sport"], "format": r["format"],
             "city": r["city"], "status": r["status"], "visibility": r["visibility"], "ranking_method": r["ranking_method"],
             "participants": len(cl.lr.live(r.get("entries", []))), "max_participants": r["max_participants"],
             "created_at": r["created_at"]} for r in rows]
