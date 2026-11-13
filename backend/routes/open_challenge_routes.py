"""Open Challenge Board. See open_challenge.py for the rules.

/api/open-challenges           player endpoints
/api/admin/open-challenges     moderation
"""
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

import audit_log
import direct_challenge as dc
import open_challenge as oc
from auth_utils import get_current_user, get_optional_user, require_admin
from bson import ObjectId

router = APIRouter()
admin_router = APIRouter()


def _wrap(fn):
    async def run(*a, **kw):
        try:
            return await fn(*a, **kw)
        except dc.ChallengeError as e:
            raise HTTPException(status_code=e.status, detail=e.detail)
    return run


class PostIn(BaseModel):
    sport: str
    format: str = "singles"
    level: Optional[float] = None
    min_level: Optional[float] = None
    max_level: Optional[float] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    venue: str = Field(default="", max_length=120)
    court_pref: Optional[str] = "any"
    date: str
    time_window: Optional[str] = "any"
    start_time: Optional[str] = None
    availability: List[str] = []
    notes: Optional[str] = Field(default=None, max_length=500)
    visibility: Optional[str] = "public"
    max_distance_miles: Optional[int] = None
    partner_id: Optional[str] = None
    publish: bool = True


class PatchIn(BaseModel):
    sport: Optional[str] = None
    format: Optional[str] = None
    level: Optional[float] = None
    min_level: Optional[float] = None
    max_level: Optional[float] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    venue: Optional[str] = Field(default=None, max_length=120)
    court_pref: Optional[str] = None
    date: Optional[str] = None
    time_window: Optional[str] = None
    start_time: Optional[str] = None
    availability: Optional[List[str]] = None
    notes: Optional[str] = Field(default=None, max_length=500)
    visibility: Optional[str] = None
    max_distance_miles: Optional[int] = None
    partner_id: Optional[str] = None


class AcceptIn(BaseModel):
    partner_id: Optional[str] = None


class ShareIn(BaseModel):
    emails: List[str] = Field(min_length=1, max_length=5)


class ReportIn(BaseModel):
    reason: str = Field(max_length=500)


class RemoveIn(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=300)


async def _load(db, post_id: str, user: dict) -> dict:
    """Load a post the user is allowed to know exists: their own, one they accepted, an open public/link one, or any for admins."""
    post = await _wrap(oc.load)(db, post_id)
    uid = user["_id"]
    if post["owner_id"] == uid or post.get("acceptor_id") == uid or oc.is_admin(user):
        return post
    # Everyone else may only see a post that is still open: once it is taken, its details are private to the two players.
    if post["status"] != "open" or post["owner_id"] in await oc.blocked_ids(db, uid):
        raise HTTPException(status_code=404, detail="Challenge not found")
    return post


async def _one(db, post: dict, user: dict) -> dict:
    post = await oc.load(db, str(post["_id"]))
    ch = await db.direct_challenges.find_one({"open_id": str(post["_id"])}) if post["status"] == "accepted" else None
    return await oc.view(db, post, user, ch=ch)


# ── Fixed paths first ─────────────────────────────────────────────────────────

@router.get("")
@router.get("/")
async def browse(request: Request, sport: Optional[str] = None, format: Optional[str] = None, city: Optional[str] = None,
                 zip_code: Optional[str] = None, date: Optional[str] = None, time_window: Optional[str] = None,
                 min_level: Optional[float] = None, max_level: Optional[float] = None, near: Optional[str] = None,
                 q: Optional[str] = None):
    db = request.app.state.db
    user = await get_current_user(request, db)
    return await oc.browse(db, user, {
        "sport": sport, "format": format, "city": city, "zip_code": zip_code, "date": date, "time_window": time_window,
        "min_level": min_level, "max_level": max_level, "near": near, "q": q})


