"""Seed modules for initial DB setup.

Keep each seed function pure and idempotent so it can be re-run safely.
"""
from seeds.admin import seed_admin
from seeds.cities import seed_cities
from seeds.leagues import seed_leagues
from seeds.indexes import create_indexes

__all__ = ["seed_admin", "seed_cities", "seed_leagues", "create_indexes"]
