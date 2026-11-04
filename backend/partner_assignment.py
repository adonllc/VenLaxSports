"""Database side of admin-assisted partner assignment.

A waiting team is a doubles_invites row in WAITING status with no partner. Assigning two of them
makes the earlier registrant's invite the team record and absorbs the other invite ("merged").
"""
from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId

import email_service
import partner_matching

WAITING = ("pending", "initiator_paid")


def change_window_open(league: dict, now: datetime) -> bool:
    """Players may ask for a different partner until the league's start date."""
    start = str(league.get("start_date") or "")[:10]
    return league.get("status") == "registration" and bool(start) and now.date().isoformat() < start


async def waiting_candidates(db, league: dict):
    """Opted-in waiting teams of one league. Returns (candidates, skipped); skipped = [{name, reason}]."""
    lid = str(league["_id"])
    paid_league = float(league.get("entry_fee") or 0) > 0
    invites = await db.doubles_invites.find(
        {"league_id": lid, "status": {"$in": list(WAITING)}, "auto_assign_opt_in": True}
    ).to_list(500)
    candidates, skipped = [], []
    for invite in invites:
        if invite.get("partner_user_id"):
            continue
        try:
            user = await db.users.find_one({"_id": ObjectId(invite["initiator_id"])})
        except Exception:
            user = None
        if not user:
            continue
        name = user.get("name") or invite.get("initiator_name", "")
        if paid_league and invite.get("status") != "initiator_paid":
            skipped.append({"name": name, "reason": "Has not paid yet"})
            continue
        profile = user.get("play_profile") or {}
        candidates.append({
            "token": invite["token"],
            "user_id": str(user["_id"]),
            "name": name,
            "email": user.get("email", ""),
            "gender": user.get("gender"),
            "city": user.get("city") or "",
            "zip_code": user.get("zip_code") or "",
            "level": partner_matching.player_level(user, league.get("sport", "tennis")),
            "court_side": profile.get("court_side"),
            "availability": profile.get("availability") or [],
            "registered_at": invite.get("created_at", ""),
            "rejected": invite.get("rejected_partner_ids") or [],
            "paid": invite.get("status") == "initiator_paid",
        })
    return candidates, skipped


async def assign_pair(db, token_a: str, token_b: str, now: datetime | None = None) -> dict:
    """Make the two waiting players a team. Raises ValueError(message) when the pair is not allowed."""
    from routes.doubles_routes import _create_doubles_pair, mixed_gender_error

    now = now or datetime.now(timezone.utc)
    if token_a == token_b:
        raise ValueError("Pick two different players")
    a = await db.doubles_invites.find_one({"token": token_a})
    b = await db.doubles_invites.find_one({"token": token_b})
    if not a or not b:
        raise ValueError("One of the teams no longer exists")
    if a["league_id"] != b["league_id"]:
        raise ValueError("Both players must be in the same league")
    try:
        league = await db.leagues.find_one({"_id": ObjectId(a["league_id"])})
    except Exception:
        league = None
    if not league:
        raise ValueError("League not found")
    if league.get("status") != "registration":
        raise ValueError("League registration is closed")

    fee = float(league.get("entry_fee") or 0)
    for invite in (a, b):
        who = invite.get("initiator_name", "A player")
        if invite.get("status") not in WAITING or invite.get("partner_user_id"):
            raise ValueError(f"{who} is no longer waiting for a partner")
        if not invite.get("auto_assign_opt_in"):
            raise ValueError(f"{who} has not agreed to be paired by VenLax")
        if fee > 0 and invite.get("status") != "initiator_paid":
            raise ValueError(f"{who} has not paid yet")
    if a["initiator_id"] == b["initiator_id"]:
        raise ValueError("Pick two different players")
    if b["initiator_id"] in (a.get("rejected_partner_ids") or []) or a["initiator_id"] in (b.get("rejected_partner_ids") or []):
        raise ValueError("These two players asked not to be paired")

    # The earlier registrant keeps the team record; the later one is flagged for a refund
    if (b.get("created_at") or "") < (a.get("created_at") or ""):
        a, b = b, a
        token_a, token_b = token_b, token_a

    pa = await db.users.find_one({"_id": ObjectId(a["initiator_id"])})
    pb = await db.users.find_one({"_id": ObjectId(b["initiator_id"])})
    if not pa or not pb:
        raise ValueError("A player account no longer exists")
    if league.get("format") == "mixed_doubles":
        reason = mixed_gender_error(pa.get("gender"), pb.get("gender"))
        if reason:
            raise ValueError(reason)

    reserved = await db.leagues.find_one_and_update(
        {"_id": league["_id"], "$expr": {"$lte": [{"$add": ["$current_players", 2]}, "$max_players"]}},
        {"$inc": {"current_players": 2}},
    )
    if not reserved:
        raise ValueError("No spots left in this league")

    b_id = str(pb["_id"])
    partner_doc = {
        "_id": b_id, "id": b_id, "email": pb.get("email", ""), "name": pb.get("name", ""),
        "first_name": pb.get("first_name", ""), "last_name": pb.get("last_name", ""),
    }
    try:
        await _create_doubles_pair(db, {**a, "partner_user_id": b_id}, league, partner_doc, send_emails=False)
    except Exception:
        await db.leagues.update_one({"_id": league["_id"]}, {"$inc": {"current_players": -2}})
        raise

    refund_due = fee > 0 and b.get("status") == "initiator_paid"
    await db.doubles_invites.update_one({"token": token_a}, {"$set": {
        "status": "accepted", "partner_user_id": b_id, "partner_email": pb.get("email", ""),
        "partner_added_by_initiator": False, "assigned_by_admin": True, "assigned_at": now.isoformat(),
        "status_before_assign": a.get("status"), "merged_token": token_b, "partner_change_request": None,
    }})
    await db.doubles_invites.update_one({"token": token_b}, {"$set": {
        "status": "merged", "merged_into": token_a, "status_before_merge": b.get("status"),
        "refund_due": refund_due, "refunded_at": None,
    }})

    name_a, name_b = pa.get("name", ""), pb.get("name", "")
    league_name, start = league.get("name", "the league"), league.get("start_date", "")
    for to, me, other in ((pa.get("email"), name_a, name_b), (pb.get("email"), name_b, name_a)):
        if to:
            email_service.schedule(email_service.send_partner_assigned(to, me, other, league_name, start))
    return {"team_token": token_a, "refund_due": refund_due, "players": [name_a, name_b]}


