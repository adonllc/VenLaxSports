# Auto-assign Doubles Partners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Waiting doubles players can consent to be paired by VenLax; an admin runs a matcher, reviews suggested pairs, assigns them; a matched player can request a different partner until the league starts.

**Architecture:** A pure matching module (`partner_matching.py`) scores and pairs candidates. A DB module (`partner_assignment.py`) loads candidates, assigns a pair (reusing `_create_doubles_pair`), and dissolves a team. Thin routes expose it to admins and players. Frontend: consent controls, a dashboard team note with a change-request button, and an admin panel.

**Tech Stack:** FastAPI + Pydantic v2 + motor (pytest with the in-memory fake DB from `tests/test_league_schedule.py`), React 19 + axios.

Spec: `docs/superpowers/specs/2026-11-03-auto-assign-partners-design.md`

**Two refinements to the spec (the spec is updated to match):**
- `GET /api/admin/partner-matches` without `league_id` returns every league that has opted-in waiting teams: `{max_gap, leagues: [{league_id, league_name, start_date, spots_left, pairs, unmatched, skipped}]}`. No league picker is needed in the UI.
- The level gap is not re-checked at assign time. The admin saw it when choosing the pair.

Run backend commands from `backend/`. All backend tests here use the in-memory fake DB; no server or MongoDB is needed.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `backend/partner_matching.py` | Create | `player_level`, `score_pair`, `suggest_pairs` (pure) |
| `backend/partner_assignment.py` | Create | `waiting_candidates`, `assign_pair`, `dissolve_team`, `team_info`, `change_window_open` |
| `backend/routes/partner_match_routes.py` | Create | admin endpoints |
| `backend/routes/doubles_routes.py` | Modify | `auto-assign` toggle, `change-request`, `my-invites` flag, `send_emails` flag on `_create_doubles_pair` |
| `backend/routes/league_routes.py` | Modify | `auto_assign_partner` on join; `team` in `/leagues/my` |
| `backend/routes/user_routes.py` | Modify | `zip_code` on profile update and setup |
| `backend/models.py` | Modify | `zip_code` on `User`, `normalize_zip` |
| `backend/email_service.py` | Modify | `send_partner_assigned`, `send_partner_change_resolved` |
| `backend/server.py` | Modify | mount the new router |
| `backend/tests/test_partner_matching.py` | Create | tasks 1-2 |
| `backend/tests/test_zip_code.py` | Create | task 3 |
| `backend/tests/test_auto_assign_partners.py` | Create | tasks 4-8 |
| `frontend/src/components/ZipCodeEditor.jsx` | Create | dashboard zip editor |
| `frontend/src/components/AssignedTeamNote.jsx` | Create | partner note + change request |
| `frontend/src/components/PartnerMatchingPanel.jsx` | Create | admin panel |
| `frontend/src/pages/PlayerDashboard.jsx`, `LeagueDetail.jsx`, `ProfileSetup.jsx`, `AdminDashboard.jsx` | Modify | wire the above |

---

### Task 1: `player_level`

**Files:**
- Create: `backend/partner_matching.py`
- Test: `backend/tests/test_partner_matching.py` (create)

- [ ] **Step 1: Write the failing tests**

```python
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from partner_matching import player_level, snap_half  # noqa: E402


def test_snap_half_rounds_to_nearest_half():
    assert snap_half(3.24) == 3.0
    assert snap_half(3.25) == 3.5
    assert snap_half(3.74) == 3.5
    assert snap_half(3.75) == 4.0


def test_level_prefers_declared_skill_level():
    assert player_level({"skill_level": "3.5", "tennis_rating": 4.4}, "tennis") == 3.5


def test_level_accepts_plus_suffix():
    assert player_level({"skill_level": "6.0+"}, "tennis") == 6.0


def test_level_falls_back_to_sport_rating():
    assert player_level({"tennis_rating": 3.76}, "tennis") == 4.0
    assert player_level({"pickleball_rating": 2.6}, "pickleball") == 2.5


def test_level_defaults_to_three():
    assert player_level({}, "tennis") == 3.0
    assert player_level({"skill_level": "abc"}, "tennis") == 3.0
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_partner_matching.py -v`
Expected: collection error `ModuleNotFoundError: No module named 'partner_matching'`

- [ ] **Step 3: Implement** — create `backend/partner_matching.py`:

```python
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
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_partner_matching.py -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/partner_matching.py backend/tests/test_partner_matching.py
git commit -m "feat(partners): player_level for partner matching"
```

---

### Task 2: `score_pair` and `suggest_pairs`

**Files:**
- Modify: `backend/partner_matching.py` (append)
- Test: `backend/tests/test_partner_matching.py` (append)

- [ ] **Step 1: Write the failing tests** (append to the test file)

```python
from partner_matching import score_pair, suggest_pairs  # noqa: E402


def cand(uid, level=3.0, **kw):
    base = {
        "token": f"t-{uid}", "user_id": uid, "name": uid, "gender": None, "city": "Atlanta",
        "zip_code": "", "level": level, "court_side": None, "availability": [],
        "registered_at": f"2026-11-0{uid[-1]}", "rejected": [],
    }
    base.update(kw)
    return base


def score(a, b, gap=1.0, mixed=False):
    res = score_pair(a, b, gap, mixed)
    return None if res is None else res[0]


def test_level_gap_is_a_hard_limit_and_scored():
    assert score(cand("u1", 3.0), cand("u2", 3.5), gap=0.0) is None
    assert score(cand("u1", 3.0), cand("u2", 3.0)) == 66      # 40 level + 15 city + 6 side unset + 5 availability unset
    assert score(cand("u1", 3.0), cand("u2", 3.5)) == 51      # 25 level
    assert score(cand("u1", 3.0), cand("u2", 4.0)) == 36      # 10 level


def test_location_zip_beats_city_beats_nothing():
    assert score(cand("u1", zip_code="30350"), cand("u2", zip_code="30350")) == 76
    assert score(cand("u1"), cand("u2")) == 66
    assert score(cand("u1"), cand("u2", city="Marietta")) == 51
    _, reasons = score_pair(cand("u1", zip_code="30350"), cand("u2", zip_code="30350"), 0.0)
    assert "Same zip" in reasons


def test_court_side_opposites_score_highest():
    assert score(cand("u1", court_side="left"), cand("u2", court_side="right")) == 80
    assert score(cand("u1", court_side="left"), cand("u2", court_side="left")) == 60
    assert score(cand("u1", court_side="either"), cand("u2", court_side="left")) == 72


def test_availability_overlap_and_flexible():
    a = cand("u1", availability=["weekend_morning", "weekday_evening"])
    b = cand("u2", availability=["weekend_morning"])
    assert score(a, b) == 76
    assert "Shared: Weekend mornings" in score_pair(a, b, 0.0)[1]
    flex = cand("u1", availability=["flexible"])
    assert score(flex, cand("u2", availability=["weekday_evening"])) == 76
    assert "Flexible schedule" in score_pair(flex, cand("u2", availability=["weekday_evening"]), 0.0)[1]
    assert score(cand("u1", availability=["weekday_morning"]), cand("u2", availability=["weekend_evening"])) == 61


def test_never_pair_a_player_with_themselves_or_a_rejected_partner():
    assert score(cand("u1"), cand("u1")) is None
    assert score(cand("u1", rejected=["u2"]), cand("u2")) is None
    assert score(cand("u1"), cand("u2", rejected=["u1"])) is None


def test_mixed_doubles_needs_one_male_and_one_female():
    assert score(cand("u1", gender="male"), cand("u2", gender="male"), mixed=True) is None
    assert score(cand("u1", gender="male"), cand("u2"), mixed=True) is None
    assert score(cand("u1", gender="male"), cand("u2", gender="female"), mixed=True) == 66


def test_suggest_pairs_prefers_exact_levels_and_earlier_registrant_is_a():
    people = [cand("u1", 3.0), cand("u2", 3.5), cand("u3", 3.0), cand("u4", 3.5)]
    pairs, unmatched = suggest_pairs(people, 0.5)
    assert unmatched == []
    got = {(p["a"]["user_id"], p["b"]["user_id"]) for p in pairs}
    assert got == {("u1", "u3"), ("u2", "u4")}


def test_suggest_pairs_ties_go_to_the_longest_waiting_and_odd_one_is_explained():
    pairs, unmatched = suggest_pairs([cand("u1"), cand("u2"), cand("u3")], 0.0)
    assert [(p["a"]["user_id"], p["b"]["user_id"]) for p in pairs] == [("u1", "u2")]
    assert unmatched == [{"candidate": cand("u3"), "reason": "Every compatible player was paired with someone else"}]


def test_unmatched_reasons():
    _, solo = suggest_pairs([cand("u1")], 0.0)
    assert solo[0]["reason"] == "Nobody else opted in"
    _, far = suggest_pairs([cand("u1", 3.0), cand("u2", 3.5)], 0.0)
    assert {u["reason"] for u in far} == {"No one within the chosen level range, try a wider level"}
    pairs, widened = suggest_pairs([cand("u1", 3.0), cand("u2", 3.5)], 0.5)
    assert len(pairs) == 1 and widened == []
    _, men = suggest_pairs([cand("u1", gender="male"), cand("u2", gender="male")], 0.0, mixed=True)
    assert {u["reason"] for u in men} == {"Needs an opposite-gender partner"}
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_partner_matching.py -v`
Expected: collection error `ImportError: cannot import name 'score_pair'`

- [ ] **Step 3: Implement** — append to `backend/partner_matching.py`:

