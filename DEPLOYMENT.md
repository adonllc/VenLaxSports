# Deploying VenLax Sports to www.venlaxsports.com

**Domain:** www.venlaxsports.com (DNS managed on Hostinger)  
**Deployment platform:** Coolify (self-hosted PaaS)  
**Stack:** React frontend + FastAPI backend + MongoDB

---

## Overview — Everything Runs on Coolify

Coolify handles your frontend, backend, database, SSL certificates, and reverse proxy — all from one dashboard.

| Part | Where | Notes |
|------|-------|-------|
| Database (MongoDB) | Coolify → Database resource | Or MongoDB Atlas |
| Backend (FastAPI) | Coolify → Application | Auto-detects Python via Nixpacks |
| Frontend (React) | Coolify → Application (Static) | `yarn build` → serve `build/` |
| SSL/HTTPS | Coolify (Let's Encrypt) | Automatic — no setup needed |
| Domain DNS | Hostinger → point to VPS IP | 3 A records |

---

## Before You Start

- Coolify running and connected to your VPS
- Your VPS public IP address
- GitHub repo with your code pushed to `main`
- Stripe live API key

---

## Step 1 — Point Your Domain to the VPS

In **Hostinger hPanel → Domains → your domain → DNS Zone**

Delete any existing A records, then add all three:

| Type | Name | Value |
|------|------|-------|
| `A` | `@` | `YOUR.VPS.IP.ADDRESS` |
| `A` | `www` | `YOUR.VPS.IP.ADDRESS` |
| `A` | `api` | `YOUR.VPS.IP.ADDRESS` |

Save. DNS takes 10 min – 24 hours to propagate.

---

## Step 2 — Create a Project in Coolify

1. Open Coolify dashboard
2. **Projects → New Project**
3. Name: `VenLax Sports` / Environment: `Production`

---

## Step 3 — Deploy MongoDB

1. Inside project → **New Resource → Database → MongoDB**
2. Set:
   - **Name:** `venlaxsports-db`
   - **Version:** 6 or 7
3. Click **Start**

After it starts, click the database → copy the **Internal Connection URL**:
```
mongodb://root:GENERATED_PASSWORD@venlaxsports-db:27017/?authSource=admin
```

**Save this.** You need it in Step 4.

> **Alternative:** Use MongoDB Atlas (cloud, managed backups). See Atlas setup at the bottom of this doc.

---

## Step 4 — Deploy the Backend (FastAPI)

1. Inside project → **New Resource → Application → GitHub**
2. Select your repo
3. Configure:
   - **Name:** `venlaxsports-api`
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Build Pack:** `Nixpacks`
   - **Start Command:** `uvicorn server:app --host 0.0.0.0 --port 8000`
   - **Port:** `8000`

4. Under **Environment Variables** — add all of these:

| Key | Value | Notes |
|-----|-------|-------|
| `MONGO_URL` | `mongodb://root:PASSWORD@venlaxsports-db:27017/?authSource=admin` | From Step 3 |
| `DB_NAME` | `venlaxsports` | |
| `JWT_SECRET` | random 64-char string | Generate one below |
| `PHASE` | `1` | |
| `STRIPE_API_KEY` | `sk_live_YOUR_LIVE_KEY` | From Stripe dashboard |
| `ADMIN_EMAIL` | `adonllcusa@gmail.com` | Your admin login email |
| `ADMIN_PASSWORD` | strong password of your choice | Your admin login password |
| `CORS_ORIGINS` | `https://www.venlaxsports.com,https://venlaxsports.com` | |
| `SMTP_HOST` | your SMTP host | Optional — emails work without it |
| `SMTP_PORT` | `587` | Optional |
| `SMTP_USER` | your email | Optional |
| `SMTP_PASS` | your email password | Optional |
| `SMTP_FROM` | `noreply@venlaxsports.com` | Optional |

**To generate a JWT_SECRET** — run this in any terminal:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
Or use any random string of 64+ characters.

5. Under **Domains** → Add: `api.venlaxsports.com` → enable HTTPS
6. Click **Deploy** — wait ~3 minutes for build

**Verify:** Visit `https://api.venlaxsports.com/api/health` — should return `{"status":"ok",...}`

> **Seeding is automatic.** On every startup, the server seeds admin user, cities, leagues, indexes, and pricing. No manual scripts needed.

> **Default admin account** is created from `ADMIN_EMAIL` + `ADMIN_PASSWORD` env vars you set above.

---

## Step 5 — Deploy the Frontend (React)

1. Inside project → **New Resource → Application → GitHub**
2. Select same repo
3. Configure:
   - **Name:** `venlaxsports-web`
   - **Branch:** `main`
   - **Root Directory:** `frontend`
   - **Build Pack:** `Nixpacks` or `Static`
   - **Build Command:** `yarn build`
   - **Publish Directory:** `build`
   - **Port:** leave blank (static site)

4. Under **Environment Variables** add:

| Key | Value |
|-----|-------|
| `REACT_APP_BACKEND_URL` | `https://api.venlaxsports.com` |
| `REACT_APP_PHASE` | `1` |

5. Under **Domains** add:
   - `www.venlaxsports.com` → enable HTTPS
   - `venlaxsports.com` → enable HTTPS
6. Click **Deploy**

**Verify:** Visit `https://www.venlaxsports.com` — home page should load with HTTPS padlock.

---

## Step 6 — Configure Stripe Webhook

In **Stripe Dashboard → Developers → Webhooks → Add endpoint:**

| Field | Value |
|-------|-------|
| Endpoint URL | `https://api.venlaxsports.com/api/webhook/stripe` |
| Events to listen | `checkout.session.completed`, `payment_intent.succeeded` |

Click **Add endpoint**.

> Switch Stripe from Test mode to **Live mode** first, then add the webhook.

---

## Step 7 — Final Checklist

Go through this before sharing the site:

- [ ] `https://www.venlaxsports.com` loads with HTTPS padlock
- [ ] `https://api.venlaxsports.com/api/health` returns `{"status":"ok"}`
- [ ] Register a new player account (email + password)
- [ ] Google login works
- [ ] Leagues page shows Tennis + Pickleball leagues
- [ ] Join a free league — works
- [ ] Join a paid league — Stripe checkout opens
- [ ] Admin login works (use your `ADMIN_EMAIL` + `ADMIN_PASSWORD`)
- [ ] Score report submits correctly
- [ ] Standings page loads and shows rankings
- [ ] No error popups or blank pages

---

## Quick Reference

| What | URL |
|------|-----|
| Your site | `https://www.venlaxsports.com` |
| Backend API | `https://api.venlaxsports.com` |
| API health | `https://api.venlaxsports.com/api/health` |
| API docs | `https://api.venlaxsports.com/docs` |
| Coolify dashboard | your Coolify URL |
| Stripe dashboard | `https://dashboard.stripe.com` |

---

## Troubleshooting

**Build fails — "module not found" or pip error**  
→ Coolify → your backend app → Logs tab → read full error  
→ `requirements.txt` is in `backend/` — Nixpacks auto-detects it

**CORS error in browser console**  
→ Check `CORS_ORIGINS` env var in Coolify backend = `https://www.venlaxsports.com,https://venlaxsports.com` (comma-separated, no spaces, no trailing slash)  
→ Check `REACT_APP_BACKEND_URL` in frontend = `https://api.venlaxsports.com` (no trailing slash)

**Login broken / cookies not working**  
→ Never hardcode the backend URL — always use `process.env.REACT_APP_BACKEND_URL`  
→ Never add fallback URLs in auth flows

**SSL not working**  
→ DNS must propagate before Coolify issues certificates  
→ Wait up to 24 hours after adding DNS records  
→ In Coolify → Domains → click "Renew Certificate"

**Admin login fails**  
→ Check `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars in Coolify backend  
→ Restart the backend service (seeding runs on startup)

**MongoDB connection refused**  
→ If using Coolify internal DB: use the internal hostname (service name), not VPS IP  
→ The internal URL looks like `mongodb://root:PASSWORD@venlaxsports-db:27017/` — do NOT use `localhost` or VPS IP

**Stripe payments not completing**  
→ Confirm webhook URL is exactly `https://api.venlaxsports.com/api/webhook/stripe`  
→ Confirm you are in Stripe **Live** mode (not Test mode)  
→ Confirm `STRIPE_API_KEY` env var uses `sk_live_...` key

---

## Optional — MongoDB Atlas Instead of Coolify DB

If you want managed backups and Atlas monitoring:

1. Go to `https://cloud.mongodb.com` → Create free account
2. **Build Database → Free (M0)** → pick US region
3. Create username + password → Network Access → Allow `0.0.0.0/0`
4. Connect → Drivers → copy connection string:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Set this as `MONGO_URL` in Coolify backend env vars (use `venlaxsports` as DB name in `DB_NAME`)
6. Skip Step 3 (no Coolify MongoDB resource needed)
