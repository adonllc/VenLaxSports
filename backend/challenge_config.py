"""Tunable rules for direct player challenges. Every value can be overridden with an environment variable."""
import os


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


from competition import SPORT_RULES

CHALLENGE_SPORTS = tuple(SPORT_RULES)
CHALLENGE_FORMATS = ("singles", "doubles")

EXPIRY_HOURS = _int("CHALLENGE_EXPIRY_HOURS", 72)               # an unanswered invitation lapses after this long
EXPIRING_WARN_HOURS = _int("CHALLENGE_EXPIRING_WARN_HOURS", 24)  # the opponent is nudged this long before it lapses
DAILY_SEND_LIMIT = _int("CHALLENGE_DAILY_LIMIT", 5)              # invitations one player can send per day
CANCEL_CUTOFF_HOURS = _int("CHALLENGE_CANCEL_CUTOFF_HOURS", 24)  # a booked match can be cancelled up to this long before
MAX_SCHEDULE_DAYS_AHEAD = _int("CHALLENGE_MAX_DAYS_AHEAD", 60)   # furthest ahead a time can be proposed
MAX_SETS = _int("CHALLENGE_MAX_SETS", 5)
MAX_GAMES_PER_SET = _int("CHALLENGE_MAX_GAMES_PER_SET", 30)      # pickleball games and tennis tiebreak sets stay below this
SEARCH_LIMIT_MAX = 50
HISTORY_MAX = 100
MATCH_REMINDER_HOURS = _int("CHALLENGE_REMINDER_HOURS", 24)       # both players are reminded this long before a booked match

# ── Community ladders ─────────────────────────────────────────────────────────
LADDER_SPORTS = CHALLENGE_SPORTS
LADDER_FORMATS = CHALLENGE_FORMATS
LADDER_SIZES = (4, 8, 16, 32)
LADDER_DURATIONS = (30, 60, 90)
LADDER_RANKING_METHODS = ("leapfrog", "points", "elo")
LADDER_VISIBILITY = ("public", "private")
LADDER_JOIN_MODES = ("open", "approval")
LADDER_MIN_PARTICIPANTS = 2
LADDER_RECOMMENDED_PARTICIPANTS = 4
LADDER_MAX_OWNED_ACTIVE = _int("LADDER_MAX_OWNED_ACTIVE", 3)              # live ladders one player can run at once
LADDER_CHALLENGE_RANK_RANGE = _int("LADDER_CHALLENGE_RANK_RANGE", 3)      # leapfrog: how far above you you can challenge
LADDER_MAX_OPEN_OUTGOING = _int("LADDER_MAX_OPEN_OUTGOING", 2)            # open challenges one player can have out per ladder
LADDER_REMATCH_COOLDOWN_HOURS = _int("LADDER_REMATCH_COOLDOWN_HOURS", 24)  # the same pair cannot count twice inside this window
LADDER_INVITE_EXPIRY_DAYS = _int("LADDER_INVITE_EXPIRY_DAYS", 14)
LADDER_INACTIVE_DAYS = _int("LADDER_INACTIVE_DAYS", 45)                   # no confirmed match for this long: closed automatically
LADDER_DRAFT_EXPIRY_DAYS = _int("LADDER_DRAFT_EXPIRY_DAYS", 30)
POINTS_WIN = _int("LADDER_POINTS_WIN", 3)
POINTS_LOSS = _int("LADDER_POINTS_LOSS", 1)                                # showing up counts
ELO_START = _int("LADDER_ELO_START", 1000)
ELO_K = _int("LADDER_ELO_K", 32)

# ── Open challenge board ──────────────────────────────────────────────────────
OPEN_WINDOWS = ("morning", "afternoon", "evening", "any")
OPEN_COURTS = ("indoor", "outdoor", "any")
OPEN_VISIBILITY = ("public", "link_only")          # public: on the board and shareable; link_only: reachable by link only
OPEN_MAX_ACTIVE = _int("OPEN_MAX_ACTIVE", 5)        # draft/open/paused posts one player can hold at once
OPEN_MAX_DAYS_AHEAD = _int("OPEN_MAX_DAYS_AHEAD", 60)
OPEN_MAX_LIFE_DAYS = _int("OPEN_MAX_LIFE_DAYS", 14)  # a post lapses after this long, or on its match date, whichever is first
OPEN_LEVEL_SPREAD = 1.0                              # default opponent range is the poster's level plus or minus this
OPEN_LEVEL_MIN, OPEN_LEVEL_MAX = 1.0, 7.0
OPEN_NOTIFY_MAX = _int("OPEN_NOTIFY_MAX", 25)        # nearby players pinged (in-app only) when a post goes live
OPEN_SHARE_DAILY = _int("OPEN_SHARE_DAILY", 10)      # invitation emails one player can send per day
OPEN_SHARE_MAX_PER_CALL = 5

# ── Challenges sent by email to people who may not be registered ──────────────
EMAIL_INVITE_DAILY = _int("EMAIL_INVITE_DAILY", 3)               # invitation emails one player can send per day
EMAIL_INVITE_EXPIRY_DAYS = _int("EMAIL_INVITE_EXPIRY_DAYS", 14)
EMAIL_INVITE_REMIND_DAYS = _int("EMAIL_INVITE_REMIND_DAYS", 7)   # one reminder, this long after sending
EMAIL_INVITE_SAME_ADDRESS_DAYS = _int("EMAIL_INVITE_SAME_ADDRESS_DAYS", 7)  # same sender cannot email one address twice inside this
EMAIL_INVITE_MAX_RESENDS = 1
