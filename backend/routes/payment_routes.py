from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from bson import ObjectId
from auth_utils import get_current_user
from models import PaymentTransaction, PlayerLeague, Standing
import email_service
import os

router = APIRouter()


FOUNDING_MEMBER_LIMIT = 200


class CheckoutRequest(BaseModel):
    league_id: str
    origin_url: str
    promo_code: Optional[str] = None


async def _validate_promo(db, code: str, user_id: str, league: dict) -> dict | None:
    """Return promo doc if valid for this user+league, else None."""
    promo = await db.promo_codes.find_one({"code": code.upper(), "active": True})
    if not promo:
        return None
    now = datetime.now(timezone.utc)
    if promo.get("expires_at"):
        try:
            exp = datetime.fromisoformat(promo["expires_at"].replace("Z", "+00:00"))
            if now > exp:
                return None
        except Exception:
            pass
    if promo.get("max_uses") and promo.get("used_count", 0) >= promo["max_uses"]:
        return None
    per_user = promo.get("per_user_limit", 1)
    if per_user and per_user > 0:
        uses = await db.promo_uses.count_documents({"code": code.upper(), "user_id": user_id})
        if uses >= per_user:
            return None
    sports = promo.get("applicable_sports") or []
    if sports and league.get("sport") not in sports:
        return None
    formats = promo.get("applicable_formats") or []
    if formats and league.get("format") not in formats:
        return None
    return promo


async def _record_promo_use(db, code: str, user_id: str, league_id: str) -> None:
    await db.promo_codes.update_one({"code": code.upper()}, {"$inc": {"used_count": 1}})
    await db.promo_uses.insert_one({
        "code": code.upper(),
        "user_id": user_id,
        "league_id": league_id,
        "used_at": datetime.now(timezone.utc).isoformat(),
    })


