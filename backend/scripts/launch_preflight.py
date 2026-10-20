"""Launch preflight: read-only checks that the environment is ready to go live.

Changes nothing. Run it in the backend container's terminal (it reads the
container's own env vars and database):

    python -m scripts.launch_preflight            # env + database checks
    python -m scripts.launch_preflight --skip-db  # env checks only

Exit code 1 if any check FAILs, so it can gate a launch. WARN means "look at it",
not "blocked".
"""
from __future__ import annotations
import argparse
import asyncio
import os
import re

from dotenv import load_dotenv

KEEP_EMAILS = {"adonllcusa@gmail.com"}
DEMO_RE = re.compile(r"\.demo@venlaxsports\.com$", re.I)
results: list[tuple[str, str, str]] = []


def add(level: str, name: str, detail: str = "") -> None:
    results.append((level, name, detail))


def env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def check_env(target: str) -> None:
    prod = target == "prod"
    add("PASS" if env("ENV") == "production" else "FAIL", "ENV=production (secure cookies)", f"ENV={env('ENV') or 'unset'}")
    add("PASS" if env("PHASE") == "1" else "FAIL", "PHASE=1 (USA, Tennis + Pickleball)", f"PHASE={env('PHASE') or 'unset'}")
    add("FAIL" if env("CRICKET_ENABLED").lower() == "true" else "PASS", "Cricket flag off", f"CRICKET_ENABLED={env('CRICKET_ENABLED') or 'unset'}")
    add("PASS" if env("MONGO_URL") and env("DB_NAME") else "FAIL", "MONGO_URL and DB_NAME set", f"DB_NAME={env('DB_NAME') or 'unset'}")

    jwt = env("JWT_SECRET")
    add("PASS" if len(jwt) >= 32 else "FAIL", "JWT_SECRET set (32+ chars)", f"length {len(jwt)}")

    stripe = env("STRIPE_API_KEY")
    if prod:
        add("PASS" if stripe.startswith("sk_live_") else "FAIL", "Stripe LIVE key (sk_live_...)", "starts with " + (stripe[:8] or "unset"))
        add("PASS" if env("STRIPE_WEBHOOK_SECRET").startswith("whsec_") else "FAIL", "Stripe webhook signing secret", "set" if env("STRIPE_WEBHOOK_SECRET") else "unset")
    else:
        add("PASS" if stripe.startswith("sk_test_") else "WARN", "Stripe TEST key on staging", "starts with " + (stripe[:8] or "unset"))

    smtp = env("SMTP_HOST")
    add("PASS" if smtp else "FAIL", "SMTP host set (emails actually send)", smtp or "unset: emails only print to console")
    if smtp:
        add("WARN" if "gmail" in smtp.lower() else "PASS", "SMTP is a transactional provider (not Gmail)", smtp)
        add("PASS" if env("SMTP_USER") and env("SMTP_PASS") and env("SMTP_FROM") else "FAIL", "SMTP user, password and from address", "")

    front = env("FRONTEND_URL")
    add("PASS" if front.startswith("https://") else "FAIL", "FRONTEND_URL is https", front or "unset")
    cors = env("CORS_ORIGINS")
    add("PASS" if cors and "*" not in cors and "localhost" not in cors else "FAIL", "CORS locked to real origins (no * / localhost)", cors or "unset")
    add("PASS" if env("GOOGLE_CLIENT_ID") and env("GOOGLE_CLIENT_SECRET") else "FAIL", "Google sign-in credentials", "")
    add("PASS" if env("ADMIN_EMAIL") else "WARN", "ADMIN_EMAIL set", env("ADMIN_EMAIL") or "unset")
    add("WARN" if not (env("WHATSAPP_API_TOKEN")) else "PASS", "WhatsApp token (optional, Meta approval pending)", "unset" if not env("WHATSAPP_API_TOKEN") else "set")


async def check_db() -> None:
    from motor.motor_asyncio import AsyncIOMotorClient

    db = AsyncIOMotorClient(env("MONGO_URL"), serverSelectionTimeoutMS=8000)[env("DB_NAME")]
    try:
        await db.command("ping")
    except Exception as e:  # noqa: BLE001
        add("FAIL", "Database reachable", str(e)[:120])
        return
    add("PASS", "Database reachable", env("DB_NAME"))

    admins = await db.users.count_documents({"role": "admin"})
    add("PASS" if admins else "FAIL", "At least one admin user", f"{admins} admin(s)")
    keep = await db.users.count_documents({"email": {"$in": list(KEEP_EMAILS)}})
    add("PASS" if keep else "WARN", "Owner account exists", ", ".join(KEEP_EMAILS))

    demo = [u["email"] async for u in db.users.find({"email": DEMO_RE}, {"email": 1})]
    add("PASS" if not demo else "FAIL", "No demo accounts left", f"{len(demo)} found" + (f": {demo[:3]}" if demo else ""))

    others = await db.users.count_documents({"role": {"$ne": "admin"}, "email": {"$nin": list(KEEP_EMAILS)}})
    add("PASS" if others == 0 else "WARN", "No non-admin accounts besides the owner (review if real players)", f"{others} other user(s)")

    leagues = [l async for l in db.leagues.find({}, {"name": 1, "status": 1})]
    testy = [l["name"] for l in leagues if re.search(r"\b(test|demo|sample|dummy)\b", l.get("name", ""), re.I)]
    add("PASS" if not testy else "FAIL", "No test-named leagues", f"{len(testy)} found" + (f": {testy[:3]}" if testy else ""))
    add("PASS" if leagues else "WARN", "Real leagues created for launch", f"{len(leagues)} league(s)")

    for coll, label in (("matches", "matches"), ("payment_transactions", "payment transactions"), ("rating_history", "rating history")):
        n = await db[coll].count_documents({})
        add("PASS" if n == 0 else "WARN", f"No leftover {label} from testing", f"{n} document(s)")

    idx = await db.users.index_information()
    add("PASS" if any(v.get("unique") and v["key"][0][0] == "email" for v in idx.values()) else "FAIL", "Indexes created (users.email unique)", "run seeds.indexes if missing")
    cities = await db.cities.count_documents({})
    add("PASS" if cities else "WARN", "Cities seeded", f"{cities} cit(ies)")
    wl = await db.waitlist.count_documents({})
    add("PASS", "Waitlist preserved", f"{wl} sign-up(s)")


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-db", action="store_true")
    ap.add_argument("--target", choices=["prod", "staging"], default="prod")
    args = ap.parse_args()

    check_env(args.target)
    if not args.skip_db:
        asyncio.run(check_db())

    width = max(len(n) for _, n, _ in results)
    for level, name, detail in results:
        print(f"[{level}] {name.ljust(width)}  {detail}")
    fails = sum(1 for l, _, _ in results if l == "FAIL")
    warns = sum(1 for l, _, _ in results if l == "WARN")
    print(f"\n{fails} FAIL, {warns} WARN, {sum(1 for l, _, _ in results if l == 'PASS')} PASS")
    print("READY TO FLIP THE FLAG" if fails == 0 else "NOT READY: fix the FAIL lines above")
    raise SystemExit(1 if fails else 0)


if __name__ == "__main__":
    main()
