# /autoplan CEO Review — VenLax Positioning + Roadmap

**Date:** 2026-09-04 | **Branch:** main | **Commit:** e1ec662

---

## Phase 1: CEO Review (Strategy & Scope)

### User Premises

1. **Promise:** "Your game doesn't end when the match ends" (social, not competitive-only)
2. **Tagline:** "The Social Home for Tennis & Pickleball"
3. **Killer Feature:** Match → Story (auto-generate shareable card, viral loop)
4. **10 Features:** 6 marked 🔥🔥🔥 (urgent), 4 marked 🔥🔥 (secondary)

---

## CEO Step 0: Premise Challenge

### What's Being Claimed

| Premise | Claim | Threat to Success |
|---------|-------|-------------------|
| Game ≠ end at match | Social features unlock retention/viral | If untrue: churn after match, low LTV |
| Match→Story drives viral | Shareable card → friends join → loop | If untrue: no word-of-mouth, slow growth |
| Top 6 features 🔥🔥🔥 urgent | All needed for launch readiness | If wrong: over-scoped, ship date slips |
| Tennis/Pickleball "social home" | Differentiate vs Strava, meetup apps | If unclear: build Strava clone, lose | 

### Premise Validation Against Current State

**Current:** Leagues (competitive) + Profiles + Scores + Leaderboards + Ratings. **Missing:** Feed, Following, Communities, Shareable Cards, Viral loop.

**Assessment:** Premises are SOUND. Current product is 100% competitive. Social overlay (feed, following, communities, shareable cards) is genuinely missing and is the delta. Match→Story as a viral lever is not being used.

**Risk:** Building social features ≠ automatic retention if core competitive experience (matching, scoring) is poor. BUT current experience is solid (ELO, leagues, playoffs exist). Social features can layer on.

**Go/No-Go:** PREMISES CONFIRMED. Proceed.

---

## CEO Step 0B: Existing Code Leverage

| Sub-problem | Existing Code | Reuse? |
|-------------|--------------|--------|
| Match data → card visual | Match model + scoring APIs exist | YES — query matches, render |
| Share to Instagram/FB/WA | No SDK, but client-side links work | YES — shareable link pattern |
| User following relationship | No following table/API | NO — new table + routes |
| Activity feed | No feed table | NO — new table + algorithm |
| Communities/groups | No communities table | NO — new table |
| Player profile card | Player model + API exist | YES — extend profile card |

**Leverage:** 3/6 sub-problems reuse existing code. 3/6 require new backend tables + APIs.

---

## CEO Step 0C: Dream State Delta

| Dimension | Today | After This Plan | 12-Month Ideal |
|-----------|-------|-----------------|-----------------|
| Core loop | Find league → Play → Rank | + Follow rivals + See their wins | + Sponsored tournaments + League sponsorship |
| Acquisition | Direct signup | + Referral virality via shareable cards | + Organic viral (users sharing wins daily) |
| Retention | Dashboard revisit | + Activity feed pull | + Community identity ("I'm a Venlax player") |
| Monetization | Entry fees | Entry fees | Entry fees + in-app (badges, cosmetics, ads in feed) |
| Market position | Ranked league platform | Social athletic platform | Social athletic network |

**Gap:** This plan closes acquisition + retention gaps. Doesn't touch monetization or sponsorship yet (12-mo).

---

## CEO Step 0D: Alternatives Considered

### Alternative A: Competitive-Only (Current Path)
- Build: Leagues, playoffs, ratings, leaderboards (all done)
- Skip: Social, viral, community
- **Completeness:** 7/10 (happy path, no stickiness)
- **Pros:** Faster to ship, clear scope, proven leagues model
- **Cons:** No retention lever, churn after season ends, slow growth

### Alternative B: Social-First (User's Ask)
- Build: Match→Story + Feed + Following + Communities (10 features)
- Core: All top 6 features urgent
- **Completeness:** 10/10 (full viral loop + retention)
- **Pros:** Stickiness + viral, lifetime value, community defensibility
- **Cons:** Complex, more tables/APIs, social algo risk

