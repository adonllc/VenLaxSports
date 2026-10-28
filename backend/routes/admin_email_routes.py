"""Admin: send marketing emails to the early list or to registered users (preview, test, send, progress).

Admin only (not city admins). Nothing is sent by preview or test-to-self; a real send needs the recipient
count the admin was shown.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel

import bulk_email
import email_service
import email_tracking
import audit_log
import permissions
from auth_utils import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()
public_router = APIRouter()


class EmailPayload(BaseModel):
    audience: str                      # "early_list" | "registered"
    step: Optional[int] = None         # early list: 1, 2 or 3
    template: Optional[str] = None     # registered: a template id, or empty for free-form
    segment: str = "all"               # registered: all | no_league | in_league
    city: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None
    user_ids: Optional[list[str]] = None   # registered: only these players (one, several, or leave out for everyone matching)


class SendRequest(EmailPayload):
    confirm_count: int


async def _admin(request: Request, permission: str = "marketing.send") -> dict:
    user = await get_current_user(request, request.app.state.db)
    return permissions.ensure(user, permission)


def _payload(p: EmailPayload) -> dict:
    d = p.model_dump(exclude={"confirm_count"})
    try:
        bulk_email.validate(d)
    except bulk_email.PayloadError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return d


@router.get("/templates")
async def templates(request: Request):
    await _admin(request, "marketing.read")
    return {"templates": [{"id": k, "label": v["label"]} for k, v in bulk_email.TEMPLATES.items()],
            "segments": list(bulk_email.SEGMENTS), "max_recipients": bulk_email.MAX_RECIPIENTS}


@router.post("/preview")
async def preview(body: EmailPayload, request: Request):
    """How many people would get it, who (first few), and exactly what it looks like. Sends nothing."""
    await _admin(request)
    db = request.app.state.db
    payload = _payload(body)
    audience = await bulk_email.build_audience(db, payload)
    sample = audience["send"][0] if audience["send"] else {"id": "0" * 24, "email": "", "first_name": "Sam"}
    m = bulk_email.render(payload, sample)
    return {
        "campaign_key": bulk_email.campaign_key(payload),
        "recipients": len(audience["send"]),
        "sample_emails": [r["email"] for r in audience["send"][:5]],
        "skipped": audience["skipped"],
        "over_limit": len(audience["send"]) > bulk_email.MAX_RECIPIENTS,
        "subject": m["subject"],
        "html": email_service.campaign_html(m["title"], m["body"], m["cta_label"], m["cta_url"], m["unsubscribe_url"], m["reason"]),
    }


@router.post("/test")
async def test_send(body: EmailPayload, request: Request):
    """One copy to the admin's own address. Not recorded, so it never uses up anyone's once-only send."""
    admin = await _admin(request)
    db = request.app.state.db
    payload = _payload(body)
    rec = {"id": str(admin["_id"]), "email": admin["email"], "first_name": bulk_email._first_name(admin)}
    ok = await bulk_email.send_to(db, payload, rec, record=False)
    if not ok:
        raise HTTPException(status_code=502, detail="The test email could not be sent. Check the email settings.")
    return {"sent_to": admin["email"]}


@router.post("/send")
async def send(body: SendRequest, request: Request):
    admin = await _admin(request)
    db = request.app.state.db
    payload = _payload(body)
    key = bulk_email.campaign_key(payload)

    audience = await bulk_email.build_audience(db, payload)
    count = len(audience["send"])
    if count == 0:
        raise HTTPException(status_code=400, detail="Nobody to send to")
    if count > bulk_email.MAX_RECIPIENTS:
        raise HTTPException(status_code=400, detail=f"Too many recipients ({count}). The limit per send is {bulk_email.MAX_RECIPIENTS}.")
    if count != body.confirm_count:
        raise HTTPException(status_code=409, detail=f"The audience changed (now {count} people). Preview again before sending.")
    if await db.email_jobs.find_one({"campaign_key": key, "status": "running"}):
        raise HTTPException(status_code=409, detail="This email is already being sent")

    job_id, job = await bulk_email.launch(db, payload, audience["send"], str(admin["_id"]))
    await audit_log.record(db, admin, "email.send", "campaign", key, job["subject"],
                           after={"recipients": count, "audience": payload["audience"], "template": payload.get("template"),
                                  "segment": payload.get("segment")}, request=request)
    return {"job_id": str(job_id), "total": count}


# ── scheduling ────────────────────────────────────────────────────────────────

class ScheduleRequest(SendRequest):
    run_at: str                        # ISO 8601 with offset, e.g. 2026-11-02T14:00:00Z


def _parse_run_at(raw: str) -> datetime:
    try:
        when = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="That date and time is not valid")
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    if when < now + timedelta(minutes=2):
        raise HTTPException(status_code=400, detail="Pick a time at least 2 minutes from now")
    if when > now + timedelta(days=90):
        raise HTTPException(status_code=400, detail="You can schedule up to 90 days ahead")
    return when.astimezone(timezone.utc)


def _row(d: dict) -> dict:
    d = {**d}
    d["id"] = str(d.pop("_id"))
    for k in ("run_at", "created_at"):
        if isinstance(d.get(k), datetime):
            d[k] = d[k].isoformat()
    d.pop("payload", None)
    return d


@router.post("/schedule")
async def schedule(body: ScheduleRequest, request: Request):
    """Queue a send for later. The audience is rebuilt when it runs, so people who unsubscribe in between are skipped."""
    admin = await _admin(request)
    db = request.app.state.db
    payload = _payload(body)
    when = _parse_run_at(body.run_at)
    audience = await bulk_email.build_audience(db, payload)
    count = len(audience["send"])
    if count == 0:
        raise HTTPException(status_code=400, detail="Nobody to send to")
    if count > bulk_email.MAX_RECIPIENTS:
        raise HTTPException(status_code=400, detail=f"Too many recipients ({count}). The limit per send is {bulk_email.MAX_RECIPIENTS}.")
    if count != body.confirm_count:
        raise HTTPException(status_code=409, detail=f"The audience changed (now {count} people). Preview again before scheduling.")
    doc = {
        "payload": payload, "campaign_key": bulk_email.campaign_key(payload), "run_at": when, "confirm_count": count,
        "subject": bulk_email.render(payload, audience["send"][0])["subject"], "status": "scheduled",
        "created_by": str(admin["_id"]), "created_at": datetime.now(timezone.utc),
    }
    sid = (await db.scheduled_emails.insert_one(doc)).inserted_id
    await audit_log.record(db, admin, "email.schedule", "campaign", doc["campaign_key"], doc["subject"],
                           after={"run_at": when.isoformat(), "recipients": count, "audience": payload["audience"]}, request=request)
    return {"id": str(sid), "run_at": when.isoformat(), "recipients": count}


@router.get("/scheduled")
async def scheduled(request: Request):
    await _admin(request, "marketing.read")
    rows = await request.app.state.db.scheduled_emails.find({}).sort("run_at", -1).to_list(50)
    return {"scheduled": [_row(r) for r in rows]}


_TRANSITIONS = {"pause": ("scheduled", "paused"), "resume": ("paused", "scheduled"),
                "cancel": ("scheduled", "cancelled"), "release": ("needs_review", "scheduled")}


@router.post("/scheduled/{sid}/{action}")
async def change_scheduled(sid: str, action: str, request: Request):
    """pause, resume or cancel a queued send. `release` re-queues one that was held for review because its audience grew."""
    admin = await _admin(request)
    if action not in _TRANSITIONS or not ObjectId.is_valid(sid):
        raise HTTPException(status_code=404, detail="Not found")
    before, after = _TRANSITIONS[action]
    db = request.app.state.db
    doc = await db.scheduled_emails.find_one({"_id": ObjectId(sid)})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    if action == "release":
        # the admin has looked at it: accept today's audience size as the new confirmed count
        audience = await bulk_email.build_audience(db, doc["payload"])
        extra = {"confirm_count": len(audience["send"]), "run_at": datetime.now(timezone.utc) + timedelta(minutes=2)}
    else:
        extra = {}
    res = await db.scheduled_emails.update_one({"_id": doc["_id"], "status": before}, {"$set": {"status": after, **extra}})
    if not res.matched_count:
        raise HTTPException(status_code=409, detail=f"It is {doc['status']}, so it cannot be {action}d")
    await audit_log.record(db, admin, f"email.schedule_{action}", "campaign", doc["campaign_key"], doc["subject"], request=request)
    return {"id": sid, "status": after}


@router.get("/results")
async def results(request: Request):
    """Per-campaign results: sent, failed, people who clicked, click rate. Opens and bounces are not tracked."""
    await _admin(request, "marketing.read")
    return {"campaigns": await email_tracking.campaign_results(request.app.state.db),
            "not_tracked": ["opens", "bounces"]}


@router.get("/jobs/{job_id}")
async def job_status(job_id: str, request: Request):
    await _admin(request, "marketing.read")
    db = request.app.state.db
    try:
        job = await db.email_jobs.find_one({"_id": ObjectId(job_id)})
    except Exception:
        job = None
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job["id"] = str(job.pop("_id"))
    return job


@router.get("/jobs")
async def recent_jobs(request: Request):
    await _admin(request, "marketing.read")
    db = request.app.state.db
    jobs = await db.email_jobs.find({}).sort("started_at", -1).to_list(20)
    for j in jobs:
        j["id"] = str(j.pop("_id"))
    return {"jobs": jobs}


@public_router.get("/click")
async def click(request: Request, t: str):
    """Record one click and send the visitor to the page. A bad or edited link goes to the home page, never elsewhere."""
    c = email_tracking.decode_click(t)
    if not c:
        return RedirectResponse(bulk_email.SITE, status_code=302)
    try:
        await email_tracking.record_click(request.app.state.db, c["campaign"], c["user_id"])
    except Exception:  # noqa: BLE001 - never block the visitor over a stats failure
        logger.exception("could not record email click")
    return RedirectResponse(c["destination"], status_code=302)


@public_router.get("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe_user(request: Request, token: str):
    """One-click unsubscribe from VenLax Sports marketing email (match and league emails are unaffected)."""
    db = request.app.state.db
    uid = bulk_email.decode_user_unsub_token(token)
    ok = False
    if uid:
        try:
            res = await db.users.update_one({"_id": ObjectId(uid)},
                                            {"$set": {"marketing_unsubscribed_at": datetime.now(timezone.utc).isoformat()}})
            ok = res.matched_count > 0
        except Exception:
            ok = False
    msg = ("You have been unsubscribed from VenLax Sports marketing email. You will still get emails about your own matches and leagues."
           if ok else "This unsubscribe link is not valid. Write to support@venlaxsports.com and we will remove you.")
    return HTMLResponse(f"<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'>"
                        f"<body style='font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;color:#3D3D3D'>"
                        f"<h2>VenLax Sports</h2><p>{msg}</p></body>")
