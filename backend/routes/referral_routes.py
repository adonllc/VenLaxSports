from fastapi import APIRouter, HTTPException, Request, Body
from bson import ObjectId
from models import User
from auth_utils import get_current_user
from datetime import datetime, timezone
import secrets
import string
import email_service

router = APIRouter()

def generate_referral_code():
    """Generate REF_XXXXXX format"""
    chars = string.ascii_uppercase + string.digits
    random_part = ''.join(secrets.choice(chars) for _ in range(6))
    return f"REF_{random_part}"

@router.get("/me/referral-code")
async def get_my_referral_code(request: Request):
    """Get current user's referral code"""
    db = request.app.state.db
    current_user = await get_current_user(request, db)

    # Generate referral code if not exists
    if not current_user.get("referral_code"):
        ref_code = generate_referral_code()
        from bson import ObjectId
        await db.users.update_one(
            {"_id": ObjectId(current_user.get("_id"))},
            {"$set": {"referral_code": ref_code}}
        )
    else:
        ref_code = current_user.get("referral_code")

    frontend_url = email_service._get_frontend_url() or "https://venlaxsports.com"
    return {
        "referral_code": ref_code,
        "referral_link": f"{frontend_url}/auth?ref={ref_code}",
        "credits_balance": current_user.get("credits_balance", 0.0)
    }

@router.get("/me/credits")
async def get_my_credits(request: Request):
    """Get user's current credit balance"""
    db = request.app.state.db
    current_user = await get_current_user(request, db)

    # Get referral earnings history
    me = str(current_user["_id"])
    referrals = await db.referral_credits.find({"referrer_id": me}).to_list(None)
    # Credit that exists but is not spendable yet: waiting for a referred player's first confirmed match,
    # whether this user is the one who referred or the one who was referred.
    as_referee = await db.referral_credits.find({"referee_id": me, "status": "pending"}).to_list(None)
    pending_credits = sum(r.get("credit_amount", 0) for r in referrals if r.get("status") == "pending") +         sum(r.get("credit_amount", 0) for r in as_referee if r.get("referrer_id") != me)

    return {
        "pending_credits": pending_credits,
        "credits_balance": current_user.get("credits_balance", 0.0),
        "credits_expiry": current_user.get("credits_expiry"),
        "total_referrals": len([r for r in referrals if r.get("type", "referral") == "referral"]),
        "earned_referrals": sum(r.get("credit_amount", 0) for r in referrals if r.get("status") == "applied"),
    }


@router.get("/leaderboard")
async def referral_leaderboard(request: Request):
    """Top referrers, first-name + last-initial only (no admin auth required)."""
    db = request.app.state.db
    await get_current_user(request, db)

    top_agg = await db.referral_credits.aggregate([
        {"$match": {"status": "applied", "type": "referral"}},
        {"$group": {"_id": "$referrer_id", "referrals": {"$sum": 1}}},
        {"$sort": {"referrals": -1}},
        {"$limit": 10},
    ]).to_list(10)

    ids = [ObjectId(r["_id"]) for r in top_agg if ObjectId.is_valid(r["_id"])]
    users = await db.users.find({"_id": {"$in": ids}}, {"name": 1}).to_list(len(ids))
    name_map = {str(u["_id"]): u.get("name", "Player") for u in users}

    def _display_name(full_name: str) -> str:
        parts = (full_name or "Player").split()
        if len(parts) < 2:
            return parts[0] if parts else "Player"
        return f"{parts[0]} {parts[-1][0]}."

    return [
        {"name": _display_name(name_map.get(r["_id"], "Player")), "referrals": r["referrals"]}
        for r in top_agg
    ]


@router.post("/me/credits/apply")
async def apply_credit_to_league(
    request: Request,
    payload: dict = Body(...)
):
    """Apply credit to league entry fee (manual button click)"""
    db = request.app.state.db
    current_user = await get_current_user(request, db)

    league_id = payload.get("league_id")
    amount_to_apply = payload.get("amount", 0)

    if not league_id or amount_to_apply <= 0:
        raise HTTPException(status_code=400, detail="Invalid league_id or amount")

    user = await db.users.find_one({"_id": current_user.get("_id")})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    available_credit = user.get("credits_balance", 0.0)
    if available_credit < amount_to_apply:
        raise HTTPException(status_code=400, detail="Insufficient credits")

    # Check credit expiry
    expiry = user.get("credits_expiry")
    if expiry and datetime.fromisoformat(expiry) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Credits expired")

    # Deduct credit (will be used in payment processing)
    new_balance = available_credit - amount_to_apply
    await db.users.update_one(
        {"_id": current_user.get("_id")},
        {"$set": {"credits_balance": new_balance}}
    )

    # Store credit application record for audit
    await db.credit_applications.insert_one({
        "user_id": current_user.get("_id"),
        "league_id": league_id,
        "amount": amount_to_apply,
        "applied_at": datetime.now(timezone.utc).isoformat()
    })

    return {
        "status": "success",
        "amount_applied": amount_to_apply,
        "new_balance": new_balance
    }
