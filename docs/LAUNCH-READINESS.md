# VENLAX Sports — Launch Readiness Checklist

Goal: get everything ready for go-live, then flip the switch on launch day.
Live launch is **not scheduled yet**. Phases A–C can be done any time; Phase D is the launch-day runbook.

Legend: `[ ]` todo · `[x]` done

---

## Phase A — Prep now (safe, no user impact)

- [ ] **1. Commit the cleanup script** — `backend/scripts/prelaunch_cleanup.py`. Do **not** run it yet; it deletes test data still needed for QA.
- [ ] **2. Replace stale seed leagues**
  - `backend/seeds/leagues.py` (removed 2026-10-20) had 2025 dates and $29.99/$39.99 fees; canonical pricing is singles $9.99, doubles/mixed $19.99 (`pricing_config.py`).
  - Decide launch cities, formats, start dates.
  - Verify `POST /api/admin/auto/leagues` generates correct leagues.
- [ ] **3. Separate staging from prod**
  - Staging on Coolify with its own DB and Stripe **test** keys.
  - Do all QA on staging so prod data stays clean.
  - Confirm staging cannot reach the prod DB.
- [ ] **4. Fix prod deploy webhook** (broken per notes) or document the manual Coolify API deploy.
- [ ] **5. Hide or label unfinished features**
  - Apple Pay / Google Pay / Zelle (stubs)
  - WhatsApp (Meta approval pending)
  - Push notification dispatch (pending)

## Phase B — Third-party setup (long lead times, start early)

- [ ] **6. Stripe live account**
  - Complete business verification + bank payout setup.
  - Create live webhook; record signing secret.
  - Do **not** put live keys in env until launch day.
- [ ] **7. Email provider**
  - Move off Gmail SMTP (daily cap) to Resend / SES / Postmark.
  - Add SPF, DKIM, DMARC DNS records on `venlaxsports.com`.
  - Add unsubscribe link + physical address to email footers (CAN-SPAM).
- [ ] **8. Meta WhatsApp approval** — keep chasing; do not block launch on it.
- [ ] **9. MongoDB Atlas**
  - Move off free tier if applicable.
  - Enable backups + point-in-time restore.
  - Restrict IP allowlist to the Coolify VPS.
- [ ] **10. Google OAuth**
  - Add prod redirect URIs.
  - Publish consent screen out of "Testing" mode.
- [ ] **11. Monitoring**
  - Error tracking (Sentry or similar), frontend + backend.
  - Uptime monitor on `https://venlaxsports.com/api/health`.

## Phase C — Hardening and QA (on staging)

- [ ] **12. Security**
  - Rotate admin password and `SECRET_KEY`.
  - CORS locked to `venlaxsports.com`.
  - `ENV=production` set in prod (secure cookies).
  - Run `/cso` security audit.
- [ ] **13. Full QA pass** (`/qa`) on staging, mobile Safari + Chrome:
  - Register, login, Google login (mobile 400 was a past bug)
  - Forgot / reset password
  - Join league (free and paid), promo codes
  - Doubles invites, round robin
  - Schedule match, report score, standings, ELO update
  - Match card share
  - Every transactional email (register, reset, match scheduled, score, early access, weekly feedback, referral)
- [ ] **14. Performance + SEO**
  - Lighthouse (CLS fixes recently shipped)
  - sitemap.xml, robots.txt, OG images
  - Prerendered routes serve correctly
- [ ] **15. Legal review** — human/lawyer review of Terms, Privacy (CCPA), waiver language.
- [ ] **16. Rollback drill** — perform one rollback via Coolify to confirm it works.

## Phase D — Launch-day runbook (write now, execute later)

Env flags to confirm: `PHASE=1` (backend) and `VITE_PHASE=1` (frontend) match.

- [ ] 1. Take Atlas snapshot.
- [ ] 2. Cleanup script on prod DB:
  - Run from Coolify backend terminal, or locally with the Atlas public URL:
    `python -m scripts.prelaunch_cleanup` (dry run), review output
  - Add test accounts to `--extra-delete-emails`
  - Execute: `python -m scripts.prelaunch_cleanup --execute --backup-dir ./cleanup_backup`
  - Keeps `adonllcusa@gmail.com` and all `role=admin`; deletes `*.demo@venlaxsports.com`; wipes leagues/matches/standings/etc.
- [ ] 3. Run `seeds/indexes.py` against prod.
- [ ] 4. Create real leagues via `POST /api/admin/auto/leagues` (not `seeds/leagues.py`). Keep startup seeds in `server.py` commented out.
- [ ] 5. Swap in live Stripe key + webhook secret and new SMTP credentials.
- [ ] 6. Set `VITE_PRELAUNCH=false` (or `VITE_LAUNCH_LIVE=true`) and **rebuild/redeploy frontend** — Vite bakes it in at build time.
- [ ] 7. Real $9.99 payment, then refund; verify league join + `payment_transactions` record. Test key emails.
- [ ] 8. Announce to waitlist.
- [ ] 9. Watch logs + error tracking for the first 24 hours.

---

## Suggested order of attack

1. Start long-lead items: **6, 7, 9**.
2. Quick code tasks: **1, 2, 5**.
3. Staging hardening: **12, 13**.
4. Finish **14–16**, then rehearse Phase D.

## Notes

- Backend must be redeployed whenever new routes are added (past waitlist 404 incident).
- Use `craco start` for local frontend dev, not `react-scripts start`.
- Coolify prod webhook is broken; use the REST deploy trigger until fixed.
