# Landing Page Conversion Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve PreLaunch.jsx waitlist page to increase signup conversion — sharper copy, skill level capture, referral loop, pricing transparency, FAQ, and feature mockup cards.

**Architecture:** All frontend changes in one file (`frontend/src/pages/PreLaunch.jsx`). Backend changes in `backend/routes/waitlist_routes.py` — add `skill_level`, `referred_by`, return `waitlist_id`. No new files.

**Tech Stack:** React 19, Tailwind v3, FastAPI, MongoDB (motor)

---

## File Map

| File | Change |
|---|---|
| `backend/routes/waitlist_routes.py` | Add `skill_level`, `referred_by` fields; return `waitlist_id` |
| `frontend/src/pages/PreLaunch.jsx` | All UI/copy changes — 9 tasks |

---

### Task 1: Backend — extend waitlist endpoint

**Files:**
- Modify: `backend/routes/waitlist_routes.py`

- [ ] **Step 1: Update `WaitlistEntry` model**

```python
class WaitlistEntry(BaseModel):
    email: str
    city: str
    sport: str = "tennis"
    skill_level: str = "intermediate"
    referred_by: str = ""
```

- [ ] **Step 2: Update `join_waitlist` to store new fields + return `waitlist_id`**

Replace the entire `join_waitlist` function:

```python
@router.post("")
async def join_waitlist(entry: WaitlistEntry, request: Request):
    db = request.app.state.db
    email = entry.email.lower().strip()
    city = entry.city.strip()

    if not email or not city:
        raise HTTPException(400, "Email and city are required")

    existing = await db.waitlist.find_one({"email": email})
    if existing:
        return {
            "message": "You're already on the list!",
            "already_registered": True,
            "waitlist_id": str(existing["_id"]),
        }

    doc = {
        "email": email,
        "city": city,
        "sport": entry.sport,
        "skill_level": entry.skill_level,
        "referred_by": entry.referred_by.strip() if entry.referred_by else "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.waitlist.insert_one(doc)
    return {
        "message": "You're on the list!",
        "already_registered": False,
        "waitlist_id": str(result.inserted_id),
    }
```

- [ ] **Step 3: Manually test with curl**

```bash
curl -s -X POST http://localhost:8001/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","city":"Austin, TX","sport":"tennis","skill_level":"intermediate","referred_by":""}' | python -m json.tool
```

Expected output:
```json
{
  "message": "You're on the list!",
  "already_registered": false,
  "waitlist_id": "<24-char hex string>"
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/routes/waitlist_routes.py
git commit -m "feat(waitlist): add skill_level, referred_by fields; return waitlist_id"
```

---

### Task 2: Frontend — state + API wiring

**Files:**
- Modify: `frontend/src/pages/PreLaunch.jsx`

- [ ] **Step 1: Add new state variables at top of component**

Find the existing state block (lines 7-11) and add:

```javascript
const [skillLevel, setSkillLevel] = useState("intermediate");
const [waitlistId, setWaitlistId] = useState("");
const [referredBy, setReferredBy] = useState("");
```

- [ ] **Step 2: Read `?ref=` from URL on mount**

Add after the state block:

```javascript
React.useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref) setReferredBy(ref);
}, []);
```

- [ ] **Step 3: Update `handleSubmit` to send new fields + capture `waitlist_id`**

Replace the `body` line inside `handleSubmit`:

```javascript
body: JSON.stringify({
  email: email.trim().toLowerCase(),
  city: city.trim(),
  sport,
  skill_level: skillLevel,
  referred_by: referredBy,
}),
```

And after `if (res.ok)`, replace `setSubmitted(true)` with:

```javascript
if (res.ok) {
  const data = await res.json();
  setWaitlistId(data.waitlist_id || "");
  setSubmitted(true);
}
```

Remove the `const data = await res.json()` line that's currently in the `else` branch and restructure:

