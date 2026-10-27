"""Player CRM rules that need no database: tags, notes, account status, and duplicate detection.

Duplicates are only ever reported, never merged here. A merge rewrites matches, standings, payments and referrals and
cannot be undone, so it needs its own reviewed workflow.
"""
from __future__ import annotations

import re
from collections import defaultdict

MAX_TAGS = 20
MAX_TAG_LEN = 30
MAX_NOTE_LEN = 2000
MAX_REASON_LEN = 300
STATUSES = ("active", "suspended", "deactivated")


class CrmError(ValueError):
    pass


def clean_tag(raw) -> str:
    tag = re.sub(r"\s+", "-", str(raw or "").strip().lower())
    if not 1 <= len(tag) <= MAX_TAG_LEN or not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", tag):
        raise CrmError("A tag is 1 to 30 letters, numbers, dashes or underscores")
    return tag


def apply_tags(current, add=(), remove=()) -> list[str]:
    tags = [t for t in (current or []) if isinstance(t, str)]
    drop = {clean_tag(t) for t in remove}
    tags = [t for t in tags if t not in drop]
    for t in (clean_tag(x) for x in add):
        if t not in tags:
            tags.append(t)
    if len(tags) > MAX_TAGS:
        raise CrmError(f"A player can have at most {MAX_TAGS} tags")
    return sorted(tags)


def clean_note(text) -> str:
    text = str(text or "").strip()
    if not 1 <= len(text) <= MAX_NOTE_LEN:
        raise CrmError(f"A note is 1 to {MAX_NOTE_LEN} characters")
    return text


def clean_reason(text) -> str:
    text = str(text or "").strip()
    if not 3 <= len(text) <= MAX_REASON_LEN:
        raise CrmError(f"Give a reason of 3 to {MAX_REASON_LEN} characters")
    return text


def status_of(user: dict) -> str:
    if user.get("is_active") is False:
        return "deactivated"
    return "suspended" if user.get("suspended_at") else "active"


def normalize_email(email: str) -> str:
    """One mailbox, one key: lowercase, no +tag, and Gmail ignores dots."""
    email = (email or "").strip().lower()
    if "@" not in email:
        return email
    local, domain = email.rsplit("@", 1)
    local = local.split("+", 1)[0]
    if domain in ("gmail.com", "googlemail.com"):
        local, domain = local.replace(".", ""), "gmail.com"
    return f"{local}@{domain}"


def _name_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def _phone_key(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    return digits[-10:] if len(digits) >= 10 else ""


def find_duplicates(users: list[dict]) -> list[dict]:
    """Groups of accounts that may belong to one person.

    high: the same mailbox (dots / +tags ignored) or the same phone number. possible: the same name in the same city.
    Accounts linked by any rule end up in one group."""
    people = [u for u in users if u.get("role") != "admin"]
    parent = {str(u["_id"]): str(u["_id"]) for u in people}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    reasons: dict[str, set] = defaultdict(set)
    levels: dict[str, str] = {}
    buckets: dict[tuple, list[str]] = defaultdict(list)
    for u in people:
        uid = str(u["_id"])
        if u.get("email"):
            buckets[("email", normalize_email(u["email"]))].append(uid)
        if _phone_key(u.get("phone", "")):
            buckets[("phone", _phone_key(u["phone"]))].append(uid)
        if _name_key(u.get("name", "")) and (u.get("city") or "").strip():
            buckets[("name", _name_key(u["name"]), u["city"].strip().lower())].append(uid)
    for key, members in buckets.items():
        if len(members) < 2:
            continue
        for m in members[1:]:
            parent[find(m)] = find(members[0])
        label = {"email": "same email address", "phone": "same phone number", "name": "same name and city"}[key[0]]
        for m in members:
            reasons[m].add(label)
            if key[0] != "name":
                levels[m] = "high"
            else:
                levels.setdefault(m, "possible")

    groups = defaultdict(list)
    for u in people:
        groups[find(str(u["_id"]))].append(u)
    out = []
    for members in groups.values():
        if len(members) < 2:
            continue
        ids = [str(m["_id"]) for m in members]
        out.append({
            "confidence": "high" if any(levels.get(i) == "high" for i in ids) else "possible",
            "reasons": sorted(set().union(*(reasons[i] for i in ids))),
            "players": [{"id": str(m["_id"]), "name": m.get("name", ""), "email": m.get("email", ""), "city": m.get("city") or "",
                         "created_at": m.get("created_at", ""), "status": status_of(m)} for m in sorted(members, key=lambda m: m.get("created_at", ""))],
        })
    out.sort(key=lambda g: (g["confidence"] != "high", -len(g["players"])))
    return out
