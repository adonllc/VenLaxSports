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
from pydantic import BaseModel
from typing import Optional
import email_service
import os

router = APIRouter(redirect_slashes=False)

GENDERS = ("male", "female")


def invite_expiry(league: dict, now: datetime) -> str:
    """A doubles invite stays open until the league starts and stays visible to admin 30 more days.

    Never shorter: a team whose first player has paid must not lose its record while the partner is still unknown."""
    from datetime import timedelta
    try:
        start = datetime.fromisoformat(str(league.get("start_date", ""))[:10]).replace(tzinfo=timezone.utc)
    except ValueError:
        start = now + timedelta(days=30)
    return (max(start, now) + timedelta(days=30)).isoformat()


def mixed_gender_error(gender_a, gender_b) -> Optional[str]:
    """Mixed doubles is one male and one female. Returns the reason a pair is not allowed, or None."""
    if gender_a not in GENDERS or gender_b not in GENDERS:
        return "Mixed doubles needs both players to have a gender (male or female) on their profile."
    if gender_a == gender_b:
        return "Mixed doubles requires one male and one female player."
    return None


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
        if invite.get("status") == "initiator_paid":
            # The first player has paid: keep the team open so they can name another partner
            await db.doubles_invites.update_one(
                {"token": body.token}, {"$set": {"partner_email": "", "partner_user_id": None}}
            )
        else:
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

    if league.get("format") == "mixed_doubles":
        p1 = await db.users.find_one({"_id": ObjectId(invite["initiator_id"])}, {"gender": 1})
        reason = mixed_gender_error((p1 or {}).get("gender"), current_user.get("gender"))
        if reason:
            raise HTTPException(status_code=400, detail=reason)

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

    gender_warning = None  # kept in the response for older clients; the gender rule is now enforced above

    if entry_fee == 0 or invite_status_before == "initiator_paid":
        # Free league OR initiator already paid — create both PlayerLeague records now
        await _create_doubles_pair(db, invite, league, current_user)
        await db.doubles_invites.update_one(
            {"token": body.token}, {"$set": {"status": "accepted"}}
        )
        return {"accepted": True, "league_id": league_id, "gender_warning": gender_warning}

    # Paid league (initiator hasn't paid) — create Stripe checkout for initiator (P1)
    import stripe

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Payment processing is not configured. Please contact support.")

    stripe.api_key = api_key

    currency = league.get("currency", "USD").lower()
    stripe_currency = "usd"
    stripe_amount = int(entry_fee * 100)  # Convert to cents

    frontend_url = email_service._get_frontend_url() or "https://venlaxsports.com"
    success_url = f"{frontend_url}/leagues/{league_id}?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{frontend_url}/leagues/{league_id}"

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": stripe_currency,
                        "product_data": {
                            "name": league["name"],
                        },
                        "unit_amount": stripe_amount,
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "league_id": str(league_id),
                "user_id": str(invite["initiator_id"]),
                "invite_token": invite["token"],
                "is_doubles": "true",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Failed to create checkout session: {str(e)}")

    await db.doubles_invites.update_one(
        {"token": body.token},
        {"$set": {"payment_session_id": session.id, "status": "accepted"}},
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
        {"initiator_id": user["_id"], "status": {"$in": ["pending", "initiator_paid"]}}
    ).sort("created_at", -1).to_list(50)

    result = []
    for inv in invites:
        league_name = "Unknown League"
        entry_fee = 0.0
        try:
            league = await db.leagues.find_one({"_id": ObjectId(inv["league_id"])})
            if league:
                league_name = league["name"]
                entry_fee = float(league.get("entry_fee", 0))
        except Exception:
            pass
        result.append({
            "token": inv["token"],
            "league_name": league_name,
            "league_id": inv.get("league_id", ""),
            "entry_fee": entry_fee,
            "partner_email": inv.get("partner_email", ""),
            "partner_later": bool(inv.get("partner_later")),
            "paid": inv.get("status") == "initiator_paid",
            "expires_at": inv.get("expires_at", ""),
            "status": inv.get("status", "pending"),
        })

    return {"invites": result}


# ── POST /{token}/partner ─────────────────────────────────────────────────────

class AddPartnerRequest(BaseModel):
    partner_id: Optional[str] = None
    partner_email: Optional[str] = None


