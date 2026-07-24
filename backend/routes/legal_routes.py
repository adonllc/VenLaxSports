from fastapi import APIRouter, HTTPException, status, Request
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List

from models import User, DisputeEscalation, OrganizerDecision, PlayerAppeal
from auth_utils import get_current_user

router = APIRouter(prefix="/api/legal", tags=["legal"])


# ─── Parental Consent ──────────────────────────────────
@router.post("/parental-consent")
async def submit_parental_consent(
    player_id: str,
    guardian_name: str,
    relationship: str,
    consent: bool,
    request: Request,
):
    """Submit parental consent for <18 player."""
    db = request.app.state.db
    current_user = await get_current_user(request, db)

    if not consent:
        raise HTTPException(status_code=400, detail="Parental consent required")

    user = await db.users.find_one({"_id": ObjectId(player_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Player not found")

    # Update user with parental consent
    result = await db.users.update_one(
        {"_id": ObjectId(player_id)},
        {
            "$set": {
                "parental_consent": True,
                "parental_consent_guardian_name": guardian_name,
                "parental_consent_timestamp": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Player not found")

    return {
        "message": "Parental consent recorded",
        "player_id": player_id,
        "guardian_name": guardian_name,
    }


# ─── Dispute Escalation ────────────────────────────────
@router.post("/disputes")
async def create_dispute(
    league_id: str,
    dispute_type: str,  # score|conduct|playoff_seeding|rating
    description: str,
    request: Request,
    reported_against_id: Optional[str] = None,
    evidence: Optional[List[str]] = None,
    match_id: Optional[str] = None,
):
    """Report a score, conduct, or playoff seeding dispute."""
    db = request.app.state.db
    current_user = await get_current_user(request, db)

    # Validate dispute type
    valid_types = ["score", "conduct", "playoff_seeding", "rating"]
    if dispute_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid dispute type. Must be one of {valid_types}")

    dispute = DisputeEscalation(
        league_id=league_id,
        dispute_type=dispute_type,
        reported_by_id=current_user["_id"],
        reported_by_name=current_user["name"],
        reported_against_id=reported_against_id,
        description=description,
        evidence=evidence or [],
        match_id=match_id,
        status="pending",
    )

    result = await db.disputes.insert_one(dispute.to_mongo())
    return {"message": "Dispute created", "dispute_id": str(result.inserted_id)}


@router.get("/disputes/{dispute_id}")
async def get_dispute(
    dispute_id: str,
    request: Request,
):
    """Get dispute details."""
    db = request.app.state.db
    current_user = await get_current_user(request, db)

    dispute = await db.disputes.find_one({"_id": ObjectId(dispute_id)})
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    return DisputeEscalation.from_mongo(dispute)


@router.get("/disputes")
async def list_disputes(
    request: Request,
    league_id: Optional[str] = None,
    status: Optional[str] = None,
):
    """List disputes. Organizers can see all; players see their own."""
    db = request.app.state.db
    current_user = await get_current_user(request, db)

    query = {}
    if league_id:
        query["league_id"] = league_id
    if status:
        query["status"] = status

    # If player (not organizer), filter to disputes they reported or against them
    if current_user["role"] != "admin" and current_user["role"] != "city_admin":
        query["$or"] = [
            {"reported_by_id": current_user["_id"]},
            {"reported_against_id": current_user["_id"]},
        ]

    disputes = await db.disputes.find(query).to_list(100)
    return [DisputeEscalation.from_mongo(d) for d in disputes]


# ─── Organizer Decision ────────────────────────────────
@router.post("/disputes/{dispute_id}/decision")
async def issue_decision(
    dispute_id: str,
    decision: str,
    ruling_type: str,  # upheld|overturned|remanded|partial
    request: Request,
    penalty: Optional[str] = None,
    penalty_duration: Optional[str] = None,
):
    """Organizer issues final decision on dispute."""
    db = request.app.state.db
    current_user = await get_current_user(request, db)

    # Verify organizer authority
    if current_user["role"] not in ["admin", "city_admin"]:
        raise HTTPException(status_code=403, detail="Only organizers can issue decisions")

    dispute = await db.disputes.find_one({"_id": ObjectId(dispute_id)})
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    # Create decision record
    org_decision = OrganizerDecision(
        dispute_id=dispute_id,
        organizer_id=current_user["_id"],
        organizer_name=current_user["name"],
        decision=decision,
        ruling_type=ruling_type,
        penalty=penalty,
        penalty_duration=penalty_duration,
        appeal_eligible=True,
    )

    result = await db.decisions.insert_one(org_decision.to_mongo())

    # Update dispute status
    await db.disputes.update_one(
        {"_id": ObjectId(dispute_id)},
        {"$set": {"status": "resolved", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    return {"message": "Decision issued", "decision_id": str(result.inserted_id)}


# ─── Player Appeal ────────────────────────────────────
@router.post("/decisions/{decision_id}/appeal")
async def appeal_decision(
    decision_id: str,
    appeal_reason: str,
    request: Request,
    evidence: Optional[List[str]] = None,
):
    """Player appeals an organizer decision within 7-day window."""
    db = request.app.state.db
    current_user = await get_current_user(request, db)

    decision = await db.decisions.find_one({"_id": ObjectId(decision_id)})
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    if not decision.get("appeal_eligible"):
        raise HTTPException(status_code=400, detail="This decision is not eligible for appeal")

    appeal = PlayerAppeal(
        decision_id=decision_id,
        player_id=current_user["_id"],
        player_name=current_user["name"],
        appeal_reason=appeal_reason,
        evidence=evidence or [],
        status="pending",
    )

    result = await db.appeals.insert_one(appeal.to_mongo())
    return {"message": "Appeal submitted", "appeal_id": str(result.inserted_id)}


# ─── Terms Acceptance ──────────────────────────────────
@router.post("/terms/accept")
async def accept_terms(
    request: Request,
):
    """Mark terms as accepted by current user."""
    db = request.app.state.db
    current_user = await get_current_user(request, db)

    result = await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {
            "$set": {
                "terms_accepted": True,
                "terms_accepted_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "Terms accepted"}


# ─── Emergency Contact ────────────────────────────────
@router.post("/emergency-contact/update")
async def update_emergency_contact(
    emergency_contact_name: str,
    emergency_contact_phone: str,
    request: Request,
):
    """Update emergency contact info."""
    db = request.app.state.db
    current_user = await get_current_user(request, db)

    result = await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {
            "$set": {
                "emergency_contact_name": emergency_contact_name,
                "emergency_contact_phone": emergency_contact_phone,
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "Emergency contact updated"}
