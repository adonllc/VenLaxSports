from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from bson import ObjectId
from auth_utils import get_current_user
from models import PaymentTransaction, PlayerLeague, Standing
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
