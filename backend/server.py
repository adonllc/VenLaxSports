from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, Request
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import bcrypt
from pathlib import Path
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Multi-Sport League Platform", version="1.0.0")
app.state.db = db

api_router = APIRouter(prefix="/api", redirect_slashes=False)

# Import routers
from routes.auth_routes import router as auth_router
from routes.google_auth_routes import router as google_auth_router
from routes.league_routes import router as league_router
from routes.match_routes import router as match_router
from routes.payment_routes import router as payment_router
from routes.admin_routes import router as admin_router

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(google_auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(league_router, prefix="/leagues", tags=["leagues"])
api_router.include_router(match_router, prefix="/matches", tags=["matches"])
api_router.include_router(payment_router, prefix="/payments", tags=["payments"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])


@api_router.get("/")
async def root():
    return {"message": "Multi-Sport League Platform API v1.0"}


@api_router.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@api_router.get("/cities")
async def get_cities(country: str = None):
    from phase_config import ACTIVE_COUNTRY
    query = {"country": country if country else ACTIVE_COUNTRY}
    cities = await db.cities.find(query, {"_id": 0}).sort("name", 1).to_list(50)
    return cities


@api_router.get("/phase")
async def get_phase():
    """Expose active phase info so frontend can confirm backend phase."""
    from phase_config import PHASE, ACTIVE_SPORTS, ACTIVE_COUNTRY, CURRENCY, PAYMENT_PROVIDER
    return {
        "phase": PHASE,
        "active_sports": ACTIVE_SPORTS,
        "active_country": ACTIVE_COUNTRY,
        "currency": CURRENCY,
        "payment_provider": PAYMENT_PROVIDER,
    }


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    api_key = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"

    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        stripe = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
        event = await stripe.handle_webhook(body, signature)
        if event.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": event.session_id},
                {"$set": {
                    "payment_status": "paid",
                    "status": "complete",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
    except Exception as e:
        logging.getLogger(__name__).warning(f"Webhook error: {e}")

    return {"received": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@leaguepro.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt()).decode()
        await db.users.insert_one({
            "email": admin_email,
            "name": "Admin",
            "password_hash": hashed,
            "role": "admin",
            "country": "USA",
            "city": "New York",
            "sport_preferences": ["tennis", "cricket", "pickleball"],
            "tennis_rating": 5.0,
            "cricket_rating": 100.0,
            "pickleball_rating": 5.0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin seeded: {admin_email}")
    elif not bcrypt.checkpw(admin_password.encode(), existing["password_hash"].encode()):
        hashed = bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt()).decode()
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hashed}})


async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.player_leagues.create_index([("player_id", 1), ("league_id", 1)])
    await db.matches.create_index([("league_id", 1), ("scheduled_date", 1)])
    await db.standings.create_index([("league_id", 1), ("points", -1)])
    await db.payment_transactions.create_index("session_id")


async def seed_leagues():
    count = await db.leagues.count_documents({})
    if count > 0:
        return
    admin = await db.users.find_one({"role": "admin"})
    if not admin:
        return
    admin_id = str(admin["_id"])
    now = datetime.now(timezone.utc).isoformat()

    leagues = [
        {"name": "NYC Tennis Open - Season 1", "sport": "tennis", "country": "USA", "city": "New York",
         "format": "singles", "entry_fee": 29.99, "currency": "USD", "max_players": 16, "current_players": 0,
         "start_date": "2025-03-01", "end_date": "2025-05-31", "status": "registration", "admin_id": admin_id,
         "description": "Competitive singles tennis league for players rated 3.0-4.5. Weekly matches at Central Park courts.",
         "venue": "Central Park Tennis Center", "season": "Spring 2025", "created_at": now},
        {"name": "Mumbai Premier Cricket League", "sport": "cricket", "country": "India", "city": "Mumbai",
         "format": "T20", "entry_fee": 1500.0, "currency": "INR", "max_players": 11, "current_players": 0,
         "start_date": "2025-02-15", "end_date": "2025-04-30", "status": "registration", "admin_id": admin_id,
         "description": "T20 cricket league for corporate teams. Professional grounds with umpires.",
         "venue": "Wankhede Stadium Practice Grounds", "season": "Season 2025", "created_at": now},
        {"name": "LA Pickleball Championship", "sport": "pickleball", "country": "USA", "city": "Los Angeles",
         "format": "doubles", "entry_fee": 39.99, "currency": "USD", "max_players": 16, "current_players": 0,
         "start_date": "2025-03-15", "end_date": "2025-06-15", "status": "registration", "admin_id": admin_id,
         "description": "Doubles pickleball league for intermediate to advanced players. Indoor courts.",
         "venue": "LA Sports Complex", "season": "Spring 2025", "created_at": now},
        {"name": "SF Bay Area Doubles Tennis", "sport": "tennis", "country": "USA", "city": "San Francisco",
         "format": "doubles", "entry_fee": 0.0, "currency": "USD", "max_players": 8, "current_players": 0,
         "start_date": "2025-02-20", "end_date": "2025-04-20", "status": "registration", "admin_id": admin_id,
         "description": "FREE doubles tennis for beginners and intermediate players. All welcome!",
         "venue": "Golden Gate Park Courts", "season": "Winter 2025", "created_at": now},
        {"name": "Delhi Corporate Cricket T10", "sport": "cricket", "country": "India", "city": "Delhi",
         "format": "T10", "entry_fee": 2000.0, "currency": "INR", "max_players": 8, "current_players": 0,
         "start_date": "2025-03-01", "end_date": "2025-04-15", "status": "registration", "admin_id": admin_id,
         "description": "Corporate T10 cricket league with professional facilities and live scoring.",
         "venue": "Feroz Shah Kotla Ground", "season": "Season 2025", "created_at": now},
        {"name": "Atlanta Pickleball Mixed Doubles", "sport": "pickleball", "country": "USA", "city": "Atlanta",
         "format": "mixed", "entry_fee": 25.00, "currency": "USD", "max_players": 16, "current_players": 0,
         "start_date": "2025-03-10", "end_date": "2025-05-10", "status": "registration", "admin_id": admin_id,
         "description": "Mixed doubles pickleball for all skill levels. Fun and competitive!",
         "venue": "Atlanta Community Sports Center", "season": "Spring 2025", "created_at": now},
        {"name": "Bangalore Cricket T20 Open", "sport": "cricket", "country": "India", "city": "Bangalore",
         "format": "T20", "entry_fee": 1200.0, "currency": "INR", "max_players": 12, "current_players": 0,
         "start_date": "2025-04-01", "end_date": "2025-06-30", "status": "registration", "admin_id": admin_id,
         "description": "Open T20 cricket for amateur teams across Bangalore. Night games available.",
         "venue": "Chinnaswamy Stadium Practice Area", "season": "Season 2025", "created_at": now},
        {"name": "Chicago Tennis Singles Open", "sport": "tennis", "country": "USA", "city": "Chicago",
         "format": "singles", "entry_fee": 35.00, "currency": "USD", "max_players": 16, "current_players": 0,
         "start_date": "2025-04-15", "end_date": "2025-07-15", "status": "registration", "admin_id": admin_id,
         "description": "Competitive singles tennis for rated players 3.5 to 5.0.",
         "venue": "Grant Park Tennis Courts", "season": "Summer 2025", "created_at": now},
    ]
    for league in leagues:
        await db.leagues.insert_one(league)
    logger.info(f"Seeded {len(leagues)} sample leagues")


async def seed_cities():
    count = await db.cities.count_documents({})
    if count > 0:
        return
    cities = [
        {"name": "New York", "country": "USA", "state": "NY"},
        {"name": "Los Angeles", "country": "USA", "state": "CA"},
        {"name": "Chicago", "country": "USA", "state": "IL"},
        {"name": "San Francisco", "country": "USA", "state": "CA"},
        {"name": "Atlanta", "country": "USA", "state": "GA"},
        {"name": "Houston", "country": "USA", "state": "TX"},
        {"name": "Phoenix", "country": "USA", "state": "AZ"},
        {"name": "Seattle", "country": "USA", "state": "WA"},
        {"name": "Mumbai", "country": "India", "state": "Maharashtra"},
        {"name": "Delhi", "country": "India", "state": "Delhi"},
        {"name": "Bangalore", "country": "India", "state": "Karnataka"},
        {"name": "Chennai", "country": "India", "state": "Tamil Nadu"},
        {"name": "Hyderabad", "country": "India", "state": "Telangana"},
        {"name": "Pune", "country": "India", "state": "Maharashtra"},
        {"name": "Kolkata", "country": "India", "state": "West Bengal"},
    ]
    await db.cities.insert_many(cities)


@app.on_event("startup")
async def startup_event():
    await seed_admin()
    await create_indexes()
    await seed_leagues()
    await seed_cities()
    logger.info("Application startup complete")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
