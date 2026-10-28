"""Click tracking and per-campaign results for marketing email.

A button link in a marketing email goes through /api/email/click?t=<signed token>. The token carries the campaign, the
player and the destination, signed with the server secret, so it cannot be edited to redirect anywhere else. We record
one click event (campaign, player, time) and send the visitor on. No IP address, user agent or cookie is stored.

Not tracked, on purpose or because SMTP gives us no signal: opens (tracking pixels are blocked or prefetched by mail
apps, so the number would mislead) and bounces (Gmail SMTP sends no delivery webhook). "Sent" means the mail server
accepted the message; "failed" means it refused it.
"""
import re
from datetime import datetime, timezone
from urllib.parse import quote

import jwt as pyjwt

from auth_utils import JWT_ALGORITHM, get_jwt_secret

CLICK_TYPE = "email_click"
_DEST = re.compile(r"^https://(www\.)?venlaxsports\.com(/[^\s]*)?$")


def _api_base() -> str:
    import os
    return os.environ.get("API_PUBLIC_URL", "https://api.venlaxsports.com").rstrip("/")


def click_url(campaign: str, user_id: str, destination: str) -> str:
    """The tracked link that stands in for `destination` in a real send."""
    token = pyjwt.encode({"type": CLICK_TYPE, "c": campaign, "u": user_id, "d": destination}, get_jwt_secret(), algorithm=JWT_ALGORITHM)
    return f"{_api_base()}/api/email/click?t={quote(token)}"


def decode_click(token: str) -> dict | None:
    """{campaign, user_id, destination} for a valid token pointing at venlaxsports.com, else None."""
    try:
        p = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except pyjwt.InvalidTokenError:
        return None
    dest = p.get("d") or ""
    if p.get("type") != CLICK_TYPE or not _DEST.match(dest):
        return None
    return {"campaign": p.get("c") or "", "user_id": p.get("u") or "", "destination": dest}


async def record_click(db, campaign: str, user_id: str) -> None:
    # a real datetime so the TTL index on `at` can expire old events
    await db.email_events.insert_one({"type": "click", "campaign": campaign, "user_id": user_id, "at": datetime.now(timezone.utc)})


def rate(part: int, whole: int):
    """Percent with one decimal, or None when there is nothing to divide by (shown as n/a, never 0%)."""
    return round(100 * part / whole, 1) if whole else None


async def campaign_results(db, limit: int = 30) -> list[dict]:
    """One row per campaign: people sent, people who clicked (each person once), click rate, failures, last sent."""
    jobs = await db.email_jobs.find({}).sort("started_at", -1).to_list(500)
    sent_by: dict[str, set] = {}
    last_sent: dict[str, str] = {}
    for d in await db.email_campaigns.find({}, {"campaign": 1, "user_id": 1, "sent_at": 1}).to_list(200000):
        k = d.get("campaign") or ""
        sent_by.setdefault(k, set()).add(d.get("user_id"))
        last_sent[k] = max(last_sent.get(k, ""), str(d.get("sent_at") or ""))
    clicked_by: dict[str, set] = {}
    for e in await db.email_events.find({"type": "click"}).to_list(200000):
        clicked_by.setdefault(e.get("campaign") or "", set()).add(e.get("user_id"))
    meta: dict[str, dict] = {}
    for j in jobs:
        m = meta.setdefault(j.get("campaign_key") or "", {"subject": j.get("subject"), "failed": 0})
        m["failed"] += int(j.get("failed") or 0)
    rows = []
    for key, people in sent_by.items():
        clicks = len(clicked_by.get(key, set()) & people)
        rows.append({"campaign": key, "subject": (meta.get(key) or {}).get("subject") or key, "sent": len(people),
                     "failed": (meta.get(key) or {}).get("failed", 0), "clicked": clicks, "click_rate": rate(clicks, len(people)),
                     "last_sent": last_sent.get(key) or None})
    rows.sort(key=lambda r: r["last_sent"] or "", reverse=True)
    return rows[:limit]
