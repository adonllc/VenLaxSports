# Legal Compliance — Production Deployment Guide

**Target:** https://www.venlaxsports.com  
**API:** https://api.venlaxsports.com  
**Infrastructure:** Coolify on Hetzner VPS (2.24.93.113)

---

## Pre-Deployment Checklist

- [x] All 6 commits pushed to main
- [x] Code verified (Python syntax, React valid)
- [x] Documentation complete
- [ ] Coolify dashboard access ready
- [ ] MongoDB credentials ready (if manual seed)
- [ ] Backup created (optional but recommended)

---

## Step 1: Backend Redeploy

### Option A: Coolify UI (Recommended)

1. Navigate to Coolify dashboard (admin credentials in deployment memory)
2. Go to **Applications** → **venlaxsports-api** (UUID: jbqbib2pbhn8xxupr7s9m5cw)
3. Click **Redeploy** button
   - Pulls latest from `main` branch
   - Rebuilds Docker image
   - Restarts container
   - Takes ~2-3 minutes
4. Monitor deployment logs (watch for errors)
5. When complete, verify API health:
   ```bash
   curl https://api.venlaxsports.com/api/health
   ```
   Expected response: `{"status": "ok", "timestamp": "..."}`

### Option B: SSH + Manual Deploy

```bash
# SSH to VPS
ssh root@2.24.93.113

# Navigate to backend
cd /path/to/venlaxsports/backend

# Pull latest code
git pull origin main

# Install dependencies (if needed)
pip install -r requirements.txt

# Restart backend service (depends on setup)
# Either: restart Coolify container, or restart uvicorn

# Verify
curl localhost:8001/api/health
```

---

## Step 2: Create MongoDB Indexes

### Required for Dispute Escalation

Run this after backend is live (MongoDB connection needed):

```bash
# Option A: Via Coolify exec
# SSH to VPS, then:
docker exec <backend-container-id> python seeds/indexes.py

# Option B: Direct Python (if local MongoDB access)
cd backend
python seeds/indexes.py
```

**Indexes Created:**
- `disputes` collection: league_id, status, reporter, respondent, type, match_id
- `decisions` collection: dispute_id, organizer_id, appeal_eligible
- `appeals` collection: decision_id, player_id, status

**Verify indexes exist:**
```bash
# MongoDB client
db.disputes.getIndexes()
db.decisions.getIndexes()
db.appeals.getIndexes()
```

All should return array with new index objects (not just `_id`).

---

## Step 3: Frontend Redeploy

### Option A: Coolify UI (Recommended)

1. Navigate to Coolify dashboard
2. Go to **Applications** → **venlaxsports-web** (UUID: forj0vu6jpr3on72033qs8x7)
3. Click **Redeploy** button
   - Pulls latest from `main` branch
   - Runs `yarn build`
   - Deploys to Traefik reverse proxy
   - Takes ~3-5 minutes
4. Monitor deployment logs
5. Verify frontend loads:
   ```bash
   curl https://www.venlaxsports.com
   # Should return HTML (not 404)
   ```

### Option B: Manual Build & Deploy

```bash
# SSH to VPS
ssh root@2.24.93.113

# Navigate to frontend
cd /path/to/venlaxsports/frontend

# Pull latest code
git pull origin main

# Build
yarn install
yarn build
# Generates `dist/` directory

# Deploy (depends on setup)
# Either: upload dist/ to web server, or restart Coolify container
```

---

## Step 4: Smoke Tests

### Frontend Tests

1. **Navigate to https://www.venlaxsports.com**
   - Page loads without errors
   - Navigation menu visible
   - No 404s

2. **Test Rules Page**
   - Click footer → Rules
   - URL: https://www.venlaxsports.com/rules
   - Content loads (8 rule sections visible)
   - No console errors

3. **Test Terms Page**
   - Click footer → Terms & Conditions
   - URL: https://www.venlaxsports.com/terms
   - Content loads (9 legal sections visible)
   - Links to /rules work

4. **Test Auth Signup**
   - Navigate to https://www.venlaxsports.com/auth?mode=register
   - Form fields visible:
     - Name ✓
     - Email ✓
     - Password ✓
     - Country ✓
     - City (optional) ✓
     - Skill Level (optional) ✓
     - **DOB (optional)** ✓ NEW
     - **Emergency Contact Name (optional)** ✓ NEW
     - **Emergency Contact Phone (optional)** ✓ NEW
     - **Medical Conditions (optional)** ✓ NEW
     - **Terms Checkbox (required)** ✓ NEW
   - Try submitting without Terms checkbox → Error: "You must accept Terms of Service"
   - Check Terms checkbox → No error
   - Continue flow (waiver modal should appear)

