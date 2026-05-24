from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from bson import ObjectId
from itertools import combinations
from auth_utils import require_admin

router = APIRouter(redirect_slashes=False)

BOX_LABELS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


def _serpentine_groups(players: list, group_size: int) -> list:
    """Sort players by ELO desc, assign to groups using serpentine draft."""
    players = sorted(players, key=lambda p: p.get("elo", 1500), reverse=True)
    n_groups = max(1, len(players) // group_size)
    groups = [[] for _ in range(n_groups)]
    forward = True
    group_idx = 0
    for player in players:
        groups[group_idx].append(player)
        if forward:
            group_idx += 1
            if group_idx >= n_groups:
                group_idx = n_groups - 1
                forward = False
        else:
            group_idx -= 1
            if group_idx < 0:
                group_idx = 0
                forward = True
    return groups


@router.post("/{league_id}/assign-boxes")
async def assign_boxes(league_id: str, request: Request):
    db = request.app.state.db
    await require_admin(request, db)

    try:
        league = await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="League not found")
    if not league or league.get("league_type") != "box_league":
        raise HTTPException(status_code=400, detail="Not a box league")

    group_size = league.get("box_group_size", 6)

    # Get registered players with their ELO
    regs = await db.player_leagues.find(
        {"league_id": league_id, "payment_status": {"$in": ["paid", "free"]}},
    ).to_list(500)
    if len(regs) < group_size:
        raise HTTPException(status_code=400, detail=f"Need at least {group_size} players to assign boxes")

    # Fetch ELO for each player
    sport = league.get("sport", "tennis")
    elo_field = f"{sport}_rating"
    player_data = []
    for reg in regs:
        uid = reg["player_id"]
        user = await db.users.find_one({"_id": ObjectId(uid)}, {elo_field: 1, "name": 1})
        player_data.append({
            "player_id": uid,
            "name": user.get("name", "") if user else "",
            "elo": user.get(elo_field, 1500) if user else 1500,
        })

    groups = _serpentine_groups(player_data, group_size)
    now_iso = datetime.now(timezone.utc).isoformat()
    box_assignments = []
    all_matches = []

    for i, group in enumerate(groups):
        box_id = BOX_LABELS[i] if i < len(BOX_LABELS) else str(i + 1)
        player_ids = [p["player_id"] for p in group]
        box_assignments.append({"box_id": box_id, "player_ids": player_ids})

        # Update each player's box_id in player_leagues
        for pid in player_ids:
            await db.player_leagues.update_one(
                {"league_id": league_id, "player_id": pid},
                {"$set": {"box_id": box_id}},
            )

        # Generate all match pairs within box (C(n,2) pairs)
        for p1, p2 in combinations(group, 2):
            match_doc = {
                "league_id": league_id,
                "sport": sport,
                "player1_id": p1["player_id"],
                "player2_id": p2["player_id"],
                "player1_name": p1["name"],
                "player2_name": p2["name"],
                "scheduled_date": league.get("start_date", now_iso),
                "status": "scheduled",
                "source": "box_league",
                "box_id": box_id,
                "created_at": now_iso,
            }
            result = await db.matches.insert_one(match_doc)
            all_matches.append(str(result.inserted_id))

    # Store box_assignments on league doc
    await db.leagues.update_one(
        {"_id": ObjectId(league_id)},
        {"$set": {"box_assignments": box_assignments, "status": "active"}},
    )

    return {
        "boxes": [
            {"box_id": ba["box_id"], "player_count": len(ba["player_ids"])}
            for ba in box_assignments
        ],
        "match_count": len(all_matches),
    }
