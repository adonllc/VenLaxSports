"""Admin: ambassadors are ordinary users with a memorable referral code (for example ATLCLUB).

Nothing new is tracked: signups arrive through the normal referral flow and the $5/$5 credit is paid only
after the referred player's first confirmed match. This only lets an admin pick the code and see the results.
"""
import re
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

import email_service
from auth_utils import get_current_user

router = APIRouter()

CODE_RE = re.compile(r"^[A-Z0-9_]{3,20}$")


class AmbassadorIn(BaseModel):
    email: str
    code: str
    label: Optional[str] = None


async def _admin(request: Request) -> dict:
    user = await get_current_user(request, request.app.state.db)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def normalize_code(raw: str) -> str:
    code = (raw or "").strip().upper()
    if not CODE_RE.match(code):
        raise HTTPException(status_code=400, detail="Code must be 3 to 20 letters, numbers or underscores")
    if code.startswith("REF_"):
        raise HTTPException(status_code=400, detail="Codes starting with REF_ are reserved for automatic codes")
    return code


def link_for(code: str) -> str:
    base = (email_service._get_frontend_url() or "https://venlaxsports.com").rstrip("/")
    return f"{base}/auth?ref={code}&utm_source=ambassador&utm_medium=referral&utm_campaign={code.lower()}"


@router.post("")
async def make_ambassador(body: AmbassadorIn, request: Request):
    await _admin(request)
    db = request.app.state.db
    code = normalize_code(body.code)
    email = body.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="No account with that email. They need to register first.")

    taken = await db.users.find_one({"$or": [{"referral_code": code}, {"referral_code_aliases": code}]})
    if taken and str(taken["_id"]) != str(user["_id"]):
        raise HTTPException(status_code=409, detail="That code is already used by someone else")

    update: dict = {"$set": {"referral_code": code, "ambassador": {
        "label": (body.label or "").strip()[:80], "since": datetime.now(timezone.utc).isoformat()}}}
    old = user.get("referral_code")
    if old and old != code:
        update["$addToSet"] = {"referral_code_aliases": old}   # links already shared keep working
    await db.users.update_one({"_id": user["_id"]}, update)
    return {"code": code, "link": link_for(code), "email": email}


@router.get("")
async def list_ambassadors(request: Request):
    await _admin(request)
    db = request.app.state.db
    users = await db.users.find({"ambassador": {"$exists": True}}).to_list(200)
    rows = []
    for u in users:
        uid = str(u["_id"])
        credits = await db.referral_credits.find({"referrer_id": uid, "type": {"$ne": "tier_bonus"}}).to_list(None)
        code = u.get("referral_code", "")
        rows.append({
            "user_id": uid,
            "name": u.get("name", ""),
            "email": u.get("email", ""),
            "label": (u.get("ambassador") or {}).get("label", ""),
            "code": code,
            "link": link_for(code),
            "signups": len(credits),
            "first_match_played": len([c for c in credits if c.get("status") == "applied"]),
            "waiting": len([c for c in credits if c.get("status") == "pending"]),
        })
    rows.sort(key=lambda r: -r["signups"])
    return {"ambassadors": rows}


@router.delete("/{user_id}")
async def remove_ambassador(user_id: str, request: Request):
    """Stops listing them as an ambassador. Their code keeps working as an ordinary referral code."""
    await _admin(request)
    db = request.app.state.db
    try:
        res = await db.users.update_one({"_id": ObjectId(user_id)}, {"$unset": {"ambassador": ""}})
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="User not found")
    return {"removed": True}
