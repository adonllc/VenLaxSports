from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from bson import ObjectId
from models import Match, MatchCreate, MatchScore
from auth_utils import get_current_user
from rating_utils import delta_for, rating_field_for, clamp
import email_service

router = APIRouter(redirect_slashes=False)


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


def _should_notify(user: dict) -> bool:
    return bool(user and user.get("email") and user.get("email_notifications", True))


@router.get("/my")
async def my_matches(request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)
    uid = user["_id"]
    matches = await db.matches.find(
        {"$or": [{"player1_id": uid}, {"player2_id": uid}]}
    ).sort("scheduled_date", -1).to_list(50)
    return [_serialize(m) for m in matches]


@router.post("")
@router.post("/")
async def create_match(data: MatchCreate, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)

    try:
        league = await db.leagues.find_one({"_id": ObjectId(data.league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    in_league = await db.player_leagues.find_one({"player_id": user["_id"], "league_id": data.league_id})
    if not in_league:
        raise HTTPException(status_code=400, detail="You are not registered in this league")

    try:
        opponent = await db.users.find_one({"_id": ObjectId(data.player2_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Opponent not found")
    if not opponent:
        raise HTTPException(status_code=404, detail="Opponent not found")

    match = Match(
        league_id=data.league_id,
        sport=league["sport"],
        player1_id=user["_id"],
        player2_id=data.player2_id,
        player1_name=user["name"],
        player2_name=opponent["name"],
        scheduled_date=data.scheduled_date,
        venue=data.venue or league.get("venue"),
        notes=data.notes,
    )
    result = await db.matches.insert_one(match.to_mongo())
    match_id = str(result.inserted_id)

    # Notify both players (fire-and-forget)
    if _should_notify(user):
        email_service.schedule(email_service.send_match_scheduled(
            user["email"], user["name"], opponent["name"], league["sport"],
            data.scheduled_date, data.venue or league.get("venue"), match_id))
    if _should_notify(opponent):
        email_service.schedule(email_service.send_match_scheduled(
            opponent["email"], opponent["name"], user["name"], league["sport"],
            data.scheduled_date, data.venue or league.get("venue"), match_id))

    return {"id": match_id, "message": "Match scheduled"}


@router.post("/{match_id}/score")
async def report_score(match_id: str, score_data: MatchScore, request: Request):
    db = request.app.state.db
    user = await get_current_user(request, db)

    try:
        match = await db.matches.find_one({"_id": ObjectId(match_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Match not found")
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if user["_id"] not in [match["player1_id"], match["player2_id"]]:
        raise HTTPException(status_code=403, detail="Not a player in this match")
    if match["status"] == "completed":
        raise HTTPException(status_code=400, detail="Match already completed")

    winner_name = (
        match["player1_name"] if score_data.winner_id == match["player1_id"] else match["player2_name"]
    )
    await db.matches.update_one(
        {"_id": ObjectId(match_id)},
        {
            "$set": {
                "status": "completed",
                "winner_id": score_data.winner_id,
                "winner_name": winner_name,
                "score_data": score_data.score_data,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    await _update_standings(db, match["league_id"], match, score_data.winner_id)

    # Rating updates (tennis / pickleball only — cricket is team-based)
    rating_change = None
    try:
        rating_change = await _update_ratings(db, match, score_data.winner_id)
    except Exception:
        pass

    # Playoff advancement: if this match was a playoff match and its round is now fully
    # scored, auto-create the next round pairing winners in bracket order.
    next_round_created = None
    try:
        if match.get("is_playoff"):
            next_round_created = await _maybe_advance_playoffs(db, match["league_id"], match.get("bracket_round", 1))
    except Exception:
        pass

    # Notify both players with the result
    try:
        league = await db.leagues.find_one({"_id": ObjectId(match["league_id"])})
        league_name = league.get("name", "your league") if league else "your league"
        p1 = await db.users.find_one({"_id": ObjectId(match["player1_id"])})
        p2 = await db.users.find_one({"_id": ObjectId(match["player2_id"])})
        for p, opp_name in ((p1, match["player2_name"]), (p2, match["player1_name"])):
            if _should_notify(p):
                won = str(p["_id"]) == str(score_data.winner_id)
                email_service.schedule(email_service.send_score_reported(
                    p["email"], p["name"], opp_name, match["sport"],
                    won, match["league_id"], league_name))
    except Exception:
        pass

    resp = {"message": "Score reported successfully"}
    if rating_change:
        resp["rating_change"] = rating_change
    if next_round_created:
        resp["next_round_created"] = next_round_created
    return resp


@router.get("/{match_id}")
async def get_match(match_id: str, request: Request):
    db = request.app.state.db
    try:
        match = await db.matches.find_one({"_id": ObjectId(match_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Match not found")
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return _serialize(match)


async def _update_standings(db, league_id: str, match: dict, winner_id: str):
    loser_id = match["player2_id"] if winner_id == match["player1_id"] else match["player1_id"]
    now = datetime.now(timezone.utc).isoformat()
    await db.standings.update_one(
        {"league_id": league_id, "player_id": winner_id},
        {"$inc": {"wins": 1, "matches_played": 1, "points": 2}, "$set": {"updated_at": now}},
    )
    await db.standings.update_one(
        {"league_id": league_id, "player_id": loser_id},
        {"$inc": {"losses": 1, "matches_played": 1}, "$set": {"updated_at": now}},
    )


async def _update_ratings(db, match: dict, winner_id: str):
    """Apply ELO-style rating delta to winner + loser for tennis/pickleball.

    Returns a dict with old/new ratings and writes rating_history snapshots.
    """
    sport = match["sport"]
    field = rating_field_for(sport)
    if not field or sport == "cricket":
        return None  # cricket uses team NRR instead

    loser_id = match["player2_id"] if winner_id == match["player1_id"] else match["player1_id"]
    try:
        winner = await db.users.find_one({"_id": ObjectId(winner_id)})
        loser = await db.users.find_one({"_id": ObjectId(loser_id)})
    except Exception:
        return None
    if not winner or not loser:
        return None

    w_rating = float(winner.get(field, 3.0))
    l_rating = float(loser.get(field, 3.0))
    w_delta, l_delta = delta_for(w_rating, l_rating)
    w_new = clamp(w_rating + w_delta)
    l_new = clamp(l_rating + l_delta)

    await db.users.update_one({"_id": ObjectId(winner_id)}, {"$set": {field: w_new}})
    await db.users.update_one({"_id": ObjectId(loser_id)}, {"$set": {field: l_new}})

    now = datetime.now(timezone.utc).isoformat()
    match_id_str = str(match.get("_id", ""))
    await db.rating_history.insert_many([
        {"user_id": winner_id, "sport": sport, "rating": w_new, "delta": w_delta,
         "match_id": match_id_str, "league_id": match.get("league_id"),
         "opponent_id": loser_id, "opponent_name": loser.get("name"),
         "result": "win", "created_at": now},
        {"user_id": loser_id, "sport": sport, "rating": l_new, "delta": l_delta,
         "match_id": match_id_str, "league_id": match.get("league_id"),
         "opponent_id": winner_id, "opponent_name": winner.get("name"),
         "result": "loss", "created_at": now},
    ])

    return {
        "sport": sport,
        "winner": {"id": winner_id, "old": w_rating, "new": w_new, "delta": w_delta},
        "loser": {"id": loser_id, "old": l_rating, "new": l_new, "delta": l_delta},
    }


async def _maybe_advance_playoffs(db, league_id: str, round_num: int):
    """If every match in `round_num` is complete, create next-round matches by pairing winners."""
    round_matches = await db.matches.find(
        {"league_id": league_id, "is_playoff": True, "bracket_round": round_num}
    ).sort("bracket_position", 1).to_list(64)
    if not round_matches:
        return None
    if any(m.get("status") != "completed" for m in round_matches):
        return None
    if len(round_matches) == 1:
        # Final already played — mark league done
        await db.leagues.update_one(
            {"_id": ObjectId(league_id)},
            {"$set": {"playoffs_status": "completed", "status": "completed",
                      "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {"round": round_num, "league_completed": True}

    next_round = round_num + 1
    existing = await db.matches.count_documents(
        {"league_id": league_id, "is_playoff": True, "bracket_round": next_round}
    )
    if existing > 0:
        return None

    league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    venue = league.get("venue") if league else None
    sport = league.get("sport") if league else round_matches[0]["sport"]

    base_date = round_matches[0].get("scheduled_date", datetime.now(timezone.utc).isoformat())
    try:
        from datetime import timedelta
        base_dt = datetime.fromisoformat(str(base_date).replace("Z", "+00:00"))
        new_date = (base_dt + timedelta(days=7)).isoformat()
    except Exception:
        new_date = base_date

    # Round label depends on how many matches the next round will hold
    next_round_size = len(round_matches) // 2
    round_label = {1: "Final", 2: "Semifinal", 4: "Quarterfinal"}.get(
        next_round_size, f"Round {next_round}"
    )

    now = datetime.now(timezone.utc).isoformat()
    created_ids: list[str] = []
    for i in range(0, len(round_matches), 2):
        a = round_matches[i]
        b = round_matches[i + 1]
        winner_a_id = a["winner_id"]
        winner_b_id = b["winner_id"]
        winner_a_name = a.get("winner_name") or (
            a["player1_name"] if winner_a_id == a["player1_id"] else a["player2_name"]
        )
        winner_b_name = b.get("winner_name") or (
            b["player1_name"] if winner_b_id == b["player1_id"] else b["player2_name"]
        )
        m = Match(
            league_id=league_id,
            sport=sport,
            player1_id=winner_a_id,
            player2_id=winner_b_id,
            player1_name=winner_a_name,
            player2_name=winner_b_name,
            scheduled_date=new_date,
            venue=venue,
            notes=f"Playoff {round_label} — Match {(i // 2) + 1}",
        )
        doc = m.to_mongo()
        doc["is_playoff"] = True
        doc["bracket_round"] = next_round
        doc["bracket_position"] = (i // 2) + 1
        doc["created_at"] = now
        result = await db.matches.insert_one(doc)
        created_ids.append(str(result.inserted_id))

    await db.leagues.update_one(
        {"_id": ObjectId(league_id)},
        {"$set": {"playoffs_status": f"round_{next_round}", "updated_at": now}},
    )

    # Notify next-round players (best-effort)
    try:
        for mid in created_ids:
            new_match = await db.matches.find_one({"_id": ObjectId(mid)})
            if not new_match:
                continue
            p1 = await db.users.find_one({"_id": ObjectId(new_match["player1_id"])})
            p2 = await db.users.find_one({"_id": ObjectId(new_match["player2_id"])})
            for p, opp in ((p1, new_match["player2_name"]), (p2, new_match["player1_name"])):
                if _should_notify(p):
                    email_service.schedule(email_service.send_match_scheduled(
                        p["email"], p["name"], opp, sport,
                        new_date, venue, mid))
    except Exception:
        pass

    return {"round": next_round, "match_ids": created_ids, "label": round_label}
