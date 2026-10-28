"""Automation workflows: when something happens to a player, wait, then send one email, unless they should be left alone.

A workflow is  trigger -> delay -> conditions -> one email,  with exit rules.

Safety rules, all enforced here and tested:
  * A workflow only acts on events that happen AFTER it was turned on (`enabled_at`). Turning one on never emails
    people from the past. Turning it off and on again moves that line forward, so the gap is not back-filled.
  * Each player enters a workflow once (a `workflow_runs` row, whatever the outcome).
  * Conditions and exit rules are checked at send time, not when the player entered, so a player who joined a league
    during the delay is not sent "join a league".
  * Always left alone: unsubscribed, opted out, suspended or deactivated players, and anyone who already received the
    same email some other way.
  * At most one automation email per player per 24 hours; a player held back by that is retried on the next pass.
  * At most MAX_PER_PASS sends per pass, so a mistake cannot blast the whole list at once.
"""
import logging
from datetime import datetime, timedelta, timezone

from bson import ObjectId

import bulk_email
from dashboard_kpis import parse_dt

logger = logging.getLogger(__name__)

TRIGGERS = {
    "signup": "A player creates an account",
    "league_joined": "A player joins a league (paid or free)",
}
MAX_DELAY_HOURS = 24 * 30
MAX_PER_PASS = 100
PLAYER_COOLDOWN = timedelta(hours=24)
CONDITION_SEGMENTS = ("all", "no_league", "in_league")


class WorkflowError(ValueError):
    pass


def build_payload(email: dict) -> dict:
    """The bulk-email payload for the workflow's one email, validated like a manual send."""
    payload = {"audience": "registered", "segment": "all"}
    if email.get("template"):
        payload["template"] = email["template"]
        if email["template"] not in bulk_email.TEMPLATES:
            raise WorkflowError("Unknown email template")
    else:
        for k in ("subject", "body", "cta_label", "cta_url"):
            if email.get(k):
                payload[k] = email[k]
    try:
        bulk_email.validate(payload)
    except bulk_email.PayloadError as e:
        raise WorkflowError(str(e))
    return payload


def validate_definition(d: dict) -> dict:
    """Clean, checked fields for a workflow, or WorkflowError."""
    name = (d.get("name") or "").strip()
    if not 3 <= len(name) <= 80:
        raise WorkflowError("Give the workflow a name of 3 to 80 characters")
    if d.get("trigger") not in TRIGGERS:
        raise WorkflowError("Unknown trigger")
    delay = d.get("delay_hours")
    if not isinstance(delay, int) or isinstance(delay, bool) or not 0 <= delay <= MAX_DELAY_HOURS:
        raise WorkflowError(f"Delay must be a whole number of hours from 0 to {MAX_DELAY_HOURS}")
    cond = d.get("conditions") or {}
    if cond.get("segment", "all") not in CONDITION_SEGMENTS:
        raise WorkflowError("Unknown condition")
    return {
        "name": name, "trigger": d["trigger"], "delay_hours": delay,
        "conditions": {"segment": cond.get("segment", "all"), "city": (cond.get("city") or "").strip()},
        "exit_on_league": bool(d.get("exit_on_league")),
        "email": d.get("email") or {}, "payload": build_payload(d.get("email") or {}),
    }


# ── who has triggered ─────────────────────────────────────────────────────────

def _is_player(u: dict) -> bool:
    return u.get("role") not in ("admin", "city_admin")


async def trigger_events(db, trigger: str, users: list[dict]) -> dict[str, datetime]:
    """{user_id: when the trigger first happened} for every player it has happened to."""
    ids = {str(u["_id"]) for u in users if _is_player(u)}
    out: dict[str, datetime] = {}
    if trigger == "signup":
        for u in users:
            t = parse_dt(u.get("created_at"))
            if str(u["_id"]) in ids and t:
                out[str(u["_id"])] = t
    elif trigger == "league_joined":
        for r in await db.player_leagues.find({"payment_status": {"$in": ["paid", "free"]}}).to_list(None):
            t = parse_dt(r.get("joined_at") or r.get("registered_at"))
            pid = str(r.get("player_id"))
            if t and pid in ids and (pid not in out or t < out[pid]):
                out[pid] = t
    return out


