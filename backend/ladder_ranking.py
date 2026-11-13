"""Community ladder ranking: leapfrog, points and ELO.

A ladder entry (a player, or a team in doubles) looks like
  {player_id, name, members, status: provisional|ranked|withdrawn|removed, rank, wins, losses, played,
   points, elo, joined_at, last_played_at}
Everyone starts "provisional" with no rank, so nobody (the creator included) begins ahead. An entry becomes
"ranked" after its first verified match. Only a confirmed direct challenge ever calls apply_result, and a
result is applied at most once (ladder_applied_at on the challenge). Every application is kept in
ladder_results with the standings before and after.

Methods
  leapfrog  ranks are positions. A challenger who beats an entry ranked above takes that position and everything
            in between moves down one place. A new entry that wins takes the opponent's place. A new entry that
            loses is placed directly below the opponent.
  points    win POINTS_WIN, loss POINTS_LOSS. Rank by points, then wins, then fewer matches played.
  elo       ladder-local rating starting at ELO_START. Rank by rating, then wins.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from bson import ObjectId

import challenge_config as cfg
import notification_center

logger = logging.getLogger(__name__)

LIVE = ("provisional", "ranked")


def new_entry(player_id: str, name: str, partner_id: str | None = None, partner_name: str = "") -> dict:
    return {
        "player_id": player_id, "name": f"{name} & {partner_name}" if partner_id else name,
        "partner_id": partner_id, "partner_name": partner_name,
        "members": [player_id] + ([partner_id] if partner_id else []),
        "status": "provisional", "rank": None, "wins": 0, "losses": 0, "played": 0,
        "points": 0, "elo": cfg.ELO_START,
        "joined_at": datetime.now(timezone.utc).isoformat(), "last_played_at": None,
    }


def live(entries: list[dict]) -> list[dict]:
    return [e for e in entries if e.get("status") in LIVE]


def entry_of(entries: list[dict], player_id: str):
    return next((e for e in live(entries) if player_id in e.get("members", [e["player_id"]])), None)


def _expected(a: float, b: float) -> float:
    return 1 / (1 + 10 ** ((b - a) / 400))


def _sort_key(method: str):
    if method == "points":
        return lambda e: (-e["points"], -e["wins"], e["played"], e["joined_at"])
    return lambda e: (-e["elo"], -e["wins"], e["played"], e["joined_at"])


def leapfrog_order(order: list[str], winner: str, loser: str) -> list[str]:
    """`order` holds the ranked entry ids, best first. Returns the new order after winner beat loser."""
    order = list(order)
    w_in, l_in = winner in order, loser in order
    if w_in and l_in:
        wi, li = order.index(winner), order.index(loser)
        if wi > li:                                   # the lower-ranked winner jumps ahead of the loser
            order.insert(li, order.pop(wi))
        return order
    if w_in:                                          # a new entry lost: placed directly below the winner
        order.insert(order.index(winner) + 1, loser)
        return order
    if l_in:                                          # a new entry won: takes the loser's place
        order.insert(order.index(loser), winner)
        return order
    return order + [winner, loser]                    # both new: winner above loser, below everyone already ranked


def renumber(entries: list[dict], method: str, order: list[str] | None = None) -> None:
    """Assign ranks in place. Entries that have not played keep rank None and stay provisional."""
    played = [e for e in live(entries) if e["played"] > 0]
    if method == "leapfrog":
        ids = [i for i in (order or []) if any(e["player_id"] == i for e in played)]
        ids += [e["player_id"] for e in played if e["player_id"] not in ids]   # never lose a played entry
        ranked = [next(e for e in played if e["player_id"] == i) for i in ids]
    else:
        ranked = sorted(played, key=_sort_key(method))
    for e in live(entries):
        e["rank"], e["status"] = None, "provisional"
    for pos, e in enumerate(ranked, start=1):
        e["rank"], e["status"] = pos, "ranked"


def current_order(entries: list[dict]) -> list[str]:
    return [e["player_id"] for e in sorted((e for e in live(entries) if e.get("rank")), key=lambda e: e["rank"])]


def apply_to_entries(entries: list[dict], method: str, winner_id: str, loser_id: str, now_iso: str) -> None:
    """Update stats and ranks in place after the entry winner_id beat the entry loser_id."""
    w = next(e for e in entries if e["player_id"] == winner_id)
    l = next(e for e in entries if e["player_id"] == loser_id)
    before = current_order(entries)
    if method == "elo":
        gain = cfg.ELO_K * (1 - _expected(w["elo"], l["elo"]))
        w["elo"], l["elo"] = round(w["elo"] + gain), round(l["elo"] - gain)
    for e, won in ((w, True), (l, False)):
        e["played"] += 1
        e["wins" if won else "losses"] += 1
        e["last_played_at"] = now_iso
        if method == "points":
            e["points"] += cfg.POINTS_WIN if won else cfg.POINTS_LOSS
    renumber(entries, method, leapfrog_order(before, winner_id, loser_id) if method == "leapfrog" else None)


def withdraw_from_entries(entries: list[dict], method: str, player_id: str, new_status: str = "withdrawn") -> None:
    """Take an entry out. Leapfrog closes the gap; the other methods re-sort."""
    before = current_order(entries)
    for e in entries:
        if e["player_id"] == player_id:
            e["status"], e["rank"] = new_status, None
    renumber(entries, method, [i for i in before if i != player_id] if method == "leapfrog" else None)


def snapshot(entries: list[dict]) -> list[dict]:
    rows = sorted(live(entries), key=lambda e: (e.get("rank") is None, e.get("rank") or 0, e["name"].lower()))
    return [{"player_id": e["player_id"], "name": e["name"], "rank": e.get("rank"), "points": e.get("points", 0), "elo": e.get("elo")}
            for e in rows]


def standings(entries: list[dict]) -> list[dict]:
    """Ranked entries by rank, then provisional ones alphabetically (an order that favours nobody)."""
    rows = live(entries)
    rows.sort(key=lambda e: (e.get("rank") is None, e.get("rank") or 0, e["name"].lower()))
    return [{**e, "win_pct": round(100 * e["wins"] / e["played"]) if e["played"] else None} for e in rows]


def _rank_changes(before: list[dict], after: list[dict]) -> dict:
    old = {b["player_id"]: b["rank"] for b in before}
    return {a["player_id"]: (old.get(a["player_id"]), a["rank"]) for a in after
            if a["rank"] is not None and old.get(a["player_id"]) != a["rank"]}


async def apply_result(db, ch: dict) -> bool:
    """Apply one confirmed ladder challenge to its ladder. Safe to call twice. True when standings changed."""
    if not ch.get("ladder_id") or ch.get("ladder_applied_at") or ch.get("status") != "confirmed":
        return False
    ladder = await db.ladders.find_one({"_id": ObjectId(ch["ladder_id"])})
    if not ladder:
        return False
    entries = ladder.get("entries", [])
    win_side = ch["side1"] if ch["result"]["winner_side"] == 1 else ch["side2"]
    lose_side = ch["side2"] if ch["result"]["winner_side"] == 1 else ch["side1"]
    w, l = entry_of(entries, win_side[0]), entry_of(entries, lose_side[0])
    now_iso = datetime.now(timezone.utc).isoformat()
    changed = False
    if w and l and w["player_id"] != l["player_id"]:
        method = ladder.get("ranking_method", "leapfrog")
        before = snapshot(entries)
        apply_to_entries(entries, method, w["player_id"], l["player_id"], now_iso)
        after = snapshot(entries)
        await db.ladders.update_one({"_id": ladder["_id"]}, {"$set": {"entries": entries, "last_match_at": now_iso}})
        await db.ladder_results.insert_one({
            "ladder_id": ch["ladder_id"], "challenge_id": str(ch["_id"]), "at": now_iso, "method": method,
            "winner": w["player_id"], "loser": l["player_id"], "sets": ch["result"]["sets"],
            "before": before, "after": after,
        })
        changed = True
        for pid, (old, new) in _rank_changes(before, after).items():
            entry = next(e for e in entries if e["player_id"] == pid)
            text = f"You are now #{new}" if old is None else f"You moved from #{old} to #{new}"
            await notification_center.notify(
                db, entry["members"], "ranking_changed", f"{ladder['name']}: {text}", "",
                f"/community-ladders/{ladder['_id']}", str(ladder["_id"]), email=False)
    await db.direct_challenges.update_one({"_id": ch["_id"]}, {"$set": {"ladder_applied_at": now_iso}})
    ch["ladder_applied_at"] = now_iso
    return changed


async def reconcile(db) -> int:
    """Retry confirmed ladder results that were never applied, for example after a crash. Returns how many applied."""
    applied = 0
    for ch in await db.direct_challenges.find({"status": "confirmed", "ladder_applied_at": None, "ladder_id": {"$ne": None}}).to_list(200):
        try:
            applied += bool(await apply_result(db, ch))
        except Exception:
            logger.exception("ladder reconcile failed: challenge=%s", ch.get("_id"))
    return applied
