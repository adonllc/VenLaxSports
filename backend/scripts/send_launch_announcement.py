"""Send the one-time launch announcement to the waitlist.

DRY RUN by default: lists who would be emailed and sends nothing.

Usage (from backend/, with MONGO_URL / DB_NAME / SMTP_* in the environment):
    python -m scripts.send_launch_announcement                      # dry run
    python -m scripts.send_launch_announcement --test you@example.com   # one sample email, nothing recorded
    python -m scripts.send_launch_announcement --send                # real send, once per person
"""
from __future__ import annotations
import argparse
import asyncio
import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

import email_service
import launch_announcement as la


async def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--send", action="store_true", help="really send to the waitlist")
    ap.add_argument("--test", metavar="EMAIL", help="send one sample to this address only")
    args = ap.parse_args()

    if args.test:
        ok = await email_service.send_launch_announcement(args.test, "", la.unsub_url("000000000000000000000000"))
        print("test sent" if ok else "test FAILED")
        return

    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ.get("DB_NAME", "venlaxsports")]
    r = await la.build_recipients(db)
    print(f"Would email {len(r['send'])} | already registered {r['skipped_registered']} | "
          f"unsubscribed {r['skipped_unsubscribed']} | already sent {r['skipped_already_sent']}")
    for rec in r["send"]:
        print("  ", rec["email"])
    if not args.send:
        print("Dry run. Nothing sent. Re-run with --send to send.")
        return

    sent = failed = 0
    for rec in r["send"]:
        if await la.send_one(db, rec):
            sent += 1
        else:
            failed += 1
            print("FAILED", rec["email"])
        await asyncio.sleep(1)
    print(f"Done. sent={sent} failed={failed}")


if __name__ == "__main__":
    asyncio.run(main())