@router.get("/promo/{code}")
async def validate_promo_code(code: str, league_id: str, request: Request):
    """Validate a promo code for a specific league. Returns discount details."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    promo = await _validate_promo(db, code, user["_id"], league)
    if not promo:
        raise HTTPException(status_code=400, detail="Invalid or expired promo code")

    entry_fee = float(league.get("entry_fee", 0))
    discount_type = promo.get("type")
    discount_value = float(promo.get("value", 0))

    if discount_type == "free_entry" or discount_value >= 100:
        final_fee = 0.0
        savings = entry_fee
    elif discount_type == "percent_off":
        final_fee = round(entry_fee * (1 - discount_value / 100), 2)
        savings = round(entry_fee - final_fee, 2)
    elif discount_type == "amount_off":
        final_fee = max(0.0, round(entry_fee - discount_value, 2))
        savings = round(entry_fee - final_fee, 2)
    else:
        final_fee = entry_fee
        savings = 0.0

    return {
        "valid": True,
        "code": promo["code"],
        "description": promo.get("description", ""),
        "discount_type": discount_type,
        "discount_value": discount_value,
        "original_fee": entry_fee,
        "final_fee": final_fee,
        "savings": savings,
    }


@router.post("/checkout")
async def create_checkout(data: CheckoutRequest, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)

    try:
        league = await db.leagues.find_one({"_id": ObjectId(data.league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    entry_fee = float(league.get("entry_fee", 0))
    if entry_fee <= 0:
        raise HTTPException(status_code=400, detail="This league is free to join")

    existing = await db.player_leagues.find_one({"player_id": user["_id"], "league_id": data.league_id})
    if existing and existing.get("payment_status") in ["paid", "free"]:
        raise HTTPException(status_code=400, detail="Already registered")

    # Apply promo code if provided
    if data.promo_code:
        promo = await _validate_promo(db, data.promo_code, user["_id"], league)
        if not promo:
            raise HTTPException(status_code=400, detail="Invalid or expired promo code")

        discount_type = promo.get("type")
        discount_value = float(promo.get("value", 0))

        if discount_type == "free_entry" or discount_value >= 100:
            await _confirm_player_registered(
                db, league, data.league_id, user,
                f"promo:{data.promo_code.upper()}", 0.0,
                {"promo_code": data.promo_code.upper()},
            )
            await _record_promo_use(db, data.promo_code, user["_id"], data.league_id)
            return {"free": True, "message": "Promo applied — you're registered!"}
        elif discount_type == "percent_off":
            entry_fee = max(0.01, round(entry_fee * (1 - discount_value / 100), 2))
        elif discount_type == "amount_off":
            entry_fee = max(0.01, round(entry_fee - discount_value, 2))

    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    except ImportError:
        raise HTTPException(status_code=503, detail="Stripe not configured on this deployment")

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Payment processing is not configured. Please contact support.")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    currency = league.get("currency", "USD").lower()
    # Stripe only accepts USD for test; for INR use USD equivalent
    stripe_currency = "usd"
    stripe_amount = entry_fee if currency == "usd" else round(entry_fee / 83.0, 2)

    success_url = f"{data.origin_url}/leagues/{data.league_id}?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{data.origin_url}/leagues/{data.league_id}"

    checkout_req = CheckoutSessionRequest(
        amount=stripe_amount,
        currency=stripe_currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "league_id": data.league_id,
            "user_id": user["_id"],
            "user_email": user["email"],
        },
    )
    session = await stripe.create_checkout_session(checkout_req)

    txn_meta = {"league_id": data.league_id, "user_id": user["_id"]}
    if data.promo_code:
        txn_meta["promo_code"] = data.promo_code.upper()

    txn = PaymentTransaction(
        user_id=user["_id"],
        user_email=user["email"],
        league_id=data.league_id,
        league_name=league["name"],
        session_id=session.session_id,
        amount=stripe_amount,
        currency="USD",
        status="initiated",
        payment_status="unpaid",
        metadata=txn_meta,
    )
    await db.payment_transactions.insert_one(txn.to_mongo())
    return {"url": session.url, "session_id": session.session_id}


@router.get("/status/{session_id}")
async def get_payment_status(session_id: str, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)

    txn = await db.payment_transactions.find_one({"session_id": session_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Payment not found")

    if txn.get("payment_status") == "paid":
        return {"status": "complete", "payment_status": "paid"}

    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
    except ImportError:
        raise HTTPException(status_code=503, detail="Stripe not configured on this deployment")

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Payment processing is not configured.")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    status = await stripe.get_checkout_status(session_id)
    now = datetime.now(timezone.utc).isoformat()

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"status": status.status, "payment_status": status.payment_status, "updated_at": now}},
    )

    if status.payment_status == "paid":
        league_id = txn.get("league_id")
        user_id = txn.get("user_id")
        already_registered = await db.player_leagues.find_one(
            {"player_id": user_id, "league_id": league_id, "payment_status": "paid"}
        )
        if not already_registered:
            league = await db.leagues.find_one({"_id": ObjectId(league_id)})
            player = await db.users.find_one({"_id": ObjectId(user_id)})
            if league and player:
                # Retrieve waiver consent recorded at join time
                consent = await db.waiver_consents.find_one(
                    {"user_id": user_id, "league_id": league_id},
                    sort=[("waiver_accepted_at", -1)],
                )
                pl = PlayerLeague(
                    player_id=user_id,
                    player_name=player["name"],
                    league_id=league_id,
                    sport=league["sport"],
                    payment_status="paid",
                    session_id=session_id,
                    waiver_accepted_at=consent["waiver_accepted_at"] if consent else now,
                )
                await db.player_leagues.insert_one(pl.to_mongo())
                await db.leagues.update_one({"_id": ObjectId(league_id)}, {"$inc": {"current_players": 1}})
                s = Standing(
                    league_id=league_id,
                    player_id=user_id,
                    player_name=player["name"],
                    sport=league["sport"],
                    country=player.get("country", "USA"),
                )
                await db.standings.insert_one(s.to_mongo())

                # Notify player of paid registration
                if player.get("email") and player.get("email_notifications", True):
                    email_service.schedule(email_service.send_registration_confirmed(
                        player["email"], player["name"], league["name"], league["sport"],
                        league_id, paid=True, amount=float(txn.get("amount", 0)),
                        currency=txn.get("currency", "USD")))

                # Record promo use if code was applied
                promo_code = (txn.get("metadata") or {}).get("promo_code")
                if promo_code:
                    await _record_promo_use(db, promo_code, user_id, league_id)

    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
    }


@router.get("/my")
async def my_payments(request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    txns = await db.payment_transactions.find(
        {"user_id": user["_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    return txns


# ─── Multiple payment methods (Phase 1) ──────────────────────
# Stripe → existing /checkout flow.
# Apple Pay & Google Pay → wallet flows that ride on top of Stripe in production;
# placeholder credentials for now so the user can plug real merchant IDs later.
# Zelle → bank-to-bank rails with no API; we record a pending intent and the player
# enters their Zelle reference number which an admin verifies.

@router.get("/methods")
async def list_payment_methods():
    """Public endpoint — exposes which payment methods are available + display config.

    All credentials are placeholder env vars until real merchant accounts are wired.
    """
    return {
        "methods": [
            {
                "id": "stripe",
                "label": "Card (Stripe)",
                "icon": "credit-card",
                "enabled": True,
                "config": {},
            },
            {
                "id": "apple_pay",
                "label": "Apple Pay",
                "icon": "apple",
                "enabled": True,
                "config": {
                    "merchant_id": os.environ.get("APPLE_PAY_MERCHANT_ID", ""),
                    "domain": os.environ.get("APPLE_PAY_DOMAIN", ""),
                    "placeholder": True,
                },
            },
            {
                "id": "google_pay",
                "label": "Google Pay",
                "icon": "google",
                "enabled": True,
                "config": {
                    "merchant_id": os.environ.get("GOOGLE_PAY_MERCHANT_ID", ""),
                    "gateway": os.environ.get("GOOGLE_PAY_GATEWAY", "stripe"),
                    "placeholder": True,
                },
            },
            {
                "id": "zelle",
                "label": "Zelle",
                "icon": "z",
                "enabled": True,
                "config": {
                    "handle": os.environ.get("ZELLE_HANDLE", ""),
                    "display_name": os.environ.get("ZELLE_DISPLAY_NAME", "VENLAX Sports"),
                    "placeholder": True,
                },
            },
        ],
    }


class WalletPaymentIn(BaseModel):
    league_id: str
    method: str  # "apple_pay" | "google_pay"
    token: str   # Apple/GPay payment token (placeholder accepted while merchant IDs are stubbed)


async def _confirm_player_registered(db, league: dict, league_id: str, user: dict, method: str,
                                     amount: float, txn_extra: dict | None = None):
    """Idempotently mark player as paid + create standing + notify."""
    user_id = user["_id"]
    already = await db.player_leagues.find_one(
        {"player_id": user_id, "league_id": league_id, "payment_status": "paid"}
    )
    if already:
        return False

    consent = await db.waiver_consents.find_one(
        {"user_id": user_id, "league_id": league_id},
        sort=[("waiver_accepted_at", -1)],
    )
    pl = PlayerLeague(
        player_id=user_id,
        player_name=user["name"],
        league_id=league_id,
        sport=league["sport"],
        payment_status="paid",
        waiver_accepted_at=consent["waiver_accepted_at"] if consent else datetime.now(timezone.utc).isoformat(),
    )
    await db.player_leagues.insert_one(pl.to_mongo())
    await db.leagues.update_one({"_id": ObjectId(league_id)}, {"$inc": {"current_players": 1}})

    standing = Standing(
        league_id=league_id,
        player_id=user_id,
        player_name=user["name"],
        sport=league["sport"],
        country=user.get("country", "USA"),
    )
    await db.standings.insert_one(standing.to_mongo())

    txn = PaymentTransaction(
        user_id=user_id,
        user_email=user["email"],
        league_id=league_id,
        league_name=league["name"],
        session_id=f"{method}_{ObjectId()}",
        amount=amount,
        currency="USD",
        status="complete",
        payment_status="paid",
        metadata={"method": method, **(txn_extra or {})},
    )
    await db.payment_transactions.insert_one(txn.to_mongo())

    if user.get("email") and user.get("email_notifications", True):
        email_service.schedule(email_service.send_registration_confirmed(
            user["email"], user["name"], league["name"], league["sport"],
            league_id, paid=True, amount=amount, currency="USD"))
    return True


@router.post("/wallet")
async def pay_with_wallet(data: WalletPaymentIn, request: Request):
    """Apple Pay / Google Pay — not yet live. Merchant IDs pending."""
    raise HTTPException(
        status_code=503,
        detail="Apple Pay and Google Pay are not yet available. Please use card payment via Stripe.",
    )


class ZelleIntentIn(BaseModel):
    league_id: str


class ZelleConfirmIn(BaseModel):
    league_id: str
    reference_number: str  # Zelle confirmation number entered by the player


@router.post("/zelle/intent")
async def zelle_intent(data: ZelleIntentIn, request: Request):
    """Returns instructions for the player to send Zelle and a tracking record."""
    db = request.app.state.db
    user = await get_current_user(request, db)
    try:
        league = await db.leagues.find_one({"_id": ObjectId(data.league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    fee = float(league.get("entry_fee", 0))
    if fee <= 0:
        raise HTTPException(status_code=400, detail="This league is free to join")

    handle = os.environ.get("ZELLE_HANDLE", "payments@leaguepro.com")
    display = os.environ.get("ZELLE_DISPLAY_NAME", "VENLAX Sports Payments")
    memo = f"LP-{data.league_id[-6:]}-{user['_id'][-6:]}".upper()

    # Record a pending intent so the admin/UI can later match it to the reference
    intent = {
        "user_id": user["_id"],
        "user_email": user["email"],
        "league_id": data.league_id,
        "league_name": league["name"],
        "amount": fee,
        "currency": "USD",
        "method": "zelle",
        "status": "pending_zelle",
        "memo": memo,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_transactions.insert_one({**intent, "session_id": f"zelle_{ObjectId()}"})

    return {
        "method": "zelle",
        "handle": handle,
        "display_name": display,
        "amount": fee,
        "currency": "USD",
        "memo": memo,
        "instructions": (
            f"Open your bank's Zelle and send ${fee:.2f} to '{handle}' "
            f"({display}). Include memo: {memo}. Then return here and enter "
            "your Zelle confirmation number."
        ),
        "placeholder": True,
    }


@router.post("/zelle/confirm")
async def zelle_confirm(data: ZelleConfirmIn, request: Request):
    """Player submits the Zelle confirmation number.

    Does NOT register the player. Sets transaction to pending_admin so an admin
    must verify the deposit before registration is confirmed.
    """
    db = request.app.state.db
    user = await get_current_user(request, db)
    try:
        league = await db.leagues.find_one({"_id": ObjectId(data.league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    fee = float(league.get("entry_fee", 0))
    if fee <= 0:
        raise HTTPException(status_code=400, detail="This league is free to join")
    if not data.reference_number or len(data.reference_number) < 4:
        raise HTTPException(status_code=400, detail="Reference number too short")

    already_registered = await db.player_leagues.find_one(
        {"player_id": user["_id"], "league_id": data.league_id, "payment_status": "paid"}
    )
    if already_registered:
        return {"message": "Already registered"}

    now = datetime.now(timezone.utc).isoformat()
    result = await db.payment_transactions.update_one(
        {"user_id": user["_id"], "league_id": data.league_id, "method": "zelle", "status": "pending_zelle"},
        {"$set": {
            "reference_number": data.reference_number,
            "status": "pending_admin",
            "needs_admin_review": True,
            "updated_at": now,
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="No pending Zelle intent found. Please start the Zelle flow again.")

    return {
        "message": "Your Zelle reference has been recorded. Registration will be confirmed after admin verifies the deposit.",
        "league_id": data.league_id,
        "reference_number": data.reference_number,
        "status": "pending_admin",
    }
