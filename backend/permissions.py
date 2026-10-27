"""Admin roles and what each may do. Checked on the server for every sensitive admin route.

Backward compatible: an existing `role: "admin"` user with no `admin_role` is a super administrator, exactly as before.
An admin can be narrowed by setting `admin_role` (Admin > Team). A `city_admin` is a league administrator: leagues,
matches and payments, never player contact data, email campaigns, settings or the audit log. An `admin_role` value we do
not recognise fails closed to read-only.
"""
from fastapi import HTTPException

ALL_PERMISSIONS = (
    "dashboard.read",
    "players.read",      # names, emails, activity: personal data
    "players.write",     # tags
    "players.notes",     # read and write private admin notes about a player
    "players.suspend",   # suspend, reactivate, deactivate an account
    "players.delete",
    "players.export",
    "leagues.read",
    "leagues.write",
    "leagues.delete",
    "matches.write",
    "payments.read",
    "payments.write",
    "marketing.read",
    "marketing.send",
    "settings.write",    # open cities, feature flags
    "reports.read",
    "audit.read",
    "roles.manage",
)

ROLES: dict[str, dict] = {
    "super_admin": {"label": "Super administrator", "perms": set(ALL_PERMISSIONS)},
    "operations": {"label": "Operations administrator", "perms": set(ALL_PERMISSIONS) - {"roles.manage", "audit.read"}},
    "league_admin": {
        "label": "League administrator",
        "perms": {"dashboard.read", "leagues.read", "leagues.write", "leagues.delete", "matches.write", "payments.read", "payments.write"},
    },
    "marketing": {
        "label": "Marketing administrator",
        "perms": {"dashboard.read", "players.read", "marketing.read", "marketing.send", "reports.read"},
    },
    "support": {"label": "Customer support administrator", "perms": {"dashboard.read", "players.read", "players.write", "players.notes"}},
    "analytics_viewer": {
        "label": "Analytics viewer",
        "perms": {"dashboard.read", "leagues.read", "marketing.read", "reports.read"},
    },
    "read_only": {
        "label": "Read-only administrator",
        "perms": {"dashboard.read", "players.read", "leagues.read", "payments.read", "marketing.read", "reports.read"},
    },
}

ASSIGNABLE_ROLES = tuple(ROLES)


def effective_role(user: dict) -> str | None:
    """The permission role for this account, or None when it is not an admin at all."""
    base = user.get("role")
    if base == "city_admin":
        return "league_admin"
    if base != "admin":
        return None
    chosen = user.get("admin_role")
    if not chosen:
        return "super_admin"
    return chosen if chosen in ROLES else "read_only"


def permissions_for(user: dict) -> set[str]:
    role = effective_role(user)
    return set(ROLES[role]["perms"]) if role else set()


def has(user: dict, permission: str) -> bool:
    return permission in permissions_for(user)


def ensure(user: dict, permission: str) -> dict:
    """Return the user when they hold the permission, otherwise raise 403."""
    role = effective_role(user)
    if role is None:
        raise HTTPException(status_code=403, detail="Admin only")
    if permission not in ROLES[role]["perms"]:
        raise HTTPException(status_code=403, detail=f"Your admin role ({ROLES[role]['label']}) cannot do this")
    return user


async def require_permission(request, permission: str) -> dict:
    """Load the signed-in user from the request and require the permission. Use in routes that have no tighter check."""
    from auth_utils import get_current_user
    user = await get_current_user(request, request.app.state.db)
    return ensure(user, permission)
