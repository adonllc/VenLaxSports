"""Notification subscription routes.

POST /api/notifications/subscribe           — capture city+sport interest (auth optional)
POST /api/notifications/push-subscription  — store browser push endpoint (auth required)
DELETE /api/notifications/unsubscribe      — one-click unsubscribe via signed token
GET /api/notifications/interests           — list current user's active interests
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import List, Optional

import jwt as pyjwt
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr

from auth_utils import get_current_user, get_optional_user, get_jwt_secret, JWT_ALGORITHM

router = APIRouter()
logger = logging.getLogger(__name__)

JWT_UNSUB_TYPE = "unsub"


# ── helpers ──────────────────────────────────────────────────────────────────

def _make_unsub_token(interest_id: str) -> str:
    return pyjwt.encode(
        {"sub": interest_id, "type": JWT_UNSUB_TYPE},
        get_jwt_secret(),
        algorithm=JWT_ALGORITHM,
    )


def _decode_unsub_token(token: str) -> str:
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except pyjwt.InvalidTokenError as e:
        raise HTTPException(status_code=400, detail=f"Invalid unsubscribe token: {e}")
    if payload.get("type") != JWT_UNSUB_TYPE:
        raise HTTPException(status_code=400, detail="Invalid token type")
    return payload["sub"]


# ── request models ────────────────────────────────────────────────────────────

class SubscribeRequest(BaseModel):
    city: str
    sport: str
    channels: List[str] = ["email"]
    email: Optional[EmailStr] = None


class PushSubscriptionRequest(BaseModel):
    endpoint: str
    keys: dict  # {"p256dh": str, "auth": str}


# ── routes ────────────────────────────────────────────────────────────────────

@router.post("/subscribe")
async def subscribe(body: SubscribeRequest, request: Request):
    """Create or refresh a notification interest record."""
    db = request.app.state.db
    user = await get_optional_user(request, db)

    # Determine email — logged-in users use account email; guests must supply one
    if user:
        email = user["email"]
        user_id = user["_id"]
    else:
        if not body.email:
            raise HTTPException(status_code=422, detail="email is required for guest subscriptions")
        email = body.email
        user_id = None

    now = datetime.now(timezone.utc)

    # Upsert — if record exists (same email+city+sport), refresh it (clear unsubscribed_at)
    existing = await db.notification_interests.find_one({
        "email": email,
        "city": body.city,
        "sport": body.sport,
    })

    if existing:
        update: dict = {"unsubscribed_at": None, "channels": body.channels}
        # Link user_id if guest previously subscribed and is now logged in
        if user_id and not existing.get("user_id"):
            update["user_id"] = user_id
        await db.notification_interests.update_one(
            {"_id": existing["_id"]},
            {"$set": update},
        )
        interest_id = str(existing["_id"])
    else:
        doc = {
            "user_id": user_id,
            "email": email,
            "city": body.city,
            "sport": body.sport,
            "channels": body.channels,
            "created_at": now,
            "unsubscribed_at": None,
        }
        result = await db.notification_interests.insert_one(doc)
        interest_id = str(result.inserted_id)

    return {
        "message": "Subscribed",
        "unsubscribe_token": _make_unsub_token(interest_id),
    }


@router.post("/push-subscription")
async def save_push_subscription(body: PushSubscriptionRequest, request: Request):
    """Store a browser push subscription endpoint for the authenticated user."""
    db = request.app.state.db
    user = await get_current_user(request, db)

    now = datetime.now(timezone.utc)

    # Upsert by endpoint so re-subscribing on same browser is idempotent
    existing = await db.push_subscriptions.find_one({"endpoint": body.endpoint})
    if existing:
        await db.push_subscriptions.update_one(
            {"_id": existing["_id"]},
            {"$set": {"user_id": user["_id"], "keys": body.keys, "last_used_at": now}},
        )
    else:
        user_agent = request.headers.get("user-agent", "")
        await db.push_subscriptions.insert_one({
            "user_id": user["_id"],
            "endpoint": body.endpoint,
            "keys": body.keys,
            "user_agent": user_agent,
            "created_at": now,
            "last_used_at": None,
        })

    return {"message": "Push subscription saved"}


@router.delete("/unsubscribe")
async def unsubscribe(request: Request, token: str = Query(...)):
    """One-click unsubscribe from email link. No login required."""
    db = request.app.state.db
    interest_id = _decode_unsub_token(token)

    try:
        oid = ObjectId(interest_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid interest ID in token")

    result = await db.notification_interests.update_one(
        {"_id": oid},
        {"$set": {"unsubscribed_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")

    return {"message": "Unsubscribed"}


@router.get("/interests")
async def list_interests(request: Request):
    """Return the current user's active notification interests."""
    db = request.app.state.db
    user = await get_current_user(request, db)

    interests = await db.notification_interests.find(
        {"user_id": user["_id"], "unsubscribed_at": None}
    ).to_list(100)

    return [
        {
            "id": str(i["_id"]),
            "city": i["city"],
            "sport": i["sport"],
            "channels": i.get("channels", ["email"]),
            "created_at": i.get("created_at"),
            "unsubscribe_token": _make_unsub_token(str(i["_id"])),
        }
        for i in interests
    ]