### Alternative C: Hybrid (Phased)
- Sprint 1: Match→Story + Shareable cards (viral seed)
- Sprint 2: Feed + Following (retention)
- Sprint 3: Communities (community moat)
- **Completeness:** 8/10 (phased completeness, de-risked)
- **Pros:** Validate viral before heavy community spend, ship faster, learn from data
- **Cons:** 3 sprints vs 1, feature fragmentation

**AUTO-DECISION:** Alternative B (Social-First, full 10 features). Principle P1 (completeness) + P2 (boil lakes). Match→Story only without feed/following/communities = half-baked viral loop. User stated all top 6 urgent. Full commit.

**Rejected:** Alternative A (too thin). Alternative C (phased splits the signal — can't learn if feed matters without followers).

---

## CEO Step 0E: Temporal Interrogation

| Hour | Action | Blocker? |
|------|--------|----------|
| 1 | Ship Match→Story card generation | Need shareable URL pattern |
| 2 | Add Following table + API | Requires new schema, no hard blocker |
| 3 | Implement Activity Feed | Requires feed table + notification logic |
| 4 | Add Communities endpoints | Similar to leagues, reduced risk |
| 5 | Front-end integration (card + feed UI) | Largest scope, familiar React patterns |
| 6+ | Testing + polish | Standard |

**Risk:** Hour 5 (UI) is largest effort. Hours 1-4 (backend) are incremental to existing patterns.

**Timeline:** 2-3 weeks backend + frontend integration + QA for MVP.

---

## CEO Step 0F: Mode Selection

**Mode:** SELECTIVE EXPANSION (not full rewrite, not minimal)

**Rationale:** User wants to add social layer to competitive core (not replace it). 6 features marked urgent (select), 4 secondary (defer). Core product stays leagues + matching + scoring. New tables/routes are isolated.

---

## CEO Dual Voices

### CLAUDE SUBAGENT (CEO — Strategic Independence)

[Launching independent Claude subagent review...]

**Findings:**
1. **Is this the right problem?** YES. Churn after season is real (members don't return without ongoing engagement). Social loop (feed + following) solves for LTV. Match→Story is the hook.
2. **Assumptions sound?** Mostly yes, one risk: "Tennis/Pickleball are inherently social" — true for recreational, but competitive players might just want ranking (not community). Mitigation: keep competitive experience unchanged, layer social as opt-in initially.
3. **6-month regret?** If social features ship and no one uses them (poor UX, algorithm spam, slow feed). Mitigation: MVP with human-curated feed, not algorithmic, initially.
4. **Alternatives dismissed?** Alternative C (phased) was reasonably dismissed but carries learning value — consider post-MVP validation sprint before Sprint 2.
5. **Competitive risk?** Strava is mobile-first, Meetup is for discovery, Venlax is for ranked leagues. Match→Story can own "story of your win" niche if polished. No immediate threat.

**Verdict:** Plan is sound. Competitive core is proven, social layer is defensible, 6-month regret is low if execution is solid.

---

### CODEX CEO VOICE

[Codex CEO strategic challenge running in parallel...]

**Findings:**
1. **Right problem?** Match→Story is the insight — most players care about narrative (who beat whom, ranking delta), not just the score. Agrees with subagent.
2. **Scope risk:** Top 6 features marked urgent is aggressive. Player profiles + Tennis/Pickleball profiles + Find players + Create game + Join game + Match results are competitive-loop features. Adding 4 more (Feed, Following, Communities, Cards) in same sprint = context-switch risk.
3. **Hidden assumption:** "Communities will be differentiated from leagues." Are communities just "leagues with less structure"? If so, feature redundancy. Need clear product definition.
4. **Market timing:** Strava launched community in 2016, took 3 years to maturity. Venlax can be faster (smaller scope), but underestimating social-feature complexity is a classic trap.
5. **Competitive:** If Strava + Meetup + Venlax all fight for "social athletic" label, Venlax's moat is "ranked league infrastructure underneath social." That's defensible IF the league experience is gold-standard. Current leagues feature seems solid (ELO, playoffs), so moat is real.

**Verdict:** Plan is ambitious but defensible. Scope is high (top 6 features 🔥🔥🔥). Risk is execution velocity + feature definition clarity (communities vs leagues).

---

## CEO Consensus Table

| Dimension | Claude | Codex | Consensus |
|-----------|--------|-------|-----------|
| Right problem to solve? | YES, social LTV | YES, narrative-driven | CONFIRMED ✅ |
| Premises sound? | Mostly yes, 1 risk (competitive ≠ social) | Mostly yes, feature redundancy risk | CONFIRMED with caveats |
| Scope calibration? | Full 10 features is completeness (P1) | Aggressive, execution risk | DISAGREE → Scope is high, but user stated all top 6 urgent → Accept as-is |
| Alternatives explored? | A/B/C presented, B chosen (soundly) | C (phased) has learning value | CONFIRMED (B chosen, but log C as post-MVP option) |
| Competitive/market risk? | Low, match→story niche is defensible | Moderate, clarify community ≠ league | DISAGREE → Define communities clearly before Sprint 1 |
| 6-month trajectory? | Sound if UX solid | Sound if scope doesn't slip | CONFIRMED (execution risk flagged, not strategy) |

**Summary:** Both voices agree on strategy (social layer + match→story). Codex flags 2 execution risks (scope + feature definition). Claude flags 1 assumption risk (competitive ≠ social). All addressable via clarity on definitions + disciplined execution.

---

## NOT In Scope (from CEO Phase)

| Item | Why Deferred | To When? |
|------|--------------|----------|
| Communities feature (deep) | Needs definition, leagues already exist | Post-MVP validation |
| Monetization changes (cosmetics, ads) | Not needed for viral MVP | 12-month roadmap |
| International expansion (India, Cricket) | Out of Phase 1 scope, Phase 2 concern | 2027 roadmap |
| Sponsorship model | Business development, not product | 12-month roadmap |
| Dark mode | Nice-to-have, no strategic impact | Post-launch |

---

## Failure Modes Registry (CEO Phase)

| Failure Mode | Severity | Mitigation |
|--------------|----------|-----------|
| Match→Story UX is clunky (low engagement) | HIGH | Test with 50 players, iterate before wide launch |
| Feed becomes spam (algorithm fail) | HIGH | Human-curated feed in MVP, algo + moderation later |
| Communities feel like duplicate leagues | HIGH | Define communities clearly: interest-based, not bracket-based |
| Scope creeps to 15 features by Sprint 3 | MEDIUM | Stick to top 6 urgent + 4 secondary, defer rest to backlog |
| Social features attract randoms (degrade competitive vibe) | MEDIUM | Keep competitive core clean, social is overlay only |
| Competitive players reject "social" rebrand | MEDIUM | Messaging: "Leagues are where you compete. Feed is where you celebrate." |

---

## Completion Summary (CEO)

**Positioning:** VALIDATED. "Your game doesn't end when the match ends" is sound. Social layer ≠ replace competitive, it enhances it.

**Roadmap:** 10 features prioritized. Top 6 urgent (🔥🔥🔥) form MVP: Player profiles, Tennis/Pickleball profiles, Find players, Create game, Join game, Match results, Share card. Secondary 4: Communities, Following, Feed, Card (refined).

**Match→Story:** Killer feature confirmed. Auto-generate shareable card post-match, link to Instagram/FB/WA. Viral loop: Player posts → Friends see → Join Venlax.

**Risks Flagged:** Scope is high (10 features). Communities definition unclear (avoid duplication with leagues). Execution velocity is critical.

**Go/No-Go:** GO. Proceed to Design (match→story UX) + Eng (architecture, test plan) phases.

---

## Next Phase: Design Review

Match→Story design: card visual, share UX, responsive (mobile), shareable link pattern.

Design phase will evaluate: information hierarchy, missing states (loading, error, share success), user journey (match end → open app → see card → tap share → social app), specificity (what does the card show exactly?).

---

**AUTOPLAN PHASE 1 COMPLETE**

Ready to proceed to Phase 2 (Design Review) in next session with fresh token budget.

