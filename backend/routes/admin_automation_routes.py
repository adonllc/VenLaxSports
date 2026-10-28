"""Admin: automation workflows (trigger, delay, conditions, one email, exit rules) and what they have done."""
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

import audit_log
import bulk_email
import email_automation as auto
import permissions
from auth_utils import get_current_user

router = APIRouter()


class EmailIn(BaseModel):
    template: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None


class ConditionsIn(BaseModel):
    segment: str = "all"
    city: Optional[str] = None


class WorkflowIn(BaseModel):
    name: str
    trigger: str
    delay_hours: int
    conditions: ConditionsIn = ConditionsIn()
    exit_on_league: bool = False
    email: EmailIn


async def _admin(request: Request, permission: str) -> dict:
    user = await get_current_user(request, request.app.state.db)
    return permissions.ensure(user, permission)


def _clean(body: WorkflowIn) -> dict:
    try:
        return auto.validate_definition(body.model_dump())
    except auto.WorkflowError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _out(d: dict, stats: dict | None = None) -> dict:
    d = {**d, "id": str(d.pop("_id"))}
    for k in ("enabled_at", "created_at", "updated_at"):
        if isinstance(d.get(k), datetime):
            d[k] = d[k].isoformat()
    d.pop("payload", None)
    d["stats"] = stats or {"sent": 0, "failed": 0, "exited": 0}
    return d


async def _get(db, wid: str) -> dict:
    doc = await db.automations.find_one({"_id": ObjectId(wid)}) if ObjectId.is_valid(wid) else None
    if not doc:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return doc


@router.get("")
async def list_workflows(request: Request):
    await _admin(request, "marketing.read")
    db = request.app.state.db
    stats: dict[str, dict] = {}
    for r in await db.workflow_runs.find({}).to_list(200000):
        s = stats.setdefault(r["workflow_id"], {"sent": 0, "failed": 0, "exited": 0})
        s[r["status"]] = s.get(r["status"], 0) + 1
    rows = await db.automations.find({}).sort("created_at", -1).to_list(100)
    return {"workflows": [_out(r, stats.get(str(r["_id"]))) for r in rows], "triggers": auto.TRIGGERS,
            "templates": [{"id": k, "label": v["label"]} for k, v in bulk_email.TEMPLATES.items()],
            "max_delay_hours": auto.MAX_DELAY_HOURS}


@router.post("")
async def create_workflow(body: WorkflowIn, request: Request):
    """New workflows start switched off. Nothing is sent until you turn one on."""
    admin = await _admin(request, "marketing.send")
    db = request.app.state.db
    doc = {**_clean(body), "enabled": False, "enabled_at": None, "created_by": str(admin["_id"]),
           "created_at": datetime.now(timezone.utc)}
    wid = (await db.automations.insert_one(doc)).inserted_id
    await audit_log.record(db, admin, "automation.create", "automation", str(wid), doc["name"],
                           after={"trigger": doc["trigger"], "delay_hours": doc["delay_hours"]}, request=request)
    return {"id": str(wid)}


@router.put("/{wid}")
async def update_workflow(wid: str, body: WorkflowIn, request: Request):
    admin = await _admin(request, "marketing.send")
    db = request.app.state.db
    doc = await _get(db, wid)
    if doc.get("enabled"):
        raise HTTPException(status_code=409, detail="Turn the workflow off before editing it")
    new = _clean(body)
    await db.automations.update_one({"_id": doc["_id"]}, {"$set": {**new, "updated_at": datetime.now(timezone.utc)}})
    await audit_log.record(db, admin, "automation.update", "automation", wid, new["name"],
                           before={"name": doc.get("name"), "trigger": doc.get("trigger"), "delay_hours": doc.get("delay_hours")},
                           after={"name": new["name"], "trigger": new["trigger"], "delay_hours": new["delay_hours"]}, request=request)
    return {"id": wid}


@router.post("/{wid}/{action}")
async def switch(wid: str, action: str, request: Request):
    """`enable` starts acting on events from this moment on; `disable` stops it. Nothing is back-filled."""
    if action not in ("enable", "disable"):
        raise HTTPException(status_code=404, detail="Not found")
    admin = await _admin(request, "marketing.send")
    db = request.app.state.db
    doc = await _get(db, wid)
    on = action == "enable"
    if on and not doc.get("payload"):
        raise HTTPException(status_code=400, detail="This workflow has no valid email")
    await db.automations.update_one({"_id": doc["_id"]}, {"$set": {"enabled": on, **({"enabled_at": datetime.now(timezone.utc)} if on else {})}})
    await audit_log.record(db, admin, f"automation.{action}", "automation", wid, doc.get("name"), request=request)
    return {"id": wid, "enabled": on}


@router.get("/{wid}/history")
async def history(wid: str, request: Request):
    await _admin(request, "marketing.read")
    db = request.app.state.db
    doc = await _get(db, wid)
    runs = await db.workflow_runs.find({"workflow_id": str(doc["_id"])}).sort("at", -1).to_list(100)
    return {"runs": [{"email": r.get("email"), "status": r["status"], "reason": r.get("reason"),
                      "trigger_at": r["trigger_at"].isoformat() if isinstance(r.get("trigger_at"), datetime) else r.get("trigger_at"),
                      "at": r["at"].isoformat() if isinstance(r.get("at"), datetime) else r.get("at")} for r in runs]}
