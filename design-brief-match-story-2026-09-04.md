# Design Brief — Match→Story Feature

**Date:** 2026-09-04 | **Phase:** 2 (Design) | **Status:** Approved

---

## Feature Summary

Post-match card showing winner's achievement (name, score, opponent, rating delta) in sport-color committed design. Card is shareable to Instagram, Facebook, WhatsApp via native OS share sheet. Generates server-side og:image for social preview. Users tap "Share Victory" immediately after reporting match score.

---

## Primary User Action

Report match score → see card → tap "Share Victory" → native share sheet opens → select social app → card + link posted to friend's feed → friend sees winner's achievement + "Join VENLAX" CTA → friend joins → viral loop closes.

---

## Design Direction

**Color Strategy:** Committed. Sport color (emerald for Tennis, orange for Pickleball, blue for Cricket) fills 40-50% of card. Not playful, measured competitive tone.

**Theme Scene:** Player just won 6-4, 4-6, 6-4 on a sunny court. Walks to sideline between sets, checks phone. Sees card confirming the win + rating jump. Taps share to tell their crew. Mood: proud, focused, want to mark the moment.

**Anchor References:** Apple Health activity card (clean data hierarchy, sport-color accent), Strava activity feed (measured achievement tone, rating numbers prominent), tennis score cards (clarity on opponent + result).

---

## Scope

- **Fidelity:** Production-ready
- **Breadth:** Single card surface + share flow (entry → card view → native share)
- **Interactivity:** Card is static visual. Share button triggers OS sheet. Deep link pre-fills social apps with card image + VENLAX referral URL.
- **Time intent:** Ship in this sprint

---

## Layout Strategy

Card is 1080×1350px (Instagram story aspect, safe for all socials). Vertical stack:
- Sport icon/logo top (16px margin)
- Winner name (Sora 48px, weight 700)
- vs. opponent (gray label + opponent name)
- Match score (Sora 56px bold)
- Rating delta (Sora 32px, emerald or orange)
- Timestamp (DM Sans 12px, gray)
- VENLAX watermark + "Join VENLAX" small link (12px) bottom

Emphasis hierarchy: name → score → delta. Opponent secondary. Time/branding minimal. Sport color as background wash or accent bar (right edge or top bar).

---

## Key States

| State | Content | Tone |
|-------|---------|------|
| Default (tennis) | Winner card, emerald dominant, clear hierarchy | Measured achievement |
| Default (pickleball) | Winner card, orange dominant | Measured achievement |
| Loading | Skeleton placeholder (sport color shimmer) | Neutral |
| Error | "Couldn't generate card" + "Try again" button | Supportive |
| Shared preview (social) | og:image renders, og:title = "Winner: [Name] beat [Opponent]" | Shareable |

---

## Interaction Model

User flow:
1. Match report form (existing) → user submits score
2. Card view (new) displayed full-screen or modal
3. "Share Victory" CTA at bottom
4. Tap → native iOS/Android share sheet
5. User selects app (Instagram, FB, WhatsApp, etc.)
6. Deep link opens app + pre-fills post with card image + referral URL
7. User hits post. Friend sees card + "Join VENLAX" link.

No micro-animations required (card appears instantly). Share button scales on tap (standard mobile feedback).

---

## Content Requirements

**Copy:**
- "Share Victory" (button label)
- Winner name (dynamic, from match record)
- Opponent name (dynamic)
- Score (e.g., "6-4, 4-6, 6-4") — formatted from match data
- Rating delta (e.g., "+47") — calculated ELO
- Timestamp (e.g., "Sept 4, 2:30 PM")
- Watermark: "VENLAX Sports" + sport-specific tagline (e.g., "Ranked Tennis" for Tennis)

**Dynamic data sources:**
- Match record (winner, opponent, score, timestamp)
- ELO delta (from rating_utils calculation)
- Sport ID (tennis/pickleball/cricket) → color mapping
- User avatar (optional, or use initials)

**Shareable URL:** Backend generates short URL (e.g., venlax.app/m/abc123) that embeds og:image (pre-rendered card image), og:title, og:description.

**Rendering:** Server-side (backend generates og:image at share time, or pre-generates when score is submitted). No client-side image generation (perf + reliability).

---

## Recommended References

- spatial-design.md (vertical card hierarchy, emphasis through scale + color)
- motion-design.md (card entry animation, loading state)
- interaction-design.md (share flow, native OS integration)

---

## Approval

**User Approval:** ✅ 2026-09-04
**Brief Status:** Locked. Ready for Phase 3 (Eng Review) + implementation.
