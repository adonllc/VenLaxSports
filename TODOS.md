# VenLax Sports — Deferred Tasks

**Last updated:** 2026-08-30  
**Status:** Approved by /autoplan (dev-live-environment-plan)

## Phase 1: Dev/Live Environment Setup (IN PROGRESS)

### Implementation Tasks (from /autoplan)

- [ ] **T1.1 (1h) — Coolify: Create Dev Service**
  - Duplicate existing Live service in Coolify
  - Domain: dev.venlaxsports.com
  - Environment variables: Load from .env.dev
  - Disable auto-deploy (manual only)

- [ ] **T1.2 (30m) — DNS: Add Dev Records**
  - dev.venlaxsports.com CNAME → dev Coolify IP
  - dev-backend.venlaxsports.com CNAME → dev Coolify IP

- [ ] **T1.3 (30m) — Database: Create dev_venlaxsports**
  - Create DB name dev_venlaxsports in MongoDB
  - Store connection string in .env.dev

- [ ] **T1.4 (20m) — Environment Variables**
  - Create .env.dev (dev Stripe key, dev MongoDB URL, ENV=development)
  - Create .env.live (prod Stripe key, prod MongoDB URL, ENV=production)

- [ ] **T1.5 (1h) — Validation Testing**
  - Dev deploy + smoke test (register user, create league)
  - Live deploy + verify prod data untouched
  - Rollback test

- [ ] **T1.6 (1h) — Runbook Creation** ← BLOCKER for team adoption
  - docs/deployment-runbook.md (Deploy to Dev, Deploy to Live, Rollback, Troubleshooting)

- [ ] **T1.7 (15m) — Smoke Test Script**
  - scripts/smoke-test.sh (bash: curl health, register, join league)

- [ ] **T1.8 (20m) — Process Definition**
  - CLAUDE.md: Add deployment workflow
  - Assign QA role + approval gate

**Phase 1 ETA: 1 week**

## Phase 2: CI/CD + Automation (DEFERRED)

- [ ] T2.1 — GitHub Actions: Auto-deploy Dev on push
- [ ] T2.2 — Automated smoke tests (fail CI if broken)
- [ ] T2.3 — Approval gate for Live (manual-only)

**Phase 2 ETA: 1 week after Phase 1**

## Phase 3: Observability (DEFERRED)

- [ ] T3.1 — Error tracking (Sentry)
- [ ] T3.2 — Deployment monitoring
- [ ] T3.3 — Health dashboard

**Phase 3 ETA: 1 month after Phase 1**

## Growth Wave 2: after the first launch-city league fills (added 2026-10-25, from /plan-ceo-review + /plan-eng-review)

**Why it waits:** these need real players and a completed season. Wave 1 (launch-city flag, rating seed, start-threshold line, referral credit gating, About page) ships first. Plan: `~/.gstack/projects/adonllc-VenLaxSports/ceo-plans/2026-10-25-density-first-city-launch.md`.

- [ ] **Season 1 public page + consent (A4/F2).** Players listed only with opt-in (default off), first name + last initial, withdrawable any time. Reuse `LeagueSpectator.jsx` and `public_routes.py /league/{id}`. Replace the "sample" cards on Home once real data exists.
- [x] **Local comparison page (A5)** (built 2026-10-25 at /compare. Owner decision: no competitor is named; generic wording only, so no competitor facts to re-check). Original note: Honest "VENLAX vs team leagues (ALTA/USTA) in Atlanta". Verify every competitor fact before publishing.
- [ ] **Court and venue guide (E4).** One page per open city, address + booking link, "suggest a court" form. Needs real venue facts from the owner.
- [x] **Ambassadors (E2)** (built 2026-10-25: admin Referrals tab sets a memorable code on an account; old codes keep working). Original note: Plain referral codes for 3 to 5 local people or clubs; no new attribution system. Depends on the Wave 1 credit fix so credit pays only after a first completed match.
- [x] **Season recap card + badges (E3)** (built 2026-10-25: cards generate when a league completes; players see them on the dashboard; admin can regenerate via POST /api/recaps/admin/{league_id}). Original note: Reuse `card_generation.py`. Needs a season that has ended. Skip a player's card on failure and log it; never fail the batch.
- [-] **Season-start guarantee (E1).** DROPPED: owner decided refunds are only before the league starts, with no minimum-player rule and no minimum shown to players. Original note: Minimum players + automatic refund. Business policy decision first.
