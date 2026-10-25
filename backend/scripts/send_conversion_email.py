"""Send a sign-up email (step 1, 2 or 3) to people on the old early list.

DRY RUN by default: lists who would be emailed and sends nothing.

Usage (from backend/, with MONGO_URL / DB_NAME / SMTP_* in the environment):
    python -m scripts.send_conversion_email --step 1                      # dry run
    python -m scripts.send_conversion_email --step 1 --test you@example.com   # one sample, nothing recorded
    python -m scripts.send_conversion_email --step 1 --send               # real send, once per person per step
"""
from __future__ import annotations
import argparse
import asyncio
import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

import conversion_campaign as cc
import email_service


async def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--step", type=int, required=True, choices=sorted(cc.STEPS))
    ap.add_argument("--send", action="store_true", help="really send to the early list")
    ap.add_argument("--test", metavar="EMAIL", help="send one sample to this address only")
    args = ap.parse_args()

    if args.test:
        r = cc.render(args.step, "000000000000000000000000")
        ok = await email_service.send_campaign_email(
            args.test, r["subject"], r["title"], r["body"], r["cta_label"], r["cta_url"], r["unsubscribe_url"])
        print("test sent" if ok else "test FAILED")
        return

    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ.get("DB_NAME", "venlaxsports")]
    r = await cc.build_recipients(db, args.step)
    print(f"Step {args.step}: would email {len(r['send'])} | already registered {r['skipped_registered']} | "
          f"unsubscribed {r['skipped_unsubscribed']} | already sent {r['skipped_already_sent']}")
    for rec in r["send"]:
        print("  ", rec["email"])
    if not args.send:
        print("Dry run. Nothing sent. Re-run with --send to send.")
        return

    sent = failed = 0
    for rec in r["send"]:
        if await cc.send_one(db, args.step, rec):
            sent += 1
        else:
            failed += 1
            print("FAILED", rec["email"])
        await asyncio.sleep(1)
    print(f"Done. sent={sent} failed={failed}")


if __name__ == "__main__":
    asyncio.run(main())
