"""Create the launch leagues: one per city x sport x format for a season.

DRY RUN by default. Nothing is written unless --execute is passed.

Usage (from backend/, with MONGO_URL / DB_NAME / ADMIN_EMAIL in the environment):
    python -m scripts.create_launch_leagues                 # dry run, lists what would be created
    python -m scripts.create_launch_leagues --execute

Idempotent: a league with the same city, sport, format and season is skipped.
Also makes sure every launch city exists in the cities collection.
Leagues get no description on purpose, so the site shows the auto-generated
"About this league" text built from each league's own fields.
"""
from __future__ import annotations
import argparse
import asyncio
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from pricing_config import fee_for_format

CITIES = [
    ("Atlanta", "GA"),
    ("New York", "NY"),
    ("Los Angeles", "CA"),
    ("Chicago", "IL"),
    ("San Francisco", "CA"),
    ("Houston", "TX"),
    ("Dallas", "TX"),
    ("Charlotte", "NC"),
]
SPORTS = ["tennis", "pickleball"]
FORMATS = ["singles", "doubles"]


async def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--execute", action="store_true")
    ap.add_argument("--season", default="Winter Season 2026")
    ap.add_argument("--season-short", default="Winter 2026", help="used in league names")
    ap.add_argument("--start", default="2026-11-08")
    ap.add_argument("--end", default="2027-01-03", help="8 weeks after the start by default")
    ap.add_argument("--max-players", type=int, default=16)
    args = ap.parse_args()

    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    admin = await db.users.find_one({"email": os.environ.get("ADMIN_EMAIL", "adonllcusa@gmail.com")})
    if not admin:
        raise SystemExit("Admin user not found (check ADMIN_EMAIL)")

    now_iso = datetime.now(timezone.utc).isoformat()
    new_cities, new_leagues, skipped = [], [], 0

    for city, state in CITIES:
        if not await db.cities.find_one({"name": city, "country": "USA"}):
            new_cities.append({"name": city, "country": "USA", "state": state})

        for sport in SPORTS:
            for fmt in FORMATS:
                if await db.leagues.find_one({"city": city, "sport": sport, "format": fmt, "season": args.season}):
                    skipped += 1
                    continue
                new_leagues.append({
                    "name": f"{city} {sport.title()} {fmt.title()} — {args.season_short}",
                    "sport": sport,
                    "country": "USA",
                    "city": city,
                    "format": fmt,
                    "entry_fee": fee_for_format(fmt),
                    "currency": "USD",
                    "max_players": args.max_players,
                    "current_players": 0,
                    "start_date": args.start,
                    "end_date": args.end,
                    "status": "registration",
                    "admin_id": str(admin["_id"]),
                    "season": args.season,
                    "league_type": "flex",
                    "created_at": now_iso,
                })

    print(f"Cities to add: {[c['name'] for c in new_cities] or 'none'}")
    print(f"Leagues to create: {len(new_leagues)} (skipping {skipped} that already exist)")
    for l in new_leagues:
        print(f"  {l['name']:<48} ${l['entry_fee']:.2f}  {l['start_date']} to {l['end_date']}  max {l['max_players']}")

    extra = [c["name"] async for c in db.cities.find({"country": "USA", "name": {"$nin": [c for c, _ in CITIES]}})]
    if extra:
        print(f"NOTE: USA cities in the database that are not launch cities (left untouched): {extra}")

    if not args.execute:
        print("\nDry run only. Re-run with --execute to write.")
        return
    if new_cities:
        await db.cities.insert_many(new_cities)
    if new_leagues:
        await db.leagues.insert_many(new_leagues)
    print(f"\nDone: added {len(new_cities)} cities and {len(new_leagues)} leagues.")


if __name__ == "__main__":
    asyncio.run(main())
