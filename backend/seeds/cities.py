CITIES = [
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


async def seed_cities(db) -> None:
    count = await db.cities.count_documents({})
    if count > 0:
        return
    await db.cities.insert_many(CITIES)
