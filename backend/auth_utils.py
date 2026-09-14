import os
import bcrypt
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import HTTPException, Request
from bson import ObjectId

JWT_ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET not configured")
    return secret


async def check_rate_limit(db, key: str, max_attempts: int = 5, window_minutes: int = 15) -> None:
    """Raise 429 if `key` (e.g. "login:email@x.com") has hit max_attempts within
    the current window. Call record_attempt() on failure to count it, and
    clear_attempts() on success to reset. Window auto-expires via the
    login_attempts TTL index (see seeds/indexes.py) — no manual cleanup needed.
    """
    doc = await db.login_attempts.find_one({"_id": key})
    if doc and doc.get("count", 0) >= max_attempts:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in a few minutes.")


async def record_attempt(db, key: str, window_minutes: int = 15) -> None:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=window_minutes)
    await db.login_attempts.update_one(
        {"_id": key},
        {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": expires_at}},
        upsert=True,
    )


async def clear_attempts(db, key: str) -> None:
    await db.login_attempts.delete_one({"_id": key})


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str = "player") -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access",
    }
    return pyjwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return pyjwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def _is_token_blacklisted(token: str, db) -> bool:
    """Check if token is in blacklist."""
    blacklisted = await db.token_blacklist.find_one({"token": token})
    return blacklisted is not None


async def get_current_user(request: Request, db) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")

        if await _is_token_blacklisted(token, db):
            raise HTTPException(status_code=401, detail="Token revoked")

        user_id = payload["sub"]
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            user = None
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_optional_user(request: Request, db) -> Optional[dict]:
    """Like get_current_user but returns None instead of raising 401."""
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        return None
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None

        if await _is_token_blacklisted(token, db):
            return None

        user_id = payload["sub"]
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            return None
        if not user:
            return None
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except (pyjwt.ExpiredSignatureError, pyjwt.InvalidTokenError):
        return None


def serialize_public_user(user: dict) -> dict:
    """Strip PII — return only public-safe fields from a user document."""
    return {
        "id": str(user.get("_id") or user.get("id", "")),
        "name": user.get("name"),
        "city": user.get("city"),
        "country": user.get("country", "USA"),
        "tennis_rating": user.get("tennis_rating", 3.0),
        "pickleball_rating": user.get("pickleball_rating", 3.0),
        "cricket_rating": user.get("cricket_rating", 3.0),
        "avatar": user.get("avatar"),
        "profile_public": user.get("profile_public", True),
        "founding_member": user.get("founding_member", False),
    }


async def require_admin(request: Request, db) -> dict:
    user = await get_current_user(request, db)
    if user.get("role") not in ["admin", "city_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
