async def create_indexes(db) -> None:
    await db.funnel_events.create_index([("event", 1), ("at", -1)])
    await db.funnel_events.create_index("at", expireAfterSeconds=60 * 60 * 24 * 730)   # keep two years
    await db.email_events.create_index([("campaign", 1), ("type", 1)])
    await db.email_events.create_index("at", expireAfterSeconds=60 * 60 * 24 * 730)
    await db.scheduled_emails.create_index([("status", 1), ("run_at", 1)])
    await db.workflow_runs.create_index([("workflow_id", 1), ("user_id", 1)], unique=True)
    await db.workflow_runs.create_index([("status", 1), ("at", -1)])
    await db.audit_log.create_index([("at", -1)])
    await db.audit_log.create_index([("action", 1), ("at", -1)])
    await db.audit_log.create_index([("admin_id", 1), ("at", -1)])
    await db.audit_log.create_index([("target_type", 1), ("target_id", 1)])
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
    await db.push_subscriptions.create_index("endpoint")
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
    # Legal Compliance — Dispute Escalation
    await db.disputes.create_index([("league_id", 1), ("status", 1)])
    await db.disputes.create_index([("reported_by_id", 1), ("created_at", -1)])
    await db.disputes.create_index([("reported_against_id", 1)])
    await db.disputes.create_index([("dispute_type", 1), ("status", 1)])
    await db.disputes.create_index("match_id")
    # Organizer Decisions
    await db.decisions.create_index([("dispute_id", 1)])
    await db.decisions.create_index([("organizer_id", 1), ("created_at", -1)])
    await db.decisions.create_index([("appeal_eligible", 1), ("appeal_deadline", 1)])
    # Player Appeals
    await db.appeals.create_index([("decision_id", 1)])
    await db.appeals.create_index([("player_id", 1), ("status", 1)])
    await db.appeals.create_index([("status", 1), ("created_at", -1)])
    # Token Blacklist — auto-cleanup expired tokens
    await db.token_blacklist.create_index("expires_at", expireAfterSeconds=0)
    # Login/auth rate limiting — auto-cleanup expired attempt windows
    await db.login_attempts.create_index("expires_at", expireAfterSeconds=0)
    # Player follow graph
    await db.user_follows.create_index([("follower_id", 1), ("followee_id", 1)], unique=True)
    await db.user_follows.create_index([("followee_id", 1)])
    # Weekly referral campaign idempotency lookups
    await db.email_campaigns.create_index([("user_id", 1), ("campaign", 1), ("sent_at", 1)])
    await db.referral_credits.create_index([("referrer_id", 1), ("status", 1)])
    await db.referral_credits.create_index([("referee_id", 1), ("status", 1)])  # release after a first match
    await db.users.create_index([("credits_balance", 1), ("credits_expiry", 1)])
