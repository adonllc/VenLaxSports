from fastapi import APIRouter, HTTPException, Response, Request
from datetime import datetime, timezone
from bson import ObjectId
from models import User, UserCreate, UserLogin
from auth_utils import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_user, get_jwt_secret, JWT_ALGORITHM,
)
import jwt as pyjwt

router = APIRouter()


def _set_tokens(response: Response, user_id: str, email: str, role: str):
    access = create_access_token(user_id, email, role)
    refresh = create_refresh_token(user_id)
    response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return access, refresh


@router.post("/register")
async def register(user_data: UserCreate, response: Response, request: Request):
    db = request.app.state.db
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=user_data.email.lower(),
        name=user_data.name,
        password_hash=hash_password(user_data.password),
        country=user_data.country,
        city=user_data.city,
        phone=user_data.phone,
        role="player",
    )
    result = await db.users.insert_one(user.to_mongo())
    user_id = str(result.inserted_id)
    _set_tokens(response, user_id, user.email, user.role)

    return {
        "id": user_id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "country": user.country,
        "city": user.city,
        "sport_preferences": [],
        "tennis_rating": 3.0,
        "cricket_rating": 50.0,
        "pickleball_rating": 3.0,
    }


@router.post("/login")
async def login(credentials: UserLogin, response: Response, request: Request):
    db = request.app.state.db
    user = await db.users.find_one({"email": credentials.email.lower()})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    role = user.get("role", "player")
    _set_tokens(response, user_id, user["email"], role)

    return {
        "id": user_id,
        "email": user["email"],
        "name": user["name"],
        "role": role,
        "country": user.get("country", "USA"),
        "city": user.get("city"),
        "sport_preferences": user.get("sport_preferences", []),
        "tennis_rating": user.get("tennis_rating", 3.0),
        "cricket_rating": user.get("cricket_rating", 50.0),
        "pickleball_rating": user.get("pickleball_rating", 3.0),
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out"}


@router.get("/me")
async def me(request: Request):
    db = request.app.state.db
    return await get_current_user(request, db)


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    db = request.app.state.db
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user_id = str(user["_id"])
        new_access = create_access_token(user_id, user["email"], user.get("role", "player"))
        response.set_cookie("access_token", new_access, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
        return {"message": "Token refreshed"}
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
