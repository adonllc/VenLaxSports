"""In-app notifications (the bell) plus the matching email, in one call.

`notify` never raises: a notification failure must not undo the action that caused it.
Collection: user_notifications {user_id, type, title, body, link, ref_id, created_at, read_at}
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from bson import ObjectId

import email_service

logger = logging.getLogger(__name__)

LIST_LIMIT = 30


def _frontend_url() -> str:
    return os.environ.get("FRONTEND_URL", "https://venlaxsports.com").rstrip("/")


async def notify(db, user_ids, type_: str, title: str, body: str = "", link: str = "", ref_id: str = "",
                 email: bool = True) -> None:
    """Record an in-app notification for each user and, unless they opted out, email it."""
    now = datetime.now(timezone.utc).isoformat()
    for uid in dict.fromkeys(str(u) for u in user_ids if u):
        try:
            await db.user_notifications.insert_one({
                "user_id": uid, "type": type_, "title": title, "body": body, "link": link,
                "ref_id": ref_id, "created_at": now, "read_at": None,
            })
            if not email:
                continue
            user = await db.users.find_one({"_id": ObjectId(uid)}) if ObjectId.is_valid(uid) else None
            if user and user.get("email") and user.get("email_notifications", True):
                text = f"Hi {user.get('name', '')},\n\n{title}"
                if body:
                    text += f"\n\n{body}"
                if link:
                    text += f"\n\nOpen it: {_frontend_url()}{link}"
                email_service.schedule(email_service.send_generic(user["email"], title, text + "\n\n— VENLAX Sports"))
        except Exception:
            logger.exception("notify failed: user=%s type=%s", uid, type_)


async def list_for(db, user_id: str) -> dict:
    rows = await db.user_notifications.find({"user_id": user_id}).sort("created_at", -1).to_list(LIST_LIMIT)
    items = [{
        "id": str(r["_id"]), "type": r.get("type"), "title": r.get("title"), "body": r.get("body", ""),
        "link": r.get("link", ""), "created_at": r.get("created_at"), "read": bool(r.get("read_at")),
    } for r in rows]
    unread = await db.user_notifications.count_documents({"user_id": user_id, "read_at": None})
    return {"unread": unread, "items": items}


async def mark_read(db, user_id: str, notification_id: str | None = None) -> None:
    """Mark one notification (or, with no id, all of them) read. Only the owner's rows are touched."""
    now = datetime.now(timezone.utc).isoformat()
    query: dict = {"user_id": user_id, "read_at": None}
    if notification_id:
        if not ObjectId.is_valid(notification_id):
            return
        query["_id"] = ObjectId(notification_id)
    await db.user_notifications.update_many(query, {"$set": {"read_at": now}})
