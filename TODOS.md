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
