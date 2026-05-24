from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


LEAGUES = [
    {"name": "NYC Tennis Open - Season 1", "sport": "tennis", "country": "USA", "city": "New York",
     "format": "singles", "entry_fee": 29.99, "currency": "USD", "max_players": 16, "current_players": 0,
     "start_date": "2025-03-01", "end_date": "2025-05-31", "status": "registration",
     "description": "Competitive singles tennis league for players rated 3.0-4.5. Weekly matches at Central Park courts.",
     "venue": "Central Park Tennis Center", "season": "Spring 2025",
     "division_label": "Competitive", "division_ntrp_min": 4.5, "division_ntrp_max": None},
    {"name": "Mumbai Premier Cricket League", "sport": "cricket", "country": "India", "city": "Mumbai",
     "format": "T20", "entry_fee": 1500.0, "currency": "INR", "max_players": 11, "current_players": 0,
     "start_date": "2025-02-15", "end_date": "2025-04-30", "status": "registration",
     "description": "T20 cricket league for corporate teams. Professional grounds with umpires.",
     "venue": "Wankhede Stadium Practice Grounds", "season": "Season 2025"},
    {"name": "LA Pickleball Championship", "sport": "pickleball", "country": "USA", "city": "Los Angeles",
     "format": "doubles", "entry_fee": 39.99, "currency": "USD", "max_players": 16, "current_players": 0,
     "start_date": "2025-03-15", "end_date": "2025-06-15", "status": "registration",
     "description": "Doubles pickleball league for intermediate to advanced players. Indoor courts.",
     "venue": "LA Sports Complex", "season": "Spring 2025",
     "division_label": "Intermediate", "division_ntrp_min": 3.0, "division_ntrp_max": 3.5},
    {"name": "SF Bay Area Doubles Tennis", "sport": "tennis", "country": "USA", "city": "San Francisco",
     "format": "doubles", "entry_fee": 0.0, "currency": "USD", "max_players": 8, "current_players": 0,
     "start_date": "2025-02-20", "end_date": "2025-04-20", "status": "registration",
     "description": "FREE doubles tennis for beginners and intermediate players. All welcome!",
     "venue": "Golden Gate Park Courts", "season": "Winter 2025",
     "division_label": "Beginner", "division_ntrp_min": 2.5, "division_ntrp_max": 3.0},
    {"name": "Delhi Corporate Cricket T10", "sport": "cricket", "country": "India", "city": "Delhi",
     "format": "T10", "entry_fee": 2000.0, "currency": "INR", "max_players": 8, "current_players": 0,
     "start_date": "2025-03-01", "end_date": "2025-04-15", "status": "registration",
     "description": "Corporate T10 cricket league with professional facilities and live scoring.",
     "venue": "Feroz Shah Kotla Ground", "season": "Season 2025"},
    {"name": "Atlanta Pickleball Mixed Doubles", "sport": "pickleball", "country": "USA", "city": "Atlanta",
     "format": "mixed", "entry_fee": 25.00, "currency": "USD", "max_players": 16, "current_players": 0,
     "start_date": "2025-03-10", "end_date": "2025-05-10", "status": "registration",
     "description": "Mixed doubles pickleball for all skill levels. Fun and competitive!",
     "venue": "Atlanta Community Sports Center", "season": "Spring 2025"},
    {"name": "Bangalore Cricket T20 Open", "sport": "cricket", "country": "India", "city": "Bangalore",
     "format": "T20", "entry_fee": 1200.0, "currency": "INR", "max_players": 12, "current_players": 0,
     "start_date": "2025-04-01", "end_date": "2025-06-30", "status": "registration",
     "description": "Open T20 cricket for amateur teams across Bangalore. Night games available.",
     "venue": "Chinnaswamy Stadium Practice Area", "season": "Season 2025"},
    {"name": "Chicago Tennis Singles Open", "sport": "tennis", "country": "USA", "city": "Chicago",
     "format": "singles", "entry_fee": 35.00, "currency": "USD", "max_players": 16, "current_players": 0,
     "start_date": "2025-04-15", "end_date": "2025-07-15", "status": "registration",
     "description": "Competitive singles tennis for rated players 3.5 to 5.0.",
     "venue": "Grant Park Tennis Courts", "season": "Summer 2025",
     "division_label": "Competitive", "division_ntrp_min": 4.5, "division_ntrp_max": None},
]


async def seed_leagues(db) -> None:
    count = await db.leagues.count_documents({})
    if count > 0:
        return
    admin = await db.users.find_one({"role": "admin"})
    if not admin:
        return
    admin_id = str(admin["_id"])
    now = datetime.now(timezone.utc).isoformat()

    for league in LEAGUES:
        await db.leagues.insert_one({**league, "admin_id": admin_id, "created_at": now})
    logger.info(f"Seeded {len(LEAGUES)} sample leagues")
