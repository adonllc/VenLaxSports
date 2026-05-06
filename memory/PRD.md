# LeaguePro - Multi-Sport League Platform
## Product Requirements Document

**Last Updated**: May 2026  
**Version**: 1.0 MVP

---

## Problem Statement
Build a multi-sport, multi-country league platform (T2Tennis-style) supporting Tennis, Cricket, and Pickleball across USA and India. Players can join leagues, schedule matches, report scores, track standings, and compete across seasons.

## User Personas
1. **Player (USA)** - Tennis/Pickleball enthusiast, 18-50, competitive amateur
2. **Player (India)** - Cricket player, corporate league participant, 18-45
3. **Admin** - Platform operator managing leagues, payments, and analytics
4. **Team Captain (Cricket)** - Organizes team, registers in leagues

## Architecture
- **Frontend**: React + Tailwind CSS (Outfit/DM Sans fonts, sport color themes)
- **Backend**: FastAPI (Python) on port 8001
- **Database**: MongoDB (motor async driver)
- **Auth**: JWT + httpOnly cookies (bcrypt password hashing)
- **Payments**: Stripe (emergentintegrations library)

---

## What's Been Implemented (MVP - May 2026)

### Config-Driven Multi-Repo Architecture (Added May 2026)
- `frontend/src/config/platformConfig.js` — single source of truth for both deployments
- `frontend/.env.usa` — USA deployment template (Tennis + Pickleball, USD, Stripe)
- `frontend/.env.india` — India deployment template (Cricket, INR, Razorpay)
- `backend/.env.usa` / `backend/.env.india` — backend deployment templates with separate DBs
- All country-specific hardcoding removed from UI — zero "USA" or "India" labels visible
- Cities section on Home page driven by config (6 city cards per deployment)
- Default sport, currency, featured cities, hero text all config-driven

### Backend (/app/backend/)
- `server.py` - FastAPI app, DB connection, middleware, startup seeding
- `models.py` - User, League, Team, Match, Standing, PlayerLeague, PaymentTransaction
- `auth_utils.py` - JWT creation/verification, bcrypt hashing, get_current_user dependency
- `routes/auth_routes.py` - register, login, logout, me, refresh
- `routes/league_routes.py` - CRUD leagues, join league, get players/standings/matches
- `routes/match_routes.py` - Schedule matches, report scores, my matches
- `routes/payment_routes.py` - Stripe checkout, payment status polling
- `routes/admin_routes.py` - Stats, user management, league management

### Frontend (/app/frontend/src/)
- `App.js` - Route definitions with AuthProvider
- `contexts/AuthContext.js` - Auth state, login/logout/register
- `components/Navbar.jsx` - Sticky glass nav with sports dropdown
- `components/Footer.jsx` - Footer with sport colors
- `pages/Home.jsx` - Hero (3-sport images), stats, sport cards, featured leagues, how-it-works, countries
- `pages/Auth.jsx` - Login/Register with country selection
- `pages/Leagues.jsx` - Browse with sport/country/status filters
- `pages/LeagueDetail.jsx` - League info, join flow, tabs (overview/players/matches/standings)
- `pages/PlayerDashboard.jsx` - Profile, stats, leagues, match scheduling, results
- `pages/AdminDashboard.jsx` - Stats, create league, manage leagues
- `pages/SportLanding.jsx` - Sport-specific page (tennis/cricket/pickleball)
- `pages/ScoreReport.jsx` - Sport-specific score input (sets/games/runs)
- `pages/Standings.jsx` - Full standings table for a league

### Seeded Data
- Admin: admin@leaguepro.com / Admin@123
- 8 sample leagues (Tennis, Cricket, Pickleball across USA & India)
- 15 cities (8 USA, 7 India)

---

## Credentials
- Admin: admin@leaguepro.com / Admin@123

---

## Prioritized Backlog

### P0 - Critical (Next Sprint)
- [ ] Google OAuth Social Login integration
- [ ] Team management for Cricket (create team, add players)
- [ ] Email notifications (SendGrid) for match scheduling
- [ ] Razorpay integration for India INR payments
- [ ] Player search by ID to improve match scheduling UX

### P1 - High Priority
- [ ] Rating system updates after match results
- [ ] Playoffs bracket generation
- [ ] Season management (create/activate/end seasons)
- [ ] Dispute resolution system
- [ ] City/venue management pages

### P2 - Nice to Have
- [ ] Corporate league packages
- [ ] Umpire marketplace (India cricket)
- [ ] Coaching marketplace
- [ ] Mobile app (React Native)
- [ ] Live scoring (WebSocket)
- [ ] Sponsorship management
- [ ] WhatsApp/SMS notifications
- [ ] Franchise model for city admins

---

## Revenue Streams Implemented
1. League entry fees (Stripe checkout) ✓
2. Platform service fee structure (configurable)

## Revenue Streams Planned
3. Razorpay for India (INR)
4. Premium player profiles
5. Corporate league packages
6. Umpire marketplace
7. Coaching marketplace
8. Tournament photography/streaming add-ons
