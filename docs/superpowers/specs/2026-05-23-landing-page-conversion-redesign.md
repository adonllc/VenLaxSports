# Landing Page Conversion Redesign — Spec

**Date:** 2026-05-23  
**Scope:** PreLaunch.jsx (pre-launch waitlist page at venlaxsports.com)  
**Approach:** B — Copy + Conversion Lift  
**File:** `frontend/src/pages/PreLaunch.jsx`

---

## Goals

1. Increase waitlist signup conversion rate
2. Capture skill level data for better league placement
3. Add referral loop to drive organic signups after submission
4. Add pricing transparency so players set correct expectations
5. Answer common objections before they kill the signup
6. Make the features section look like a real product, not a placeholder

---

## 1. Copy Rewrites

### Hero

**Headline (current):** "Play Ranked. Rise Fast. Own Your City's Courts."  
**Headline (new):** "Stop Hunting for Good Matches. Play in a Real League."

**Subheadline (current):** "VENLAX Sports brings competitive Tennis and Pickleball leagues to your city — real rankings, smart matchmaking, and players who actually show up."  
**Subheadline (new):** "VENLAX runs competitive Tennis and Pickleball leagues in your city — real rankings, skill-matched opponents, and players who actually show up."

Rationale: leads with the pain (hunting for matches) before the solution.

### Trust Bar

Replace 5 generic checkmarks with benefit-specific, pricing-anchored claims:

- ✓ $9.99/season — less than one court rental
- ✓ Placed by skill — no sandbaggers, no mismatches
- ✓ Flexible scheduling — you set match times with your opponent
- ✓ Official VENLAX city ranking after every match
- ✓ Tennis + Pickleball on one profile

### Social Proof Section

**Remove:** "2 Sports", "City-Based", "2026" stats (descriptions, not proof).

**Replace stats with:**
- **$9.99** — entry fee per season
- **7 days** — per match round, you pick the time
- **ELO-based** — ranking system, not vibes

**Testimonial:** Replace anonymous quote with more credible framing:
> "Finally a league that doesn't require a $2,000 club membership."  
> — Tennis player, 34, Austin TX

### Step 3 Copy

**Current:** "Win matches. Climb the city rankings. Build your VENLAX legacy."  
**New:** "Win matches. Climb the city leaderboard. Your ranking follows you."

---

## 2. Form + Conversion Changes

### Skill Level Picker (new field)

Add between sport selector and submit button:

```
How would you describe your level?
[ Beginner ]  [ Intermediate ]  [ Advanced ]  [ Competitive ]
```

