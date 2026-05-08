# VENLAX - Multi-Sport League Platform
## Product Requirements Document

**Last Updated**: Feb 2026
**Version**: 1.2 (Phase 1 — USA: Tennis + Pickleball)
**Domain**: venlaxsports.com
**Tagline**: Victory. Energy. eXperience.

---

## Brand Identity

**VENLAX** is built on three pillars:
- **🏆 Victory** — Every match, every league, every season helps players win, improve, and rise.
- **⚡ Energy** — The heartbeat of sports — fast, dynamic, community-driven.
- **🎮 eXperience** — Seamless digital + physical sports journey, mobile-first.

**Short story**: VENLAX stands for Victory, Energy, and eXperience — a global multi-sport platform built for players who want to compete, connect, and rise.

---

## Problem Statement
Build a multi-sport, multi-country league platform (T2Tennis-style) supporting Tennis, Cricket, and Pickleball across USA and India. Players can join leagues, schedule matches, report scores, track standings, and compete across seasons.

**Rollout model (3 phases):**
1. **Phase 1 — USA: Tennis + Pickleball** (ACTIVE) — Stripe, USD
2. **Phase 2 — USA: + Cricket** — Stripe, USD
3. **Phase 3 — India: Cricket focus** — Razorpay, INR

## User Personas
1. **Player (USA)** — Tennis/Pickleball, 18-50, competitive amateur (Phase 1)
2. **Player (India)** — Cricket, corporate, 18-45 (Phase 3)
3. **Admin** — Platform operator managing leagues, payments, analytics
4. **Team Captain (Cricket)** — Registers teams (Phase 2+)

## Architecture
- **Frontend**: React + Tailwind + shadcn/ui (Outfit/DM Sans fonts)
- **Backend**: FastAPI (Python) on port 8001
- **Database**: MongoDB (motor async)
- **Auth**: JWT (httpOnly cookies, bcrypt) + Google OAuth (Emergent Auth)
- **Payments**: Stripe (emergentintegrations library) — Razorpay planned for Phase 3

### Phase Gating
- **Single config source**: `frontend/src/config/platformConfig.js` (phase 1/2/3 configs) and `backend/phase_config.py` (mirror)
- Controlled by env vars: `REACT_APP_PHASE` (frontend) and `PHASE` (backend)
- Public API endpoints (`/api/leagues`, `/api/cities`) filter responses by active sports + country
- Admin endpoints remain unfiltered so cross-phase data stays visible to ops
- Frontend UI components (Navbar, Home, Footer, Leagues filter, SportLanding, Auth, AdminDashboard) all read from `activeSports` / `activeCountry`

---

## What's Been Implemented

### Feb 2026 — How It Works + Rules & Conduct
- **HowItWorks** — original 6-step component (`/components/HowItWorks.jsx`) replacing the previous generic copy: Pick league → Personalized schedule → Coordinate matches → Report scores → Climb playoffs → Play all year. VENLAX-themed with emerald accents, hover lift animations, CTA to /leagues.
- **Rules page** at `/rules` (`/pages/Rules.jsx`) with USTA-aligned tennis rules (Friend at Court & The Code) + USAP-aligned pickleball rules. Sections: Match Format · Scoring · Court Conduct · VENLAX League Specifics · Ratings · Code of Conduct · Disputes & Appeals. Sticky in-page tab nav, gradient hero ("Play hard. Play fair. Play VENLAX.").
- Nav + Footer links added (desktop + mobile).

### Feb 2026 — VENLAX Rebrand
- **Brand identity migration** from LeaguePro → VENLAX with `frontend/src/config/brandConfig.js` as single source of truth (name, domain, taglines, pillars, story).
- All UI surfaces updated: HTML title + meta + OG tags, Navbar logo (`VEN`+`LAX` emerald), Footer, Auth left panel ("Victory. Energy. eXperience."), SportLanding, App.css.
- Backend: email_service `APP_NAME='VENLAX'`, default sender `noreply@venlaxsports.com`, Zelle handle `payments@venlaxsports.com`, admin email default `admin@venlaxsports.com`.
- New admin seeded `admin@venlaxsports.com / Admin@123` (legacy `admin@leaguepro.com` still works for backwards compat).
- `.env.usa` and `.env.india` deployment templates rewritten with VENLAX domain + Atlas-ready Mongo placeholders + CORS pre-configured for `venlaxsports.com`.

