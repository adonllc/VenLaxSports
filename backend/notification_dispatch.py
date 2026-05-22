"""Notification dispatch — fires push + email at capacity milestones.

Called from league_routes.py. Never raises — errors are logged and skipped
so that the join/create flow is never blocked.
"""
from __future__ import annotations
import asyncio
import json
import logging
import os
from functools import partial
from typing import Optional

import email_service

logger = logging.getLogger(__name__)


def _fe_url() -> str:
    return os.environ.get("FRONTEND_URL", "").rstrip("/")


def _vapid_private_key() -> Optional[str]:
    return os.environ.get("VAPID_PRIVATE_KEY")


def _vapid_claims_email() -> str:
    return os.environ.get("VAPID_CLAIMS_EMAIL", "hello@venlaxsports.com")


async def _get_interests(db, city: str, sport: str) -> list[dict]:
    """Return all active (non-unsubscribed) interests matching city+sport."""
    return await db.notification_interests.find(
        {"city": city, "sport": sport, "unsubscribed_at": None}
    ).to_list(1000)


async def _get_user_for_interest(db, interest: dict) -> Optional[dict]:
    """Fetch user doc if user_id is set on the interest."""
    user_id = interest.get("user_id")
    if not user_id:
        return None
    from bson import ObjectId
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user:
            user["_id"] = str(user["_id"])
        return user
    except Exception:
        return None


def _notifications_allowed(user: Optional[dict]) -> bool:
    """Return False only if user exists and has explicitly disabled notifications."""
    if user is None:
        return True
    return user.get("email_notifications", True)


async def _send_push_to_user(db, user_id: str, payload: dict) -> None:
    """Send push notification to all active subscriptions for user_id."""
    vapid_key = _vapid_private_key()
    if not vapid_key:
        logger.warning("VAPID_PRIVATE_KEY not set — skipping push")
        return

    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush not installed — skipping push")
        return

    from bson import ObjectId
    try:
        subs = await db.push_subscriptions.find({"user_id": user_id}).to_list(10)
    except Exception:
        return

    loop = asyncio.get_running_loop()
    for sub in subs:
        try:
            await loop.run_in_executor(None, partial(
                webpush,
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": sub["keys"],
                },
                data=json.dumps(payload),
                vapid_private_key=vapid_key,
                vapid_claims={"sub": f"mailto:{_vapid_claims_email()}"},
            ))
        except Exception as exc:
            # 410 Gone — browser revoked the subscription; clean it up
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status == 410:
                logger.info("Dead push subscription %s — removing", sub.get("_id"))
                try:
                    await db.push_subscriptions.delete_one({"_id": sub["_id"]})
                except Exception:
                    pass
            else:
                logger.warning("Push send failed for user %s: %s", user_id, exc)


async def dispatch_season_open(db, league: dict) -> None:
    """Trigger 1 — fires when a new league is created (status=registration)."""
    city = league.get("city", "")
    sport = league.get("sport", "")
    league_id = str(league.get("id") or league.get("_id", ""))
    league_name = league.get("name", "")
    join_url = f"{_fe_url()}/leagues/{league_id}"

    sport_emoji = {"tennis": "🎾", "pickleball": "🏓", "cricket": "🏏"}.get(sport, "🏆")
    city_short = city.split(",")[0]

    try:
        interests = await _get_interests(db, city, sport)
    except Exception:
        logger.exception("dispatch_season_open: failed to query interests")
        return

    for interest in interests:
        try:
            user = await _get_user_for_interest(db, interest)
            if not _notifications_allowed(user):
                continue
            name = user["name"] if user else "Player"
            email = interest["email"]
            channels = interest.get("channels", ["email"])

            if "email" in channels:
                email_service.schedule(email_service.send_season_open(
                    email, name, city, sport, league_name, join_url
                ))

            if "push" in channels and interest.get("user_id"):
                push_payload = {
                    "title": f"{sport_emoji} {city_short} {sport.title()} Season just opened",
                    "body": f"{league_name} — Join now →",
                    "url": join_url,
                }
                asyncio.create_task(_send_push_to_user(db, interest["user_id"], push_payload))
        except Exception:
            logger.exception("dispatch_season_open: error processing interest %s", interest.get("_id"))


