from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, Request
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
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
from routes.league_routes import router as league_router
from routes.match_routes import router as match_router
from routes.payment_routes import router as payment_router
from routes.admin_routes import router as admin_router
from routes.user_routes import router as user_router
from routes.season_routes import router as season_router
from routes.playoffs_routes import router as playoffs_router
from routes.auto_league_routes import router as auto_league_router
from routes.round_robin_routes import router as rr_router
from routes.public_routes import router as public_router
from routes.whatsapp_routes import router as wa_router

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(league_router, prefix="/leagues", tags=["leagues"])
api_router.include_router(match_router, prefix="/matches", tags=["matches"])
api_router.include_router(payment_router, prefix="/payments", tags=["payments"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_router.include_router(user_router, prefix="/users", tags=["users"])
api_router.include_router(season_router, prefix="/seasons", tags=["seasons"])
api_router.include_router(playoffs_router, prefix="/playoffs", tags=["playoffs"])
api_router.include_router(auto_league_router, prefix="/admin/auto", tags=["auto-leagues"])
api_router.include_router(rr_router, prefix="/round-robin", tags=["round-robin"])
api_router.include_router(public_router, prefix="/public", tags=["public"])
api_router.include_router(wa_router, prefix="/webhook/whatsapp", tags=["whatsapp"])


@api_router.get("/")
async def root():
    return {"message": "Multi-Sport League Platform API v1.0"}


@api_router.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@api_router.get("/cities")
async def get_cities(country: str = None):
    from phase_config import ACTIVE_COUNTRY
    # Phase gate — reject cross-phase lookups even when explicit
    if country and country != ACTIVE_COUNTRY:
        return []
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


async def seed_admin_wrapper():
    from seeds.admin import seed_admin as _seed
    await _seed(db)


async def create_indexes_wrapper():
    from seeds.indexes import create_indexes as _idx
    await _idx(db)


async def seed_leagues_wrapper():
    from seeds.leagues import seed_leagues as _seed
    await _seed(db)


async def seed_cities_wrapper():
    from seeds.cities import seed_cities as _seed
    await _seed(db)


async def normalize_pricing_wrapper():
    from seeds.pricing import normalize_pricing as _norm
    await _norm(db)


@app.on_event("startup")
async def startup_event():
    await seed_admin_wrapper()
    await create_indexes_wrapper()
    await seed_leagues_wrapper()
    await seed_cities_wrapper()
    await normalize_pricing_wrapper()
    logger.info("Application startup complete")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
