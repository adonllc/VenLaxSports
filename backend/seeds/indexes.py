async def create_indexes(db) -> None:
    await db.users.create_index("email", unique=True)
    await db.player_leagues.create_index([("player_id", 1), ("league_id", 1)])
    await db.matches.create_index([("league_id", 1), ("scheduled_date", 1)])
    await db.standings.create_index([("league_id", 1), ("points", -1)])
    await db.payment_transactions.create_index("session_id")
    await db.seasons.create_index([("sport", 1), ("status", 1)])
    # Referral engine expansions
    await db.users.create_index([("city", 1)])
    await db.matches.create_index([("league_id", 1), ("status", 1)])
    await db.rating_history.create_index([("user_id", 1), ("created_at", -1)])
    await db.challenges.create_index([("challenger_id", 1), ("created_at", -1)])
    await db.challenges.create_index([("challenged_id", 1), ("status", 1)])
    await db.promo_codes.create_index("code", unique=True)
    await db.promo_uses.create_index([("code", 1), ("user_id", 1)])
    await db.users.create_index("founding_member")
    await db.auth_codes.create_index("code", unique=True)
    await db.auth_codes.create_index("expires_at", expireAfterSeconds=0)
    await db.oauth_states.create_index("state", unique=True)
    await db.oauth_states.create_index("expires_at", expireAfterSeconds=0)
    # Smart notifications (B2)
    await db.notification_interests.create_index([("city", 1), ("sport", 1)])
    await db.notification_interests.create_index([("email", 1)])
    await db.push_subscriptions.create_index([("user_id", 1)])
    # Doubles invite indexes
    await db.doubles_invites.create_index("token", unique=True)
    await db.doubles_invites.create_index([("expires_at", 1)], expireAfterSeconds=0)
    await db.doubles_invites.create_index("initiator_id")
    await db.doubles_invites.create_index("partner_email")
    await db.doubles_invites.create_index(
        [("initiator_id", 1), ("league_id", 1)],
        unique=True,
        sparse=True,
        name="doubles_invites_active_unique",
    )
    # player_leagues unique guard for concurrent ACCEPT
    await db.player_leagues.create_index(
        [("league_id", 1), ("player_id", 1)],
        unique=True,
        name="player_leagues_unique",
    )
    # Waitlist
    await db.waitlist.create_index("email", unique=True)
    # Challenge Ladder
    await db.ladders.create_index([("city", 1), ("sport", 1), ("division_label", 1), ("format", 1)])
    await db.ladder_challenges.create_index([("ladder_id", 1), ("status", 1)])
    await db.ladder_challenges.create_index([("challenger_id", 1), ("status", 1)])