async def team_info(db, league: dict, user_id: str, now: datetime):
    """What the dashboard shows for a doubles player's team. None unless VenLax paired the team."""
    rec = await db.player_leagues.find_one({"league_id": str(league["_id"]), "player_id": user_id})
    token = (rec or {}).get("invite_token")
    if not token:
        return None
    invite = await db.doubles_invites.find_one({"token": token})
    if not invite or not invite.get("assigned_by_admin"):
        return None
    status = (invite.get("partner_change_request") or {}).get("status")
    return {
        "invite_token": token,
        "partner_name": rec.get("partner_name", ""),
        "assigned_by_venlax": True,
        "change_request": status,
        "can_request_change": change_window_open(league, now) and status not in ("pending", "declined"),
    }


async def dissolve_team(db, league: dict, team: dict) -> dict:
    """Undo an assignment: both players go back to waiting and are never offered to each other again.

    Raises ValueError when the league has started or the team was not paired by VenLax.
    If the absorbed player's payment was already refunded, they come back as unpaid (repay_required).
    """
    if league.get("status") != "registration":
        raise ValueError("The league has started. Handle this team by hand.")
    if not team.get("assigned_by_admin") or not team.get("partner_user_id"):
        raise ValueError("This team was not paired by VenLax")

    token_a = team["token"]
    p1, p2 = team["initiator_id"], team["partner_user_id"]
    await db.player_leagues.delete_many({"league_id": str(league["_id"]), "invite_token": token_a})
    await db.leagues.update_one({"_id": league["_id"]}, {"$inc": {"current_players": -2}})
    await db.doubles_invites.update_one({"token": token_a}, {
        "$set": {"status": team.get("status_before_assign") or "pending", "partner_user_id": None,
                 "partner_email": "", "assigned_by_admin": False, "merged_token": None},
        "$push": {"rejected_partner_ids": p2},
    })

    repay = False
    absorbed = await db.doubles_invites.find_one({"token": team["merged_token"]}) if team.get("merged_token") else None
    if absorbed:
        repay = bool(absorbed.get("refunded_at"))
        await db.doubles_invites.update_one({"token": absorbed["token"]}, {
            "$set": {"status": "pending" if repay else (absorbed.get("status_before_merge") or "pending"),
                     "merged_into": None, "refund_due": False},
            "$push": {"rejected_partner_ids": p1},
        })
    return {"repay_required": repay, "players": [p1, p2]}
