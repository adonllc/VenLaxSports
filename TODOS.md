# TODOS — Referral Engine Expansions
Generated: 2026-05-19 | Plan: ceo-plans/2026-05-19-referral-engine.md

---

## BLOCKERS (must resolve before launch)

- [ ] **Apply for WhatsApp Business API today** — Meta Business verification takes 2-4 weeks. This gates Expansion 4 (WA integration). Do not wait for engineering to finish first.
- [ ] **Seed demo league before public launch** — city leaderboards + spectator views are empty at launch. Create 2-3 admin test accounts, run a real demo league in target city (New York tennis), submit match results. Real data, not placeholder.
- [ ] **`serialize_public_user()` helper in `auth_utils.py`** — must strip email, password_hash, google_id, payment_status before any public endpoint returns user data. Ship before any public route goes live.

---

## ARCHITECTURE

- [ ] Add `get_optional_user()` to `backend/auth_utils.py` — returns `None` if no auth cookie, does not raise 401. All public endpoints use this.
- [ ] Create `backend/routes/public_routes.py` — all unauthenticated endpoints go here (city leaderboard, league spectator, player profile public view). Do not add to existing route files.
- [ ] Split user profile endpoint: `GET /users/me` (auth required, full fields) stays in `user_routes.py`. `GET /users/{id}` (public, filtered fields) moves to `public_routes.py`.
- [ ] Mount `public_routes.py` in `backend/server.py` under `/api/public`.
- [ ] Add `challenges` collection schema to `backend/models.py` (fields: `challenger_id`, `challenged_id`, `league_id`, `created_at`, `status`, `delivery_method`).

---

## SECURITY

- [ ] Rate-limit Challenge button: max 3 challenges per IP per day. Use in-memory counter or Redis. Return 429 on excess.
- [ ] Verify `X-Hub-Signature-256` header on all incoming WA webhook payloads. Reject unsigned payloads with 403.
- [ ] If OG image generation is server-side: sanitize player names before embedding in image (strip zero-width chars, RTL overrides).
- [ ] Audit all public endpoints at code review: confirm zero PII leakage (email, exact location, payment data).

---

## DATABASE — Indexes

Add to `backend/seeds/create_indexes.py`:

```python
# Referral engine expansions
await db.standings.create_index([("city", 1), ("sport", 1)])
await db.matches.create_index([("league_id", 1), ("status", 1)])
await db.rating_history.create_index([("user_id", 1), ("recorded_at", -1)])
await db.challenges.create_index([("challenged_id", 1), ("status", 1)])
await db.challenges.create_index([("challenger_id", 1), ("created_at", -1)])
```

---

## ERROR HANDLING

- [ ] City leaderboard with no players → return `{"players": [], "leagues": []}` with 200. Frontend shows "Be the first to compete in {city}" CTA. Never 404.
- [ ] Private player profile accessed anonymously → return 404 (not 403 — 403 leaks that account exists).
- [ ] WA delivery failure → silent fallback to email. Log failure. Never raise 500.
- [ ] Card generation failure → degrade to text share link. Never block score submission flow.

---

## TESTS — New test class required

File: `backend/tests/test_public_endpoints.py`

- [ ] `test_city_leaderboard_no_auth` — GET city page without cookie, assert 200
- [ ] `test_city_leaderboard_empty_city` — empty city returns 200 + empty arrays, not 404
- [ ] `test_league_spectator_no_auth` — GET league public view without cookie, assert 200
- [ ] `test_player_profile_public_no_auth` — GET public profile without cookie, assert 200, no email field
- [ ] `test_player_profile_private_no_auth` — GET private profile without cookie, assert 404
- [ ] `test_challenge_rate_limit` — 4th challenge from same IP returns 429
- [ ] `test_public_response_no_pii` — assert none of: email, password_hash, google_id in any public response

---

## OBSERVABILITY

- [ ] All generated URLs (share cards, challenge links, spectator links) must include UTM params: `utm_source=venlax&utm_medium={card|challenge|spectator|leaderboard}`. This is how we know which surface drives traffic.
- [ ] Log challenge events: `challenge_sent`, `challenge_viewed` (on invite page load), `challenge_converted` (recipient registered). This is the Expansion 3 conversion funnel.
- [ ] WA delivery logging: log per message type (`reminder`, `score_prompt`, `league_start`) with delivery status. Compare vs email rates monthly.

---

## DEPLOYMENT

Add to `.env.usa` (and document in CLAUDE.md):
```
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
META_APP_SECRET=
```

- [ ] WA webhook endpoint must be registered at app startup (not lazy import). Meta pings it during setup verification.
- [ ] If server-side card generation: add `Pillow` to `backend/requirements.txt`. **Recommendation: use client-side Canvas API first** — faster to ship, zero server dependency.
- [ ] Update sitemap to include city leaderboard pages + public league pages. Submit to Google Search Console post-launch.
- [ ] Add `<meta og:*>` tags to all public-facing pages (city, league spectator, player profile).

---

## DESIGN — Do before building

- [ ] **Test 3 shareable card designs with real players before engineering.** Key requirements: VenLax wordmark prominent, sport color accent (emerald=tennis, orange=pickleball), player names + score large, city+date small. No stock graphics. Get "would you share this?" feedback before committing.
- [ ] All public pages need sticky "Join VenLax" CTA. First-time visitor must have an obvious next action.
- [ ] City leaderboard must show activity indicators: "Last match: 3 days ago", "6 active players". Static table of names = dead product.
- [ ] Player profile ELO chart: show ELO by match number (not calendar date). Trajectory matters, not timing.
- [ ] Add privacy disclosure to registration flow: "Your match results will be visible publicly. Change in Settings anytime."

---

## IMPLEMENTATION ORDER (from CEO plan)

| # | Feature | Notes |
|---|---------|-------|
| 1 | League Spectator View | Lowest effort, highest SEO impact |
| 2 | City Public Leaderboards | Needs index seed first |
| 3 | Match Result Shareable Cards | Design cards first |
| 4 | Public Player Profiles | Privacy toggle required |
| 5 | Challenge Any Player Button | Needs profiles to exist |
| 6 | WhatsApp Business API | Blocked until Meta approval |
