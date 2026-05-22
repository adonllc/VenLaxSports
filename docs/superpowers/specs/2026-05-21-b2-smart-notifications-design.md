# B2 — Smart Notifications Design Spec
**Date:** 2026-05-21  
**Status:** Approved  
**Goal:** Fill league registrations faster by notifying interested players the moment a new season opens.

---

## Problem

New season registrations fill slowly because players don't know a league opened. There's no mechanism to capture interest or push timely alerts.

---

## Approach: Event-Triggered Sequence

Four automated notification triggers per league:

| # | Trigger | Channels | When |
|---|---------|----------|------|
| 1 | Season opens (status=registration) | Email + Push | Immediately on league creation |
| 2 | League hits 50% capacity | Push only | On player join that crosses 50% |
| 3 | League hits 80% capacity | Email + Push | On player join that crosses 80% |
| 4 | League full (max_players reached) | Email + Push | On final player join |

Trigger 1 fires in `league_routes.py` `POST /leagues` (on league creation).  
Triggers 2–4 fire in `league_routes.py` `POST /leagues/:id/join` (on each player join).  
No background job required.

---

## Channels

- **Email** — existing `email_service.py` infrastructure. 4 new template functions.
- **PWA Push** — browser Push API via `pywebpush`. VAPID key pair. Service worker at `/sw.js`.

---

## Audience

Players are notified if they appear in `notification_interests` matching the league's `city` + `sport` and have not unsubscribed.

Interest is captured via:
1. "Notify Me" banner on CityLeaderboard when no open leagues exist
2. Bell icon in page header for proactive subscription at any time
3. Waitlist entry when a league is full

---

## Data Model

### `notification_interests` collection
```python
{
  "_id": ObjectId,
  "user_id": str | None,        # None for anonymous email captures
  "email": str,                  # always required
  "city": str,                   # e.g. "New York"
  "sport": str,                  # e.g. "tennis"
  "channels": List[str],         # ["email", "push"]
  "created_at": datetime,
  "unsubscribed_at": datetime | None
}
```

### `push_subscriptions` collection
```python
{
  "_id": ObjectId,
  "user_id": str,
  "endpoint": str,
  "keys": {"p256dh": str, "auth": str},
  "user_agent": str,
  "created_at": datetime,
  "last_used_at": datetime | None
}
```

### Indexes (add to `seeds/create_indexes.py`)
```python
await db.notification_interests.create_index([("city", 1), ("sport", 1)])
await db.notification_interests.create_index([("email", 1)])
await db.push_subscriptions.create_index([("user_id", 1)])
```

### Existing `users` collection
No schema changes. Existing `email_notifications` field acts as master kill switch — if `False`, skip all sends for that user.

### New env vars (add to `.env.usa` + Coolify)
```
VAPID_PRIVATE_KEY=
VAPID_PUBLIC_KEY=
VAPID_CLAIMS_EMAIL=hello@venlaxsports.com
```

---

## Backend

### New route file: `backend/routes/notification_routes.py`

```
POST /api/notifications/subscribe
  Body: { city, sport, channels, email? }
  Auth: optional (user_id from cookie if present)
  Creates notification_interests record.

POST /api/notifications/push-subscription
  Body: { endpoint, keys }
  Auth: required
  Stores push_subscriptions record for logged-in user.

DELETE /api/notifications/unsubscribe?token=<signed_token>
  Auth: none (one-click unsubscribe from email)
  Marks notification_interests.unsubscribed_at = now()
```

### Trigger helper: `backend/notification_dispatch.py`

```python
async def dispatch_season_open(db, league: dict) -> None
async def dispatch_filling_fast(db, league: dict) -> None   # push only
async def dispatch_last_spots(db, league: dict) -> None
async def dispatch_waitlist_open(db, league: dict) -> None
```

Each function:
1. Queries `notification_interests` for `{city, sport, unsubscribed_at: null}`
2. Skips users with `email_notifications=False`
3. Sends email via `email_service` + push via `pywebpush`
4. Dead push subscriptions (410 Gone from browser) → delete from `push_subscriptions`

Called from `league_routes.py` after player join updates `current_players`.

### Email templates (add to `email_service.py`)
```python
send_season_open(email, name, city, sport, league_name, join_url)
send_last_spots(email, name, city, sport, spots_left, join_url)
send_waitlist_open(email, name, city, sport, waitlist_url)
```

---

## Frontend

### 1. Notify Me Entry Points

**A. Inline banner** — shown on `CityLeaderboard` + `SportLanding` when zero open registration leagues exist:
```jsx
<NotifyMeBanner city={city} sport={sport} />
```
Emerald border card: "No open leagues right now — notify me when one opens" + "Notify Me" button.

**B. Bell icon** — persistent in page header of CityLeaderboard + SportLanding. Always visible. Clicking it triggers the same subscribe flow.

### 2. Subscribe Flow

**Logged-in user:** single click → `POST /api/notifications/subscribe` → toast "You're on the list!" → browser push permission prompt (`Notification.requestPermission()`). If granted → `POST /api/notifications/push-subscription`.

**Guest:** clicking "Notify Me" opens a small modal:
- Email input field
- "Get Notified" button
- "No account needed. Unsubscribe anytime." microcopy
- On submit → `POST /api/notifications/subscribe` (no user_id) → success state in modal

### 3. Service Worker (`public/sw.js`)
```js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/logo192.png',
    data: { url: data.url }
  });
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  clients.openWindow(event.notification.data.url);
});
```

Register in `frontend/src/index.js` after app mount.

### 4. Notification Settings (PlayerDashboard — Settings tab)

Inline section appended to existing Settings tab:

```
Notifications
─────────────
Email notifications        [toggle — existing field]
Push notifications         [toggle — calls DELETE push-subscription or requestPermission]

Subscribed cities
  🎾 Tennis — New York    [Remove]
  🏓 Pickleball — New York [Remove]
```

---

## Notification Copy

| Trigger | Email subject | Push text |
|---------|--------------|-----------|
| Season opens | "New York Tennis is open — grab your spot" | "🎾 NY Tennis Season 2 just opened. Join now →" |
| 50% full | — (no email) | "🎾 NY Tennis is half full. Don't miss out →" |
| 80% full | "Only 3 spots left in New York Tennis" | "⚡ 3 spots left in NY Tennis. Last chance →" |
| Full / waitlist | "New York Tennis is full — you're on the waitlist" | "🔔 NY Tennis is full. You're on the waitlist →" |

All push notifications link directly to the league `/join` page.  
All emails contain a one-click unsubscribe link in the footer (no login required).

---

## Error Handling

- **Dead push endpoint** (410 response from browser): delete `push_subscriptions` record silently.
- **Email send failure**: log + continue. Never raise 500 or block the join flow.
- **Push permission denied**: degrade silently to email-only. No error shown.
- **Anonymous subscribe, user later registers**: on registration, match email → link `user_id` to existing `notification_interests` record.

---

## Out of Scope (this spec)

- Match reminders, score prompts, challenge notifications — separate spec (B1 match chat)
- Post-season re-engagement sequences — Phase 2 of notifications
- SMS channel — deferred until user base validates push ROI
- In-app notification bell/inbox — deferred

---

## Implementation Order

1. `notification_dispatch.py` + email templates
2. `notification_routes.py` (subscribe, push-subscription, unsubscribe)
3. Service worker + push registration in frontend
4. `NotifyMeBanner` component + bell icon
5. Subscribe modal (guest flow)
6. Settings tab additions
7. Wire triggers into `league_routes.py`
8. Indexes seed
9. VAPID keys + env vars in Coolify