async def dispatch_filling_fast(db, league: dict) -> None:
    """Trigger 2 — fires when league crosses 50% capacity. Push only."""
    city = league.get("city", "")
    sport = league.get("sport", "")
    league_id = str(league.get("id") or league.get("_id", ""))
    league_name = league.get("name", "")
    join_url = f"{_fe_url()}/leagues/{league_id}"

    sport_emoji = {"tennis": "🎾", "pickleball": "🏓", "cricket": "🏏"}.get(sport, "🏆")
    city_short = city.split(",")[0]

    try:
        interests = await _get_interests(db, city, sport)
    except Exception:
        logger.exception("dispatch_filling_fast: failed to query interests")
        return

    for interest in interests:
        try:
            if not interest.get("user_id"):
                continue  # push only — need user_id
            user = await _get_user_for_interest(db, interest)
            if not _notifications_allowed(user):
                continue
            if "push" in interest.get("channels", []):
                push_payload = {
                    "title": f"{sport_emoji} {city_short} {sport.title()} is half full",
                    "body": "Don't miss out →",
                    "url": join_url,
                }
                asyncio.create_task(_send_push_to_user(db, interest["user_id"], push_payload))
        except Exception:
            logger.exception("dispatch_filling_fast: error processing interest %s", interest.get("_id"))


async def dispatch_last_spots(db, league: dict, spots_left: int) -> None:
    """Trigger 3 — fires when league crosses 80% capacity. Email + push."""
    city = league.get("city", "")
    sport = league.get("sport", "")
    league_id = str(league.get("id") or league.get("_id", ""))
    league_name = league.get("name", "")
    join_url = f"{_fe_url()}/leagues/{league_id}"

    sport_emoji = {"tennis": "🎾", "pickleball": "🏓", "cricket": "🏏"}.get(sport, "🏆")
    city_short = city.split(",")[0]

    try:
        interests = await _get_interests(db, city, sport)
    except Exception:
        logger.exception("dispatch_last_spots: failed to query interests")
        return

    for interest in interests:
        try:
            user = await _get_user_for_interest(db, interest)
            if not _notifications_allowed(user):
                continue
            name = user["name"] if user else "Player"
            email = interest["email"]
            channels = interest.get("channels", ["email"])

            if "email" in channels:
                email_service.schedule(email_service.send_last_spots(
                    email, name, city, sport, spots_left, join_url
                ))

            if "push" in channels and interest.get("user_id"):
                push_payload = {
                    "title": f"⚡ {spots_left} spot{'s' if spots_left != 1 else ''} left in {city_short} {sport.title()}",
                    "body": "Last chance →",
                    "url": join_url,
                }
                asyncio.create_task(_send_push_to_user(db, interest["user_id"], push_payload))
        except Exception:
            logger.exception("dispatch_last_spots: error processing interest %s", interest.get("_id"))


async def dispatch_waitlist_open(db, league: dict) -> None:
    """Trigger 4 — fires when league hits max_players. Email + push."""
    city = league.get("city", "")
    sport = league.get("sport", "")
    league_id = str(league.get("id") or league.get("_id", ""))
    league_name = league.get("name", "")
    waitlist_url = f"{_fe_url()}/leagues/{league_id}"

    sport_emoji = {"tennis": "🎾", "pickleball": "🏓", "cricket": "🏏"}.get(sport, "🏆")
    city_short = city.split(",")[0]

    try:
        interests = await _get_interests(db, city, sport)
    except Exception:
        logger.exception("dispatch_waitlist_open: failed to query interests")
        return

    for interest in interests:
        try:
            user = await _get_user_for_interest(db, interest)
            if not _notifications_allowed(user):
                continue
            name = user["name"] if user else "Player"
            email = interest["email"]
            channels = interest.get("channels", ["email"])

            if "email" in channels:
                email_service.schedule(email_service.send_waitlist_open(
                    email, name, city, sport, waitlist_url
                ))

            if "push" in channels and interest.get("user_id"):
                push_payload = {
                    "title": f"🔔 {city_short} {sport.title()} is full",
                    "body": "You're on the waitlist →",
                    "url": waitlist_url,
                }
                asyncio.create_task(_send_push_to_user(db, interest["user_id"], push_payload))
        except Exception:
            logger.exception("dispatch_waitlist_open: error processing interest %s", interest.get("_id"))
