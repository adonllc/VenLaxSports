"""Indexes for Direct Challenges, Community Ladders and the Open Challenge Board only.

Run against the production database (safe to repeat; every collection here is new, so no unique index can clash):
    python -m seeds.compete_indexes
needs MONGO_URL and DB_NAME in the environment.
"""
import asyncio
import os


async def create_compete_indexes(db) -> None:
    # Direct player challenges + in-app notifications
    await db.direct_challenges.create_index([("side1", 1), ("status", 1)])
    await db.direct_challenges.create_index([("side2", 1), ("status", 1)])
    await db.direct_challenges.create_index([("status", 1), ("expires_at", 1)])
    await db.direct_challenges.create_index([("challenger_id", 1), ("created_at", -1)])
    await db.user_notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.user_notifications.create_index([("user_id", 1), ("read_at", 1)])
    # Open challenge board
    await db.open_challenges.create_index([("status", 1), ("visibility", 1), ("sport", 1), ("city", 1), ("date", 1)])
    await db.open_challenges.create_index([("owner_id", 1), ("status", 1)])
    await db.open_challenges.create_index([("acceptor_id", 1), ("status", 1)])
    await db.open_challenges.create_index([("status", 1), ("expires_at", 1)])
    await db.direct_challenges.create_index("open_id", sparse=True)
    await db.open_challenge_blocks.create_index([("user_id", 1), ("blocked_id", 1)], unique=True)
    await db.open_challenge_blocks.create_index("blocked_id")
    await db.open_challenge_reports.create_index([("post_id", 1), ("reporter_id", 1)], unique=True)
    await db.open_challenge_shares.create_index([("user_id", 1), ("created_at", -1)])
    # Community ladders
    await db.ladders.create_index([("type", 1), ("status", 1), ("visibility", 1)])
    await db.ladders.create_index([("owner_id", 1), ("status", 1)])
    await db.ladders.create_index("invite_token", sparse=True)
    await db.ladder_invites.create_index("token", unique=True)
    await db.ladder_invites.create_index([("ladder_id", 1), ("status", 1)])
    await db.ladder_invites.create_index([("invitee_user_id", 1), ("status", 1)])
    await db.ladder_results.create_index([("ladder_id", 1), ("at", -1)])
    await db.direct_challenges.create_index([("ladder_id", 1), ("status", 1)])


if __name__ == "__main__":
    from motor.motor_asyncio import AsyncIOMotorClient

    async def main():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        await create_compete_indexes(client[os.environ["DB_NAME"]])
        print("compete indexes ready")

    asyncio.run(main())
