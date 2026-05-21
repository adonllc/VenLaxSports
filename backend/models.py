from typing import Optional, List, Dict, Any, Annotated
from pydantic import BaseModel, Field, BeforeValidator
from bson import ObjectId
from datetime import datetime, timezone


def coerce_object_id(v: Any) -> Optional[str]:
    if isinstance(v, ObjectId):
        return str(v)
    if v is None:
        return None
    return str(v)


PyObjectId = Annotated[str, BeforeValidator(coerce_object_id)]


class BaseDocument(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}

    def to_mongo(self) -> dict:
        d = self.model_dump(by_alias=True, exclude_none=True)
        if "_id" in d and d["_id"] is None:
            del d["_id"]
        return d

    @classmethod
    def from_mongo(cls, data: dict):
        if data is None:
            return None
        if "_id" in data:
            data["_id"] = str(data["_id"])
        return cls(**data)


# ─── User ───────────────────────────────────────────
class User(BaseDocument):
    email: str
    name: str
    password_hash: Optional[str] = None
    role: str = "player"  # player, admin, city_admin
    country: str = "USA"
    city: Optional[str] = None
    sport_preferences: List[str] = []
    phone: Optional[str] = None
    avatar: Optional[str] = None
    is_active: bool = True
    tennis_rating: float = 3.0
    cricket_rating: float = 50.0
    pickleball_rating: float = 3.0
    email_notifications: bool = True
    profile_public: bool = True
    skill_level: Optional[str] = None  # USTA/USAPA level: "2.0", "2.5", ..., "5.5", "6.0+"
    email_verified: bool = False
    otp_code: Optional[str] = None      # bcrypt-hashed 6-digit OTP
    otp_expires_at: Optional[str] = None
    home_court: Optional[str] = None
    profile_complete: bool = False
    founding_member: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    country: str = "USA"
    city: Optional[str] = None
    phone: Optional[str] = None
    skill_level: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


# ─── League ─────────────────────────────────────────
class League(BaseDocument):
    name: str
    sport: str  # tennis, cricket, pickleball
    country: str = "USA"
    city: str
    format: str  # singles, doubles, mixed, T20, T10
    entry_fee: float = 0.0
    currency: str = "USD"
    max_players: int = 16
    current_players: int = 0
    start_date: str
    end_date: str
    status: str = "registration"  # registration, active, completed, cancelled
    admin_id: str
    description: Optional[str] = None
    venue: Optional[str] = None
    season: str = "Season 1"
    season_id: Optional[str] = None
    rules: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    league_type: str = "flex"               # "flex" | "round_robin"
    rr_config: Optional[Dict] = None
    is_public: bool = True


class LeagueCreate(BaseModel):
    name: str
    sport: str
    country: str = "USA"
    city: str
    format: str
    entry_fee: float = 0.0
    currency: str = "USD"
    max_players: int = 16
    start_date: str
    end_date: str
    description: Optional[str] = None
    venue: Optional[str] = None
    season: str = "Season 1"
    season_id: Optional[str] = None
    rules: Optional[str] = None
    league_type: str = "flex"
    rr_config: Optional[Dict] = None


class LeagueUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    venue: Optional[str] = None
    max_players: Optional[int] = None
    entry_fee: Optional[float] = None
    season_id: Optional[str] = None
    rules: Optional[str] = None


# ─── Round Robin Config ───────────────────────────────
class RRConfig(BaseModel):
    min_players: int = 6
    max_players: int = 12
    division_type: str = "singles"          # "singles" | "doubles"
    scoring_format: Optional[str] = None    # auto-set on schedule generation
    playoff_threshold: int = 4
    schedule_generated: bool = False
    playoff_generated: bool = False
    auto_started_at: Optional[str] = None


# ─── Doubles Invite ──────────────────────────────────
class DoublesInvite(BaseDocument):
    league_id: str
    inviter_id: str
    inviter_name: str
    partner_email: str
    token: str
    status: str = "pending"                 # "pending" | "accepted" | "expired"
    expires_at: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ─── Team (Cricket) ──────────────────────────────────
class Team(BaseDocument):
    name: str
    captain_id: str
    captain_name: str
    league_id: str
    country: str = "India"
    players: List[Dict] = []
    max_players: int = 11
    wins: int = 0
    losses: int = 0
    draws: int = 0
    points: int = 0
    nrr: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TeamCreate(BaseModel):
    name: str
    league_id: str
    max_players: int = 11


# ─── Match ───────────────────────────────────────────
class Match(BaseDocument):
    league_id: str
    sport: str
    player1_id: str
    player2_id: str
    player1_name: str
    player2_name: str
    scheduled_date: str
    venue: Optional[str] = None
    status: str = "scheduled"  # scheduled, in_progress, completed, cancelled
    winner_id: Optional[str] = None
    winner_name: Optional[str] = None
    score_data: Optional[Dict] = None
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Optional[str] = None
    round: Optional[int] = None             # week number in RR; None for flex
    is_rr: bool = False
    team1_partner_id: Optional[str] = None
    team1_partner_name: Optional[str] = None
    team2_partner_id: Optional[str] = None
    team2_partner_name: Optional[str] = None


class MatchCreate(BaseModel):
    league_id: str
    player2_id: str
    scheduled_date: str
    venue: Optional[str] = None
    notes: Optional[str] = None


class MatchScore(BaseModel):
    winner_id: str
    score_data: Dict


# ─── Standing ────────────────────────────────────────
class Standing(BaseDocument):
    league_id: str
    player_id: str
    player_name: str
    sport: str
    wins: int = 0
    losses: int = 0
    draws: int = 0
    points: float = 0.0          # float — formula: 3W+1L+0.5(SW-SL)+0.1(GW-GL)+BP
    matches_played: int = 0
    sets_won: int = 0
    sets_lost: int = 0
    games_won: int = 0
    games_lost: int = 0
    bonus_points: float = 0.0
    nrr: float = 0.0
    country: str = "USA"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Optional[str] = None


# ─── Player-League Registration ───────────────────────
class PlayerLeague(BaseDocument):
    player_id: str
    player_name: str
    league_id: str
    sport: str
    payment_status: str = "pending"  # pending, paid, free
    session_id: Optional[str] = None
    joined_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    waiver_accepted_at: Optional[str] = None  # ISO timestamp of explicit waiver consent


# ─── Payment Transaction ──────────────────────────────
class PaymentTransaction(BaseDocument):
    user_id: str
    user_email: str
    league_id: Optional[str] = None
    league_name: Optional[str] = None
    session_id: str
    payment_id: Optional[str] = None
    amount: float
    currency: str = "USD"
    status: str = "initiated"  # initiated, pending, paid, failed, expired
    payment_status: str = "unpaid"
    metadata: Optional[Dict] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Optional[str] = None


# ─── Challenge ───────────────────────────────────────
class Challenge(BaseDocument):
    challenger_id: str
    challenger_name: str
    challenged_id: str
    league_id: Optional[str] = None
    status: str = "pending"          # pending, accepted, expired
    delivery_method: str = "email"   # email | whatsapp
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
