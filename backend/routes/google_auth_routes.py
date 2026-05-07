"""Google OAuth via Emergent Auth — issues the existing JWT cookies so
the rest of the app's auth middleware keeps working unchanged.

REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
"""
from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel
from datetime import datetime, timezone
import httpx
from models import User
from auth_utils import create_access_token, create_refresh_token

router = APIRouter()

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


class GoogleSessionIn(BaseModel):
    session_id: str


def _set_tokens(response: Response, user_id: str, email: str, role: str):
    access = create_access_token(user_id, email, role)
    refresh = create_refresh_token(user_id)
    response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")


@router.post("/google/session")
async def google_session(body: GoogleSessionIn, response: Response, request: Request):
    db = request.app.state.db

    # 1) Exchange session_id with Emergent Auth (server-side only)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Emergent Auth unreachable: {e}")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    data = r.json()
    email = (data.get("email") or "").lower()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    if not email:
        raise HTTPException(status_code=400, detail="Google account missing email")

    # 2) Upsert user (email is the key — JWT users may already exist)
    user = await db.users.find_one({"email": email})
    if user:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "name": name or user.get("name"),
                "picture": picture,
                "auth_provider": user.get("auth_provider") or "google",
                "last_login_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
    else:
        new_user = User(
            email=email,
            name=name,
            role="player",
        )
        doc = new_user.to_mongo()
        doc["auth_provider"] = "google"
        doc["picture"] = picture
        result = await db.users.insert_one(doc)
        user = await db.users.find_one({"_id": result.inserted_id})

    user_id = str(user["_id"])
    role = user.get("role", "player")
    _set_tokens(response, user_id, email, role)

    return {
        "id": user_id,
        "email": email,
        "name": user.get("name", name),
        "role": role,
        "country": user.get("country"),
        "city": user.get("city"),
        "picture": picture,
        "sport_preferences": user.get("sport_preferences", []),
        "tennis_rating": user.get("tennis_rating", 3.0),
        "cricket_rating": user.get("cricket_rating", 50.0),
        "pickleball_rating": user.get("pickleball_rating", 3.0),
    }
