"""Where did each new account come from? First-touch and last-touch marketing source, saved at signup.

The frontend captures utm_source / utm_medium / utm_campaign / utm_content / utm_term, the referral code (?ref=)
and the referring site the first time a visitor lands, and sends them with the registration. Nothing else is stored:
no IP address, no user agent, no page history. Values are trimmed and capped because they come from a URL anyone can edit.

  {"first": {"source": "instagram", "medium": "social", "campaign": "atlanta-launch", ...},
   "last":  {...}}                       "last" is only present when it differs from "first"
"""
from collections import defaultdict
from typing import Optional

TOUCH_KEYS = ("source", "medium", "campaign", "content", "term", "ref", "referrer", "landing")
MAX_LEN = 100


def _clean(value) -> str:
    text = "".join(ch for ch in str(value) if ch.isprintable()).strip()
    return text[:MAX_LEN]


def _clean_touch(raw) -> dict:
    if not isinstance(raw, dict):
        return {}
    out = {}
    for key in TOUCH_KEYS:
        text = _clean(raw.get(key, ""))
        if text:
            out[key] = text.lower() if key in ("source", "medium", "campaign", "content", "term", "referrer") else text
    return out


def sanitize_attribution(raw) -> Optional[dict]:
    """Return the cleaned attribution to store, or None when there is nothing usable."""
    if not isinstance(raw, dict):
        return None
    first = _clean_touch(raw.get("first"))
    last = _clean_touch(raw.get("last"))
    if not first and not last:
        return None
    result = {"first": first or last}
    if last and last != result["first"]:
        result["last"] = last
    return result


def channel_for(attribution: Optional[dict]) -> tuple:
    """(source, medium, campaign) used to group the report. Falls back from UTM to referral code to referring site."""
    first = (attribution or {}).get("first") or {}
    if first.get("source"):
        return first["source"], first.get("medium") or "(none)", first.get("campaign") or "(none)"
    if first.get("ref"):
        return "referral", "friend", "(none)"
    if first.get("referrer"):
        return first["referrer"], "referral", "(none)"
    return "(direct)", "(none)", "(none)"


def build_report(users: list, joined_ids: set, played_ids: set) -> list:
    """Group new accounts by channel. Each row: signups, joined (paid or free league), played (rated match)."""
    rows = defaultdict(lambda: {"signups": 0, "joined": 0, "played": 0})
    for u in users:
        row = rows[channel_for(u.get("attribution"))]
        uid = str(u["_id"])
        row["signups"] += 1
        row["joined"] += uid in joined_ids
        row["played"] += uid in played_ids
    out = []
    for (source, medium, campaign), r in rows.items():
        out.append({
            "source": source, "medium": medium, "campaign": campaign,
            **r,
            "join_rate": round(100 * r["joined"] / r["signups"], 1) if r["signups"] else 0.0,
        })
    return sorted(out, key=lambda x: (-x["signups"], x["source"]))
