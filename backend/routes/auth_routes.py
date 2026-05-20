from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from models import User, UserCreate, UserLogin
from auth_utils import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_user, get_jwt_secret, JWT_ALGORITHM,
)
import jwt as pyjwt
import email_service
import os
import random
import string

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
        skill_level=user_data.skill_level,
        role="player",
    )
    result = await db.users.insert_one(user.to_mongo())
    user_id = str(result.inserted_id)
    _set_tokens(response, user_id, user.email, user.role)

    # Send OTP verification email (best-effort, non-blocking)
    otp = "".join(random.choices(string.digits, k=6))
    otp_expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    hashed_otp = hash_password(otp)
    await db.users.update_one(
        {"_id": result.inserted_id},
        {"$set": {"otp_code": hashed_otp, "otp_expires_at": otp_expires}},
    )
    email_service.schedule(email_service.send_otp(user.email, user.name, otp))

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
        "email_notifications": True,
        "email_verified": False,
        "profile_complete": False,
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
        "email_notifications": user.get("email_notifications", True),
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out"}


@router.get("/me")
async def me(request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    user["id"] = user.pop("_id")
    # Strip internal OTP fields before sending to client
    user.pop("otp_code", None)
    user.pop("otp_expires_at", None)
    return user


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


# ── OTP Email Verification ──────────────────────────────────────────────

class OTPVerifyIn(BaseModel):
    otp: str


@router.post("/send-otp")
async def send_otp(request: Request):
    """Resend OTP to the currently logged-in user (if not yet verified)."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    if user.get("email_verified"):
        return {"message": "Email already verified"}
    otp = "".join(random.choices(string.digits, k=6))
    otp_expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"otp_code": hash_password(otp), "otp_expires_at": otp_expires}},
    )
    email_service.schedule(email_service.send_otp(user["email"], user["name"], otp))
    return {"message": "Verification code sent"}


@router.post("/verify-otp")
async def verify_otp(body: OTPVerifyIn, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    if user.get("email_verified"):
        return {"message": "Already verified", "email_verified": True}
    stored = user.get("otp_code")
    expires = user.get("otp_expires_at")
    if not stored or not expires:
        raise HTTPException(status_code=400, detail="No OTP pending — request a new code")
    if datetime.fromisoformat(expires) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Code expired — request a new one")
    if not verify_password(body.otp.strip(), stored):
        raise HTTPException(status_code=400, detail="Invalid code")
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"email_verified": True}, "$unset": {"otp_code": "", "otp_expires_at": ""}},
    )
    return {"message": "Email verified", "email_verified": True}


# Password Reset
class ForgotPasswordIn(BaseModel):
    email: str


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str


class UpdatePreferencesIn(BaseModel):
    email_notifications: Optional[bool] = None
    profile_public: Optional[bool] = None


def _create_reset_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "password_reset",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
    }
    return pyjwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordIn, request: Request):
    """Always returns 200 to avoid email enumeration; sends reset link only if user exists."""
    db = request.app.state.db
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if user and user.get("password_hash"):
        token = _create_reset_token(str(user["_id"]), email)
        frontend_url = os.environ.get("FRONTEND_URL", "").rstrip("/")
        reset_url = f"{frontend_url}/reset-password?token={token}"
        if user.get("email_notifications", True):
            email_service.schedule(email_service.send_password_reset(
                email, user.get("name", "there"), reset_url))
    return {"message": "If an account exists for that email, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordIn, request: Request):
    db = request.app.state.db
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    try:
        payload = pyjwt.decode(body.token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid reset token")
        user_id = payload["sub"]
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Reset link expired - please request a new one")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password_hash": hash_password(body.new_password),
                  "password_updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"message": "Password updated successfully"}


@router.patch("/preferences")
async def update_preferences(body: UpdatePreferencesIn, request: Request):
    """Toggle email notifications and/or profile visibility."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    update = {}
    if body.email_notifications is not None:
        update["email_notifications"] = body.email_notifications
    if body.profile_public is not None:
        update["profile_public"] = body.profile_public
    if update:
        await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": update})
    merged = {**user, **update}
    return {
        "email_notifications": merged.get("email_notifications", True),
        "profile_public": merged.get("profile_public", True),
    }
