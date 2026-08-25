from fastapi import APIRouter, HTTPException, Request, Body
from models import User, ReferralCredit
from auth_utils import get_current_user
from datetime import datetime, timezone, timedelta
import secrets
import string

router = APIRouter()

def generate_referral_code():
    """Generate REF_XXXXXX format"""
    chars = string.ascii_uppercase + string.digits
    random_part = ''.join(secrets.choice(chars) for _ in range(6))
    return f"REF_{random_part}"

@router.post("/referral/redeem/{code}")
async def redeem_referral_code(code: str, request: Request):
    """Apply referral credit when user signs up with referral code"""
    db = request.app.state.db

    # Find referral credit record by code
    ref_credit = await db.referral_credits.find_one({"referral_code": code})
    if not ref_credit:
        raise HTTPException(status_code=404, detail="Invalid referral code")

    # Get current user (must be logged in)
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Check if already redeemed
    if ref_credit.get("referee_id"):
        raise HTTPException(status_code=400, detail="Referral code already redeemed")

    # Check if expired
    expires_at = datetime.fromisoformat(ref_credit.get("expires_at"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Referral code expired")

    # Update referral credit: set referee_id, apply credit to referee's account
    referee = await db.users.find_one({"_id": user_id})
    if not referee:
        raise HTTPException(status_code=404, detail="User not found")

    # Add credit to referee's account
    new_balance = (referee.get("credits_balance", 0.0) or 0.0) + ref_credit.get("credit_amount", 0.0)
    await db.users.update_one(
        {"_id": user_id},
        {
            "$set": {
                "credits_balance": new_balance,
                "credits_expiry": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
            }
        }
    )

    # Mark referral as applied
    await db.referral_credits.update_one(
        {"_id": ref_credit.get("_id")},
        {
            "$set": {
                "referee_id": user_id,
                "status": "applied",
                "applied_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )

    return {
        "status": "success",
        "message": f"${ref_credit.get('credit_amount', 0)} credit applied!",
        "new_balance": new_balance
    }

@router.get("/me/referral-code")
async def get_my_referral_code(request: Request):
    """Get current user's referral code"""
    db = request.app.state.db
    current_user = await get_current_user(request, db)

    user = await db.users.find_one({"_id": current_user.id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Generate referral code if not exists
    if not user.get("referral_code"):
        ref_code = generate_referral_code()
        await db.users.update_one(
            {"_id": current_user.id},
            {"$set": {"referral_code": ref_code}}
        )
    else:
        ref_code = user.get("referral_code")

    return {
        "referral_code": ref_code,
        "referral_link": f"https://venlaxsports.com/auth?ref={ref_code}",
        "credits_balance": user.get("credits_balance", 0.0)
    }

@router.get("/me/credits")
async def get_my_credits(request: Request):
    """Get user's current credit balance"""
    db = request.app.state.db
    current_user = await get_current_user(request, db)

    user = await db.users.find_one({"_id": current_user.id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get referral earnings history
    referrals = await db.referral_credits.find({"referrer_id": current_user.id}).to_list(None)

    return {
        "credits_balance": user.get("credits_balance", 0.0),
        "credits_expiry": user.get("credits_expiry"),
        "total_referrals": len(referrals),
        "earned_referrals": sum(r.get("credit_amount", 0) for r in referrals if r.get("referee_id"))
    }

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

    user = await db.users.find_one({"_id": current_user.id})
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
        {"_id": current_user.id},
        {"$set": {"credits_balance": new_balance}}
    )

    # Store credit application record for audit
    await db.credit_applications.insert_one({
        "user_id": current_user.id,
        "league_id": league_id,
        "amount": amount_to_apply,
        "applied_at": datetime.now(timezone.utc).isoformat()
    })

    return {
        "status": "success",
        "amount_applied": amount_to_apply,
        "new_balance": new_balance
    }