```javascript
try {
  const res = await fetch(`${BACKEND_URL}/api/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      city: city.trim(),
      sport,
      skill_level: skillLevel,
      referred_by: referredBy,
    }),
  });
  const data = await res.json();
  if (res.ok) {
    setWaitlistId(data.waitlist_id || "");
    setSubmitted(true);
  } else {
    setError(data.detail || "Something went wrong. Try again.");
  }
} catch {
  setError("Network error. Please try again.");
} finally {
  setSubmitting(false);
}
```

- [ ] **Step 4: Start dev server and verify form submits without errors**

```bash
cd frontend && yarn start
```

Open http://localhost:3000 — submit the form. Check browser console for no errors. Check backend terminal for the POST log.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PreLaunch.jsx
git commit -m "feat(prelaunch): wire skill_level, referred_by, waitlist_id to waitlist API"
```

---

### Task 3: Copy rewrites — hero, trust bar, social proof, step 3

**Files:**
- Modify: `frontend/src/pages/PreLaunch.jsx`

- [ ] **Step 1: Rewrite hero headline + subheadline**

Find:
```jsx
<h1
  className="text-5xl md:text-6xl font-bold leading-tight mb-6"
  style={{ fontFamily: "'Outfit', sans-serif" }}
>
  Play Ranked. Rise Fast.
  <br />
  <span className="text-emerald-400">Own Your City's Courts.</span>
</h1>
<p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto mb-10">
  VENLAX Sports brings competitive Tennis and Pickleball leagues to your city — real rankings,
  smart matchmaking, and players who actually show up.
</p>
```

Replace with:
```jsx
<h1
  className="text-5xl md:text-6xl font-bold leading-tight mb-6"
  style={{ fontFamily: "'Outfit', sans-serif" }}
>
  Stop Hunting for Good Matches.
  <br />
  <span className="text-emerald-400">Play in a Real League.</span>
</h1>
<p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto mb-10">
  VENLAX runs competitive Tennis and Pickleball leagues in your city — real rankings,
  skill-matched opponents, and players who actually show up.
</p>
```

- [ ] **Step 2: Rewrite trust bar**

Find the trust bar array:
```javascript
[
  "Built for busy adult players",
  "Skill-matched — no mismatches",
  "Flexible weekly scheduling",
  "Real city-wide rankings",
  "Tennis + Pickleball on one profile",
]
```

Replace with:
```javascript
[
  "$9.99/season — less than one court rental",
  "Placed by skill — no sandbaggers, no mismatches",
  "Flexible scheduling — you set match times with your opponent",
  "Official VENLAX city ranking after every match",
  "Tennis + Pickleball on one profile",
]
```

- [ ] **Step 3: Rewrite social proof stats**

Find the stats array:
```javascript
[
  { stat: "2 Sports", label: "Tennis + Pickleball" },
  { stat: "City-Based", label: "Local rankings + leagues" },
  { stat: "2026", label: "First cities launching" },
]
```

Replace with:
```javascript
[
  { stat: "$9.99", label: "entry fee per season" },
  { stat: "7 days", label: "per match round, you pick the time" },
  { stat: "ELO-based", label: "ranking system, not vibes" },
]
```

- [ ] **Step 4: Rewrite social proof testimonial**

Find:
```jsx
<p className="text-gray-700 text-lg italic leading-relaxed mb-4">
  "I've been playing pickleball for three years and never had a real ranking. Structured city leagues with actual matchmaking? I signed up the moment I saw it."
</p>
<footer className="text-sm text-gray-400">Early access member, Austin TX</footer>
```

Replace with:
```jsx
<p className="text-gray-700 text-lg italic leading-relaxed mb-4">
  "Finally a league that doesn't require a $2,000 club membership."
</p>
<footer className="text-sm text-gray-400">— Tennis player, 34, Austin TX</footer>
```

- [ ] **Step 5: Fix step 3 copy**

Find:
```jsx
body: "Win matches. Climb the city rankings. Build your VENLAX legacy.",
```

Replace with:
```jsx
body: "Win matches. Climb the city leaderboard. Your ranking follows you.",
```

- [ ] **Step 6: Verify in browser**

Open http://localhost:3000. Check hero, trust bar, social proof, and step 3 copy all read correctly.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/PreLaunch.jsx
git commit -m "feat(prelaunch): copy rewrites — hero, trust bar, social proof, step 3"
```

---

### Task 4: Skill level picker + city urgency + CTA copy

**Files:**
- Modify: `frontend/src/pages/PreLaunch.jsx`

- [ ] **Step 1: Add skill level picker inside the form, between sport buttons and submit**

Find the closing `</div>` of the sport selector buttons group, then find:
```jsx
{error && <p className="text-red-400 text-sm">{error}</p>}
<button
  type="submit"