### Feb 2026 — All Cities Open + Auto-League Generator + Standardized Pricing + 4 Payment Methods
- **All cities open** — UI no longer constrains players or admins to a curated list. City inputs are free-text (Auth register, Leagues filter, Admin create-league) with seeded cities as autocomplete suggestions only. "All Cities" is a first-class option.
- **Auto-league generator** — `POST /api/admin/auto/leagues` with cadence ∈ {monthly, quarterly, half_yearly, yearly, all} creates one league per cadence × active sport × format (singles/doubles/mixed). Idempotent: re-runs skip existing. Generated leagues are tagged `auto_generated:true`, `auto_cadence`, city='All Cities'. New `Auto-Generate` tab on Admin Dashboard.
- **Standardized pricing** — `pricing_config.py`: singles=$9.99, doubles=$19.99, mixed=$19.99. Startup migration `seeds/pricing.py` normalizes existing seed leagues idempotently.
- **4 payment methods** — Stripe (existing checkout), Apple Pay + Google Pay (wallet stub via `POST /api/payments/wallet`), Zelle (2-step intent + reference number via `POST /api/payments/zelle/intent` → `/zelle/confirm`). All wallets/Zelle use placeholder credentials in `backend/.env` (`APPLE_PAY_MERCHANT_ID`, `GOOGLE_PAY_MERCHANT_ID`, `ZELLE_HANDLE`, etc). New `PaymentMethodModal` on League Detail picks method.
- **Public payment-config endpoint** — `GET /api/payments/methods` exposes which methods are enabled and their (placeholder) display config so frontend can render dynamically.

### Feb 2026 — Auto-Advance Playoffs, Rating History Graph, Leagues↔Seasons FK
- **Auto-advance playoffs** — `_maybe_advance_playoffs` triggers after each playoff score; when all matches in a round are completed, next-round matches are auto-created pairing winners in bracket order. Round labels: Final / Semifinal / Quarterfinal. Notifications fired to next-round players. Final completion marks league as completed.
- **Rating history snapshots** — every tennis/pickleball score writes 2 entries to a new `rating_history` collection (winner + loser) with delta, opponent, result, league_id, sport.
- **Rating history endpoint** — `GET /api/users/me/rating-history?sport=` (route declared before `/{user_id}` for path-precedence).
- **Rating history graph** — `RatingHistoryChart` (recharts LineChart) on Player Dashboard with sport tabs, current rating, trend pill (+/- delta), reference line for starting rating, empty state for new users.
- **Leagues ↔ Seasons FK** — `League.season_id: Optional[str]`. Admin Create League form shows Season dropdown filtered to current sport. `/leagues` page has Season filter dropdown. `GET /api/leagues?season_id=` filters server-side.
- **Bonus fix** — `/api/auth/me` now returns `id` instead of `_id` for frontend consistency.