def _skip_reason(wf: dict, user: dict, in_league: bool, received: bool) -> str | None:
    """Why this player should NOT get the email now, or None to send."""
    if user.get("is_active") is False or user.get("suspended_at"):
        return "account suspended or deactivated"
    if user.get("email_notifications") is False or user.get("marketing_unsubscribed_at"):
        return "opted out of marketing email"
    if not (user.get("email") or "").strip():
        return "no email address"
    if received:
        return "already received this email"
    if wf.get("exit_on_league") and in_league:
        return "joined a league while waiting"
    seg = (wf.get("conditions") or {}).get("segment", "all")
    if (seg == "in_league" and not in_league) or (seg == "no_league" and in_league):
        return "outside the workflow's conditions"
    city = ((wf.get("conditions") or {}).get("city") or "").lower()
    if city and (user.get("city") or "").strip().lower() != city:
        return "outside the workflow's conditions"
    return None


# ── the pass ──────────────────────────────────────────────────────────────────

async def run_pass(db, now: datetime | None = None, delay: float = 0.5) -> dict:
    """Process every enabled workflow once. Returns counts, for logs and tests."""
    now = now or datetime.now(timezone.utc)
    counts = {"sent": 0, "failed": 0, "exited": 0, "held": 0}
    workflows = await db.automations.find({"enabled": True}).to_list(100)
    if not workflows:
        return counts
    users = await db.users.find({}).to_list(None)
    by_id = {str(u["_id"]): u for u in users}
    in_league = {str(r["player_id"]) for r in await db.player_leagues.find({"payment_status": {"$in": ["paid", "free"]}}).to_list(None)}
    recent = {r["user_id"] for r in await db.workflow_runs.find({"status": "sent", "at": {"$gte": now - PLAYER_COOLDOWN}}).to_list(None)}
    budget = MAX_PER_PASS
    for wf in workflows:
        enabled_at = parse_dt(wf.get("enabled_at"))
        if not enabled_at:
            continue    # never acts without a start line
        entered = {r["user_id"] for r in await db.workflow_runs.find({"workflow_id": str(wf["_id"])}).to_list(None)}
        key = bulk_email.campaign_key(wf["payload"])
        got_it = {d["user_id"] for d in await db.email_campaigns.find({"campaign": key}).to_list(None)}
        events = await trigger_events(db, wf["trigger"], users)
        due = sorted(((t, uid) for uid, t in events.items()
                      if uid not in entered and t >= enabled_at and t + timedelta(hours=wf["delay_hours"]) <= now))
        for t, uid in due:
            if budget <= 0:
                break
            user = by_id[uid]
            reason = _skip_reason(wf, user, uid in in_league, uid in got_it)
            row = {"workflow_id": str(wf["_id"]), "user_id": uid, "email": user.get("email"), "trigger_at": t, "at": now}
            if reason:
                await db.workflow_runs.insert_one({**row, "status": "exited", "reason": reason})
                counts["exited"] += 1
                continue
            if uid in recent:
                counts["held"] += 1      # not recorded: tried again next pass
                continue
            rec = {"id": uid, "email": user["email"].strip().lower(), "first_name": bulk_email._first_name(user),
                   "referral_code": user.get("referral_code")}
            try:
                ok = await bulk_email.send_to(db, wf["payload"], rec)
            except Exception:  # noqa: BLE001
                logger.exception("automation email failed")
                ok = False
            await db.workflow_runs.insert_one({**row, "status": "sent" if ok else "failed", "reason": None if ok else "send failed"})
            counts["sent" if ok else "failed"] += 1
            budget -= 1
            if ok:
                recent.add(uid)
            if delay:
                import asyncio
                await asyncio.sleep(delay)
    return counts