5. **Test AdminDashboard (if logged in as admin)**
   - Navigate to https://www.venlaxsports.com/admin
   - Tabs visible: Overview, Create League, ..., **Disputes** ✓ NEW
   - Click Disputes tab
   - DisputeEscalationPanel loads (may be empty)
   - No console errors

### Backend Tests

```bash
# Test API endpoints
curl https://api.venlaxsports.com/api/health

# Test legal endpoints exist (401 if not authenticated, that's OK)
curl https://api.venlaxsports.com/api/legal/disputes

# Expected: 401 Unauthorized or empty list (not 404)
```

---

## Step 5: Error Monitoring

Monitor for 2 hours after deployment:

### Check Backend Logs
```bash
# Coolify UI: Applications → venlaxsports-api → Logs
# OR SSH: docker logs <backend-container>

# Watch for:
# - Python syntax errors (should not happen)
# - Import errors (routes/models)
# - MongoDB connection errors
# - HTTP 500 errors on /api/legal/* endpoints
```

### Check Frontend Logs
```bash
# Coolify UI: Applications → venlaxsports-web → Logs
# OR browser console (F12):

# Watch for:
# - 404 errors (missing resources)
# - TypeError (React component issues)
# - Network errors (API unreachable)
# - Missing images/CSS
```

### Check API Response Times
```bash
# Should be <500ms for most endpoints
time curl https://api.venlaxsports.com/api/health
time curl https://api.venlaxsports.com/api/leagues

# If >1000ms, check server load / database performance
```

---

## Step 6: Rollback (If Needed)

If deployment fails or causes errors:

### Option A: Revert to Previous Commit

```bash
# SSH to VPS
cd /path/to/venlaxsports

# Revert to last stable commit (before legal compliance)
git revert HEAD  # Creates new commit
# OR
git reset --hard HEAD~6  # Resets to before legal commits

# Trigger redeploy in Coolify
```

### Option B: Restore from Backup

```bash
# Restore database backup (if created before deploy)
# Coolify UI or MongoDB backup tool

# Restart containers
docker-compose restart  # Or equivalent
```

### Option C: Quick Fix (If Minor Issue)

1. Fix issue in code
2. Commit and push to main
3. Redeploy from Coolify

---

## Deployment Checklist (Fill As You Go)

### Pre-Deployment
- [ ] 6 commits verified: `git log --oneline -6`
- [ ] Coolify dashboard access: https://coolify.io/admin
- [ ] Backup created (optional)

### Backend Deploy
- [ ] Coolify backend redeploy triggered
- [ ] Deployment logs checked (no errors)
- [ ] `/api/health` responds with 200 OK
- [ ] MongoDB connection verified

### MongoDB Indexes
- [ ] Index seed script executed: `python seeds/indexes.py`
- [ ] Indexes verified: `db.disputes.getIndexes()` etc.
- [ ] No index errors in logs

### Frontend Deploy
- [ ] Coolify frontend redeploy triggered
- [ ] Build logs checked (no errors)
- [ ] Frontend loads: https://www.venlaxsports.com
- [ ] No 404s or missing resources

### Smoke Tests
- [ ] Rules page loads: /rules
- [ ] Terms page loads: /terms
- [ ] Auth signup form complete (legal fields visible)
- [ ] Terms checkbox validation works
- [ ] Admin Disputes tab visible
- [ ] No console errors

### Error Monitoring (2 hours)
- [ ] Backend logs clean (no 500 errors)
- [ ] Frontend logs clean (no TypeErrors)
- [ ] API response times normal (<500ms)
- [ ] Database performance normal

### Sign-Off
- [ ] All tests pass ✓
- [ ] Ready for legal counsel review (if not done)
- [ ] Ready to communicate changes to users

---

## Post-Deployment (Next Steps)

1. **Notify Legal Team** (if not already involved)
   - Let them know Terms.jsx is live
   - Get sign-off if not already done

2. **Monitor Signup Metrics**
   - % of signups completing legal fields
   - Parental consent acceptance rate
   - Any support tickets about new fields

3. **Monitor Dispute Creation**
   - # of disputes created (baseline: TBD)
   - Avg time to resolution
   - Appeal rate

4. **Gather User Feedback**
   - Is ParentalConsentModal clear?
   - Do users understand Terms?
   - Any UX friction?

5. **Future Work** (Document for next sprint)
   - Identity verification for DOB
   - Medical conditions encryption
   - Facility safety inspector
   - Rating appeal workflow UI

---

## Support Contacts

- **Coolify Issues:** https://coolify.io/docs
- **MongoDB Issues:** Check VPS logs, Coolify container logs
- **Frontend Issues:** Browser console (F12)
- **Backend Issues:** Docker logs, API error responses
- **Legal Questions:** Corporate counsel

---

**Deployment Status:** Ready to execute  
**Last Updated:** 2026-06-03  
**Commits:** 800d147...1b7e07e (6 commits)
