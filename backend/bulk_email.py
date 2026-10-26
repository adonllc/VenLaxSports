"""Admin-triggered marketing emails: the early list (conversion steps) and registered users (templates or free-form).

Rules that hold for every send:
  * each person gets a given campaign at most once (email_campaigns row per person per campaign key);
  * unsubscribed people, and registered users who turned notification email off, are never emailed;
  * every email has an unsubscribe link and the sender address;
  * free-form text is escaped (no raw HTML) and links may only point to venlaxsports.com;
  * the send is started with the recipient count the admin was shown, and refused if the audience changed.
"""
from __future__ import annotations

import asyncio
import hashlib
import secrets
import html
import logging
import os
import re
from datetime import datetime, timezone
from urllib.parse import urlencode

import jwt as pyjwt
from bson import ObjectId

import conversion_campaign as cc
import email_service
import thank_you_coupon
from auth_utils import JWT_ALGORITHM, get_jwt_secret

logger = logging.getLogger(__name__)

USER_UNSUB_TYPE = "user_marketing_unsub"
SITE = cc.SITE
MAX_RECIPIENTS = 2000
MAX_SELECTED = 500
SEGMENTS = ("all", "no_league", "in_league")
REGISTERED_REASON = "You are receiving this because you have a VenLax Sports account."

_S = cc.SEASON

TEMPLATES: dict[str, dict] = {
    "season_starts": {
        "label": "Season starts",
        "subject": f"{_S['city']}'s {_S['name']} season starts {_S['start']}",
        "title": f"{_S['city']} leagues are open",
        "cta": ("Pick your league", "/leagues?city=Atlanta"),
        "body": f"""
          <p>Hi {{name}},</p>
          <p>The {_S['name']} season in {_S['city']} starts {_S['start']}. Pick a Tennis or Pickleball league, Singles or Doubles.</p>
          <p>Singles $9.99 per player. Doubles $19.99 per team, one payment covers you and your partner.</p>
          <p>Registration for a season closes once it opens. Entry fees are refundable until the league starts. Questions? Write to {cc.SUPPORT}.</p>""",
    },
    "refer_friend": {
        "label": "Refer a friend",
        "subject": "Bring a friend. You both get $5",
        "title": "Play with someone you know",
        "cta": ("Open your rewards", "/rewards"),
        "body": f"""
          <p>Hi {{name}},</p>
          <p>Your referral code is on your Rewards page. When a friend signs up with it and plays their first confirmed match, you both get $5 credit.</p>
          <p>Every third friend earns you an extra $10. Three friends is $25 for you. Credit expires 12 months after it is issued.</p>
          <p>Questions? Write to {cc.SUPPORT}.</p>""",
    },
    "thank_you": {
        "label": "Thank you + $10 coupon",
        "coupon": True,    # each recipient gets their own one-time $10 code, made when the email is really sent
        "subject": "Thank you for joining VenLax Sports",
        "title": "Thank you",
        "cta": ("Share your referral link", "/rewards"),
        "body": """
          <p>Hi {name},</p>
          <p>Thank you for registering with VenLax Sports. We truly appreciate having you in our community.</p>
          <p>To celebrate, we have a reward ready for you: <strong>$10 credit</strong> toward a future league.</p>
          <p style="background:#F1F1F1;padding:14px 16px;margin:16px 0">Your code: <strong style="font-size:20px;letter-spacing:1px">{coupon_code}</strong><br>
          Enter it at checkout when you join a league. It works once and expires on {coupon_expires}.</p>
          <p>You can earn even more by inviting friends. Share your referral link, and when a friend signs up and plays their first confirmed match, you both get $5 credit. Every third friend adds a $10 bonus.</p>
          <p>Your link: {referral_link}</p>
          <p>Thanks again for being part of VenLax Sports.</p>
          <p>See you in the game,<br>The VenLax Sports Team</p>""",
    },
    "add_partner": {
        "label": "Doubles: add your partner",
        "subject": "Doubles: add your partner before the league starts",
        "title": "Complete your doubles team",
        "cta": ("Open my dashboard", "/dashboard"),
        "body": f"""
          <p>Hi {{name}},</p>
          <p>If you registered a doubles team, you can add or change your partner from your dashboard any time before the league starts: search for a player, invite by email, or share a link. One team fee of $19.99 covers both of you.</p>
          <p>Questions? Write to {cc.SUPPORT}.</p>""",
    },
}


# ── unsubscribe tokens for registered users ───────────────────────────────────

