"""Seed modules for initial DB setup.

Keep each seed function pure and idempotent so it can be re-run safely.
"""
from seeds.admin import seed_admin
from seeds.cities import seed_cities
from seeds.indexes import create_indexes
from seeds.pricing import normalize_pricing

__all__ = ["seed_admin", "seed_cities", "create_indexes", "normalize_pricing"]
