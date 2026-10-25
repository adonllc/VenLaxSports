"""Sign-up emails to people who asked to hear about VenLax Sports before it launched (the old early list).

Three steps, each sent at most once per person (recorded in email_campaigns).
Recipients: stored contacts who have not unsubscribed and have no account yet. The contacts store no names,
so every email opens with "Hi there,". No counts, no urgency that is not true: only the season facts below.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from urllib.parse import urlencode

import jwt as pyjwt

import email_service
from auth_utils import JWT_ALGORITHM, get_jwt_secret

logger = logging.getLogger(__name__)

UNSUB_TYPE = "waitlist_unsub"  # unchanged: links in emails already sent must keep working
SITE = "https://venlaxsports.com"
SEASON = {"city": "Atlanta", "name": "Winter 2026", "start": "Nov 8"}
SUPPORT = "support@venlaxsports.com"


def make_unsub_token(contact_id: str) -> str:
    return pyjwt.encode({"sub": contact_id, "type": UNSUB_TYPE}, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_unsub_token(token: str) -> str | None:
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except pyjwt.InvalidTokenError:
        return None
    return payload.get("sub") if payload.get("type") == UNSUB_TYPE else None


def unsub_url(contact_id: str) -> str:
    base = os.environ.get("API_PUBLIC_URL", "https://api.venlaxsports.com").rstrip("/")
    return f"{base}/api/waitlist/unsubscribe?token={make_unsub_token(contact_id)}"


def tagged(path: str, step: int) -> str:
    q = urlencode({"utm_source": "early-list", "utm_medium": "email", "utm_campaign": f"atlanta-winter-2026-{step}"})
    return f"{SITE}{path}{'&' if '?' in path else '?'}{q}"


_S = SEASON

STEPS: dict[int, dict] = {
    1: {
        "subject": f"{_S['city']}'s {_S['name']} season starts {_S['start']}",
        "title": f"{_S['city']} leagues are open",
        "cta": ("Pick your league", tagged("/leagues?city=Atlanta", 1)),
        "body": f"""
          <p>Hi there,</p>
          <p>You asked to hear when VenLax Sports launched. It is live, and the {_S['name']} season in {_S['city']} starts {_S['start']}.</p>
          <p><strong>How it works</strong></p>
          <ul>
            <li>Pick a Tennis or Pickleball league, Singles or Doubles.</li>
            <li>Play 5 to 7 matches over 6 to 8 weeks. The home player proposes a time and court, the away player confirms.</li>
            <li>Your rating updates after every match, and every result gets a shareable match card.</li>
            <li>The top 4 (top 8 in bigger leagues) go to the playoffs.</li>
            <li>No club membership needed.</li>
          </ul>
          <p><strong>Price:</strong> Singles $9.99 per player. Doubles $19.99 per team, one payment covers you and your partner.</p>
          <p>Registration for a season closes once it opens. Entry fees are refundable until the league starts. Questions? Write to {SUPPORT}.</p>""",
    },
    2: {
        "subject": "Bring a partner or a friend. You both get $5",
        "title": "Play with someone you know",
        "cta": ("Create your free account", tagged("/auth?mode=register", 2)),
        "body": f"""
          <p>Hi there,</p>
          <p>Leagues are better with people you know. Here is how referrals work:</p>
          <ul>
            <li>Create your free account. Your referral code is on your Rewards page.</li>
            <li>When a friend signs up with it and plays their first confirmed match, you both get $5 credit.</li>
            <li>Every third friend earns you an extra $10. Three friends is $25 for you.</li>
            <li>Credit expires 12 months after it is issued.</li>
          </ul>
          <p>Playing Doubles? Invite your partner. One team fee of $19.99 covers both of you.</p>
          <p>The {_S['name']} season in {_S['city']} starts {_S['start']}. Questions? Write to {SUPPORT}.</p>""",
    },
    3: {
        "subject": f"Registration closes when the season opens on {_S['start']}",
        "title": "Last days to join",
        "cta": ("Pick your league", tagged("/leagues?city=Atlanta", 3)),
        "body": f"""
          <p>Hi there,</p>
          <p>The {_S['name']} season in {_S['city']} opens on {_S['start']}. Registration for a season closes once it opens, so if you want to play this one, join before then.</p>
          <p>Singles $9.99 per player. Doubles $19.99 per team, one payment covers both of you. Tennis and Pickleball.</p>
          <p>Entry fees are refundable until the league starts. If you miss this season we will tell you when the next one opens. Questions? Write to {SUPPORT}.</p>""",
    },
}


def campaign_id(step: int) -> str:
    return f"conversion_{step}"


def render(step: int, contact_id: str) -> dict:
    st = STEPS[step]
    return {"subject": st["subject"], "title": st["title"], "body": st["body"],
            "cta_label": st["cta"][0], "cta_url": st["cta"][1], "unsubscribe_url": unsub_url(contact_id)}


async def build_recipients(db, step: int) -> dict:
    """{"send": [{id, email}], "skipped_registered", "skipped_unsubscribed", "skipped_already_sent"}."""
    send, reg, unsub, done = [], 0, 0, 0
    entries = await db.waitlist.find({}).sort("created_at", 1).to_list(None)
    for e in entries:
        email = (e.get("email") or "").strip().lower()
        if not email:
            continue
        cid = str(e["_id"])
        if e.get("unsubscribed_at"):
            unsub += 1
            continue
        if await db.email_campaigns.find_one({"user_id": cid, "campaign": campaign_id(step)}):
            done += 1
            continue
        if await db.users.find_one({"email": email}, {"name": 1}):
            reg += 1
            continue
        send.append({"id": cid, "email": email})
    return {"send": send, "skipped_registered": reg, "skipped_unsubscribed": unsub, "skipped_already_sent": done}


async def send_one(db, step: int, rec: dict) -> bool:
    r = render(step, rec["id"])
    ok = await email_service.send_campaign_email(
        rec["email"], r["subject"], r["title"], r["body"], r["cta_label"], r["cta_url"], r["unsubscribe_url"])
    if ok:
        await db.email_campaigns.insert_one({
            "user_id": rec["id"], "user_email": rec["email"], "campaign": campaign_id(step),
            "audience": "early_list", "sent_at": datetime.now(timezone.utc).isoformat(),
        })
    return bool(ok)