- Default: "Intermediate" pre-selected (optional — don't block submission)
- Captured as `skill_level` field in POST `/api/waitlist` payload
- Backend model update: add optional `skill_level: str` to waitlist document

### City Urgency Line

Static line above submit button:
> "Austin is filling fast — be first in line when we open."

Implementation: hardcode "Austin" for now. Future: inject city name from form input after user types 3+ chars.

### CTA Button Copy

**Current:** "Claim My Early Access"  
**New:** "Secure My Early Access Spot"

### Post-Signup Confirmation Screen

**Current:**
```
🎾
You're on the list.
We'll notify you the moment your city opens. Watch your inbox.
```

**New:**
```
You're on the early access list.
We'll notify you the moment [city] opens.

── Move up the list ─────────────────────────────
Invite players from your city. Every friend who joins 
from your link moves you one spot higher.

[Copy invite link]  [Share on WhatsApp]  [Share via Email]
```

**Referral link format:** `https://venlaxsports.com/?ref={waitlist_id}`

**WhatsApp share text (pre-filled):**
> "I'm getting early access to VENLAX — competitive Tennis/Pickleball leagues in our city. Join me: [link]"

**Implementation notes:**
- Backend: `POST /api/waitlist` response includes `waitlist_id` (MongoDB `_id` as hex string)
- Frontend: construct ref URL from returned `waitlist_id`
- Referral tracking: on new waitlist signup, if `?ref=` param present, store `referred_by: waitlist_id` on the new document
- No referral rewards backend needed yet — just capture the data

---

## 3. New Section: Pricing

**Placement:** Between Features zig-zag and How It Works.

```
Simple pricing. No club fees. No surprises.

┌─────────────────────┐  ┌─────────────────────┐
│   Singles League    │  │   Doubles League    │
│   $9.99 / season   │  │  $19.99 / season    │
│     per player      │  │     per team        │
└─────────────────────┘  └─────────────────────┘

Included in every league:
• Full round-robin schedule
• Official VENLAX city ranking
• Score tracking + match history
• Email confirmations for every match

Early access members lock in these prices for life.
```

**Founding member benefits** (below pricing cards):
- Founding member badge on public profile
- Priority placement when your city opens
- Current season pricing locked in forever

---

## 4. New Section: FAQ

**Placement:** Between Social Proof and Final CTA.

Collapsed accordion. 6 questions:

1. **How are matches scheduled?**  
   You and your opponent coordinate directly. VENLAX gives you 7 days per match round. No mandatory court times.

2. **What skill level is right for me?**  
   We place you by self-reported level, then adjust your ELO ranking after each match. You'll always play people close to your level.

3. **What if no one is in my city yet?**  
   You're on the list. When enough players sign up in your city for a division, we open it and notify you first.

4. **Is there a mobile app?**  
   Web-first now. Mobile app coming in late 2026.

5. **What does the entry fee cover?**  
   League organization, rankings, scheduling, score tracking, and email coordination for the full season.

6. **Can I play both Tennis and Pickleball?**  
   Yes. One profile, separate rankings per sport. Register for each league individually.

---

## 5. Features Section: Visual Fix

**Current:** Emoji placeholder boxes (giant 🎾 / 🏓 emojis in colored divs).

**New:** Styled app mockup cards — pure Tailwind divs, no images needed.

| Feature | Mockup content |
|---|---|
| Smart Matchmaking | Player card: avatar initial, name, rating badge (e.g. "1847"), green "Opponent Found" chip |
| Live City Rankings | Mini leaderboard: rank # / player name / W-L record / rating, top 5 rows |
| Flexible League Formats | Match schedule card: "Round 3 of 6 — vs John D. — Due May 30 — [Report Score]" |
| Two Sports. One Profile | Profile card: two sport blocks side by side — Tennis ELO + Pickleball ELO |

Cards use same card design as rest of app (white bg, 1px border, rounded-xl).

---

## Backend Changes

| Change | File | Notes |
|---|---|---|
| Add `skill_level` field | `backend/routes/league_routes.py` or dedicated `waitlist_routes.py` | Optional str, store as-is |
| Return `waitlist_id` in response | Same | Hex string of MongoDB `_id` |
| Capture `referred_by` on signup | Same | Store if `?ref=` param present in request |

---

## Frontend Changes

| Change | File |
|---|---|
| Hero headline + subhead | `PreLaunch.jsx` |
| Trust bar copy | `PreLaunch.jsx` |
| Social proof stats + testimonial | `PreLaunch.jsx` |
| Step 3 copy | `PreLaunch.jsx` |
| Skill level picker (new) | `PreLaunch.jsx` |
| City urgency line | `PreLaunch.jsx` |
| CTA button copy | `PreLaunch.jsx` |
| Post-signup referral screen | `PreLaunch.jsx` |
| Pricing section (new) | `PreLaunch.jsx` |
| FAQ accordion (new) | `PreLaunch.jsx` |
| Feature mockup cards | `PreLaunch.jsx` |

All changes in one file. No new components needed.

---

## Out of Scope

- Post-launch home page redesign (separate spec)
- Real city waitlist counts from DB
- Mobile app
- Full referral reward system (points, leaderboard)
- Video hero
- Photography/real screenshots
