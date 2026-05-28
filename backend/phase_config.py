"""
═══════════════════════════════════════════════════════════════════
 PHASE-DRIVEN BACKEND CONFIGURATION
═══════════════════════════════════════════════════════════════════

Mirror of frontend/src/config/platformConfig.js on the server side.

Set PHASE in backend/.env to control which sports/country are exposed
via the public API:

  PHASE=1  → USA: Tennis + Pickleball (ACTIVE)
  PHASE=2  → USA: Tennis + Pickleball + Cricket
  PHASE=3  → India: Cricket + Tennis + Pickleball (Razorpay / INR)

Data for all phases lives in MongoDB — this layer only filters what
is RETURNED from public endpoints. Admin endpoints see everything.
═══════════════════════════════════════════════════════════════════
"""
import os

# ─────────────────────────────────────────────────────────────────
# PHASE 1 — USA: Tennis + Pickleball (ACTIVE)
# ─────────────────────────────────────────────────────────────────
PHASE_1 = {
    "phase": 1,
    "country": "USA",
    # PHASE 2: append "cricket" to unlock cricket leagues in USA
    "active_sports": ["tennis", "pickleball"],
    "currency": "USD",
    "payment_provider": "stripe",
}

# ─────────────────────────────────────────────────────────────────
# PHASE 2 — USA: Add Cricket
# ─────────────────────────────────────────────────────────────────
PHASE_2 = {
    **PHASE_1,
    "phase": 2,
    "active_sports": ["tennis", "pickleball", "cricket"],
}

# ─────────────────────────────────────────────────────────────────
# PHASE 3 — India: Cricket focus, Razorpay + INR
# ─────────────────────────────────────────────────────────────────
PHASE_3 = {
    "phase": 3,
    "country": "India",
    "active_sports": ["cricket", "tennis", "pickleball"],
    "currency": "INR",
    "payment_provider": "razorpay",
}

PHASE_CONFIGS = {1: PHASE_1, 2: PHASE_2, 3: PHASE_3}

PHASE = int(os.environ.get("PHASE", "1"))
CONFIG = PHASE_CONFIGS.get(PHASE, PHASE_1)

# Independent cricket toggle — set CRICKET_ENABLED=true in env to add
# cricket to any phase without bumping the phase number.
_CRICKET_ENABLED = os.environ.get("CRICKET_ENABLED", "false").lower() == "true"
_base_sports = CONFIG["active_sports"]
ACTIVE_SPORTS = (
    _base_sports + ["cricket"]
    if _CRICKET_ENABLED and "cricket" not in _base_sports
    else _base_sports
)
ACTIVE_COUNTRY = CONFIG["country"]
CURRENCY = CONFIG["currency"]
PAYMENT_PROVIDER = CONFIG["payment_provider"]


def is_sport_active(sport: str) -> bool:
    return sport in ACTIVE_SPORTS


def is_country_active(country: str) -> bool:
    return country == ACTIVE_COUNTRY