@router.post("/{token}/partner")
async def add_partner(token: str, body: AddPartnerRequest, request: Request):
    """Initiator (P1) names the partner of a team that registered first: a VenLax player (team is
    completed now) or an email (the partner gets the invite and confirms). Allowed until the league starts."""
    db = request.app.state.db
    user = await get_current_user(request, db)

    invite = await db.doubles_invites.find_one({"token": token})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["initiator_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Only the initiator can add a partner")
    if invite.get("status") not in ("pending", "initiator_paid"):
        raise HTTPException(status_code=409, detail=f"This team is already {invite.get('status')}")
    if not body.partner_id and not (body.partner_email or "").strip():
        raise HTTPException(status_code=400, detail="Select a partner or enter a partner email")

    try:
        league = await db.leagues.find_one({"_id": ObjectId(invite["league_id"])})
    except Exception:
        league = None
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    if league.get("status") != "registration":
        raise HTTPException(status_code=400, detail="League registration is closed")

    league_name = league.get("name", "the league")
    entry_fee = float(league.get("entry_fee", 0))
    initiator_name = invite.get("initiator_name", user.get("name", ""))

    # Partner is a VenLax player: complete the team now
    if body.partner_id:
        if entry_fee > 0 and invite.get("status") != "initiator_paid":
            raise HTTPException(status_code=400, detail="Complete your payment first, then add your partner")
        try:
            partner = await db.users.find_one({"_id": ObjectId(body.partner_id)})
        except Exception:
            partner = None
        if not partner:
            raise HTTPException(status_code=404, detail="Partner not found")
        partner_id = str(partner["_id"])
        if partner_id == str(user["_id"]):
            raise HTTPException(status_code=400, detail="Cannot partner with yourself")
        if await db.player_leagues.find_one({"league_id": invite["league_id"], "player_id": partner_id}):
            raise HTTPException(status_code=409, detail="Partner already registered in this league")
        if league.get("format") == "mixed_doubles":
            reason = mixed_gender_error(user.get("gender"), partner.get("gender"))
            if reason:
                raise HTTPException(status_code=400, detail=reason)

        reserved = await db.leagues.find_one_and_update(
            {"_id": league["_id"], "$expr": {"$lte": [{"$add": ["$current_players", 2]}, "$max_players"]}},
            {"$inc": {"current_players": 2}},
        )
        if not reserved:
            raise HTTPException(status_code=409, detail="Not enough spots — league is full")

        await db.doubles_invites.update_one({"token": token}, {"$set": {
            "partner_user_id": partner_id, "partner_email": partner.get("email", ""), "partner_added_by_initiator": True,
        }})
        invite["partner_user_id"] = partner_id
        partner_doc = {
            "_id": partner_id, "id": partner_id, "email": partner.get("email", ""), "name": partner.get("name", ""),
            "first_name": partner.get("first_name", ""), "last_name": partner.get("last_name", ""),
        }
        await _create_doubles_pair(db, invite, league, partner_doc, notify_partner_as_added=True)
        await db.doubles_invites.update_one({"token": token}, {"$set": {"status": "accepted"}})
        return {"registered": True, "partner_name": partner.get("name", "")}

    # Partner is invited by email
    partner_email = body.partner_email.lower().strip()
    if partner_email == (user.get("email") or "").lower():
        raise HTTPException(status_code=400, detail="Cannot invite yourself as partner")
    await db.doubles_invites.update_one({"token": token}, {"$set": {"partner_email": partner_email}})
    frontend_url = email_service._get_frontend_url() or "https://venlaxsports.com"
    email_service.schedule(email_service.send_partner_invite(
        partner_email, initiator_name, league_name, league.get("sport", "tennis"), entry_fee,
        f"{frontend_url}/doubles-invite/confirm?token={token}",
    ))
    return {"invited": True, "partner_email": partner_email}


# ── Shared helper ─────────────────────────────────────────────────────────────

async def _create_doubles_pair(db, invite: dict, league: dict, partner_user: dict,
                                notify_partner_as_added: bool = False):
    """Create PlayerLeague records for both P1 and P2.

    Idempotent — duplicate key errors (from the unique index) are silently swallowed.
    Called for free leagues (here) and paid leagues (from payment_routes after Stripe confirms).

    notify_partner_as_added: True when P2 was directly selected by P1 and never took
    an accept action themselves (direct partner-select flow) — P2 gets a "you were
    added as a partner" notification instead of the standard confirmation email.
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

    entry_fee = float(league.get("entry_fee", 0))

    if p1_email:
        email_service.schedule(email_service.send_registration_confirmed(
            p1_email, p1_name, league_name, sport, league_id,
            paid=(payment_status == "paid"), amount=entry_fee, currency=league.get("currency", "USD"),
        ))
    if p2_email:
        if notify_partner_as_added:
            email_service.schedule(email_service.send_partner_registered(
                p2_email, p2_name, p1_name, league_name, sport, league_id,
                city=league.get("city", ""), venue=league.get("venue"), start_date=league.get("start_date", ""),
                paid=(payment_status == "paid"), amount=entry_fee, currency=league.get("currency", "USD"),
            ))
        else:
            email_service.schedule(email_service.send_registration_confirmed(
                p2_email, p2_name, league_name, sport, league_id,
                paid=(payment_status == "paid"), amount=entry_fee, currency=league.get("currency", "USD"),
            ))
