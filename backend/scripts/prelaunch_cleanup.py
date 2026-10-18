"""Pre-launch cleanup: remove test/demo data before going live.

DRY RUN by default. Nothing is deleted unless --execute is passed AND you type
the database name when prompted.

Usage (from backend/, with .env pointing at the target DB):
    python -m scripts.prelaunch_cleanup                      # dry run, prints counts
    python -m scripts.prelaunch_cleanup --execute --backup-dir ./cleanup_backup

What it does
  * Deletes demo users (*.demo@venlaxsports.com) and any user in --extra-delete-emails.
  * Never deletes KEEP_EMAILS or any role=admin user.
  * Wipes ALL league/match-dependent collections (leagues, matches, standings...).
  * Deletes user-scoped rows (push subs, waivers, follows, ...) of removed users.
  * Clears ephemeral auth collections.
  * Leaves: cities, promo_codes, waitlist, feature_flags, notification_interests,
    email_campaigns, and all kept users.
Other (non-demo) users are only REPORTED, never deleted, unless listed explicitly.
"""
from __future__ import annotations
import argparse
import asyncio
import os
import re
from pathlib import Path

from bson import ObjectId, json_util
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

KEEP_EMAILS = {"adonllcusa@gmail.com"}
DEMO_RE = re.compile(r"\.demo@venlaxsports\.com$", re.I)

# Fully wiped: tied to leagues/matches, which are all test data pre-launch.
WIPE_ALL = [
    "leagues", "player_leagues", "matches", "standings", "seasons",
    "ladders", "ladder_challenges", "challenges", "disputes", "appeals",
    "decisions", "rr_schedules", "doubles_invites", "match_cards",
    "rating_history", "payment_transactions", "promo_uses",
    "credit_applications", "referral_credits",
    "token_blacklist", "oauth_states", "auth_codes", "login_attempts",
]

# Only rows belonging to removed users: collection -> fields holding a user id.
USER_SCOPED = {
    "push_subscriptions": ["user_id"],
    "user_follows": ["follower_id", "followed_id", "user_id"],
    "waiver_consents": ["user_id"],
}


def id_variants(ids: list[str]) -> list:
    """User refs are stored as str in most collections, ObjectId in some."""
    return ids + [ObjectId(i) for i in ids]


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--execute", action="store_true")
    ap.add_argument("--backup-dir", help="export docs to be deleted as JSON first")
    ap.add_argument("--extra-delete-emails", nargs="*", default=[],
                    help="additional exact emails to delete (test accounts)")
    args = ap.parse_args()

    load_dotenv()
    db_name = os.environ["DB_NAME"]
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[db_name]
    print(f"Target DB: {db_name}  |  mode: {'EXECUTE' if args.execute else 'DRY RUN'}\n")

    extra = {e.lower() for e in args.extra_delete_emails}
    users = await db.users.find({}).to_list(None)
    doomed, kept, review = [], [], []
    for u in users:
        email = (u.get("email") or "").lower()
        if email in KEEP_EMAILS or u.get("role") == "admin":
            kept.append(u)
        elif DEMO_RE.search(email) or email in extra:
            doomed.append(u)
        else:
            review.append(u)

    print(f"Users: {len(users)} total | delete {len(doomed)} | keep {len(kept)} | need review {len(review)}")
    for u in doomed:
        print(f"  DELETE  {u.get('email')}")
    for u in kept:
        print(f"  KEEP    {u.get('email')} ({u.get('role')})")
    for u in review:
        print(f"  REVIEW  {u.get('email')}  (not deleted; pass via --extra-delete-emails to remove)")

    doomed_ids = [str(u["_id"]) for u in doomed]
    plan: list[tuple[str, dict]] = [("users", {"_id": {"$in": [u["_id"] for u in doomed]}})]
    plan += [(c, {}) for c in WIPE_ALL]
    if doomed_ids:
        for coll, fields in USER_SCOPED.items():
            plan.append((coll, {"$or": [{f: {"$in": id_variants(doomed_ids)}} for f in fields]}))

    print("\nCollection plan:")
    counts = {}
    for coll, flt in plan:
        n = await db[coll].count_documents(flt)
        counts[coll] = n
        print(f"  {coll:<24} delete {n}")

    if not args.execute:
        print("\nDry run only. Re-run with --execute to apply.")
        return

    if input(f"\nType the DB name '{db_name}' to confirm deletion: ").strip() != db_name:
        print("Aborted.")
        return

    if args.backup_dir:
        out = Path(args.backup_dir)
        out.mkdir(parents=True, exist_ok=True)
        for coll, flt in plan:
            if counts[coll]:
                docs = await db[coll].find(flt).to_list(None)
                (out / f"{coll}.json").write_text(json_util.dumps(docs, indent=1), encoding="utf-8")
        print(f"Backup written to {out.resolve()}")

    for coll, flt in plan:
        res = await db[coll].delete_many(flt)
        print(f"  {coll:<24} deleted {res.deleted_count}")
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
