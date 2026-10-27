"""Admin: who may do what (roles) and the audit log. Mounted under /api/admin.

  GET /me/permissions          any admin: the signed-in admin's role and permissions (drives which tabs the UI shows)
  GET /audit-log               audit.read
  GET /team                    roles.manage
  PUT /team/{user_id}/role     roles.manage, audited, the last super administrator can never be narrowed
"""
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

import audit_log
import permissions
from auth_utils import get_current_user

router = APIRouter()


class RoleChange(BaseModel):
    admin_role: str


async def _need(request: Request, permission: str) -> dict:
    return permissions.ensure(await get_current_user(request, request.app.state.db), permission)


@router.get("/me/permissions")
async def my_permissions(request: Request):
    user = await get_current_user(request, request.app.state.db)
    role = permissions.effective_role(user)
    if role is None:
        raise HTTPException(status_code=403, detail="Admin only")
    return {"role": role, "label": permissions.ROLES[role]["label"], "permissions": sorted(permissions.permissions_for(user))}


@router.get("/audit-log")
async def get_audit_log(request: Request, action: str = "", admin_id: str = "", target_type: str = "", target_id: str = "",
                        since: str = "", until: str = "", skip: int = 0, limit: int = 50):
    await _need(request, "audit.read")
    return await audit_log.search(request.app.state.db, action, admin_id, target_type, target_id, since, until, skip, limit)


@router.get("/team")
async def team(request: Request):
    await _need(request, "roles.manage")
    db = request.app.state.db
    admins = await db.users.find({"role": {"$in": ["admin", "city_admin"]}}, {"name": 1, "email": 1, "role": 1, "admin_role": 1, "is_active": 1}).to_list(200)
    return {
        "roles": [{"id": k, "label": v["label"], "permissions": sorted(v["perms"])} for k, v in permissions.ROLES.items()],
        "admins": [{
            "id": str(a["_id"]), "name": a.get("name", ""), "email": a.get("email", ""), "base_role": a.get("role"),
            "effective_role": permissions.effective_role(a), "active": a.get("is_active", True) is not False,
        } for a in admins],
    }


@router.put("/team/{user_id}/role")
async def set_role(user_id: str, body: RoleChange, request: Request):
    actor = await _need(request, "roles.manage")
    db = request.app.state.db
    if body.admin_role not in permissions.ASSIGNABLE_ROLES:
        raise HTTPException(status_code=400, detail="Unknown role")
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")
    target = await db.users.find_one({"_id": oid})
    if not target or target.get("role") != "admin":
        raise HTTPException(status_code=404, detail="Only full administrators can be given a role")

    before = permissions.effective_role(target)
    if before == "super_admin" and body.admin_role != "super_admin":
        others = await db.users.count_documents({
            "role": "admin", "_id": {"$ne": oid}, "is_active": {"$ne": False},
            "$or": [{"admin_role": {"$exists": False}}, {"admin_role": None}, {"admin_role": "super_admin"}],
        })
        if others == 0:
            raise HTTPException(status_code=409, detail="There must always be at least one super administrator")

    await db.users.update_one({"_id": oid}, {"$set": {"admin_role": body.admin_role}})
    await audit_log.record(db, actor, "admin.role_change", "user", user_id, target.get("email", ""),
                           before={"admin_role": before}, after={"admin_role": body.admin_role}, request=request)
    return {"id": user_id, "effective_role": body.admin_role}