```python
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
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_partner_matching.py -v`
Expected: 14 passed

- [ ] **Step 5: Commit**

```bash
git add backend/partner_matching.py backend/tests/test_partner_matching.py
git commit -m "feat(partners): score and greedily pair waiting doubles players"
```

---

### Task 3: Zip code on the user

**Files:**
- Modify: `backend/models.py` (imports, `normalize_zip`, `User.zip_code`)
- Modify: `backend/routes/user_routes.py` (`UserProfileUpdate`, `ProfileSetupIn`, `profile_setup`)
- Test: `backend/tests/test_zip_code.py` (create)

- [ ] **Step 1: Write the failing tests**

```python
import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import User, normalize_zip  # noqa: E402
from routes.user_routes import ProfileSetupIn, UserProfileUpdate  # noqa: E402


def test_normalize_zip_trims_and_uppercases():
    assert normalize_zip(" 30350 ") == "30350"
    assert normalize_zip("sw1a 1aa") == "SW1A 1AA"
    assert normalize_zip("30350-1234") == "30350-1234"


def test_normalize_zip_blank_means_unset():
    assert normalize_zip(None) is None
    assert normalize_zip("   ") is None


@pytest.mark.parametrize("bad", ["12", "!!!!!", "30350 30350 30350", "<script>"])
def test_normalize_zip_rejects_junk(bad):
    with pytest.raises(ValueError):
        normalize_zip(bad)


def test_profile_update_normalizes_and_rejects():
    assert UserProfileUpdate(zip_code=" 30350 ").zip_code == "30350"
    assert UserProfileUpdate(zip_code="").model_dump(exclude_unset=True) == {"zip_code": None}
    with pytest.raises(ValidationError):
        UserProfileUpdate(zip_code="!!")


def test_setup_accepts_zip_and_user_has_field():
    assert ProfileSetupIn(zip_code="30350").zip_code == "30350"
    assert User(email="a@b.co", name="A").zip_code is None
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_zip_code.py -v`
Expected: collection error `ImportError: cannot import name 'normalize_zip'`

- [ ] **Step 3: Implement**

In `backend/models.py` add `import re` as the first line of the imports (above `from typing import ...`). Directly above `class BaseDocument`, add:

```python
_ZIP_RE = re.compile(r"[A-Z0-9][A-Z0-9 -]{1,8}[A-Z0-9]")


def normalize_zip(v):
    """Trim and uppercase a zip / postal code. Blank means unset; junk raises ValueError."""
    if v is None:
        return None
    s = str(v).strip().upper()
    if not s:
        return None
    if not _ZIP_RE.fullmatch(s):
        raise ValueError("Enter a valid zip or postal code")
    return s


```

In `class User`, after the line `    home_court: Optional[str] = None` add:

```python
    zip_code: Optional[str] = None
```

In `backend/routes/user_routes.py` change the pydantic import to `from pydantic import BaseModel, field_validator`, change `from models import UserFollow, PlayProfile` to `from models import UserFollow, PlayProfile, normalize_zip`. In `UserProfileUpdate` add after `play_profile`:

```python
    zip_code: Optional[str] = None

    @field_validator("zip_code")
    @classmethod
    def _zip(cls, v):
        return normalize_zip(v)
```

In `ProfileSetupIn` add after `play_profile`:

```python
    zip_code: Optional[str] = None

    @field_validator("zip_code")
    @classmethod
    def _zip(cls, v):
        return normalize_zip(v)
```

In `profile_setup`, after the `if body.play_profile is not None:` block add:

```python
    if body.zip_code:
        update["zip_code"] = body.zip_code
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_zip_code.py tests/test_play_profile.py -v`
Expected: all passed

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/routes/user_routes.py backend/tests/test_zip_code.py
git commit -m "feat(profile): optional zip code on the user profile"
```

---

### Task 4: Player consent (join checkbox, toggle endpoint)

**Files:**
- Modify: `backend/routes/league_routes.py` (`JoinLeagueRequest`, invite insert)
- Modify: `backend/routes/doubles_routes.py` (new endpoint, `my-invites` flag)
- Test: `backend/tests/test_auto_assign_partners.py` (create)

- [ ] **Step 1: Write the failing tests** — create `backend/tests/test_auto_assign_partners.py`:

```python
"""Admin-assisted partner assignment. In-memory fake database (see test_partner_later.py)."""
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from routes import doubles_routes  # noqa: E402
from test_league_schedule import run  # noqa: E402
from test_partner_later import Db, as_user, env, join, req  # noqa: E402,F401  (env is a fixture)


def inv(db, token):
    return next(i for i in db.doubles_invites.docs if i["token"] == token)


def toggle(db, token, enabled):
    return run(doubles_routes.set_auto_assign(token, doubles_routes.AutoAssignRequest(enabled=enabled), req(db)))


