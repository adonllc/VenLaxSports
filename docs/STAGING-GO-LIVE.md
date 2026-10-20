# Staging go-live runbook

Makes staging look exactly like production will on launch day: clean data, no demo accounts, no stale leagues.
Run these in the **Coolify terminal of `venlaxsports-api-staging`** (it already has `MONGO_URL` and `DB_NAME` for the staging database). Nothing here touches prod.

State checked 2026-10-20 through the public staging API: 0 leagues, 0 cities, 0 founding members, 0 waitlist entries. Users, payments and other collections could not be inspected without admin or DB access, so step 1 is a dry run.

## 0. Open the terminal
Coolify, then the staging API app, then Terminal. Go to the folder that contains `server.py` (usually `/app` or `/app/backend`):

```bash
cd /app 2>/dev/null; [ -f server.py ] || cd /app/backend; pwd; ls server.py
```

## 1. Dry run (changes nothing)
```bash
python -m scripts.prelaunch_cleanup
```
Read the output. It lists:
- demo users it would delete (`*.demo@venlaxsports.com`)
- users it will keep (`adonllcusa@gmail.com` and every `role=admin`)
- **other users** it will only report, never delete
- the collections it would wipe (leagues, matches, standings, payments, ratings, etc.)

If other test accounts appear, note their emails.

## 2. Execute
```bash
python -m scripts.prelaunch_cleanup --execute --backup-dir ./cleanup_backup \
  --extra-delete-emails test1@example.com test2@example.com
```
Drop the `--extra-delete-emails` line if there are none. It asks you to type the database name before it deletes anything, and writes a JSON backup first.

## 3. Create indexes (the app does not do this at startup)
```bash
python - <<'PY'
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient
from seeds.indexes import create_indexes
db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
asyncio.run(create_indexes(db))
print("indexes created on", os.environ["DB_NAME"])
PY
```

## 4. Seed cities (safe to re-run)
```bash
python - <<'PY'
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient
from seeds.cities import seed_cities
db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
asyncio.run(seed_cities(db))
print("cities seeded")
PY
```

## 5. Verify from your laptop
```bash
curl -s https://api-staging.venlaxsports.com/api/health
curl -s https://api-staging.venlaxsports.com/api/leagues          # []
curl -s https://api-staging.venlaxsports.com/api/founding-members # count 0
```
Then log in as `adonllcusa@gmail.com` and check the admin Users tab: only you and admins remain.

## Not done here (leagues)
Staging is left with 0 leagues on purpose. Create real ones later with `POST /api/admin/auto/leagues` from the admin dashboard once launch cities and dates are chosen.

## Environment parity checklist (Coolify, staging apps)
- Backend: `PHASE=1`, `ENV=production`, CORS limited to the staging domain, Stripe **test** key, SMTP set.
- Frontend: `VITE_PHASE=1`, `VITE_PRELAUNCH=false` (already, since staging shows the full site).
- `seeds/` are not run at startup (all commented out in `server.py`). `seeds/leagues.py` and `seeds/demo.py` were deleted.
