# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**VENLAX Sports** — multi-sport league platform (Tennis, Pickleball, Cricket) for USA and India.  
Domain: `venlaxsports.com`. Tagline: "Victory. Energy. eXperience."

**Active phase: Phase 1** — USA, Tennis + Pickleball, Stripe / USD.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Tailwind v3, shadcn/ui (Radix), react-router-dom v7, recharts |
| Backend | FastAPI (Python), uvicorn, port **8001** |
| Database | MongoDB via motor (async) |
| Auth | JWT (httpOnly cookies, bcrypt) + Google OAuth (Emergent Auth) |
| Payments | Stripe (`emergentintegrations` lib); Apple Pay / Google Pay / Zelle are stubs |
| Build tool | `craco` (wraps CRA) |
| Package mgr | `yarn` (frontend), `pip` (backend) |

---

## Dev Commands

### Frontend (`frontend/`)
```bash
yarn start        # dev server (default port 3000)
yarn build        # production build
yarn test         # run tests
```

### Backend (`backend/`)
```bash
uvicorn server:app --reload --port 8001   # dev server
python -m pytest tests/test_api.py -v    # run a single test file
```

Required env vars for backend (create `backend/.env`):
```
MONGO_URL=mongodb://...
DB_NAME=venlaxsports
SECRET_KEY=...
PHASE=1
STRIPE_SECRET_KEY=...
ENV=production   # enables secure=True on auth cookies; omit (or set to "development") locally
# SMTP_* vars optional — console fallback when unset
```

Required env var for frontend (create `frontend/.env`):
```
REACT_APP_PHASE=1
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## Architecture

### Phase Gating (critical)
Phase controls which sports and country are visible. **Two config files must stay in sync:**
- `frontend/src/config/platformConfig.js` — read via `REACT_APP_PHASE` env var
- `backend/phase_config.py` — read via `PHASE` env var

Public API endpoints (`/api/leagues`, `/api/cities`) filter by active sports + country. Admin endpoints are unfiltered. UI components read from `activeSports` / `activeCountry` exported from `platformConfig.js`.

### Backend Layout (`backend/`)
- `server.py` — FastAPI app, MongoDB connection (`app.state.db`), all routers mounted under `/api`
- `routes/` — one file per domain: `auth_routes`, `league_routes`, `match_routes`, `payment_routes`, `admin_routes`, `user_routes`, `season_routes`, `playoffs_routes`, `auto_league_routes`, `google_auth_routes`
- `models.py` — Pydantic models + `BaseDocument` (handles `_id`↔`id` coercion)
- `auth_utils.py` — JWT creation/verification, password hashing
- `email_service.py` — aiosmtplib; falls back to console when `SMTP_HOST` unset
- `rating_utils.py` — ELO-style deltas for tennis/pickleball (K=0.05)
- `pricing_config.py` — canonical pricing: singles=$9.99, doubles/mixed=$19.99
- `seeds/` — idempotent seed scripts (admin, cities, leagues, indexes, pricing)
- `tests/` — pytest files; run against a live MongoDB instance

### Frontend Layout (`frontend/src/`)
- `config/platformConfig.js` — single source of truth for phase, active sports, UI copy
- `config/brandConfig.js` — brand constants (name, domain, taglines, pillars)
- `pages/` — one file per route: Home, Auth, AuthCallback, Leagues, LeagueDetail, PlayerDashboard, AdminDashboard, SportLanding, ScoreReport, Standings, Rules, ResetPassword
- `components/` — shared: Navbar, Footer, Logo, HowItWorks, PaymentMethodModal, OpponentSearch, RatingHistoryChart, ForgotPasswordModal
- `components/ui/` — shadcn/ui primitives
- `contexts/` — React context providers (auth state)
- `hooks/` — custom hooks

### MongoDB Collections
`users`, `leagues`, `matches`, `seasons`, `playoffs`, `rating_history`, `cities`, `payments`

### Key API Routes
| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/register` | bcrypt, JWT cookie |
| POST | `/api/auth/login` | JWT cookie |
| POST | `/api/auth/google/session` | Google OAuth via Emergent Auth |
| GET | `/api/leagues` | phase-filtered; supports `?season_id=` |
| POST | `/api/leagues/:id/join` | free or Stripe redirect |
| POST | `/api/matches` | schedule match, emails both players |
| PATCH | `/api/matches/:id/score` | score + ELO update + playoffs advance |
| POST | `/api/playoffs` | generate bracket from standings |
| POST | `/api/admin/auto/leagues` | idempotent bulk league generator |
| GET | `/api/users/me/rating-history` | must be declared before `/:user_id` |

---

## Conventions

- **Logo wordmark**: use `<Logo />` component everywhere, never hardcode.
- **Sticky header**: `backdrop-blur-xl bg-white/70` glassmorphism.
- **All interactive elements** must have a `data-testid` attribute in kebab-case.
- Visual rules (fonts, colors, radius, buttons) live in DESIGN.md — see Design System below.

---

## Deployment Templates

`.env.usa` and `.env.india` in root — Atlas-ready Mongo placeholders, CORS pre-configured for `venlaxsports.com`. Use these as the basis for production env files.

## Design System

**Read DESIGN.md before any UI/frontend work.** All typography, colors, spacing, border-radius, motion, and component patterns are defined there. Do not deviate without explicit user approval.

**Key system:**
- **Typography:** Cabinet Grotesk (headings), Hanken Grotesk (body), IBM Plex Mono (data)
- **Colors:** emerald primary (buttons `#047857`, hover `#065F46`), orange accent `#C2410C`, page bg `#FAFAFA`, dark footer `#0B1210`
- **Layout (Produck-style):** 24px card radius (`rounded-3xl`), pill buttons (`rounded-full`), glass pills on photo panels, photos via `PhotoSlot` / `config/photos.js` with dark gradient overlays only
- **Motion:** Minimal. Fade-in on scroll, hover elevate, no playful bounces
- **Philosophy:** Lead with player progression. Athletic competitive vibe. Serious, not trendy.

When reviewing code/components, flag anything that doesn't match DESIGN.md.

---

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore

---

## Deploy Configuration (configured by /setup-deploy)

- **Platform:** Coolify (self-hosted)
- **Production URL:** https://venlaxsports.com
- **App name:** VenLax Sports
- **Deployment structure:** frontend + backend together (unified stack)
- **Deploy trigger:** Automatically on push to main (GitHub webhook)
- **Merge method:** Squash (recommended for clean history)
- **Project type:** Full-stack web app (React + FastAPI)

### Deploy workflow
- **Pre-merge:** `yarn build` (frontend) + `python -m pytest tests/ -v` (backend smoke tests)
- **Trigger:** Coolify webhook on push to main — automatic redeploy
- **Health check:** Poll `https://venlaxsports.com` (frontend) + `https://venlaxsports.com/api/health` (backend)
- **Rollback:** Manual via Coolify UI (or restart the app)
- **Logs:** Coolify dashboard or `mcp__coolify__logs`

### Notes
- Coolify MCP requires `COOLIFY_ACCESS_TOKEN` in environment (set via `/setup-deploy --auth` or `.claude/settings.local.json`)
- Backend deployed on same domain (not separate port) — FastAPI serves at `/api/*` paths
- Database: MongoDB Atlas (remote) — migrations run on deploy startup
- Frontend: served by Coolify's reverse proxy on `/` routes
- To reconfigure, edit this section or run `/setup-deploy` again