### Feb 2026 — Player Search, Ratings, Seasons, Playoffs, Seeds Refactor
- **Seeds refactor** — moved out of `server.py` into `/app/backend/seeds/{admin,cities,leagues,indexes}.py` for scalability
- **Player search** — `GET /api/users/search?q=&league_id=` (2+ char min, optional league scoping, password_hash excluded); `OpponentSearch` typeahead on Player Dashboard match scheduler
- **ELO-style rating updates** — `rating_utils.py` applies small deltas (K=0.05, logistic curve) on every completed tennis/pickleball match; response now includes `rating_change` (winner/loser old/new/delta); cricket untouched (team NRR)
- **Seasons (admin CRUD)** — `POST/GET/PATCH/DELETE /api/seasons`, phase-gated to active sports. New Seasons tab on Admin Dashboard.
- **Playoffs bracket generation** — `POST /api/playoffs` + `GET /api/playoffs/:league_id`. Single-elimination seeding (#1 vs #N, #2 vs #N-1, ...) for top 2/4/8/16 players from league standings. New Playoffs tab on Admin Dashboard with bracket preview.
- **Consistent phase gating on league creation** — admin can no longer create cricket/India leagues in Phase 1 (400 error); matches season gating behavior.

### Feb 2026 — Email Notifications (open-source, aiosmtplib)
- New `backend/email_service.py` — MIT-licensed `aiosmtplib`, console fallback when `SMTP_HOST` unset (zero-setup dev)
- Transactional emails on 4 events:
  - `/api/leagues/:id/join` — free-league registration confirmation
  - `/api/payments/status/:session_id` (on paid) — paid registration confirmation
  - `/api/matches` — match scheduled (both players)
  - `/api/matches/:id/score` — match result (both players)
- New `/api/auth/forgot-password` (enumeration-safe) + `/api/auth/reset-password` (JWT token, 30 min expiry)
- New `/api/auth/preferences` PATCH to toggle `email_notifications`
- New frontend: `ResetPassword` page (`/reset-password?token=...`), `ForgotPasswordModal` on Auth page
- New Player Dashboard opt-out toggle (Bell / BellOff pill)
- SMTP env vars (optional): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_TLS`, `SMTP_SSL`

### Feb 2026 — Phase 1 Enforcement + Google OAuth
- Added `backend/phase_config.py` and env var `PHASE=1`
- `GET /api/leagues` and `GET /api/cities` are phase-filtered; cross-phase queries return `[]`
- New `GET /api/phase` exposes active phase config to the frontend
- Extended `frontend/src/config/platformConfig.js` with `activeSportIds`, `activeSportMap`, `isSportActive`, `activeCountry`
- All frontend sport/country UI reads from the config — Cricket & India are hidden in Phase 1
- **Google OAuth (Emergent Auth)**: `POST /api/auth/google/session` exchanges `session_id` → upserts user → issues existing JWT cookies (no middleware changes)
- `AuthCallback` page handles `#session_id=` fragment before protected routes run
- "Continue with Google" button added to Auth page above the JWT form

### May 2026 — Initial MVP
- Config-driven architecture (`platformConfig.js`, `.env.usa` / `.env.india` templates)
- FastAPI backend: auth, league CRUD, match scheduling, score reporting, standings, Stripe checkout, admin panel
- React frontend: Home, Auth, Leagues list, LeagueDetail, Player/Admin dashboards, SportLanding, ScoreReport, Standings
- 9 seeded sample leagues, 15 seeded cities, admin account, bcrypt password hashing, JWT refresh flow

---

## Credentials
- Admin (JWT): `admin@leaguepro.com` / `Admin@123`
- Google OAuth: Emergent Auth flow (no app-managed passwords)
- See `/app/memory/test_credentials.md`

---

## Prioritized Backlog

### P0 — Phase 1 Completion
- [ ] Wire **real Stripe** account (replace test key + run checkout end-to-end)
- [ ] Replace placeholder **Apple Pay / Google Pay** merchant IDs with real merchant accounts (Stripe Payment Request Buttons in production)
- [ ] Replace placeholder **Zelle** handle with real business Zelle email; add admin queue to verify deposits before auto-confirm
- [ ] Public player profile page `/p/:user_id` (avatar, win-rate, current league badges, rating)

### P1 — High Priority
- [ ] Cron-trigger auto-generator (e.g. 1st of every month) — currently admin-button only
- [ ] Enable real SMTP (Gmail app password / Mailtrap / self-hosted)
- [ ] Weekly digest email (requires SMTP)
- [ ] Dispute resolution flow on reported scores
- [ ] City/venue management admin pages

### P2 — Phase 2 (USA + Cricket)
- [ ] Set `PHASE=2` + `REACT_APP_PHASE=2`
- [ ] Cricket team creation, captain management, NRR tracking
- [ ] Cricket score reporting (overs, powerplay, wickets)

### P3 — Phase 3 (India)
- [ ] Set `PHASE=3` + `REACT_APP_PHASE=3`
- [ ] Razorpay integration for INR payments (requires user credentials)
- [ ] Seed India-specific cricket leagues
- [ ] Umpire marketplace

### P4 — Nice to Have
- [ ] Corporate league packages
- [ ] Coaching marketplace
- [ ] Mobile app (React Native)
- [ ] Live scoring (WebSocket)
- [ ] Sponsorship management
- [ ] WhatsApp/SMS notifications
- [ ] Franchise model for city admins

---

## Revenue Streams Implemented
1. League entry fees (Stripe checkout) ✓

## Revenue Streams Planned
2. Razorpay for India (INR) — Phase 3
3. Premium player profiles
4. Corporate league packages
5. Umpire / coaching marketplace
6. Tournament photography / streaming add-ons
