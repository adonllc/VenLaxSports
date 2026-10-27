"""Append-only record of what administrators did: who, what, when, to which record, and the before/after values.

Nothing here updates or deletes an entry, and no route does either. Secrets and password data are redacted before
anything is stored. A failure to write the log is logged loudly but never blocks the admin action itself.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import permissions

logger = logging.getLogger(__name__)

REDACT = {"password", "password_hash", "token", "access_token", "refresh_token", "secret", "api_key", "totp_secret", "two_factor_secret"}
MAX_VALUE_LEN = 300
MAX_PAGE = 200


def _clean(value, depth=0):
    """A small, JSON-safe, redacted copy of a before/after value."""
    if depth > 3:
        return "…"
    if isinstance(value, dict):
        return {str(k): ("[redacted]" if str(k).lower() in REDACT else _clean(v, depth + 1)) for k, v in list(value.items())[:40]}
    if isinstance(value, (list, tuple, set)):
        return [_clean(v, depth + 1) for v in list(value)[:20]]
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    text = str(value)
    return text if len(text) <= MAX_VALUE_LEN else text[:MAX_VALUE_LEN] + "…"


def _ip(request) -> str:
    headers = getattr(request, "headers", None)
    if headers is None:
        return ""
    fwd = headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()[:64]
    client = getattr(request, "client", None)
    return (client.host if client else "")[:64]


async def record(db, admin: dict, action: str, target_type: str = "", target_id: str = "", target_label: str = "",
                 before=None, after=None, meta=None, request=None) -> None:
    """Write one audit entry. `action` is a dotted verb like `player.delete`, `league.update`, `email.send`."""
    try:
        await db.audit_log.insert_one({
            "at": datetime.now(timezone.utc).isoformat(),
            "admin_id": str(admin.get("_id") or admin.get("id") or ""),
            "admin_email": admin.get("email", ""),
            "admin_role": permissions.effective_role(admin) or "",
            "action": action,
            "target_type": target_type,
            "target_id": str(target_id or ""),
            "target_label": str(target_label or "")[:200],
            "before": _clean(before) if before is not None else None,
            "after": _clean(after) if after is not None else None,
            "meta": _clean(meta) if meta is not None else None,
            "ip": _ip(request),
        })
    except Exception:
        logger.exception("AUDIT LOG WRITE FAILED action=%s target=%s/%s", action, target_type, target_id)


def diff(before: dict, after: dict) -> tuple[dict, dict]:
    """Only the fields that changed, as (before, after)."""
    keys = [k for k in after if before.get(k) != after.get(k)]
    return {k: before.get(k) for k in keys}, {k: after[k] for k in keys}


async def search(db, action: str = "", admin_id: str = "", target_type: str = "", target_id: str = "",
                 since: str = "", until: str = "", skip: int = 0, limit: int = 50) -> dict:
    q: dict = {}
    if action:
        q["action"] = {"$regex": "^" + _escape(action)}
    if admin_id:
        q["admin_id"] = admin_id
    if target_type:
        q["target_type"] = target_type
    if target_id:
        q["target_id"] = target_id
    if since or until:
        q["at"] = {k: v for k, v in (("$gte", since), ("$lte", until)) if v}
    limit = max(1, min(int(limit), MAX_PAGE))
    skip = max(0, int(skip))
    total = await db.audit_log.count_documents(q)
    rows = await db.audit_log.find(q).sort("at", -1).skip(skip).limit(limit).to_list(limit)
    for r in rows:
        r["id"] = str(r.pop("_id"))
    return {"total": total, "items": rows, "skip": skip, "limit": limit}


def _escape(text: str) -> str:
    import re
    return re.escape(text.strip())[:60]
