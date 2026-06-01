"""Doubles league invite flow.

Routes:
  GET  /api/doubles-invite/status?token=xxx  — check invite state (optional auth)
  POST /api/doubles-invite/confirm            — accept or decline (auth required)

Helper exported for payment_routes:
  _create_doubles_pair(db, invite, league, partner_user)
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from bson import ObjectId
from auth_utils import get_current_user, get_optional_user
from models import DoublesConfirmRequest
import email_service
import os

router = APIRouter(redirect_slashes=False)


# ── GET /status ───────────────────────────────────────────────────────────────

@router.get("/status")
async def get_doubles_invite_status(token: str, request: Request):
    db = request.app.state.db
    current_user = await get_optional_user(request, db)

    invite = await db.doubles_invites.find_one({"token": token})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    # Expiry check
    try:
        expires = datetime.fromisoformat(invite["expires_at"])
        # Make timezone-aware if naive
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
    except Exception:
        expires = None

    now = datetime.now(timezone.utc)

    if expires and expires < now:
        if invite.get("status") == "pending":
            await db.doubles_invites.update_one(
                {"token": token}, {"$set": {"status": "expired"}}
            )
        raise HTTPException(status_code=410, detail="Invite expired")

    status = invite.get("status", "pending")

    if status == "accepted":
        return {"already_accepted": True}

    if status == "declined":
        raise HTTPException(status_code=409, detail="Invite was declined")

    if status == "expired":
        raise HTTPException(status_code=410, detail="Invite expired")

    # pending — return details
    league_id = invite["league_id"]
    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        league = None
    league_name = league["name"] if league else "the league"

    return {
        "pending": True,
        "initiator_name": invite.get("initiator_name", ""),
        "league_name": league_name,
        "league_id": league_id,
        "expires_at": invite.get("expires_at", ""),
        "is_logged_in": current_user is not None,
    }


# ── POST /confirm ─────────────────────────────────────────────────────────────

@router.post("/confirm")
async def confirm_doubles_invite(body: DoublesConfirmRequest, request: Request):
    db = request.app.state.db
    current_user = await get_current_user(request, db)

    invite = await db.doubles_invites.find_one({"token": body.token})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    # Validate status is still actionable
    if invite.get("status") not in ("pending", "initiator_paid"):
        if invite.get("status") == "accepted":
            raise HTTPException(status_code=409, detail="Invite already accepted")
        if invite.get("status") == "declined":
            raise HTTPException(status_code=409, detail="Invite already declined")
        raise HTTPException(status_code=410, detail="Invite expired")

    # Expiry re-check (race condition guard)
    try:
        expires = datetime.fromisoformat(invite["expires_at"])
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
    except Exception:
        expires = None

    if expires and expires < datetime.now(timezone.utc):
        await db.doubles_invites.update_one(
            {"token": body.token}, {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=410, detail="Invite expired")

    league_id = invite["league_id"]
    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        league = None
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    league_name = league.get("name", "the league")

    # ── DECLINE ───────────────────────────────────────────────────────────────
    if body.action == "decline":
        await db.doubles_invites.update_one(
            {"token": body.token}, {"$set": {"status": "declined"}}
        )
        # Notify initiator
        initiator_id = invite["initiator_id"]
        try:
            initiator = await db.users.find_one({"_id": ObjectId(initiator_id)})
        except Exception:
            initiator = None
        if initiator and initiator.get("email"):
            initiator_name = invite.get("initiator_name", initiator.get("name", ""))
            email_service.schedule(email_service.send_partner_declined(
                initiator["email"], initiator_name, league_name
            ))
        return {"declined": True}

    # ── ACCEPT ────────────────────────────────────────────────────────────────
    if body.action != "accept":
        raise HTTPException(status_code=400, detail="action must be 'accept' or 'decline'")

    if not body.waiver_accepted:
        raise HTTPException(status_code=400, detail="You must accept the Liability Waiver to register")

    # P2 cannot be the same person as P1
    if str(current_user["_id"]) == str(invite["initiator_id"]):
        raise HTTPException(status_code=400, detail="Cannot confirm your own invite")

    # P2 not already registered in this league
    p2_existing = await db.player_leagues.find_one(
        {"league_id": league_id, "player_id": current_user["_id"]}
    )
    if p2_existing:
        raise HTTPException(status_code=409, detail="You are already registered in this league")

    # Atomic spot reservation — TOCTOU guard
    result = await db.leagues.find_one_and_update(
        {
            "_id": ObjectId(league_id),
            "$expr": {"$lte": [{"$add": ["$current_players", 2]}, "$max_players"]},
        },
        {"$inc": {"current_players": 2}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=409, detail="No spots available — league is full")

    # Record partner on invite
    invite_status_before = invite.get("status", "pending")
    await db.doubles_invites.update_one(
        {"token": body.token},
        {"$set": {"partner_user_id": current_user["_id"]}},
    )
    # Re-fetch invite with partner_user_id set
    invite["partner_user_id"] = current_user["_id"]

    entry_fee = float(league.get("entry_fee", 0))

    # Soft gender check for mixed_doubles
    gender_warning = None
    if league.get("format") == "mixed_doubles":
        p1 = await db.users.find_one({"_id": ObjectId(invite["initiator_id"])}, {"gender": 1})
        p2 = await db.users.find_one({"_id": ObjectId(current_user["_id"])}, {"gender": 1})
        p1_gender = p1.get("gender") if p1 else None
        p2_gender = p2.get("gender") if p2 else None
        if p1_gender and p2_gender and p1_gender == p2_gender:
            gender_warning = "Mixed doubles requires one male and one female player. Please verify your team composition."

    if entry_fee == 0 or invite_status_before == "initiator_paid":
        # Free league OR initiator already paid — create both PlayerLeague records now
        await _create_doubles_pair(db, invite, league, current_user)
        await db.doubles_invites.update_one(
            {"token": body.token}, {"$set": {"status": "accepted"}}
        )
        return {"accepted": True, "league_id": league_id, "gender_warning": gender_warning}

    # Paid league (initiator hasn't paid) — create Stripe checkout for initiator (P1)
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
    stripe_currency = "usd"
    stripe_amount = entry_fee if currency == "usd" else round(entry_fee / 83.0, 2)

    frontend_url = email_service._get_frontend_url() or "https://venlaxsports.com"
    success_url = f"{frontend_url}/leagues/{league_id}?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{frontend_url}/leagues/{league_id}"

    checkout_req = CheckoutSessionRequest(
        amount=stripe_amount,
        currency=stripe_currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "league_id": league_id,
            "user_id": invite["initiator_id"],
            "invite_token": invite["token"],
            "is_doubles": "true",
        },
    )
    session = await stripe.create_checkout_session(checkout_req)

    await db.doubles_invites.update_one(
        {"token": body.token},
        {"$set": {"payment_session_id": session.session_id, "status": "accepted"}},
    )

    return {
        "accepted": True,
        "requires_payment": True,
        "checkout_url": session.url,
        "gender_warning": gender_warning,
    }


# ── DELETE /{token} ───────────────────────────────────────────────────────────

@router.delete("/{token}")
async def cancel_doubles_invite(token: str, request: Request):
    """Initiator (P1) cancels a pending outbound invite."""
    db = request.app.state.db
    user = await get_current_user(request, db)

    invite = await db.doubles_invites.find_one({"token": token})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["initiator_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Only the initiator can cancel this invite")
    if invite.get("status") != "pending":
        raise HTTPException(status_code=409, detail=f"Invite is already {invite.get('status')}")

    await db.doubles_invites.update_one(
        {"token": token}, {"$set": {"status": "cancelled"}}
    )
    return {"cancelled": True}


# ── GET /my-invites ───────────────────────────────────────────────────────────

@router.get("/my-invites")
async def my_doubles_invites(request: Request):
    """Pending outbound invites where the current user is the initiator (P1)."""
    db = request.app.state.db
    user = await get_current_user(request, db)

    invites = await db.doubles_invites.find(
        {"initiator_id": user["_id"], "status": "pending"}
    ).sort("created_at", -1).to_list(50)

    result = []
    for inv in invites:
        league_name = "Unknown League"
        try:
            league = await db.leagues.find_one({"_id": ObjectId(inv["league_id"])})
            if league:
                league_name = league["name"]
        except Exception:
            pass
        result.append({
            "token": inv["token"],
            "league_name": league_name,
            "partner_email": inv.get("partner_email", ""),
            "expires_at": inv.get("expires_at", ""),
            "status": inv.get("status", "pending"),
        })

    return {"invites": result}


# ── Shared helper ─────────────────────────────────────────────────────────────

async def _create_doubles_pair(db, invite: dict, league: dict, partner_user: dict):
    """Create PlayerLeague records for both P1 and P2.

    Idempotent — duplicate key errors (from the unique index) are silently swallowed.
    Called for free leagues (here) and paid leagues (from payment_routes after Stripe confirms).
    """
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()

    # Resolve P1 user doc for name
    try:
        p1 = await db.users.find_one({"_id": ObjectId(invite["initiator_id"])})
    except Exception:
        p1 = None
    p1_name = (
        f"{p1.get('first_name', '')} {p1.get('last_name', '')}".strip()
        if p1 and (p1.get("first_name") or p1.get("last_name"))
        else (p1.get("name", "") if p1 else invite.get("initiator_name", ""))
    )

    p2_name = (
        f"{partner_user.get('first_name', '')} {partner_user.get('last_name', '')}".strip()
        if partner_user.get("first_name") or partner_user.get("last_name")
        else partner_user.get("name", "")
    )

    payment_status = "free" if float(league.get("entry_fee", 0)) == 0 else "paid"

    p1_record = {
        "league_id": invite["league_id"],
        "player_id": invite["initiator_id"],
        "player_name": p1_name,
        "sport": league.get("sport", ""),
        "registered_at": now,
        "payment_status": payment_status,
        "partner_id": partner_user["_id"],
        "partner_name": p2_name,
        "invite_token": invite["token"],
    }
    p2_record = {
        "league_id": invite["league_id"],
        "player_id": partner_user["_id"],
        "player_name": p2_name,
        "sport": league.get("sport", ""),
        "registered_at": now,
        "payment_status": payment_status,
        "partner_id": invite["initiator_id"],
        "partner_name": p1_name,
        "invite_token": invite["token"],
    }

    try:
        await db.player_leagues.insert_one(p1_record)
    except Exception:
        pass  # already exists — idempotent

    try:
        await db.player_leagues.insert_one(p2_record)
    except Exception:
        pass  # already exists — idempotent

    # Confirmation emails (best effort)
    league_name = league.get("name", "your league")
    sport = league.get("sport", "tennis")
    league_id = invite["league_id"]

    p1_email = p1.get("email", "") if p1 else ""
    p2_email = partner_user.get("email", "")

    if p1_email:
        email_service.schedule(email_service.send_registration_confirmed(
            p1_email, p1_name, league_name, sport, league_id, paid=(payment_status == "paid")
        ))
    if p2_email:
        email_service.schedule(email_service.send_registration_confirmed(
            p2_email, p2_name, league_name, sport, league_id, paid=(payment_status == "paid")
        ))
