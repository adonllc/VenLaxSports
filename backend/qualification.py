"""Playoff qualification: one ranking used by the standings page, My Matches and the bracket.

A league may set `qualification` = {"mode": "points" | "win_pct", "top_n": 2|4|8|16, "min_matches": int,
"min_win_pct": number 0-100}. With nothing set the rule is the long-standing default: the top 4 (12 or fewer
players) or top 8, ranked by points. Finishing the regular season never qualifies anyone by itself; only the
rank (and any minimums) under this rule do.

Ordering: the chosen metric, then wins, then head-to-head wins among the players still tied, then set and game
differential, then name.
"""
from __future__ import annotations

from typing import Optional

MODES = ("points", "win_pct")
TOP_N_CHOICES = (2, 4, 8, 16)


def default_top_n(player_count: int) -> int:
    return 4 if player_count <= 12 else 8


def rule_for(league: dict, player_count: int) -> dict:
    q = (league or {}).get("qualification") or {}
    mode = q.get("mode") if q.get("mode") in MODES else "points"
    top_n = q.get("top_n") if q.get("top_n") in TOP_N_CHOICES else default_top_n(player_count)
    return {
        "mode": mode,
        "top_n": top_n,
        "min_matches": max(0, int(q.get("min_matches") or 0)),
        "min_win_pct": max(0.0, min(100.0, float(q.get("min_win_pct") or 0))),
    }


def validate_rule(q: dict) -> dict:
    """Clean an admin-supplied rule or raise ValueError."""
    if q.get("mode") not in MODES:
        raise ValueError("mode must be points or win_pct")
    if q.get("top_n") not in TOP_N_CHOICES:
        raise ValueError("top_n must be 2, 4, 8 or 16")
    mm = int(q.get("min_matches") or 0)
    mp = float(q.get("min_win_pct") or 0)
    if not 0 <= mm <= 50:
        raise ValueError("min_matches must be between 0 and 50")
    if not 0 <= mp <= 100:
        raise ValueError("min_win_pct must be between 0 and 100")
    return {"mode": q["mode"], "top_n": q["top_n"], "min_matches": mm, "min_win_pct": mp}


def metric_label(rule: dict) -> str:
    return "points" if rule["mode"] == "points" else "win percentage"


def rule_text(rule: dict) -> str:
    text = f"The top {rule['top_n']} players by {metric_label(rule)} qualify for the playoffs."
    extras = []
    if rule["min_matches"]:
        extras.append(f"at least {rule['min_matches']} matches played")
    if rule["min_win_pct"]:
        extras.append(f"a win percentage of at least {rule['min_win_pct']:g}%")
    if extras:
        text += " You also need " + " and ".join(extras) + "."
    return text


def win_pct(row: dict) -> float:
    mp = row.get("matches_played") or 0
    return round(100.0 * (row.get("wins") or 0) / mp, 2) if mp else 0.0


def _metric(row: dict, rule: dict) -> float:
    return round(row.get("points", 0), 4) if rule["mode"] == "points" else win_pct(row)


def _eligible(row: dict, rule: dict) -> bool:
    mp = row.get("matches_played") or 0
    return mp >= rule["min_matches"] and mp > 0 and win_pct(row) >= rule["min_win_pct"]


def _side_ids(m: dict, n: int) -> list:
    return [x for x in ([m.get(f"player{n}_id"), m.get(f"team{n}_partner_id")]) if x]


def rank_players(standings: list, matches: list, rule: dict) -> list:
    """Return [{"player_id", "player_name", "rank", "eligible", "qualifies", "metric", "row"}] best first.

    `matches` are the league's played regular-season matches (used for head-to-head)."""
    rows = [dict(r) for r in standings]
    for r in rows:
        r["_m"] = _metric(r, rule)

    def base(r):
        return (-r["_m"], -(r.get("wins") or 0))

    rows.sort(key=base)
    ordered: list = []
    i = 0
    while i < len(rows):
        j = i
        while j < len(rows) and base(rows[j]) == base(rows[i]):
            j += 1
        group = rows[i:j]
        if len(group) > 1:
            ids = {g["player_id"] for g in group}
            h2h = {g["player_id"]: 0 for g in group}
            for m in matches:
                w = m.get("winner_id")
                if w in ids and m.get("status") in ("completed", "walkover"):
                    other = [x for x in _side_ids(m, 2 if w in _side_ids(m, 1) else 1) if x in ids]
                    if other:
                        h2h[w] += 1
            group.sort(key=lambda g: (-h2h[g["player_id"]],
                                      -((g.get("sets_won") or 0) - (g.get("sets_lost") or 0)),
                                      -((g.get("games_won") or 0) - (g.get("games_lost") or 0)),
                                      g.get("player_name") or ""))
        ordered.extend(group)
        i = j

    out, slots = [], rule["top_n"]
    for rank, r in enumerate(ordered, start=1):
        ok = _eligible(r, rule)
        q = ok and slots > 0
        if q:
            slots -= 1
        out.append({"player_id": r["player_id"], "player_name": r.get("player_name"), "rank": rank,
                    "eligible": ok, "qualifies": q, "metric": r["_m"], "row": r})
    return out


def standing_for(ranked: list, uid: str) -> Optional[dict]:
    return next((r for r in ranked if r["player_id"] == uid), None)


def cutoff_gap(ranked: list, uid: str, rule: dict) -> Optional[dict]:
    """How far the player is from the cut-off: ahead of it when in position, behind it when outside."""
    me = standing_for(ranked, uid)
    if not me or not me["eligible"]:
        return None
    qualifiers = [r for r in ranked if r["qualifies"]]
    others = [r for r in ranked if r["eligible"] and not r["qualifies"]]
    unit = "points" if rule["mode"] == "points" else "percentage points"
    if me["qualifies"]:
        if not others:
            return None
        return {"direction": "ahead", "amount": round(me["metric"] - others[0]["metric"], 2), "unit": unit}
    if not qualifiers:
        return None
    return {"direction": "behind", "amount": round(qualifiers[-1]["metric"] - me["metric"], 2), "unit": unit}
