"""Admin: send marketing emails to the early list or to registered users (preview, test, send, progress).

Admin only (not city admins). Nothing is sent by preview or test-to-self; a real send needs the recipient
count the admin was shown.
"""
import asyncio
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

import bulk_email
import email_service
import audit_log
import permissions
from auth_utils import get_current_user

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

    job = {
        "campaign_key": key, "audience": payload["audience"], "total": count, "sent": 0, "failed": 0, "status": "running",
        "subject": bulk_email.render(payload, audience["send"][0])["subject"],
        "started_by": str(admin["_id"]), "started_at": datetime.now(timezone.utc).isoformat(),
    }
    job_id = (await db.email_jobs.insert_one(job)).inserted_id
    await audit_log.record(db, admin, "email.send", "campaign", key, job["subject"],
                           after={"recipients": count, "audience": payload["audience"], "template": payload.get("template"),
                                  "segment": payload.get("segment")}, request=request)
    asyncio.create_task(bulk_email.run_job(db, job_id, payload, audience["send"], admin_id=str(admin["_id"])))
    return {"job_id": str(job_id), "total": count}


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