def test_join_with_partner_later_can_opt_in(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    join(db, partner_later=True, auto_assign_partner=True)
    doc = db.doubles_invites.docs[0]
    assert doc["auto_assign_opt_in"] is True and doc["auto_assign_opt_in_at"]


def test_join_defaults_to_no_opt_in(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    join(db, partner_later=True)
    assert db.doubles_invites.docs[0]["auto_assign_opt_in"] is False


def test_toggle_on_and_off(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    token = join(db, partner_later=True)["invite_token"]
    assert toggle(db, token, True) == {"auto_assign_opt_in": True}
    assert inv(db, token)["auto_assign_opt_in"] is True and inv(db, token)["auto_assign_opt_in_at"]
    assert toggle(db, token, False) == {"auto_assign_opt_in": False}
    assert inv(db, token)["auto_assign_opt_in"] is False and inv(db, token)["auto_assign_opt_in_at"] is None


def test_only_the_initiator_can_toggle(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    token = join(db, partner_later=True)["invite_token"]
    as_user(monkeypatch, db, db.p2)
    with pytest.raises(HTTPException) as e:
        toggle(db, token, True)
    assert e.value.status_code == 403


def test_cannot_toggle_once_a_partner_is_attached(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.p1)
    token = join(db, partner_later=True)["invite_token"]
    inv(db, token)["partner_user_id"] = db.p2
    with pytest.raises(HTTPException) as e:
        toggle(db, token, True)
    assert e.value.status_code == 409
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_auto_assign_partners.py -v`
Expected: FAIL — `AttributeError: module 'routes.doubles_routes' has no attribute 'AutoAssignRequest'` (and the join tests fail on the unknown `auto_assign_partner` field)

- [ ] **Step 3: Implement**

In `backend/routes/league_routes.py`, in `JoinLeagueRequest` add after `partner_later: bool = False`:

```python
    auto_assign_partner: bool = False  # only used with partner_later: VenLax may pick the partner
```

In the invite `insert_one({...})` of the partner-later branch, after the line `"partner_later": True,` add:

```python
                "auto_assign_opt_in": bool(body.auto_assign_partner),
                "auto_assign_opt_in_at": now.isoformat() if body.auto_assign_partner else None,
```

In `backend/routes/doubles_routes.py`, in `my_doubles_invites` add after the `"partner_later": bool(inv.get("partner_later")),` line of the appended dict:

```python
            "auto_assign": bool(inv.get("auto_assign_opt_in")),
```

and add this block directly above the `# ── POST /{token}/partner` section:

```python
# ── POST /{token}/auto-assign ─────────────────────────────────────────────────

class AutoAssignRequest(BaseModel):
    enabled: bool


@router.post("/{token}/auto-assign")
async def set_auto_assign(token: str, body: AutoAssignRequest, request: Request):
    """Initiator (P1) agrees, or stops agreeing, that VenLax may pick the partner of a team still waiting for one."""
    db = request.app.state.db
    user = await get_current_user(request, db)

    invite = await db.doubles_invites.find_one({"token": token})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["initiator_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Only the initiator can change this")
    if invite.get("status") not in ("pending", "initiator_paid") or invite.get("partner_user_id"):
        raise HTTPException(status_code=409, detail="This team already has a partner")

    await db.doubles_invites.update_one({"token": token}, {"$set": {
        "auto_assign_opt_in": body.enabled,
        "auto_assign_opt_in_at": datetime.now(timezone.utc).isoformat() if body.enabled else None,
    }})
    return {"auto_assign_opt_in": body.enabled}


```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_auto_assign_partners.py tests/test_partner_later.py -v`
Expected: all passed (existing partner-later tests unchanged)

- [ ] **Step 5: Commit**

```bash
git add backend/routes/league_routes.py backend/routes/doubles_routes.py backend/tests/test_auto_assign_partners.py
git commit -m "feat(partners): players can consent to VenLax-picked partners"
```

---

### Task 5: Emails, `waiting_candidates`, `assign_pair`

**Files:**
- Modify: `backend/email_service.py` (two senders)
- Modify: `backend/routes/doubles_routes.py` (`_create_doubles_pair` gets `send_emails`)
- Create: `backend/partner_assignment.py`
- Test: `backend/tests/test_auto_assign_partners.py` (append)

- [ ] **Step 1: Write the failing tests** (append)

```python
import partner_assignment  # noqa: E402


def make_waiting(db, name, status="initiator_paid", opt_in=True, level="3.0", gender=None, **profile):
    uid = db.add_user(name, f"{name.lower()}@example.com", gender=gender)
    user = next(u for u in db.users.docs if str(u["_id"]) == uid)
    user.update({"skill_level": level, "city": "Atlanta", "zip_code": profile.pop("zip_code", ""),
                 "play_profile": profile or None})
    token = f"tok-{name}"
    db.doubles_invites.docs.append({
        "league_id": str(db.lid), "initiator_id": uid, "initiator_name": name, "token": token, "status": status,
        "partner_email": "", "partner_user_id": None, "partner_later": True, "auto_assign_opt_in": opt_in,
        "created_at": f"2026-11-0{len(db.doubles_invites.docs) + 1}T00:00:00+00:00", "expires_at": "2027-01-01",
    })
    return uid, token


def assign(db, a, b):
    return run(partner_assignment.assign_pair(db, a, b))


def test_waiting_candidates_only_opted_in_and_eligible():
    db = Db()
    make_waiting(db, "Ann", court_side="left")
    make_waiting(db, "Bea", opt_in=False)
    make_waiting(db, "Cy", status="pending")
    cands, skipped = run(partner_assignment.waiting_candidates(db, db.leagues.docs[0]))
    assert [c["name"] for c in cands] == ["Ann"]
    assert cands[0]["level"] == 3.0 and cands[0]["court_side"] == "left" and cands[0]["paid"] is True
    assert [(s["name"], s["reason"]) for s in skipped] == [("Cy", "Has not paid yet")]


def test_assign_pair_builds_the_team_and_flags_the_later_payment(env):
    db = Db()
    a_uid, ta = make_waiting(db, "Ann")
    b_uid, tb = make_waiting(db, "Bea")
    out = assign(db, ta, tb)
    assert out["refund_due"] is True and out["team_token"] == ta
    assert {p["player_id"] for p in db.player_leagues.docs} == {a_uid, b_uid}
    assert db.leagues.docs[0]["current_players"] == 2
    a, b = inv(db, ta), inv(db, tb)
    assert a["status"] == "accepted" and a["assigned_by_admin"] is True and a["partner_user_id"] == b_uid
    assert a["merged_token"] == tb and a["status_before_assign"] == "initiator_paid"
    assert b["status"] == "merged" and b["merged_into"] == ta and b["refund_due"] is True
    assert env == ["ann@example.com", "bea@example.com"]       # one "you were paired" email each, no duplicates


def test_the_earlier_registrant_keeps_the_team_even_if_passed_second(env):
    db = Db()
    _, ta = make_waiting(db, "Ann")
    _, tb = make_waiting(db, "Bea")
    assert assign(db, tb, ta)["team_token"] == ta


def test_free_league_has_no_refund(env):
    db = Db(fee=0)
    _, ta = make_waiting(db, "Ann", status="pending")
    _, tb = make_waiting(db, "Bea", status="pending")
    assert assign(db, ta, tb)["refund_due"] is False
    assert inv(db, tb)["refund_due"] is False


@pytest.mark.parametrize("mutate,message", [
    (lambda db, a, b: inv(db, b).update(auto_assign_opt_in=False), "has not agreed"),
    (lambda db, a, b: inv(db, b).update(status="pending"), "has not paid"),
    (lambda db, a, b: inv(db, b).update(partner_user_id="x"), "no longer waiting"),
    (lambda db, a, b: inv(db, b).update(status="accepted"), "no longer waiting"),
    (lambda db, a, b: inv(db, a).update(rejected_partner_ids=[inv(db, b)["initiator_id"]]), "asked not to be paired"),
    (lambda db, a, b: db.leagues.docs[0].update(current_players=15), "No spots"),
    (lambda db, a, b: db.leagues.docs[0].update(status="active"), "registration is closed"),
    (lambda db, a, b: inv(db, b).update(league_id="other"), "same league"),
])
def test_assign_refuses_stale_or_illegal_pairs(env, mutate, message):
    db = Db()
    _, ta = make_waiting(db, "Ann")
    _, tb = make_waiting(db, "Bea")
    mutate(db, ta, tb)
    with pytest.raises(ValueError) as e:
        assign(db, ta, tb)
    assert message in str(e.value)
    assert db.player_leagues.docs == []


def test_mixed_doubles_needs_opposite_genders(env):
    db = Db()
    db.leagues.docs[0]["format"] = "mixed_doubles"
    _, ta = make_waiting(db, "Ann", gender="female")
    _, tb = make_waiting(db, "Bea", gender="female")
    with pytest.raises(ValueError) as e:
        assign(db, ta, tb)
    assert "one male and one female" in str(e.value)
    _, tc = make_waiting(db, "Cy", gender="male")
    assert assign(db, ta, tc)["team_token"] == ta


def test_spots_are_given_back_if_building_the_team_fails(env, monkeypatch):
    db = Db()
    _, ta = make_waiting(db, "Ann")
    _, tb = make_waiting(db, "Bea")

    async def boom(*a, **k):
        raise RuntimeError("db down")
    monkeypatch.setattr(doubles_routes, "_create_doubles_pair", boom)
    with pytest.raises(RuntimeError):
        assign(db, ta, tb)
    assert db.leagues.docs[0]["current_players"] == 0 and inv(db, ta)["status"] == "initiator_paid"
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_auto_assign_partners.py -v`
Expected: collection error `ModuleNotFoundError: No module named 'partner_assignment'`

- [ ] **Step 3a: `_create_doubles_pair` gets a `send_emails` flag** in `backend/routes/doubles_routes.py`.

Change the signature to

```python
async def _create_doubles_pair(db, invite: dict, league: dict, partner_user: dict,
                                notify_partner_as_added: bool = False, send_emails: bool = True):
```

and add these lines directly above the comment `    # Confirmation emails (best effort)`:

```python
    if not send_emails:
        return

```

- [ ] **Step 3b: Two email senders** — in `backend/email_service.py`, add after `send_partner_declined`:

```python
async def send_partner_assigned(to: str, player_name: str, partner_name: str, league_name: str,
                                start_date: str = "") -> None:
    url = f"{_get_frontend_url()}/dashboard" if _get_frontend_url() else "/dashboard"
    start_line = f" The league starts on <strong>{start_date}</strong>." if start_date else ""
    body = f"""
      <p>Hi {player_name},</p>
      <p>VenLax paired you with <strong>{partner_name}</strong> as your doubles partner in <strong>{league_name}</strong>,
         based on your level, location and play profile. Your team is registered.{start_line}</p>
      <p>If you would rather play with someone else, you can ask for a different partner from your dashboard until the
         league starts. After that, teams are locked.</p>
    """
    await send_email(to, f"Your doubles partner for {league_name}", _wrap("You have a partner", body, "Open dashboard", url))


async def send_partner_change_resolved(to: str, player_name: str, league_name: str, approved: bool) -> None:
    url = f"{_get_frontend_url()}/dashboard" if _get_frontend_url() else "/dashboard"
    if approved:
        title = "Partner change approved"
        text = (f"Your team in <strong>{league_name}</strong> has been dissolved. You are back on the waiting list "
                f"and VenLax will look for another partner for you.")
    else:
        title = "Partner change declined"
        text = (f"Your request for a different partner in <strong>{league_name}</strong> was not approved, "
                f"so your team stays as it is.")
    body = f"<p>Hi {player_name},</p><p>{text}</p>"
    await send_email(to, f"{title} — {league_name}", _wrap(title, body, "Open dashboard", url))
```

- [ ] **Step 3c: Create `backend/partner_assignment.py`**

```python
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
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_auto_assign_partners.py tests/test_partner_later.py tests/test_refund_unpaired.py -v`
Expected: all passed

- [ ] **Step 5: Commit**

```bash
git add backend/email_service.py backend/routes/doubles_routes.py backend/partner_assignment.py backend/tests/test_auto_assign_partners.py
git commit -m "feat(partners): assign two waiting players as a team"
```

---

### Task 6: Admin endpoints: find matches, assign, refund list

**Files:**
- Create: `backend/routes/partner_match_routes.py`
- Modify: `backend/server.py` (import at line ~45, mount after line ~63)
- Test: `backend/tests/test_auto_assign_partners.py` (append)

- [ ] **Step 1: Write the failing tests** (append)

```python
from routes import partner_match_routes  # noqa: E402


@pytest.fixture
def admin(monkeypatch):
    async def ok(request, db):
        return {"_id": "admin", "role": "admin"}
    monkeypatch.setattr(partner_match_routes, "require_admin", ok)


def find_matches(db, **kw):
    return run(partner_match_routes.find_matches(req(db), **{"league_id": None, "max_gap": 0.0, **kw}))


def assign_matches(db, *pairs):
    body = partner_match_routes.AssignIn(pairs=[{"token_a": a, "token_b": b} for a, b in pairs])
    return run(partner_match_routes.assign_matches(body, req(db)))


def test_find_matches_suggests_the_best_pair_and_explains_the_rest(admin):
    db = Db()
    make_waiting(db, "Ann")
    make_waiting(db, "Bea")
    make_waiting(db, "Cy", level="3.5")
    out = find_matches(db)
    assert out["max_gap"] == 0.0 and len(out["leagues"]) == 1
    lg = out["leagues"][0]
    assert lg["league_name"] == "Atlanta Doubles" and lg["spots_left"] == 16
    assert [(p["a"]["name"], p["b"]["name"]) for p in lg["pairs"]] == [("Ann", "Bea")]
    assert lg["pairs"][0]["token_a"] == "tok-Ann" and lg["pairs"][0]["score"] > 0
    assert [(u["name"], u["reason"]) for u in lg["unmatched"]] == [
        ("Cy", "No one within the chosen level range, try a wider level")]


def test_wider_level_range_pairs_neighbours(admin):
    db = Db()
    make_waiting(db, "Ann")
    make_waiting(db, "Cy", level="3.5")
    assert find_matches(db)["leagues"][0]["pairs"] == []
    pairs = find_matches(db, max_gap=0.5)["leagues"][0]["pairs"]
    assert len(pairs) == 1 and "Levels 3.0 / 3.5" in pairs[0]["reasons"]


def test_bad_max_gap_is_rejected(admin):
    with pytest.raises(HTTPException) as e:
        find_matches(Db(), max_gap=0.3)
    assert e.value.status_code == 400


def test_leagues_without_opt_ins_are_not_listed_and_unpaid_are_reported(admin):
    db = Db()
    assert find_matches(db)["leagues"] == []
    make_waiting(db, "Ann", opt_in=False)
    assert find_matches(db)["leagues"] == []
    make_waiting(db, "Bea")
    make_waiting(db, "Cy", status="pending")
    lg = find_matches(db)["leagues"][0]
    assert [s["name"] for s in lg["skipped"]] == ["Cy"]


def test_assign_reports_each_pair_and_one_failure_does_not_stop_the_rest(admin, env):
    db = Db()
    _, ta = make_waiting(db, "Ann")
    _, tb = make_waiting(db, "Bea")
    _, tc = make_waiting(db, "Cy")
    _, td = make_waiting(db, "Dee", opt_in=False)
    out = assign_matches(db, (tc, td), (ta, tb))
    assert [(r["ok"], r.get("refund_due")) for r in out["results"]] == [(False, None), (True, True)]
    assert "has not agreed" in out["results"][0]["error"]
    assert db.leagues.docs[0]["current_players"] == 2


def test_refund_due_list_and_mark_refunded(admin, env):
    db = Db()
    _, ta = make_waiting(db, "Ann")
    _, tb = make_waiting(db, "Bea")
    assign_matches(db, (ta, tb))
    rows = run(partner_match_routes.refund_due(req(db)))["rows"]
    assert [(r["token"], r["player_name"], r["team_with"], r["amount"]) for r in rows] == [("tok-Bea", "Bea", "Ann", 19.99)]
    assert run(partner_match_routes.mark_refunded("tok-Bea", req(db))) == {"refunded": True}
    assert run(partner_match_routes.refund_due(req(db)))["rows"] == []
    assert inv(db, "tok-Bea")["refunded_at"]
    with pytest.raises(HTTPException) as e:
        run(partner_match_routes.mark_refunded("tok-Bea", req(db)))
    assert e.value.status_code == 409
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_auto_assign_partners.py -v`
Expected: collection error `ImportError: cannot import name 'partner_match_routes'`

- [ ] **Step 3a: Create `backend/routes/partner_match_routes.py`**

```python
"""Admin: suggest and assign doubles partners, track refunds, resolve partner change requests."""
from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

import partner_assignment
import partner_matching
from auth_utils import require_admin

router = APIRouter()


def _person(c: dict) -> dict:
    return {"token": c["token"], "name": c["name"], "email": c["email"], "city": c["city"],
            "zip_code": c["zip_code"], "level": c["level"], "paid": c["paid"]}


async def _league(db, league_id: str):
    try:
        return await db.leagues.find_one({"_id": ObjectId(league_id)})
    except Exception:
        return None


@router.get("/partner-matches")
async def find_matches(request: Request, league_id: Optional[str] = None, max_gap: float = 0.0):
    """Suggest partner pairs for opted-in waiting teams. Read-only. Level tolerance: 0, 0.5 or 1.0."""
    db = request.app.state.db
    await require_admin(request, db)
    if max_gap not in partner_matching.ALLOWED_GAPS:
        raise HTTPException(status_code=400, detail="max_gap must be 0, 0.5 or 1.0")

    if league_id:
        league_ids = [league_id]
    else:
        waiting = await db.doubles_invites.find(
            {"status": {"$in": list(partner_assignment.WAITING)}, "auto_assign_opt_in": True}
        ).to_list(2000)
        league_ids = list(dict.fromkeys(i["league_id"] for i in waiting))

    leagues = []
    for lid in league_ids:
        league = await _league(db, lid)
        if not league or league.get("status") != "registration":
            continue
        candidates, skipped = await partner_assignment.waiting_candidates(db, league)
        if not candidates and not skipped:
            continue
        pairs, unmatched = partner_matching.suggest_pairs(
            candidates, max_gap, mixed=league.get("format") == "mixed_doubles")
        leagues.append({
            "league_id": lid,
            "league_name": league.get("name", ""),
            "start_date": league.get("start_date", ""),
            "spots_left": int(league.get("max_players", 0)) - int(league.get("current_players", 0)),
            "pairs": [{
                "token_a": p["a"]["token"], "token_b": p["b"]["token"], "score": p["score"],
                "reasons": p["reasons"], "gap": p["gap"], "a": _person(p["a"]), "b": _person(p["b"]),
            } for p in pairs],
            "unmatched": [{**_person(u["candidate"]), "reason": u["reason"]} for u in unmatched],
            "skipped": skipped,
        })
    return {"max_gap": max_gap, "leagues": leagues}


class PairIn(BaseModel):
    token_a: str
    token_b: str


class AssignIn(BaseModel):
    pairs: List[PairIn] = Field(min_length=1, max_length=100)


@router.post("/partner-matches/assign")
async def assign_matches(body: AssignIn, request: Request):
    """Assign the chosen pairs. Each pair is re-checked; one failure does not stop the others."""
    db = request.app.state.db
    await require_admin(request, db)
    results = []
    for p in body.pairs:
        try:
            info = await partner_assignment.assign_pair(db, p.token_a, p.token_b)
        except ValueError as e:
            results.append({"token_a": p.token_a, "token_b": p.token_b, "ok": False, "error": str(e)})
        else:
            results.append({"token_a": p.token_a, "token_b": p.token_b, "ok": True,
                            "refund_due": info["refund_due"], "players": info["players"]})
    return {"results": results}


@router.get("/partner-matches/refund-due")
async def refund_due(request: Request):
    """Paid players absorbed into a team by an assignment: their payment is owed back (refunded by hand)."""
    db = request.app.state.db
    await require_admin(request, db)
    invites = await db.doubles_invites.find({"status": "merged", "refund_due": True}).to_list(500)
    rows = []
    for inv in invites:
        league = await _league(db, inv.get("league_id", "")) or {}
        try:
            user = await db.users.find_one({"_id": ObjectId(inv["initiator_id"])})
        except Exception:
            user = None
        team = await db.doubles_invites.find_one({"token": inv.get("merged_into")})
        rows.append({
            "token": inv["token"],
            "player_name": inv.get("initiator_name", ""),
            "player_email": (user or {}).get("email", ""),
            "league_name": league.get("name", ""),
            "amount": float(league.get("entry_fee") or 0),
            "currency": league.get("currency", "USD"),
            "team_with": (team or {}).get("initiator_name", ""),
        })
    return {"rows": rows}


@router.post("/partner-matches/{token_b}/mark-refunded")
async def mark_refunded(token_b: str, request: Request):
    db = request.app.state.db
    await require_admin(request, db)
    invite = await db.doubles_invites.find_one({"token": token_b})
    if not invite:
        raise HTTPException(status_code=404, detail="Not found")
    if invite.get("status") != "merged" or not invite.get("refund_due"):
        raise HTTPException(status_code=409, detail="No refund is due for this player")
    await db.doubles_invites.update_one({"token": token_b}, {"$set": {
        "refund_due": False, "refunded_at": datetime.now(timezone.utc).isoformat()}})
    return {"refunded": True}
```

- [ ] **Step 3b: Mount the router** in `backend/server.py`. After the line `from routes.admin_dashboard_routes import router as admin_dashboard_router` add:

```python
from routes.partner_match_routes import router as partner_match_router
```

After the line `api_router.include_router(admin_dashboard_router, prefix="/admin", tags=["admin-dashboard"])` add:

```python
api_router.include_router(partner_match_router, prefix="/admin", tags=["partner-matching"])
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_auto_assign_partners.py -v`
Then check the app still imports: `python -c "import server"` (run from `backend/`; if it needs env vars such as `MONGO_URL`, set dummy ones: `MONGO_URL=mongodb://localhost DB_NAME=x SECRET_KEY=x python -c "import server"`).
Expected: all tests passed; import prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/partner_match_routes.py backend/server.py backend/tests/test_auto_assign_partners.py
git commit -m "feat(partners): admin endpoints to find, assign and track refunds"
```

---

### Task 7: Player change request and team info

**Files:**
- Modify: `backend/partner_assignment.py` (`team_info`)
- Modify: `backend/routes/doubles_routes.py` (`change-request` endpoint, imports)
- Modify: `backend/routes/league_routes.py` (`/leagues/my` adds `team`)
- Test: `backend/tests/test_auto_assign_partners.py` (append)

- [ ] **Step 1: Write the failing tests** (append)

```python
from datetime import datetime, timezone  # noqa: E402

from routes import league_routes  # noqa: E402


def assigned_team(db):
    db.leagues.docs[0]["start_date"] = "2999-01-01"
    a_uid, ta = make_waiting(db, "Ann")
    b_uid, tb = make_waiting(db, "Bea")
    assign(db, ta, tb)
    return a_uid, b_uid, ta, tb


def request_change(db, token, reason=None):
    body = doubles_routes.ChangeRequestBody(reason=reason)
    return run(doubles_routes.request_partner_change(token, body, req(db)))


def test_change_window():
    now = datetime(2026, 11, 4, tzinfo=timezone.utc)
    lg = {"status": "registration", "start_date": "2026-11-05"}
    assert partner_assignment.change_window_open(lg, now) is True
    assert partner_assignment.change_window_open({**lg, "start_date": "2026-11-04"}, now) is False   # start day is locked
    assert partner_assignment.change_window_open({**lg, "status": "active"}, now) is False
    assert partner_assignment.change_window_open({"status": "registration"}, now) is False


def test_either_player_can_ask_for_a_different_partner(env, monkeypatch):
    db = Db()
    a_uid, b_uid, ta, _ = assigned_team(db)
    as_user(monkeypatch, db, b_uid)
    assert request_change(db, ta, "  We play at different levels  ") == {"requested": True}
    r = inv(db, ta)["partner_change_request"]
    assert r["status"] == "pending" and r["by_user_id"] == b_uid and r["reason"] == "We play at different levels"
    assert r["requested_at"]


@pytest.mark.parametrize("setup,status,fragment", [
    (lambda db, a, b, t: None, 403, "Only the two players"),
    (lambda db, a, b, t: inv(db, t).update(assigned_by_admin=False), 409, "paired by VenLax"),
    (lambda db, a, b, t: db.leagues.docs[0].update(start_date="2000-01-01"), 409, "locked"),
    (lambda db, a, b, t: db.leagues.docs[0].update(status="active"), 409, "locked"),
    (lambda db, a, b, t: inv(db, t).update(partner_change_request={"status": "pending"}), 409, "already asked"),
    (lambda db, a, b, t: inv(db, t).update(partner_change_request={"status": "declined"}), 409, "stays as it is"),
])
def test_change_request_is_refused_when_not_allowed(env, monkeypatch, setup, status, fragment):
    db = Db()
    a_uid, b_uid, ta, _ = assigned_team(db)
    outsider = db.p1
    setup(db, a_uid, b_uid, ta)
    as_user(monkeypatch, db, outsider if fragment == "Only the two players" else a_uid)
    with pytest.raises(HTTPException) as e:
        request_change(db, ta)
    assert e.value.status_code == status and fragment in e.value.detail


def test_team_info_for_the_dashboard(env):
    db = Db()
    a_uid, b_uid, ta, _ = assigned_team(db)
    league = db.leagues.docs[0]
    now = datetime.now(timezone.utc)
    info = run(partner_assignment.team_info(db, league, a_uid, now))
    assert info == {"invite_token": ta, "partner_name": "Bea", "assigned_by_venlax": True,
                    "change_request": None, "can_request_change": True}
    inv(db, ta)["partner_change_request"] = {"status": "pending"}
    info = run(partner_assignment.team_info(db, league, b_uid, now))
    assert info["partner_name"] == "Ann" and info["change_request"] == "pending" and info["can_request_change"] is False
    league["start_date"] = "2000-01-01"
    inv(db, ta)["partner_change_request"] = None
    assert run(partner_assignment.team_info(db, league, a_uid, now))["can_request_change"] is False
    inv(db, ta)["assigned_by_admin"] = False
    assert run(partner_assignment.team_info(db, league, a_uid, now)) is None


def test_my_leagues_carries_the_team_info(env, monkeypatch):
    db = Db()
    a_uid, _, ta, _ = assigned_team(db)
    as_user(monkeypatch, db, a_uid)

    async def no_progress(*a, **k):
        return {}
    import league_schedule
    monkeypatch.setattr(league_schedule, "league_progress", no_progress)
    out = run(league_routes.my_leagues(req(db)))
    assert out[0]["team"]["invite_token"] == ta and out[0]["team"]["partner_name"] == "Bea"
```

If `_serialize` in `league_routes.py` needs fields the fake league lacks, add them to the fake league inside `test_my_leagues_carries_the_team_info`; do not change `_serialize`.

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_auto_assign_partners.py -v`
Expected: FAIL — `AttributeError: ... has no attribute 'ChangeRequestBody'` / `team_info`

- [ ] **Step 3a: `team_info`** — append to `backend/partner_assignment.py`:

```python
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
```

- [ ] **Step 3b: Endpoint** — in `backend/routes/doubles_routes.py` change the pydantic import to `from pydantic import BaseModel, Field`, add `import partner_assignment` below `import email_service`, and add above the `# ── POST /{token}/partner` section:

```python
# ── POST /{token}/change-request ──────────────────────────────────────────────

class ChangeRequestBody(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


@router.post("/{token}/change-request")
async def request_partner_change(token: str, body: ChangeRequestBody, request: Request):
    """Either player of a team that VenLax paired asks for a different partner. An admin approves or declines.
    Only possible until the league's start date."""
    db = request.app.state.db
    user = await get_current_user(request, db)

    invite = await db.doubles_invites.find_one({"token": token})
    if not invite:
        raise HTTPException(status_code=404, detail="Team not found")
    if user["_id"] not in (invite.get("initiator_id"), invite.get("partner_user_id")):
        raise HTTPException(status_code=403, detail="Only the two players on this team can ask for a change")
    if not invite.get("assigned_by_admin"):
        raise HTTPException(status_code=409, detail="Only teams paired by VenLax use this. Change your partner from the league page.")
    try:
        league = await db.leagues.find_one({"_id": ObjectId(invite["league_id"])})
    except Exception:
        league = None
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    now = datetime.now(timezone.utc)
    if not partner_assignment.change_window_open(league, now):
        raise HTTPException(status_code=409, detail="Teams are locked once the league starts.")
    existing = (invite.get("partner_change_request") or {}).get("status")
    if existing == "pending":
        raise HTTPException(status_code=409, detail="You already asked for a change. We will review it soon.")
    if existing == "declined":
        raise HTTPException(status_code=409, detail="Your earlier request was reviewed and the team stays as it is.")

    await db.doubles_invites.update_one({"token": token}, {"$set": {"partner_change_request": {
        "by_user_id": user["_id"],
        "reason": (body.reason or "").strip(),
        "requested_at": now.isoformat(),
        "status": "pending",
    }}})
    return {"requested": True}


```

- [ ] **Step 3c: `/leagues/my`** — in `backend/routes/league_routes.py` add `import partner_assignment` with the other top-level imports. In `my_leagues`, after `doc["progress"] = progress` add:

```python
        if l.get("format") in ("doubles", "mixed_doubles"):
            doc["team"] = await partner_assignment.team_info(db, l, user["_id"], datetime.now(timezone.utc))
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_auto_assign_partners.py tests/test_partner_later.py -v`
Expected: all passed

- [ ] **Step 5: Commit**

```bash
git add backend/partner_assignment.py backend/routes/doubles_routes.py backend/routes/league_routes.py backend/tests/test_auto_assign_partners.py
git commit -m "feat(partners): players can ask for a different partner before the league starts"
```

---

### Task 8: Dissolve a team and resolve change requests (admin)

**Files:**
- Modify: `backend/partner_assignment.py` (`dissolve_team`)
- Modify: `backend/routes/partner_match_routes.py` (list + resolve endpoints)
- Test: `backend/tests/test_auto_assign_partners.py` (append)

- [ ] **Step 1: Write the failing tests** (append)

```python
def dissolve(db, token):
    team = inv(db, token)
    return run(partner_assignment.dissolve_team(db, db.leagues.docs[0], team))


def test_dissolve_puts_both_players_back_on_the_waiting_list(env):
    db = Db()
    a_uid, b_uid, ta, tb = assigned_team(db)
    out = dissolve(db, ta)
    assert out["repay_required"] is False
    assert db.player_leagues.docs == [] and db.leagues.docs[0]["current_players"] == 0
    a, b = inv(db, ta), inv(db, tb)
    assert a["status"] == "initiator_paid" and a["partner_user_id"] is None and a["assigned_by_admin"] is False
    assert b["status"] == "initiator_paid" and b["merged_into"] is None and b["refund_due"] is False
    assert a["rejected_partner_ids"] == [b_uid] and b["rejected_partner_ids"] == [a_uid]
    with pytest.raises(ValueError) as e:                     # the same pair is never offered again
        assign(db, ta, tb)
    assert "asked not to be paired" in str(e.value)


def test_dissolve_after_the_refund_makes_the_absorbed_player_pay_again(env):
    db = Db()
    _, _, ta, tb = assigned_team(db)
    inv(db, tb).update(refund_due=False, refunded_at="2026-11-05T00:00:00+00:00")
    out = dissolve(db, ta)
    assert out["repay_required"] is True and inv(db, tb)["status"] == "pending"


def test_dissolve_is_refused_once_the_league_started(env):
    db = Db()
    _, _, ta, _ = assigned_team(db)
    db.leagues.docs[0]["status"] = "active"
    with pytest.raises(ValueError):
        dissolve(db, ta)
    assert len(db.player_leagues.docs) == 2 and inv(db, ta)["status"] == "accepted"


def resolve(db, token, action):
    body = partner_match_routes.ResolveIn(action=action)
    return run(partner_match_routes.resolve_change_request(token, body, req(db)))


def test_admin_sees_pending_requests_and_approves_one(admin, env, monkeypatch):
    db = Db()
    a_uid, b_uid, ta, tb = assigned_team(db)
    as_user(monkeypatch, db, a_uid)
    request_change(db, ta, "Different levels")
    rows = run(partner_match_routes.list_change_requests(req(db)))["rows"]
    assert [(r["token"], r["player_a"], r["player_b"], r["requested_by"], r["reason"]) for r in rows] == [
        (ta, "Ann", "Bea", "Ann", "Different levels")]
    env.clear()
    out = resolve(db, ta, "approve")
    assert out["resolved"] == "approved" and out["repay_required"] is False
    assert inv(db, ta)["partner_change_request"]["status"] == "approved"
    assert sorted(env) == ["ann@example.com", "bea@example.com"]
    assert run(partner_match_routes.list_change_requests(req(db)))["rows"] == []


def test_admin_declines_a_request_and_the_team_stays(admin, env, monkeypatch):
    db = Db()
    a_uid, _, ta, _ = assigned_team(db)
    as_user(monkeypatch, db, a_uid)
    request_change(db, ta)
    env.clear()
    assert resolve(db, ta, "decline") == {"resolved": "declined"}
    assert inv(db, ta)["partner_change_request"]["status"] == "declined" and inv(db, ta)["status"] == "accepted"
    assert env == ["ann@example.com"]
    assert len(db.player_leagues.docs) == 2


def test_resolving_without_a_pending_request_is_a_conflict(admin, env):
    db = Db()
    _, _, ta, _ = assigned_team(db)
    with pytest.raises(HTTPException) as e:
        resolve(db, ta, "approve")
    assert e.value.status_code == 409


def test_approving_after_the_league_started_is_a_conflict_and_changes_nothing(admin, env, monkeypatch):
    db = Db()
    a_uid, _, ta, _ = assigned_team(db)
    as_user(monkeypatch, db, a_uid)
    request_change(db, ta)
    db.leagues.docs[0]["status"] = "active"
    with pytest.raises(HTTPException) as e:
        resolve(db, ta, "approve")
    assert e.value.status_code == 409
    assert len(db.player_leagues.docs) == 2 and inv(db, ta)["partner_change_request"]["status"] == "pending"
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_auto_assign_partners.py -v`
Expected: FAIL — `AttributeError: ... has no attribute 'dissolve_team'` / `ResolveIn`

- [ ] **Step 3a: `dissolve_team`** — append to `backend/partner_assignment.py`:

```python
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
```

- [ ] **Step 3b: Endpoints** — in `backend/routes/partner_match_routes.py` change the typing import to `from typing import List, Literal, Optional`, add `import email_service` below `from bson import ObjectId`'s block of imports, and append:

```python
@router.get("/partner-change-requests")
async def list_change_requests(request: Request):
    db = request.app.state.db
    await require_admin(request, db)
    invites = await db.doubles_invites.find({"partner_change_request.status": "pending"}).to_list(200)
    rows = []
    for inv in invites:
        league = await _league(db, inv.get("league_id", "")) or {}
        change = inv["partner_change_request"]
        users = {}
        for key, uid in (("by", change.get("by_user_id")), ("partner", inv.get("partner_user_id"))):
            try:
                users[key] = await db.users.find_one({"_id": ObjectId(uid)}) or {}
            except Exception:
                users[key] = {}
        rows.append({
            "token": inv["token"],
            "league_name": league.get("name", ""),
            "start_date": league.get("start_date", ""),
            "player_a": inv.get("initiator_name", ""),
            "player_b": users["partner"].get("name", ""),
            "requested_by": users["by"].get("name", ""),
            "reason": change.get("reason", ""),
            "requested_at": change.get("requested_at", ""),
        })
    return {"rows": rows}


class ResolveIn(BaseModel):
    action: Literal["approve", "decline"]


@router.post("/partner-change-requests/{token}/resolve")
async def resolve_change_request(token: str, body: ResolveIn, request: Request):
    """Approve (the team is dissolved, both players wait for new partners) or decline a change request."""
    db = request.app.state.db
    await require_admin(request, db)
    invite = await db.doubles_invites.find_one({"token": token})
    change = (invite or {}).get("partner_change_request") or {}
    if not invite or change.get("status") != "pending":
        raise HTTPException(status_code=409, detail="No pending request for this team")
    league = await _league(db, invite["league_id"]) or {}
    league_name = league.get("name", "the league")
    now = datetime.now(timezone.utc).isoformat()

    async def players():
        out = []
        for uid in (invite["initiator_id"], invite.get("partner_user_id")):
            try:
                u = await db.users.find_one({"_id": ObjectId(uid)})
            except Exception:
                u = None
            if u:
                out.append(u)
        return out

    if body.action == "decline":
        await db.doubles_invites.update_one({"token": token}, {"$set": {
            "partner_change_request": {**change, "status": "declined", "resolved_at": now}}})
        for u in await players():
            if str(u["_id"]) == change.get("by_user_id") and u.get("email"):
                email_service.schedule(email_service.send_partner_change_resolved(
                    u["email"], u.get("name", ""), league_name, False))
        return {"resolved": "declined"}

    team_players = await players()
    try:
        info = await partner_assignment.dissolve_team(db, league, invite)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    await db.doubles_invites.update_one({"token": token}, {"$set": {
        "partner_change_request": {**change, "status": "approved", "resolved_at": now}}})
    for u in team_players:
        if u.get("email"):
            email_service.schedule(email_service.send_partner_change_resolved(
                u["email"], u.get("name", ""), league_name, True))
    return {"resolved": "approved", "repay_required": info["repay_required"]}
```

Add `from datetime import datetime, timezone` is already imported at the top of the file (Task 6); make sure it still is.

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_auto_assign_partners.py tests/test_partner_matching.py tests/test_zip_code.py tests/test_partner_later.py tests/test_refund_unpaired.py tests/test_play_profile.py -v`
Expected: all passed

- [ ] **Step 5: Commit**

```bash
git add backend/partner_assignment.py backend/routes/partner_match_routes.py backend/tests/test_auto_assign_partners.py
git commit -m "feat(partners): admin approves or declines partner change requests"
```

---

### Task 9: Zip code in the UI (dashboard editor, setup step)

**Files:**
- Create: `frontend/src/components/ZipCodeEditor.jsx`
- Modify: `frontend/src/pages/PlayerDashboard.jsx` (import, mount)
- Modify: `frontend/src/pages/ProfileSetup.jsx` (state, input)

There are no frontend unit tests in this repo; verification is `npm run build` plus the manual check in Task 12. (`yarn` may be missing in the shell; `npm run build` runs the same script. The build rewrites `frontend/public/sitemap.xml`; run `git checkout frontend/public/sitemap.xml` afterwards so it is not committed.)

- [ ] **Step 1: Create `ZipCodeEditor.jsx`**

```jsx
import { useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

/** Inline zip / postal code editor. Used to match waiting doubles players who live close together. */
export default function ZipCodeEditor() {
  const { user, fetchMe } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!user) return null;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await axios.patch(`${API}/users/me`, { zip_code: draft.trim() || null }, { withCredentials: true });
      await fetchMe();
      setEditing(false);
    } catch (e) {
      setError(e.response?.status === 422 ? "Enter a valid zip or postal code." : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-1 text-sm" style={{ color: "#4C4C4C" }} data-testid="zip-section">
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. 30350"
            autoComplete="postal-code"
            maxLength={10}
            className="px-3 py-1.5 text-sm"
            style={{ border: "1px solid #E5E7EB", color: "#3D3D3D", background: "white" }}
            data-testid="input-dashboard-zip"
          />
          <button onClick={save} disabled={saving} className="px-3 py-1.5 text-xs font-bold disabled:opacity-60" style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid="save-zip-btn">
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={() => { setEditing(false); setError(""); }} className="text-xs font-semibold" style={{ color: "#6B7280" }} data-testid="cancel-zip-btn">
            Cancel
          </button>
          {error && <span className="text-xs text-red-600 w-full" role="alert">{error}</span>}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span>{user.zip_code ? `Zip: ${user.zip_code}` : "No zip code added"}</span>
          <button onClick={() => { setDraft(user.zip_code || ""); setEditing(true); }} className="text-xs font-semibold" style={{ color: "#008F70" }} data-testid="edit-zip-btn">
            {user.zip_code ? "Edit" : "Add zip"}
          </button>
          {!user.zip_code && <span className="text-xs" style={{ color: "#6B7280" }}>Helps match you with partners nearby.</span>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount it on the dashboard** — in `frontend/src/pages/PlayerDashboard.jsx` add the import below `import PlayProfileCard from "../components/PlayProfileCard";`:

```jsx
import ZipCodeEditor from "../components/ZipCodeEditor";
```

and insert `<ZipCodeEditor />` directly after the closing `</div>` of the `data-testid="phone-section"` block, i.e. immediately above the `<button` whose `onClick={toggleNotifications}`:

```jsx
              <ZipCodeEditor />
```

- [ ] **Step 3: Setup step** — in `frontend/src/pages/ProfileSetup.jsx` add `zip_code: user?.zip_code || "",` to the initial `form` state (after `city`). In the "Home Court" step (step 2), directly after the City field's closing `</div>` (the one that wraps the input with `data-testid="input-city-setup"`), add:

```jsx
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Zip code (optional)</label>
                  <input
                    type="text"
                    value={form.zip_code}
                    onChange={(e) => setForm((f) => ({ ...f, zip_code: e.target.value }))}
                    placeholder="e.g. 30350"
                    maxLength={10}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    data-testid="input-zip-setup"
                    autoComplete="postal-code"
                  />
                </div>
```

If the server rejects a bad zip with 422, the existing `handleFinish` catch already sends the player on to the dashboard; that is acceptable because the field is optional.

- [ ] **Step 4: Build**

Run (from `frontend/`): `npm run build`
Expected: `built in ...` and `[prerender] wrote ... snapshots`. Then `git checkout frontend/public/sitemap.xml`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ZipCodeEditor.jsx frontend/src/pages/PlayerDashboard.jsx frontend/src/pages/ProfileSetup.jsx
git commit -m "feat(profile): optional zip code editor on dashboard and setup"
```

---

### Task 10: Consent controls and the assigned-team note

**Files:**
- Create: `frontend/src/components/AssignedTeamNote.jsx`
- Modify: `frontend/src/pages/LeagueDetail.jsx` (checkbox, request body)
- Modify: `frontend/src/pages/PlayerDashboard.jsx` (toggle on waiting teams, note on assigned teams)

- [ ] **Step 1: Create `AssignedTeamNote.jsx`**

```jsx
import { useState } from "react";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

/**
 * Shows the partner VenLax assigned and lets either player ask for a different one until the league starts.
 * `team` comes from GET /leagues/my: { invite_token, partner_name, change_request, can_request_change }.
 */
export default function AssignedTeamNote({ team, onChanged }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!team) return null;

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await axios.post(`${API}/doubles-invite/${team.invite_token}/change-request`, { reason: reason.trim() || null }, { withCredentials: true });
      setOpen(false);
      onChanged?.();
    } catch (e) {
      setError(e.response?.data?.detail || "Could not send your request. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 ml-8 text-sm" style={{ color: "#374151" }} data-testid={`assigned-team-${team.invite_token}`}>
      <p>
        Partner: <strong>{team.partner_name}</strong>
        <span className="ml-2 text-xs px-2 py-0.5" style={{ background: "#F1F1F1", color: "#5C5C5C" }}>assigned by VenLax</span>
      </p>
      {team.change_request === "pending" && (
        <p className="text-xs mt-1" style={{ color: "#B7791F" }} data-testid="change-request-pending">Change requested. We will review it soon.</p>
      )}
      {team.change_request === "declined" && (
        <p className="text-xs mt-1" style={{ color: "#6B7280" }}>Your change request was reviewed and the team stays as it is.</p>
      )}
      {team.can_request_change && !open && (
        <button onClick={() => setOpen(true)} className="mt-1 text-xs font-semibold" style={{ color: "#008F70" }} data-testid="request-change-btn">
          Request a different partner
        </button>
      )}
      {team.can_request_change && open && (
        <div className="mt-2 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Why would you like a different partner? (optional)"
            className="w-full px-3 py-2 text-sm"
            style={{ border: "1px solid #E5E7EB" }}
            data-testid="change-request-reason"
          />
          <div className="flex items-center gap-3">
            <button onClick={submit} disabled={busy} className="px-3 py-1.5 text-xs font-bold disabled:opacity-60" style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid="change-request-submit">
              {busy ? "Sending..." : "Send request"}
            </button>
            <button onClick={() => setOpen(false)} className="text-xs font-semibold" style={{ color: "#6B7280" }}>Cancel</button>
          </div>
          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
        </div>
      )}
      {!team.can_request_change && !team.change_request && (
        <p className="text-xs mt-1" style={{ color: "#6B7280" }} data-testid="team-locked">Teams are locked now that the league has started.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Join step checkbox** — in `frontend/src/pages/LeagueDetail.jsx`:

(a) Below `const [partnerLater, setPartnerLater] = useState(false);` add:

```jsx
  const [autoAssign, setAutoAssign] = useState(false);
```

(b) In `handleDoublesJoin`, below `body.partner_later = true;` add:

```jsx
        body.auto_assign_partner = autoAssign;
```

(c) Replace the whole `<p ... data-testid="partner-later-note">...</p>` element (the "Register and pay now to hold your place..." paragraph, the else-branch of the `partnerMode === "have" ? ... : ...` ternary) with a fragment that keeps that paragraph unchanged and adds the checkbox after it:

```jsx
                                <>
                                  {/* keep the existing partner-later-note <p> exactly as it is here */}
                                  <label className="flex items-start gap-2.5 cursor-pointer" data-testid="auto-assign-label">
                                    <input
                                      type="checkbox"
                                      checked={autoAssign}
                                      onChange={(e) => setAutoAssign(e.target.checked)}
                                      className="mt-0.5 h-4 w-4 accent-[#008F70] flex-shrink-0"
                                      data-testid="auto-assign-checkbox"
                                    />
                                    <span className="text-xs leading-relaxed" style={{ color: "#4C4C4C" }}>
                                      Let VenLax pick my partner if I do not find one. VenLax may pair me with another waiting player in this league.
                                      My name, level and city are shared with that partner. I can ask for a change until the league starts.
                                    </span>
                                  </label>
                                </>
```

- [ ] **Step 3: Dashboard** — in `frontend/src/pages/PlayerDashboard.jsx`:

(a) Add the import below the `ZipCodeEditor` import:

```jsx
import AssignedTeamNote from "../components/AssignedTeamNote";
```

(b) Add this handler next to `savePhone`:

```jsx
  const toggleAutoAssign = async (invite) => {
    const enabled = !invite.auto_assign;
    try {
      await axios.post(`${API}/doubles-invite/${invite.token}/auto-assign`, { enabled }, { withCredentials: true });
      setPendingInvites((prev) => prev.map((i) => (i.token === invite.token ? { ...i, auto_assign: enabled } : i)));
    } catch (err) {
      console.error("Auto-assign toggle failed", err);
    }
  };
```

(c) In the "Pending Doubles Invites" block, directly above `{addPartnerFor === invite.token && (` add:

```jsx
                  {!invite.partner_email && (
                    <label className="mt-3 flex items-start gap-2 text-xs cursor-pointer" style={{ color: "#4C4C4C" }}>
                      <input
                        type="checkbox"
                        checked={!!invite.auto_assign}
                        onChange={() => toggleAutoAssign(invite)}
                        className="mt-0.5 h-4 w-4 accent-[#008F70]"
                        data-testid={`auto-assign-toggle-${invite.token}`}
                      />
                      Let VenLax pick my partner. VenLax may pair me with another waiting player; my name, level and city are shared with that partner.
                    </label>
                  )}
```

(d) In the My Leagues list, directly above `{pr.matches_total > 0 && (` add:

```jsx
                      {l.team && <AssignedTeamNote team={l.team} onChanged={fetchData} />}
```

- [ ] **Step 4: Build**

Run (from `frontend/`): `npm run build`, then `git checkout frontend/public/sitemap.xml`.
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AssignedTeamNote.jsx frontend/src/pages/LeagueDetail.jsx frontend/src/pages/PlayerDashboard.jsx
git commit -m "feat(partners): consent controls and assigned-team note with change requests"
```

---

### Task 11: Admin panel

**Files:**
- Create: `frontend/src/components/PartnerMatchingPanel.jsx`
- Modify: `frontend/src/pages/AdminDashboard.jsx` (import, mount)

- [ ] **Step 1: Create `PartnerMatchingPanel.jsx`**

```jsx
import { useCallback, useEffect, useState } from "react";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const GAPS = [
  { value: 0, label: "Exact level" },
  { value: 0.5, label: "Within ±0.5" },
  { value: 1, label: "Within ±1.0" },
];
const box = { border: "1px solid #E5E7EB" };
const head = { color: "#6B7280" };

function Person({ p }) {
  return (
    <div>
      <p className="text-sm font-medium">{p.name} <span className="text-xs" style={head}>L{p.level.toFixed(1)}</span></p>
      <p className="text-xs" style={head}>
        {p.email}{p.city ? ` · ${p.city}` : ""}{p.zip_code ? ` ${p.zip_code}` : ""}{p.paid ? " · paid" : ""}
      </p>
    </div>
  );
}

/** Admin: suggested partner pairs for opted-in waiting teams, refunds owed, and partner change requests. */
export default function PartnerMatchingPanel() {
  const [gap, setGap] = useState(0);
  const [data, setData] = useState(null);
  const [picked, setPicked] = useState({});
  const [refunds, setRefunds] = useState([]);
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const opts = { withCredentials: true };
      const [m, r, c] = await Promise.all([
        axios.get(`${API}/admin/partner-matches`, { params: { max_gap: gap }, ...opts }),
        axios.get(`${API}/admin/partner-matches/refund-due`, opts),
        axios.get(`${API}/admin/partner-change-requests`, opts),
      ]);
      setData(m.data);
      setRefunds(r.data.rows);
      setRequests(c.data.rows);
      setPicked({});
    } catch {
      setMsg("Could not load partner matching.");
    }
  }, [gap]);

  useEffect(() => { load(); }, [load]);

  const key = (p) => `${p.token_a}|${p.token_b}`;
  const chosen = Object.keys(picked).filter((k) => picked[k]);
  const allPairs = (data?.leagues || []).flatMap((l) => l.pairs);

  const assign = async () => {
    if (!chosen.length) return;
    setBusy(true);
    setMsg("");
    try {
      const pairs = chosen.map((k) => { const [token_a, token_b] = k.split("|"); return { token_a, token_b }; });
      const { data: out } = await axios.post(`${API}/admin/partner-matches/assign`, { pairs }, { withCredentials: true });
      const ok = out.results.filter((r) => r.ok).length;
      const failed = out.results.filter((r) => !r.ok);
      setMsg(`Assigned ${ok} team${ok === 1 ? "" : "s"}.${failed.length ? ` Skipped ${failed.length}: ${failed.map((f) => f.error).join("; ")}` : ""}`);
      await load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "Could not assign.");
    } finally {
      setBusy(false);
    }
  };

  const markRefunded = async (token) => {
    try {
      await axios.post(`${API}/admin/partner-matches/${token}/mark-refunded`, {}, { withCredentials: true });
      setRefunds((rows) => rows.filter((r) => r.token !== token));
    } catch (e) {
      setMsg(e.response?.data?.detail || "Could not update.");
    }
  };

  const resolve = async (token, action) => {
    try {
      const { data: out } = await axios.post(`${API}/admin/partner-change-requests/${token}/resolve`, { action }, { withCredentials: true });
      setMsg(out.repay_required ? "Approved. One player was already refunded and must pay again to be matched." : action === "approve" ? "Approved. Both players are back on the waiting list." : "Declined.");
      await load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "Could not resolve.");
    }
  };

  return (
    <div className="mb-6 bg-white rounded-none overflow-hidden" style={box} data-testid="partner-matching-panel">
      <div className="p-5 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: "1px solid #F3F4F6" }}>
        <div>
          <h2 className="font-heading font-bold text-lg" style={{ color: "#3D3D3D" }}>Auto-assign partners</h2>
          <p className="text-xs mt-1" style={head}>Only players who agreed to be paired by VenLax appear here. You confirm every pair.</p>
        </div>
        <label className="text-xs flex items-center gap-2" style={head}>
          Level match
          <select value={gap} onChange={(e) => setGap(Number(e.target.value))} className="px-2 py-1.5 text-sm" style={box} data-testid="partner-gap-select">
            {GAPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </label>
      </div>

      {msg && <p className="px-5 pt-3 text-sm" style={{ color: "#374151" }} role="status" data-testid="partner-matching-msg">{msg}</p>}

      {data && data.leagues.length === 0 && (
        <p className="p-5 text-sm" style={head}>No opted-in players are waiting for a partner.</p>
      )}

      {(data?.leagues || []).map((lg) => (
        <div key={lg.league_id} className="p-5" style={{ borderTop: "1px solid #F3F4F6" }} data-testid={`partner-league-${lg.league_id}`}>
          <p className="font-semibold text-sm">{lg.league_name} <span className="text-xs font-normal" style={head}>starts {lg.start_date} · {lg.spots_left} spots left</span></p>
          {lg.pairs.length === 0 ? (
            <p className="text-sm mt-2" style={head}>No pairs at this level setting.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {lg.pairs.map((p) => (
                <label key={key(p)} className="flex items-start gap-3 p-3 cursor-pointer" style={box}>
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[#008F70]" checked={!!picked[key(p)]} onChange={(e) => setPicked((s) => ({ ...s, [key(p)]: e.target.checked }))} data-testid={`pair-${p.token_a}`} />
                  <div className="grid sm:grid-cols-2 gap-3 flex-1 min-w-0">
                    <Person p={p.a} />
                    <Person p={p.b} />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: "#008F70" }}>{p.score}</p>
                    <p className="text-[11px]" style={head}>{p.gap === 0 ? "same level" : `±${p.gap}`}</p>
                  </div>
                  <div className="basis-full flex flex-wrap gap-1.5 pl-7">
                    {p.reasons.map((r) => <span key={r} className="px-2 py-0.5 text-[11px]" style={{ background: "#F1F1F1", color: "#374151" }}>{r}</span>)}
                  </div>
                </label>
              ))}
            </div>
          )}
          {lg.unmatched.length > 0 && (
            <ul className="mt-3 text-xs space-y-1" style={head}>
              {lg.unmatched.map((u) => <li key={u.token}><strong style={{ color: "#374151" }}>{u.name}</strong> (L{u.level.toFixed(1)}): {u.reason}</li>)}
            </ul>
          )}
          {lg.skipped.length > 0 && (
            <ul className="mt-2 text-xs space-y-1" style={head}>
              {lg.skipped.map((s) => <li key={s.name}>{s.name}: {s.reason}</li>)}
            </ul>
          )}
        </div>
      ))}

      {allPairs.length > 0 && (
        <div className="p-5 flex flex-wrap items-center gap-3" style={{ borderTop: "1px solid #F3F4F6" }}>
          <button onClick={() => setPicked(Object.fromEntries(allPairs.map((p) => [key(p), true])))} className="text-xs font-semibold" style={{ color: "#008F70" }} data-testid="select-all-pairs">Select all</button>
          <button onClick={assign} disabled={busy || !chosen.length} className="px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-50" style={{ background: "#F2A922", color: "#1D1D1D" }} data-testid="assign-selected-btn">
            {busy ? "Assigning..." : `Assign selected (${chosen.length})`}
          </button>
        </div>
      )}

      {requests.length > 0 && (
        <div className="p-5" style={{ borderTop: "1px solid #F3F4F6" }} data-testid="change-requests">
          <h3 className="font-semibold text-sm mb-2">Partner change requests ({requests.length})</h3>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.token} className="p-3 flex flex-wrap items-center justify-between gap-3" style={box}>
                <div className="text-sm">
                  <p><strong>{r.player_a}</strong> + <strong>{r.player_b}</strong> <span className="text-xs" style={head}>· {r.league_name} · starts {r.start_date}</span></p>
                  <p className="text-xs" style={head}>Asked by {r.requested_by}{r.reason ? `: "${r.reason}"` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => resolve(r.token, "approve")} className="px-3 py-1.5 text-xs font-bold" style={{ background: "#008F70", color: "#fff" }} data-testid={`approve-${r.token}`}>Approve</button>
                  <button onClick={() => resolve(r.token, "decline")} className="px-3 py-1.5 text-xs font-bold" style={{ border: "1px solid #E5E7EB" }} data-testid={`decline-${r.token}`}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {refunds.length > 0 && (
        <div className="p-5" style={{ borderTop: "1px solid #F3F4F6" }} data-testid="refund-due">
          <h3 className="font-semibold text-sm mb-1">Refund due ({refunds.length})</h3>
          <p className="text-xs mb-2" style={head}>These players paid for a team that was merged into another. Refund them in Stripe, then mark it done.</p>
          <div className="space-y-2">
            {refunds.map((r) => (
              <div key={r.token} className="p-3 flex flex-wrap items-center justify-between gap-3" style={box}>
                <p className="text-sm">{r.player_name} <span className="text-xs" style={head}>{r.player_email} · {r.league_name} · now teamed with {r.team_with} · ${r.amount.toFixed(2)}</span></p>
                <button onClick={() => markRefunded(r.token)} className="px-3 py-1.5 text-xs font-bold" style={{ border: "1px solid #008F70", color: "#008F70" }} data-testid={`mark-refunded-${r.token}`}>Mark refunded</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount it** — in `frontend/src/pages/AdminDashboard.jsx` add the import with the other component imports at the top:

```jsx
import PartnerMatchingPanel from "../components/PartnerMatchingPanel";
```

and add this line directly below `{tab === "leagues" && <IncompleteTeamsCard />}`:

```jsx
        {tab === "leagues" && <PartnerMatchingPanel />}
```

- [ ] **Step 3: Build**

Run (from `frontend/`): `npm run build`, then `git checkout frontend/public/sitemap.xml`.
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PartnerMatchingPanel.jsx frontend/src/pages/AdminDashboard.jsx
git commit -m "feat(partners): admin panel to find, assign and review partner matches"
```

---

### Task 12: Full verification

- [ ] **Step 1: Backend suite for everything touched**

Run (from `backend/`):
`python -m pytest tests/test_partner_matching.py tests/test_zip_code.py tests/test_auto_assign_partners.py tests/test_partner_later.py tests/test_refund_unpaired.py tests/test_play_profile.py tests/test_pairing_utils.py -q`
Expected: all passed, no failures.

- [ ] **Step 2: App imports and frontend builds**

Run (from `backend/`): `MONGO_URL=mongodb://localhost DB_NAME=x SECRET_KEY=x python -c "import server"`
Expected: no output, no traceback.
Run (from `frontend/`): `npm run build`, then `git checkout frontend/public/sitemap.xml`. Expected: succeeds.

- [ ] **Step 3: Manual check on staging** (after the user pushes to staging)

1. Two test accounts register in a free doubles league via "Register and add partner later" with "Let VenLax pick my partner" ticked.
2. Admin → Leagues tab → "Auto-assign partners". Both appear as a pair with score and reasons. Switch "Level match" with different skill levels: Exact hides the pair, ±0.5 shows it.
3. Tick the pair, "Assign selected (1)". Both players get an email; their dashboard My Leagues row shows "Partner: … assigned by VenLax" and "Request a different partner".
4. A player sends a request. Admin sees it under "Partner change requests", approves: both players are back under "Doubles teams waiting for a partner", the same pair is not suggested again.
5. Set the league's start date to today or earlier: the dashboard shows "Teams are locked now that the league has started." and the request button is gone.
6. Paid league: after assigning, "Refund due" lists the later registrant. "Mark refunded" removes it.

- [ ] **Step 4: Report** — summarize results to the user. Do not push or deploy without being asked.

---

## Self-review (spec coverage)

- Consent on join step and dashboard toggle → Tasks 4, 10. Zip → Tasks 3, 9. Level tolerance Exact / ±0.5 / ±1.0 → Tasks 1, 2, 6, 11.
- Hard rules (same league, both opted in, not waiting-with-partner, paid, mixed gender, rejected pairs, spots) → Task 5 (`assign_pair`), Task 2 (`score_pair`). Level is advisory at assign time by design.
- Score weights and reasons → Task 2. Unmatched reasons → Task 2. Skipped unpaid → Task 5/6.
- Admin review-then-confirm, partial success → Task 6. Refund flag, refund-due list, mark refunded → Tasks 5, 6, 11.
- Change request until `start_date`, locked after → Task 7 (`change_window_open`, endpoint, `team_info`) and Task 10 (note).
- Admin approve (dissolve: delete both records, free 2 spots, restore invites, rejected ids, repay case) and decline; emails → Tasks 5, 8, 11.
- Out of scope respected: no timers, no player accept step, no automatic refunds, no cross-league matching, no solo pool.
