# Production go-live runbook

Goal: do everything ahead of time, so launch day is **one step: flip the flag**.
Run the database steps in the **Coolify terminal of `venlaxsports-api`** (it already has the prod `MONGO_URL` and `DB_NAME`).

Prod API lives at `https://api.venlaxsports.com` (not on `venlaxsports.com/api`, which returns the web app's HTML for any path).

State checked 2026-10-20 through the public API:
- waitlist: **18 real sign-ups** (kept, the cleanup script never touches them)
- founding members: 4 of 200
- leagues: includes test data (`hkp test round robin`) that must go
- cities: 8 seeded (Atlanta, Chicago, Houston, Los Angeles, New York, Phoenix, San Francisco, Seattle)

## A. You do (third-party and secrets, I cannot do these)
| # | Task | Where |
|---|------|-------|
| 1 | Stripe live account verified, **live secret key** and **webhook signing secret** | Stripe dashboard, then Coolify env `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` on `venlaxsports-api` |
| 2 | Transactional email provider (Resend / SES / Postmark), SPF, DKIM, DMARC DNS | Provider, Hostinger DNS, then Coolify `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| 3 | Google OAuth consent screen published (out of Testing), prod redirect URIs added | Google Cloud Console |
| 4 | Atlas: backups on, IP allowlist limited to the VPS, **take a snapshot** before step B2 | MongoDB Atlas |
| 5 | Rotate admin password and `JWT_SECRET` | Coolify env |
| 6 | Error tracking and an uptime monitor on `https://api.venlaxsports.com/api/health` | Sentry / uptime service |

## B. Database cleanup (Coolify terminal, `venlaxsports-api`)
Go to the folder that contains `server.py`:
```bash
cd /app 2>/dev/null; [ -f server.py ] || cd /app/backend; pwd
```
1. Dry run, changes nothing, lists what would go:
   ```bash
   python -m scripts.prelaunch_cleanup
   ```
2. Execute (take the Atlas snapshot first). It makes you type the DB name and saves a JSON backup:
   ```bash
   python -m scripts.prelaunch_cleanup --execute --backup-dir ./cleanup_backup \
     --extra-delete-emails <any test emails the dry run listed>
   ```
   Keeps `adonllcusa@gmail.com`, every admin, the waitlist, cities, promo codes and feature flags. Wipes leagues, matches, standings, ratings, payments, credits and the other test data.
3. Create indexes (the app does not do this at startup):
   ```bash
   python - <<'PY'
   import asyncio, os
   from motor.motor_asyncio import AsyncIOMotorClient
   from seeds.indexes import create_indexes
   db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
   asyncio.run(create_indexes(db))
   print("indexes created")
   PY
   ```

## C. Real leagues
Log in as admin, then use the admin dashboard league generator (`POST /api/admin/auto/leagues`) for the launch cities, formats and season dates. Do not use the old seed files (deleted).

## D. Preflight (read-only, tells you if you are ready)
```bash
python -m scripts.launch_preflight
```
It checks: `ENV=production`, `PHASE=1`, Cricket off, strong `JWT_SECRET`, **live** Stripe key and webhook secret, SMTP configured (and not Gmail), https `FRONTEND_URL`, CORS locked down, Google credentials, an admin exists, no demo accounts, no test-named leagues, no leftover test payments or matches, indexes present, cities seeded, waitlist intact, and that real leagues exist.

It prints `READY TO FLIP THE FLAG` only when there are no FAIL lines. WARN lines are judgement calls (for example Gmail SMTP, or other non-admin accounts to review).

## E. Smoke test before the flip (admin, real card, then refund)
Register, log in, join a league with a $9.99 payment, refund it in Stripe, receive the emails. Then delete the test account (add it to `--extra-delete-emails` and re-run step B2, or delete it in the admin Users tab).

## F. Launch: the one step
Runtime switch, no rebuild (needs the web and API builds that include `/api/site-status`, and `VITE_PRELAUNCH=true` in the web build, as today):
1. Log in as admin, Admin dashboard, Flags tab, click **Go live** and confirm.
2. Check `https://api.venlaxsports.com/api/site-status` returns `{"live": true}` and `https://venlaxsports.com` shows the full Home.

Rollback: **Return to pre-launch** in the same place. If the API is unreachable the site falls back to the waitlist page.

Fallback (old way, needs a rebuild): set `VITE_PRELAUNCH=false` on `venlaxsports-web` and redeploy (about 4 minutes).

Then announce to the waitlist and watch the logs for the first 24 hours.
