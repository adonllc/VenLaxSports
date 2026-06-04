# Legal Compliance Deployment Checklist

**Status:** Ready for staging/production deployment  
**Date:** 2026-06-03  
**Commits:** 800d147, 7213212, a6d84b6, 1ef68da

---

## Pre-Deployment (Staging)

### Frontend Checklist
- [ ] Build passes: `yarn build` (no syntax errors)
- [ ] Terms.jsx renders without errors
- [ ] ParentalConsentModal displays correctly (test with DOB <18)
- [ ] Auth signup flow works end-to-end:
  - [ ] Name, email, password capture
  - [ ] DOB, emergency contact, medical conditions inputs work
  - [ ] Terms checkbox required (error if unchecked)
  - [ ] Waiver modal appears after Terms acceptance
  - [ ] ParentalConsentModal appears if DOB <18
  - [ ] Registration completes with all legal fields
- [ ] Rules.jsx displays correctly (no styling issues)
- [ ] Footer has Terms link (visible, clickable)
- [ ] AdminDashboard Disputes tab loads
  - [ ] DisputeEscalationPanel renders
  - [ ] Decision modal opens and closes
  - [ ] Penalty dropdown works

### Backend Checklist
- [ ] Python syntax valid: `python -m py_compile models.py routes/legal_routes.py server.py`
- [ ] MongoDB indexes created:
  - [ ] `db.disputes` indexes on league_id, status, reporters
  - [ ] `db.decisions` indexes on dispute_id, organizer_id
  - [ ] `db.appeals` indexes on decision_id, player_id, status
- [ ] Legal routes mounted at `/api/legal/*`
- [ ] Register endpoint captures legal fields
- [ ] Auth endpoint `/api/auth/register` accepts:
  - [ ] date_of_birth
  - [ ] emergency_contact_name
  - [ ] emergency_contact_phone
  - [ ] medical_conditions
  - [ ] terms_accepted
  - [ ] parental_consent
  - [ ] parental_consent_guardian_name

### API Testing (Postman/curl)
- [ ] POST /api/legal/parental-consent (success + error cases)
- [ ] POST /api/legal/disputes (success + validation)
- [ ] GET /api/legal/disputes (with filters)
- [ ] POST /api/legal/disputes/{id}/decision (with penalties)
- [ ] POST /api/legal/decisions/{id}/appeal
- [ ] POST /api/legal/terms/accept
- [ ] POST /api/legal/emergency-contact/update

### Database Checks
- [ ] User collection has new fields:
  - date_of_birth
  - emergency_contact_name
  - emergency_contact_phone
  - medical_conditions
  - terms_accepted
  - terms_accepted_at
  - parental_consent
  - parental_consent_guardian_name
  - parental_consent_timestamp
- [ ] New collections exist:
  - disputes
  - decisions
  - appeals
- [ ] Indexes created and active

---

## Staging Environment Testing

### User Flow Tests
1. **Non-<18 Signup (Happy Path)**
   - [ ] Register with DOB over 18
   - [ ] No parental consent required
   - [ ] All fields captured in database

2. **<18 Signup (Happy Path)**
   - [ ] Register with DOB under 18
   - [ ] ParentalConsentModal appears
   - [ ] Guardian name collected
   - [ ] Parental consent marked in database

3. **Terms Rejection**
   - [ ] Uncheck Terms checkbox
   - [ ] Error: "You must accept Terms of Service to continue"
   - [ ] Form does not submit

4. **Emergency Contact**
   - [ ] Register with emergency contact info
   - [ ] Data saved in database
   - [ ] Can update via /api/legal/emergency-contact/update

### Organizer Dispute Flow Tests
1. **Create Dispute**
   - [ ] Player creates dispute via `/api/legal/disputes`
   - [ ] Dispute appears in AdminDashboard → Disputes tab
   - [ ] Status is "pending"

