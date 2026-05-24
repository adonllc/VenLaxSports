"""Standardized league pricing — Phase 1.

All Tennis & Pickleball leagues follow the same pricing tiers regardless
of city or duration. Mixed-doubles is priced as doubles.
"""

# Format → entry fee (USD)
ENTRY_FEE_USD: dict[str, float] = {
    "singles": 9.99,
    "doubles": 19.99,
    "mixed": 19.99,
    "mixed_doubles": 19.99,
}

DEFAULT_ENTRY_FEE = 9.99


def fee_for_format(fmt: str) -> float:
    return ENTRY_FEE_USD.get((fmt or "").lower(), DEFAULT_ENTRY_FEE)


# Cadence → display label + month delta for end_date computation
CADENCES: dict[str, dict] = {
    "monthly": {"label": "Monthly", "months": 1, "season_label": "Monthly Open"},
    "quarterly": {"label": "Quarterly", "months": 3, "season_label": "Quarterly Cup"},
    "half_yearly": {"label": "Half-Yearly", "months": 6, "season_label": "Half-Yearly Championship"},
    "yearly": {"label": "Yearly", "months": 12, "season_label": "Annual Championship"},
}

ALL_CITIES_LABEL = "All Cities"