def make_user_unsub_token(user_id: str) -> str:
    return pyjwt.encode({"sub": user_id, "type": USER_UNSUB_TYPE}, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_user_unsub_token(token: str) -> str | None:
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except pyjwt.InvalidTokenError:
        return None
    return payload.get("sub") if payload.get("type") == USER_UNSUB_TYPE else None


def user_unsub_url(user_id: str) -> str:
    base = os.environ.get("API_PUBLIC_URL", "https://api.venlaxsports.com").rstrip("/")
    return f"{base}/api/email/unsubscribe?token={make_user_unsub_token(user_id)}"


# ── message rendering ─────────────────────────────────────────────────────────

class PayloadError(ValueError):
    pass


def _tag(path_or_url: str, campaign_key: str) -> str:
    url = path_or_url if path_or_url.startswith("http") else f"{SITE}{path_or_url}"
    q = urlencode({"utm_source": "email", "utm_medium": "email", "utm_campaign": campaign_key})
    return f"{url}{'&' if '?' in url else '?'}{q}"


def _safe_link(url: str) -> str:
    if not re.match(r"^https://(www\.)?venlaxsports\.com(/[^\s]*)?$", url.strip()):
        raise PayloadError("The button link must start with https://venlaxsports.com")
    return url.strip()


def _paragraphs(text: str) -> str:
    paras = [p.strip() for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
    return "".join(f"<p>{html.escape(p).replace(chr(10), '<br>')}</p>" for p in paras)


def campaign_key(payload: dict) -> str:
    aud = payload.get("audience")
    if aud == "early_list":
        return cc.campaign_id(int(payload.get("step", 0)))
    template = payload.get("template")
    if template in TEMPLATES:
        return f"tpl_{template}"
    raw = "|".join([payload.get("subject", ""), payload.get("body", ""), payload.get("cta_label", ""), payload.get("cta_url", ""),
                    payload.get("segment", "all"), (payload.get("city") or "").strip().lower()])
    return "custom_" + hashlib.sha256(raw.encode()).hexdigest()[:10]


def validate(payload: dict) -> None:
    aud = payload.get("audience")
    if aud == "early_list":
        if payload.get("step") not in cc.STEPS:
            raise PayloadError("Pick step 1, 2 or 3")
        return
    if aud != "registered":
        raise PayloadError("audience must be early_list or registered")
    if payload.get("segment", "all") not in SEGMENTS:
        raise PayloadError("Unknown segment")
    ids = payload.get("user_ids")
    if ids is not None:
        if not isinstance(ids, list) or not 1 <= len(ids) <= MAX_SELECTED or not all(isinstance(i, str) and ObjectId.is_valid(i) for i in ids):
            raise PayloadError(f"Pick between 1 and {MAX_SELECTED} players")
    if payload.get("template") in TEMPLATES:
        return
    subject, body = (payload.get("subject") or "").strip(), (payload.get("body") or "").strip()
    if not 3 <= len(subject) <= 150:
        raise PayloadError("Subject must be 3 to 150 characters")
    if not 10 <= len(body) <= 5000:
        raise PayloadError("Message must be 10 to 5000 characters")
    if bool(payload.get("cta_label")) != bool(payload.get("cta_url")):
        raise PayloadError("Give the button both a label and a link, or neither")
    if payload.get("cta_url"):
        _safe_link(payload["cta_url"])


def render(payload: dict, recipient: dict, coupon: dict | None = None) -> dict:
    """The message for one recipient: {subject, title, body, cta_label, cta_url, unsubscribe_url, reason}.

    coupon: this recipient's real coupon for a template that has one; None shows a clearly fake example code."""
    validate(payload)
    key = campaign_key(payload)
    name = html.escape(recipient.get("first_name") or "there")
    if payload["audience"] == "early_list":
        r = cc.render(payload["step"], recipient["id"])
        return {**r, "reason": None}
    template = TEMPLATES.get(payload.get("template"))
    if template:
        label, path = template["cta"]
        body = template["body"].replace("{name}", name)
        if template.get("coupon"):
            c = coupon or thank_you_coupon.example()
            code = recipient.get("referral_code")
            link = f'<a href="{SITE}/auth?ref={code}">{SITE}/auth?ref={code}</a>' if code else "shown on your Rewards page"
            body = body.replace("{coupon_code}", c["code"]).replace("{coupon_expires}", c["expires_text"]).replace("{referral_link}", link)
        return {"subject": template["subject"], "title": template["title"], "body": body,
                "cta_label": label, "cta_url": _tag(path, key), "unsubscribe_url": user_unsub_url(recipient["id"]), "reason": REGISTERED_REASON}
    body = f"<p>Hi {name},</p>" + _paragraphs(payload["body"].replace("{name}", recipient.get("first_name") or "there"))
    url = _tag(_safe_link(payload["cta_url"]), key) if payload.get("cta_url") else None
    return {"subject": payload["subject"].strip(), "title": payload["subject"].strip(), "body": body,
            "cta_label": payload.get("cta_label") or None, "cta_url": url,
            "unsubscribe_url": user_unsub_url(recipient["id"]), "reason": REGISTERED_REASON}


# ── audiences ─────────────────────────────────────────────────────────────────

def _first_name(user: dict) -> str:
    n = (user.get("first_name") or user.get("name") or "").strip()
    return n.split()[0] if n else ""


async def build_audience(db, payload: dict) -> dict:
    """{"send": [{id, email, first_name}], "skipped": {reason: n}} for the payload's audience."""
    validate(payload)
    if payload["audience"] == "early_list":
        r = await cc.build_recipients(db, payload["step"])
        return {"send": [{**x, "first_name": ""} for x in r["send"]],
                "skipped": {"already registered": r["skipped_registered"], "unsubscribed": r["skipped_unsubscribed"],
                            "already sent": r["skipped_already_sent"]}}

    key = campaign_key(payload)
    sent_ids = {d["user_id"] for d in await db.email_campaigns.find({"campaign": key}).to_list(None)}
    users = await db.users.find({}).to_list(None)
    chosen = set(payload["user_ids"]) if payload.get("user_ids") else None
    in_league = {d["player_id"] for d in await db.player_leagues.find({"payment_status": {"$in": ["paid", "free"]}}).to_list(None)}
    city = (payload.get("city") or "").strip().lower()
    segment = payload.get("segment", "all")
    send, skipped = [], {"opted out": 0, "already sent": 0, "outside filter": 0}
    for u in users:
        email = (u.get("email") or "").strip().lower()
        uid = str(u["_id"])
        if not email or u.get("is_active") is False or (chosen is not None and uid not in chosen):
            continue
        if u.get("email_notifications") is False or u.get("marketing_unsubscribed_at"):
            skipped["opted out"] += 1
            continue
        if uid in sent_ids:
            skipped["already sent"] += 1
            continue
        if (city and (u.get("city") or "").strip().lower() != city) or \
           (segment == "in_league" and uid not in in_league) or (segment == "no_league" and uid in in_league):
            skipped["outside filter"] += 1
            continue
        send.append({"id": uid, "email": email, "first_name": _first_name(u), "referral_code": u.get("referral_code")})
    return {"send": send, "skipped": skipped}


# ── sending ───────────────────────────────────────────────────────────────────

async def send_to(db, payload: dict, rec: dict, record: bool = True, admin_id: str = "") -> bool:
    coupon = None
    template = TEMPLATES.get(payload.get("template"))
    if template and template.get("coupon"):
        # A test email carries a real coupon too, made for the admin's own account only, so the admin can try
        # redeeming it. Its key is new every time, so every test gets its own code.
        key = campaign_key(payload) if record else f"test_{campaign_key(payload)}_{secrets.token_hex(4)}"
        coupon = await thank_you_coupon.get_or_create(db, rec["id"], key, admin_id)
    if template and template.get("coupon") and record:
        if not rec.get("referral_code"):
            from routes.referral_routes import generate_referral_code
            rec = {**rec, "referral_code": generate_referral_code()}
            await db.users.update_one({"_id": ObjectId(rec["id"])}, {"$set": {"referral_code": rec["referral_code"]}})
    m = render(payload, rec, coupon)
    ok = await email_service.send_campaign_email(
        rec["email"], m["subject"], m["title"], m["body"], m["cta_label"], m["cta_url"], m["unsubscribe_url"], reason=m["reason"])
    if ok and record:
        await db.email_campaigns.insert_one({
            "user_id": rec["id"], "user_email": rec["email"], "campaign": campaign_key(payload),
            "audience": "early_list" if payload["audience"] == "early_list" else "registered",
            "sent_at": datetime.now(timezone.utc).isoformat(),
        })
    return bool(ok)


async def run_job(db, job_id, payload: dict, recipients: list[dict], delay: float = 0.5, admin_id: str = "") -> None:
    sent = failed = 0
    for rec in recipients:
        try:
            ok = await send_to(db, payload, rec, admin_id=admin_id)
        except Exception:  # noqa: BLE001
            logger.exception("bulk email failed for one recipient")
            ok = False
        sent += 1 if ok else 0
        failed += 0 if ok else 1
        await db.email_jobs.update_one({"_id": job_id}, {"$set": {"sent": sent, "failed": failed}})
        if delay:
            await asyncio.sleep(delay)
    await db.email_jobs.update_one({"_id": job_id}, {"$set": {
        "status": "done", "sent": sent, "failed": failed, "finished_at": datetime.now(timezone.utc).isoformat()}})
