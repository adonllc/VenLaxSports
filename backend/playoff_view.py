"""What a player sees about the playoffs on My Matches: qualification status, the bracket, the next opponent."""
from __future__ import annotations

import qualification as q


def round_label(round_no: int, total_rounds: int) -> str:
    left = total_rounds - round_no
    return {0: "Final", 1: "Semifinal", 2: "Quarterfinal"}.get(left, f"Round {round_no}")


def total_rounds(league: dict, playoff_matches: list) -> int:
    top_n = league.get("playoff_top_n") or (2 * sum(1 for m in playoff_matches if m.get("bracket_round", 1) == 1))
    return max(1, int(top_n).bit_length() - 1) if top_n else 1


def _side(m: dict, n: int) -> list:
    return [x for x in (m.get(f"player{n}_id"), m.get(f"team{n}_partner_id")) if x]


def build_bracket(league: dict, playoff_matches: list, uid: str) -> dict | None:
    """Rounds of the bracket plus this player's next match and whether they are out."""
    if not playoff_matches:
        return None
    total = total_rounds(league, playoff_matches)
    rounds: dict = {}
    for m in sorted(playoff_matches, key=lambda x: (x.get("bracket_round", 1), x.get("bracket_position", 0))):
        r = m.get("bracket_round", 1)
        done = m.get("status") in ("completed", "walkover") and m.get("winner_id")
        rounds.setdefault(r, []).append({
            "id": str(m["_id"]) if "_id" in m else m.get("id"),
            "player1_name": m.get("player1_name"), "player2_name": m.get("player2_name"),
            "winner_id": m.get("winner_id") if done else None,
            "winner_name": m.get("winner_name") if done else None,
            "mine": uid in _side(m, 1) + _side(m, 2),
            "scheduled_date": m.get("scheduled_date"),
        })
    mine = [m for m in playoff_matches if uid in _side(m, 1) + _side(m, 2)]
    mine.sort(key=lambda x: x.get("bracket_round", 1))
    nxt = next((m for m in mine if m.get("status") == "scheduled"), None)
    eliminated = any(m.get("status") in ("completed", "walkover") and m.get("winner_id")
                     and m["winner_id"] not in _side(m, 1 if uid in _side(m, 1) else 2) for m in mine)
    champion = bool(mine) and mine[-1].get("bracket_round", 1) == total and mine[-1].get("status") in ("completed", "walkover") \
        and mine[-1].get("winner_id") in _side(mine[-1], 1 if uid in _side(mine[-1], 1) else 2)
    next_match = None
    if nxt:
        opp_n = 2 if uid in _side(nxt, 1) else 1
        next_match = {
            "id": str(nxt["_id"]) if "_id" in nxt else nxt.get("id"),
            "round_label": round_label(nxt.get("bracket_round", 1), total),
            "opponent_name": nxt.get(f"player{opp_n}_name"),
            "scheduled_date": nxt.get("scheduled_date"), "venue": nxt.get("venue"),
        }
    return {
        "rounds": [{"round": r, "label": round_label(r, total), "matches": rounds[r]} for r in sorted(rounds)],
        "next_match": next_match, "eliminated": eliminated and not champion, "champion": champion,
    }


def playoff_block(league: dict, rule: dict, ranked: list, uid: str, season_complete: bool, bracket: dict | None) -> dict:
    """The `playoff` object of the summary. Status words:
    unranked | needs_more_matches | in_position | outside  (before the bracket exists)
    qualified | not_qualified                              (after it exists)"""
    me = q.standing_for(ranked, uid)
    block = {
        "top_n": rule["top_n"], "mode": rule["mode"], "metric": q.metric_label(rule),
        "rule_text": q.rule_text(rule), "min_matches": rule["min_matches"], "min_win_pct": rule["min_win_pct"],
        "season_complete": season_complete, "gap": None, "bracket": bracket,
    }
    if league.get("playoffs_status"):
        block["status"] = "qualified" if bracket and any(m["mine"] for r in bracket["rounds"] for m in r["matches"]) else "not_qualified"
        return block
    if not me or not (me["row"].get("matches_played") or 0):
        block["status"] = "unranked"
    elif not me["eligible"]:
        block["status"] = "needs_more_matches"
    else:
        block["status"] = "in_position" if me["qualifies"] else "outside"
        block["gap"] = q.cutoff_gap(ranked, uid, rule)
    return block