@router.get("/mine")
async def mine(request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    return await oc.mine(db, user)


@router.get("/blocks")
async def blocks(request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    return await oc.my_blocks(db, user)


@router.post("/blocks/{player_id}")
async def block_player(player_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    await _wrap(oc.block)(db, user, player_id)
    return {"ok": True}


@router.delete("/blocks/{player_id}")
async def unblock_player(player_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    await oc.unblock(db, user, player_id)
    return {"ok": True}


@router.get("/public/{post_id}")
async def public_view(post_id: str, request: Request):
    """The shareable link. Works signed out: a visitor sees a teaser and a sign-up prompt, never contact details."""
    db = request.app.state.db
    post = await _wrap(oc.load)(db, post_id)
    if post["status"] in ("draft", "removed"):      # link_only posts are still reachable by their link
        raise HTTPException(status_code=404, detail="Challenge not found")
    owner = await db.users.find_one({"_id": ObjectId(post["owner_id"])}) or {}
    viewer = await get_optional_user(request, db)
    out = oc.public_preview(post, owner)
    out["signed_in"] = bool(viewer)
    out["is_mine"] = bool(viewer) and viewer["_id"] == post["owner_id"]
    return out


@router.post("")
@router.post("/")
async def create(body: PostIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    data = body.model_dump()
    publish = data.pop("publish")
    post = await _wrap(oc.create)(db, user, data, publish)
    return await _one(db, post, user)


# ── One post ──────────────────────────────────────────────────────────────────

@router.get("/{post_id}")
async def get_post(post_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    post = await _load(db, post_id, user)
    return await _one(db, post, user)


@router.patch("/{post_id}")
async def edit_post(post_id: str, body: PatchIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    post = await _load(db, post_id, user)
    await _wrap(oc.edit)(db, post, user, body.model_dump(exclude_unset=True))
    return await _one(db, post, user)


@router.post("/{post_id}/publish")
async def publish_post(post_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    post = await _load(db, post_id, user)
    await _wrap(oc.go_live)(db, post, user)
    return await _one(db, post, user)


@router.post("/{post_id}/pause")
async def pause_post(post_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    post = await _load(db, post_id, user)
    await _wrap(oc.set_paused)(db, post, user, True)
    return await _one(db, post, user)


@router.post("/{post_id}/resume")
async def resume_post(post_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    post = await _load(db, post_id, user)
    await _wrap(oc.set_paused)(db, post, user, False)
    return await _one(db, post, user)


@router.post("/{post_id}/cancel")
async def cancel_post(post_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    post = await _load(db, post_id, user)
    await _wrap(oc.withdraw)(db, post, user, "cancelled")
    return await _one(db, post, user)


@router.post("/{post_id}/close")
async def close_post(post_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    post = await _load(db, post_id, user)
    await _wrap(oc.withdraw)(db, post, user, "closed")
    return await _one(db, post, user)


@router.post("/{post_id}/accept")
async def accept_post(post_id: str, body: AcceptIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    post = await _load(db, post_id, user)
    post, ch = await _wrap(oc.accept)(db, post, user, body.partner_id)
    out = await _one(db, post, user)
    out["challenge_id"] = str(ch["_id"])
    return out


@router.post("/{post_id}/share")
async def share_post(post_id: str, body: ShareIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    post = await _load(db, post_id, user)
    sent = await _wrap(oc.share_by_email)(db, post, user, body.emails)
    return {"sent": sent}


@router.post("/{post_id}/report")
async def report_post(post_id: str, body: ReportIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    post = await _load(db, post_id, user)
    await _wrap(oc.report)(db, user, post, body.reason)
    return {"ok": True}


# ── Admin moderation ──────────────────────────────────────────────────────────

@admin_router.get("")
@admin_router.get("/")
async def admin_list(request: Request):
    db = request.app.state.db
    user = await require_admin(request, db)
    return await oc.admin_list(db)


@admin_router.post("/{post_id}/remove")
async def admin_remove(post_id: str, body: RemoveIn, request: Request):
    db = request.app.state.db
    user = await require_admin(request, db)
    post = await _wrap(oc.load)(db, post_id)
    await _wrap(oc.admin_remove)(db, post, user, body.reason or "")
    await audit_log.record(db, user, "open_challenge.remove", "open_challenge", post_id,
                           f"{post['sport']} {post['format']} by {post.get('owner_name')}", meta={"reason": body.reason}, request=request)
    return {"ok": True}


@admin_router.post("/{post_id}/dismiss-reports")
async def admin_dismiss(post_id: str, request: Request):
    db = request.app.state.db
    user = await require_admin(request, db)
    post = await _wrap(oc.load)(db, post_id)
    await oc.admin_dismiss(db, post)
    await audit_log.record(db, user, "open_challenge.dismiss_reports", "open_challenge", post_id, "", request=request)
    return {"ok": True}
