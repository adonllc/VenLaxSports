"""Pairing waiting doubles players for admin-assisted partner assignment.

Pure functions, no database. A candidate is a dict:
  token, user_id, name, gender, city, zip_code, level, court_side, availability,
  registered_at (iso string), rejected (user ids this player must never be paired with).
"""
from __future__ import annotations

import math

ALLOWED_GAPS = (0.0, 0.5, 1.0)
LEVEL_POINTS = {0.0: 40, 0.5: 25, 1.0: 10}

AVAILABILITY_LABELS = {
    "weekday_morning": "Weekday mornings",
    "weekday_evening": "Weekday evenings",
    "weekend_morning": "Weekend mornings",
    "weekend_afternoon": "Weekend afternoons",
    "weekend_evening": "Weekend evenings",
}


def snap_half(x: float) -> float:
    """Round to the nearest 0.5, halves rounding up."""
    return math.floor(float(x) * 2 + 0.5) / 2


def player_level(user: dict, sport: str) -> float:
    """Declared skill level first (ratings drift every match), else the sport rating, else 3.0."""
    raw = str(user.get("skill_level") or "").strip().rstrip("+")
    try:
        return snap_half(float(raw))
    except ValueError:
        pass
    rating = user.get(f"{sport}_rating")
    if rating is not None:
        try:
            return snap_half(float(rating))
        except (TypeError, ValueError):
            pass
    return 3.0


def _norm(s) -> str:
    return (s or "").strip().lower()


def score_pair(a: dict, b: dict, max_gap: float, mixed: bool = False):
    """Return (score 0-100, reasons) for a legal pair, or None when a hard rule fails."""
    if a["user_id"] == b["user_id"]:
        return None
    if b["user_id"] in (a.get("rejected") or []) or a["user_id"] in (b.get("rejected") or []):
        return None
    gap = abs(a["level"] - b["level"])
    if gap > max_gap + 1e-9:
        return None
    if mixed and {a.get("gender"), b.get("gender")} != {"male", "female"}:
        return None

    score = LEVEL_POINTS.get(round(gap, 1), 0)
    reasons = [f"Levels {a['level']:.1f} / {b['level']:.1f}"]

    za, zb = _norm(a.get("zip_code")), _norm(b.get("zip_code"))
    ca, cb = _norm(a.get("city")), _norm(b.get("city"))
    if za and za == zb:
        score += 25
        reasons.append("Same zip")
    elif ca and ca == cb:
        score += 15
        reasons.append(f"Both {a['city']}")

    sa, sb = a.get("court_side"), b.get("court_side")
    if not sa or not sb:
        score += 6
    elif "either" in (sa, sb):
        score += 12
    elif sa != sb:
        score += 20
        reasons.append("Left + right side")

    aa, ab = set(a.get("availability") or []), set(b.get("availability") or [])
    if not aa or not ab:
        score += 5
    elif "flexible" in aa or "flexible" in ab:
        score += 15
        reasons.append("Flexible schedule")
    else:
        shared = aa & ab
        if shared:
            score += 15
            reasons.append("Shared: " + ", ".join(AVAILABILITY_LABELS.get(s, s) for s in sorted(shared)))
    return score, reasons


def _unmatched_reason(c: dict, others: list, max_gap: float, mixed: bool) -> str:
    if not others:
        return "Nobody else opted in"
    if any(score_pair(c, o, max_gap, mixed) for o in others):
        return "Every compatible player was paired with someone else"
    if mixed and not any({c.get("gender"), o.get("gender")} == {"male", "female"} for o in others):
        return "Needs an opposite-gender partner"
    if max_gap < 1.0 and any(score_pair(c, o, 1.0, mixed) for o in others):
        return "No one within the chosen level range, try a wider level"
    return "No compatible player in this league"


def suggest_pairs(candidates: list, max_gap: float, mixed: bool = False):
    """Greedy best-score-first pairing. Returns (pairs, unmatched).

    pair      {"a", "b", "score", "reasons", "gap"}; a is the earlier registrant
    unmatched {"candidate", "reason"}
    """
    scored = []
    for i, x in enumerate(candidates):
        for y in candidates[i + 1:]:
            res = score_pair(x, y, max_gap, mixed)
            if res is None:
                continue
            first, second = sorted((x, y), key=lambda c: c["registered_at"])
            scored.append((res[0], first, second, res[1]))
    scored.sort(key=lambda t: (-t[0], t[1]["registered_at"], t[2]["registered_at"]))

    used, pairs = set(), []
    for s, first, second, reasons in scored:
        if first["user_id"] in used or second["user_id"] in used:
            continue
        used.update((first["user_id"], second["user_id"]))
        pairs.append({"a": first, "b": second, "score": s, "reasons": reasons,
                      "gap": abs(first["level"] - second["level"])})

    unmatched = [
        {"candidate": c, "reason": _unmatched_reason(c, [o for o in candidates if o is not c], max_gap, mixed)}
        for c in candidates if c["user_id"] not in used
    ]
    return pairs, unmatched
