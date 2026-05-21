import os
import secrets
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
import httpx
from bson import ObjectId
from models import User
from auth_utils import create_access_token, create_refresh_token

router = APIRouter()

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
FOUNDING_MEMBER_LIMIT = 200


def _frontend_url() -> str:
    return os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def _redirect_uri() -> str:
    return f"{_frontend_url()}/auth/callback"


def _set_auth_cookies(response: Response, user_id: str, email: str, role: str):
    access = create_access_token(user_id, email, role)
    refresh = create_refresh_token(user_id)
    is_secure = os.environ.get("FRONTEND_URL", "").startswith("https")
    response.set_cookie("access_token", access, httponly=True, secure=is_secure, samesite="lax", max_age=86400, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=is_secure, samesite="lax", max_age=604800, path="/")


@router.get("/google/url")
async def google_auth_url(request: Request):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google login not configured — GOOGLE_CLIENT_ID missing")

    db = request.app.state.db
    state = secrets.token_urlsafe(32)
    await db.oauth_states.insert_one({
        "state": state,
        "provider": "google",
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
    })

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return {"url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}", "state": state}


class OAuthCallbackIn(BaseModel):
    code: str
    state: str


@router.post("/google/callback")
async def google_callback(body: OAuthCallbackIn, response: Response, request: Request):
    db = request.app.state.db

    # Verify state — single-use CSRF nonce
    record = await db.oauth_states.find_one({"state": body.state, "provider": "google"})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    expires_at = record["expires_at"].replace(tzinfo=timezone.utc) if record["expires_at"].tzinfo is None else record["expires_at"]
    if expires_at < datetime.now(timezone.utc):
        await db.oauth_states.delete_one({"state": body.state})
        raise HTTPException(status_code=400, detail="OAuth state expired — restart login")
    await db.oauth_states.delete_one({"state": body.state})

    # Exchange authorization code for Google tokens
    async with httpx.AsyncClient(timeout=10) as client:
        token_resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code": body.code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": _redirect_uri(),
            "grant_type": "authorization_code",
        })

    if token_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Google token exchange failed")

    id_token_str = token_resp.json().get("id_token")
    if not id_token_str:
        raise HTTPException(status_code=400, detail="No ID token in Google response")

    # Verify ID token via Google's tokeninfo endpoint
    async with httpx.AsyncClient(timeout=10) as client:
        info_resp = await client.get(GOOGLE_TOKENINFO_URL, params={"id_token": id_token_str})

    if info_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Google ID token verification failed")

    claims = info_resp.json()
    if claims.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=400, detail="ID token audience mismatch")
    if claims.get("email_verified") != "true":
        raise HTTPException(status_code=400, detail="Google account email not verified")

    google_sub = claims["sub"]
    email = claims.get("email", "").lower()
    name = claims.get("name", "")
    avatar = claims.get("picture", "")

    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email address")

    # Find by provider subject first (most specific)
    user = await db.users.find_one({
        "oauth_providers": {"$elemMatch": {"provider": "google", "subject": google_sub}}
    })

    # Fall back to verified email match → auto-link existing account
    if not user:
        user = await db.users.find_one({"email": email})

    if user:
        # Link Google provider if not already present
        already_linked = any(
            p.get("provider") == "google" and p.get("subject") == google_sub
            for p in user.get("oauth_providers", [])
        )
        if not already_linked:
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$addToSet": {"oauth_providers": {"provider": "google", "subject": google_sub}}},
            )
        if avatar and not user.get("avatar"):
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"avatar": avatar}})
    else:
        # New account via Google
        founding_count = await db.users.count_documents({"founding_member": True})
        new_user = User(
            email=email,
            name=name,
            avatar=avatar,
            email_verified=True,
            oauth_providers=[{"provider": "google", "subject": google_sub}],
            founding_member=founding_count < FOUNDING_MEMBER_LIMIT,
        )
        result = await db.users.insert_one(new_user.to_mongo())
        user = await db.users.find_one({"_id": result.inserted_id})

    user_id = str(user["_id"])
    role = user.get("role", "player")
    _set_auth_cookies(response, user_id, email, role)

    return {
        "id": user_id,
        "email": email,
        "name": user.get("name"),
        "role": role,
        "country": user.get("country", "USA"),
        "city": user.get("city"),
        "founding_member": user.get("founding_member", False),
        "email_verified": True,
    }
