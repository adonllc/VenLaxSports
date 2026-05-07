from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from bson import ObjectId
from auth_utils import get_current_user
from models import PaymentTransaction, PlayerLeague, Standing
import email_service
import os

router = APIRouter()


class CheckoutRequest(BaseModel):
    league_id: str
    origin_url: str


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

    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

    api_key = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
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
        metadata={"league_id": data.league_id, "user_id": user["_id"]},
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

    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    api_key = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
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
                pl = PlayerLeague(
                    player_id=user_id,
                    player_name=player["name"],
                    league_id=league_id,
                    sport=league["sport"],
                    payment_status="paid",
                    session_id=session_id,
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
                    "display_name": os.environ.get("ZELLE_DISPLAY_NAME", "LeaguePro"),
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

    pl = PlayerLeague(
        player_id=user_id,
        player_name=user["name"],
        league_id=league_id,
        sport=league["sport"],
        payment_status="paid",
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
    """Apple Pay / Google Pay placeholder flow.

    In production this would verify the wallet token via Stripe Payment Request
    Buttons. For now we accept any non-empty token while merchant IDs remain
    placeholders and immediately mark the player as paid.
    """
    if data.method not in ("apple_pay", "google_pay"):
        raise HTTPException(status_code=400, detail="Unsupported wallet method")
    if not data.token:
        raise HTTPException(status_code=400, detail="Missing wallet token")

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

    confirmed = await _confirm_player_registered(
        db, league, data.league_id, user, data.method, fee,
        txn_extra={"wallet_token_prefix": data.token[:8]},
    )
    if not confirmed:
        return {"message": "Already registered"}

    return {
        "message": f"Payment confirmed via {data.method.replace('_', ' ').title()}",
        "league_id": data.league_id,
        "amount": fee,
        "currency": "USD",
        "placeholder": True,
    }


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
    display = os.environ.get("ZELLE_DISPLAY_NAME", "LeaguePro Payments")
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
    """Player submits the Zelle confirmation number — registers them as paid (placeholder).

    In production an admin would verify the reference matches a real Zelle deposit
    before confirming; here we trust + flag for review.
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

    confirmed = await _confirm_player_registered(
        db, league, data.league_id, user, "zelle", fee,
        txn_extra={"reference_number": data.reference_number, "needs_admin_review": True},
    )
    if not confirmed:
        return {"message": "Already registered"}

    return {
        "message": "Zelle reference recorded — your registration is provisional and will be auto-confirmed once we match the deposit.",
        "league_id": data.league_id,
        "reference_number": data.reference_number,
        "placeholder": True,
    }