2. **Organizer Reviews & Decides**
   - [ ] Organizer opens dispute
   - [ ] Enters decision description
   - [ ] Selects penalty (or none)
   - [ ] Clicks "Issue Decision"
   - [ ] Dispute status changes to "resolved"
   - [ ] Decision record created

3. **Player Appeals**
   - [ ] Player submits appeal via `/api/legal/decisions/{id}/appeal`
   - [ ] Appeal status is "pending"
   - [ ] Organizer can view appeal

---

## Production Deployment

### Pre-Flight
- [ ] All staging tests pass
- [ ] Corporate counsel has reviewed Terms.jsx + ParentalConsentModal (if required)
- [ ] Database backup created
- [ ] Rollback plan documented

### Deployment Steps
1. **Backend**
   - [ ] Deploy new models.py (User + DisputeEscalation + OrganizerDecision + PlayerAppeal)
   - [ ] Deploy legal_routes.py
   - [ ] Deploy updated server.py (router mount)
   - [ ] Deploy updated auth_routes.py
   - [ ] Run `python seeds/indexes.py` to create MongoDB indexes
   - [ ] Verify `/api/legal/*` endpoints respond

2. **Frontend**
   - [ ] Deploy Rules.jsx (updated)
   - [ ] Deploy Terms.jsx (new)
   - [ ] Deploy ParentalConsentModal.jsx (new)
   - [ ] Deploy Auth.jsx (updated)
   - [ ] Deploy AdminDashboard.jsx (updated)
   - [ ] Deploy DisputeEscalationPanel.jsx (new)
   - [ ] Clear browser cache / CDN cache
   - [ ] Verify /rules renders
   - [ ] Verify /terms renders
   - [ ] Verify /auth signup flow works

### Post-Deployment
- [ ] Monitor error logs for 2 hours
- [ ] Test signup flow with test account:
  - [ ] Register with DOB >18
  - [ ] Verify all fields captured
  - [ ] Check database record
- [ ] Test signup with DOB <18:
  - [ ] ParentalConsentModal appears
  - [ ] Parental consent recorded
- [ ] Test organizer dispute workflow:
  - [ ] Create test dispute
  - [ ] Issue decision in AdminDashboard
  - [ ] Verify decision recorded
- [ ] Verify /api/legal/* endpoints accessible
- [ ] Document any issues + resolution time

---

## Rollback Plan

If deployment fails:

1. **Revert frontend:** Deploy previous build from CI/CD
2. **Revert backend:** Redeploy previous server.py + routes
3. **Verify old signup flow works**
4. **Investigate failures** before retrying
5. **Notify legal team** of any issues

---

## Known Limitations (Post-Deployment)

⚠️ **NOT IMPLEMENTED (Future Sprints):**
- Identity verification for DOB (<18 proof)
- Medical conditions encryption (currently plain text)
- Automated match fixing detection
- Rating appeal workflow UI (backend API exists)
- Facility safety inspector (home player self-certifies)

---

## Success Criteria

✅ All users can complete signup with legal fields captured  
✅ ParentalConsentModal works for <18 players  
✅ Terms acceptance checkbox enforced  
✅ Organizers can manage disputes in AdminDashboard  
✅ Dispute escalation workflow functional  
✅ No user-facing errors in error logs  
✅ All API endpoints respond correctly  

---

## Support Contacts

- **Legal:** For Terms.jsx review / parental consent validation
- **DevOps:** For MongoDB index creation / database issues
- **QA:** For E2E testing / user acceptance testing
- **Support:** For escalating user reports of disputes

---

## Post-Deployment Monitoring

- [ ] Error rate (target: <0.1%)
- [ ] Signup completion rate (target: >95%)
- [ ] Dispute creation rate (baseline: TBD)
- [ ] User feedback on Terms/ParentalConsent modals

---

**Ready to deploy to staging:** ✅  
**Ready to deploy to production:** ⏳ (awaiting legal review + final staging QA)