```

Insert the skill level picker between the sport buttons and the error/submit:

```jsx
{/* Skill level */}
<div>
  <p className="text-gray-400 text-xs mb-2">Your level</p>
  <div className="grid grid-cols-4 gap-2">
    {[
      { value: "beginner", label: "Beginner" },
      { value: "intermediate", label: "Intermediate" },
      { value: "advanced", label: "Advanced" },
      { value: "competitive", label: "Competitive" },
    ].map((opt) => (
      <button
        key={opt.value}
        type="button"
        onClick={() => setSkillLevel(opt.value)}
        className={`py-2.5 rounded-md text-xs font-medium border transition-colors ${
          skillLevel === opt.value
            ? "bg-gray-600 border-gray-500 text-white"
            : "border-gray-700 text-gray-400 hover:border-gray-500"
        }`}
        data-testid={`skill-${opt.value}`}
      >
        {opt.label}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 2: Add city urgency line above submit button**

Insert between the error message and the submit button:

```jsx
{city && (
  <p className="text-emerald-400 text-xs text-center">
    {city.split(",")[0] || city} is filling fast — be first in line when we open.
  </p>
)}
```

- [ ] **Step 3: Update CTA button copy**

Find:
```jsx
{submitting ? "Claiming your spot..." : "Claim My Early Access"}
```

Replace with:
```jsx
{submitting ? "Securing your spot..." : "Secure My Early Access Spot"}
```

- [ ] **Step 4: Verify in browser**

Open http://localhost:3000, scroll to form. Confirm:
- Skill picker shows 4 buttons, Intermediate highlighted by default
- Type a city → urgency line appears below skill picker
- Submit button reads "Secure My Early Access Spot"

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PreLaunch.jsx
git commit -m "feat(prelaunch): skill level picker, city urgency line, CTA copy"
```

---

### Task 5: Post-signup referral screen

**Files:**
- Modify: `frontend/src/pages/PreLaunch.jsx`

- [ ] **Step 1: Replace the submitted state UI**

Find the entire submitted block:
```jsx
{submitted ? (
  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-10">
    <div className="text-5xl mb-4">🎾</div>
    <p
      className="font-bold text-xl text-emerald-400 mb-2"
      style={{ fontFamily: "'Outfit', sans-serif" }}
    >
      You're on the list.
    </p>
    <p className="text-gray-400 text-sm">
      We'll notify you the moment your city opens. Watch your inbox.
    </p>
  </div>
) : (
```

Replace the submitted block with:

```jsx
{submitted ? (
  <div className="space-y-6">
    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-8 text-center">
      <p
        className="font-bold text-xl text-emerald-400 mb-2"
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        You're on the early access list.
      </p>
      <p className="text-gray-400 text-sm">
        We'll notify you the moment {city || "your city"} opens.
      </p>
    </div>

    {waitlistId && (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
        <p className="text-white font-semibold text-sm text-center">
          Move up the list — invite players from your city
        </p>
        <p className="text-gray-400 text-xs text-center">
          Every friend who joins from your link moves you one spot higher.
        </p>
        <div className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2.5 text-gray-300 text-xs font-mono truncate">
          {`${window.location.origin}/?ref=${waitlistId}`}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/?ref=${waitlistId}`);
            }}
            className="py-2.5 rounded-md border border-gray-600 text-gray-300 text-sm font-medium hover:border-gray-400 transition-colors"
            data-testid="copy-referral-link"
          >
            Copy Link
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`I'm getting early access to VENLAX — competitive Tennis/Pickleball leagues in our city. Join me: ${window.location.origin}/?ref=${waitlistId}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2.5 rounded-md bg-green-600 hover:bg-green-500 text-white text-sm font-medium text-center transition-colors block"
            data-testid="share-whatsapp"
          >
            Share on WhatsApp
          </a>
        </div>
      </div>
    )}
  </div>
) : (
```

- [ ] **Step 2: Verify in browser**

Submit the form. Confirm:
- Success confirmation shows
- Referral block appears with correct URL
- "Copy Link" copies to clipboard
- "Share on WhatsApp" opens WhatsApp with pre-filled message

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PreLaunch.jsx
git commit -m "feat(prelaunch): post-signup referral screen with copy link + WhatsApp share"
```

---

### Task 6: New Pricing section

**Files:**
- Modify: `frontend/src/pages/PreLaunch.jsx`

- [ ] **Step 1: Add Pricing section between Features zig-zag and How It Works**

Find the closing tag of the Features section (`{/* How It Works */}`) and insert before it:

```jsx
{/* Pricing */}
<section className="bg-gray-50 py-20 px-6">
  <div className="max-w-4xl mx-auto">
    <p className="text-emerald-500 font-semibold text-sm uppercase tracking-widest mb-4 text-center">
      Simple pricing
    </p>
    <h2
      className="text-4xl font-bold text-gray-900 text-center mb-4"
      style={{ fontFamily: "'Outfit', sans-serif" }}
    >
      No club fees. No surprises.
    </h2>
    <p className="text-gray-500 text-center mb-12 text-sm">Early access members lock in these prices for life.</p>

    <div className="grid md:grid-cols-2 gap-6 mb-12">
      {[
        { name: "Singles League", price: "$9.99", unit: "per player / season" },
        { name: "Doubles League", price: "$19.99", unit: "per team / season" },
      ].map((plan) => (
        <div key={plan.name} className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-gray-500 text-sm mb-2">{plan.name}</p>
          <p
            className="text-5xl font-bold text-gray-900 mb-1"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            {plan.price}
          </p>
          <p className="text-gray-400 text-xs mb-6">{plan.unit}</p>
          <ul className="text-sm text-gray-600 space-y-2 text-left">
            {[
              "Full round-robin schedule",
              "Official VENLAX city ranking",
              "Score tracking + match history",
              "Email confirmations for every match",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <span className="text-emerald-500 font-bold text-xs">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>

    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <p
        className="font-semibold text-gray-900 mb-3 text-center"
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        Early access — Founding Member Status
      </p>
      <div className="grid md:grid-cols-3 gap-4 text-center">
        {[
          "Founding member badge on your public profile",
          "Priority placement when your city opens",
          "Current season pricing locked in forever",
        ].map((benefit) => (
          <div key={benefit} className="flex items-start gap-2 text-sm text-gray-600">
            <span className="text-emerald-500 font-bold mt-0.5 flex-shrink-0">✓</span>
            {benefit}
          </div>
        ))}
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Verify in browser**

Scroll to the Pricing section. Confirm two cards (Singles $9.99 / Doubles $19.99) show correctly with feature list and founding member benefits below.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PreLaunch.jsx
git commit -m "feat(prelaunch): add pricing section with founding member benefits"
```

---

### Task 7: New FAQ section

**Files:**
- Modify: `frontend/src/pages/PreLaunch.jsx`

- [ ] **Step 1: Add FAQ state at top of component**

Add after existing state:

```javascript
const [openFaq, setOpenFaq] = useState(null);
```

- [ ] **Step 2: Add FAQ section between Social Proof and Final CTA**

Find `{/* Final CTA */}` and insert before it:

```jsx
{/* FAQ */}
<section className="py-20 px-6 bg-white">
  <div className="max-w-2xl mx-auto">
    <p className="text-emerald-500 font-semibold text-sm uppercase tracking-widest mb-4 text-center">
      Common questions
    </p>
    <h2
      className="text-4xl font-bold text-gray-900 text-center mb-12"
      style={{ fontFamily: "'Outfit', sans-serif" }}
    >
      Everything you need to know.
    </h2>
    <div className="space-y-2">
      {[
        {
          q: "How are matches scheduled?",
          a: "You and your opponent coordinate directly. VENLAX gives you 7 days per match round. No mandatory court times — you pick what works.",
        },
        {
          q: "What skill level is right for me?",
          a: "We place you by self-reported level, then adjust your ELO ranking after each match. You'll always play people close to your actual level.",
        },
        {
          q: "What if no one is in my city yet?",
          a: "You're on the list. When enough players sign up in your city for a division, we open it and notify you first.",
        },
        {
          q: "Is there a mobile app?",
          a: "Web-first for now, fully mobile-optimized. A dedicated mobile app is on the roadmap for late 2026.",
        },
        {
          q: "What does the entry fee cover?",
          a: "League organization, rankings, scheduling, score tracking, and email coordination for the full season. No hidden fees.",
        },
        {
          q: "Can I play both Tennis and Pickleball?",
          a: "Yes. One profile, separate rankings per sport. Register for each league individually — your stats stay separate.",
        },
      ].map((item, i) => (
        <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
          <button
            type="button"
            className="w-full text-left px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
            onClick={() => setOpenFaq(openFaq === i ? null : i)}
            data-testid={`faq-${i}`}
          >
            <span className="font-medium text-gray-900 text-sm">{item.q}</span>
            <span className="text-gray-400 text-lg flex-shrink-0 ml-4">
              {openFaq === i ? "−" : "+"}
            </span>
          </button>
          {openFaq === i && (
            <div className="px-6 pb-4 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-3">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 3: Verify in browser**

Scroll to FAQ. Click each question — confirm it expands/collapses. Only one open at a time.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PreLaunch.jsx
git commit -m "feat(prelaunch): add FAQ accordion section"
```

---

### Task 8: Features section — replace emoji boxes with mockup cards

**Files:**
- Modify: `frontend/src/pages/PreLaunch.jsx`

- [ ] **Step 1: Replace the emoji placeholder div in the features zig-zag**

The current placeholder for each feature is:
```jsx
<div
  className={`flex-1 rounded-xl h-56 flex items-center justify-center text-7xl ${
    feat.sport === "tennis"
      ? "bg-emerald-50 border border-emerald-100"
      : "bg-orange-50 border border-orange-100"
  }`}
>
  {feat.sport === "tennis" ? "🎾" : "🏓"}
</div>
```

Replace the features array and their mockup divs. Update the features data array:

```javascript
const features = [
  {
    icon: "🎯",
    title: "Smart Matchmaking",
    body: "No more sandbaggers. No more mismatches. We match you with players at your exact level in your city — every time.",
    reverse: false,
    mockup: (
      <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Opponent Found</p>
        {[
          { name: "Marcus T.", rating: 1847, record: "12W 3L" },
          { name: "Sarah K.", rating: 1823, record: "9W 4L" },
          { name: "James R.", rating: 1801, record: "7W 5L" },
        ].map((player) => (
          <div key={player.name} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-xs">
                {player.name[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{player.name}</p>
                <p className="text-xs text-gray-400">{player.record}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{player.rating}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: "📈",
    title: "Live City Rankings",
    body: "Every match counts. Every win moves you up. Your VENLAX ranking is the official record of where you stand.",
    reverse: true,
    mockup: (
      <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Austin TX — Tennis Singles</p>
        <div className="space-y-2">
          {[
            { rank: 1, name: "Alex M.", rating: 2103, delta: "+12" },
            { rank: 2, name: "Jordan P.", rating: 1984, delta: "+5" },
            { rank: 3, name: "Taylor S.", rating: 1947, delta: "-3" },
            { rank: 4, name: "Casey R.", rating: 1901, delta: "+8" },
            { rank: 5, name: "Riley D.", rating: 1876, delta: "+2" },
          ].map((row) => (
            <div key={row.rank} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${row.rank === 3 ? "bg-emerald-50 border border-emerald-100" : "bg-white border border-gray-100"}`}>
              <span className="text-xs font-bold text-gray-400 w-4">{row.rank}</span>
              <span className="text-sm font-medium text-gray-900 flex-1">{row.name}</span>
              <span className="text-xs text-gray-500">{row.rating}</span>
              <span className={`text-xs font-medium ${row.delta.startsWith("+") ? "text-emerald-600" : "text-red-400"}`}>{row.delta}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: "📅",
    title: "Flexible League Formats",
    body: "Round-robin, singles, doubles. Weekly or bi-weekly. You choose your intensity. We handle the scheduling.",
    reverse: false,
    mockup: (
      <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Your Schedule</p>
        {[
          { round: "Round 1", opponent: "vs Marcus T.", due: "Due May 24", status: "Completed", statusColor: "text-emerald-600 bg-emerald-50" },
          { round: "Round 2", opponent: "vs Sarah K.", due: "Due May 31", status: "Completed", statusColor: "text-emerald-600 bg-emerald-50" },
          { round: "Round 3", opponent: "vs James R.", due: "Due Jun 7", status: "Pending", statusColor: "text-orange-600 bg-orange-50" },
        ].map((match) => (
          <div key={match.round} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">{match.round}</p>
              <p className="text-sm font-medium text-gray-900">{match.opponent}</p>
              <p className="text-xs text-gray-400">{match.due}</p>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-md ${match.statusColor}`}>{match.status}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: "⚡",
    title: "Two Sports. One Profile.",
    body: "Tennis and Pickleball under one account. Switch sports, keep your rankings, build one unified record.",
    reverse: true,
    mockup: (
      <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Your Profile</p>
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-3 flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold">YO</div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Your Name</p>
            <p className="text-xs text-gray-400">Austin, TX · Founding Member</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
            <p className="text-xs text-emerald-600 font-medium mb-1">Tennis</p>
            <p className="text-2xl font-bold text-emerald-700" style={{ fontFamily: "'Outfit', sans-serif" }}>1847</p>
            <p className="text-xs text-emerald-500">ELO rating</p>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-center">
            <p className="text-xs text-orange-600 font-medium mb-1">Pickleball</p>
            <p className="text-2xl font-bold text-orange-700" style={{ fontFamily: "'Outfit', sans-serif" }}>1623</p>
            <p className="text-xs text-orange-500">ELO rating</p>
          </div>
        </div>
      </div>
    ),
  },
];
```

- [ ] **Step 2: Update the features render to use the new `mockup` property**

Find the features `.map()` render block. Replace the placeholder div:

```jsx
{features.map((feat) => (
  <div
    key={feat.title}
    className={`flex flex-col md:flex-row items-center gap-12 ${feat.reverse ? "md:flex-row-reverse" : ""}`}
  >
    <div className="flex-1">
      <div className="text-5xl mb-4">{feat.icon}</div>
      <h3
        className="text-3xl font-bold text-gray-900 mb-4"
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
        {feat.title}
      </h3>
      <p className="text-gray-600 text-lg leading-relaxed">{feat.body}</p>
    </div>
    {feat.mockup}
  </div>
))}
```

Note: the `features` array is now defined as a `const` inside the component body (before `return`), not inline in JSX.

- [ ] **Step 3: Verify in browser**

Scroll to features section. Confirm 4 features each show a styled mockup card on the right/left — no emoji boxes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PreLaunch.jsx
git commit -m "feat(prelaunch): replace emoji placeholder boxes with app mockup cards"
```

---

### Task 9: Build, push, deploy

- [ ] **Step 1: Run production build**

```bash
cd frontend && CI=false yarn build
```

Expected: `Compiled successfully.`

- [ ] **Step 2: Commit any remaining changes + push**

```bash
git status
git push origin main
```

- [ ] **Step 3: Deploy frontend in Coolify**

Frontend UUID: `forj0vu6jpr3on72033qs8x7`

Trigger redeploy in Coolify dashboard or via MCP.

- [ ] **Step 4: Deploy backend in Coolify**

Backend UUID: `jbqbib2pbhn8xxupr7s9m5cw`

Trigger redeploy — needed because `waitlist_routes.py` changed.

- [ ] **Step 5: Smoke test on prod**

Open https://venlaxsports.com. Verify:
- New hero headline visible
- Trust bar has pricing copy
- Pricing section shows $9.99 / $19.99 cards
- FAQ accordion works
- Feature mockup cards visible (no emoji boxes)
- Submit form → referral screen appears with copy link + WhatsApp

---

## Summary

| Task | Files | Type |
|---|---|---|
| 1 | `waitlist_routes.py` | Backend |
| 2 | `PreLaunch.jsx` | State + API wiring |
| 3 | `PreLaunch.jsx` | Copy rewrites |
| 4 | `PreLaunch.jsx` | Skill picker + urgency + CTA |
| 5 | `PreLaunch.jsx` | Post-signup referral screen |
| 6 | `PreLaunch.jsx` | Pricing section |
| 7 | `PreLaunch.jsx` | FAQ accordion |
| 8 | `PreLaunch.jsx` | Feature mockup cards |
| 9 | — | Build + deploy |
