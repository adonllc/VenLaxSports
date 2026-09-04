# Match→Story Implementation Progress

**Date:** 2026-09-04  
**Status:** Phase 3 (Backend Scaffold) Complete. Ready for routes + integration next session.

---

## Completed

**Phase 1 (CEO Review):** ✅ LOCKED
- Commit: 8dc4ab9
- File: `ceo-review-positioning-2026-09-04.md`
- Output: Positioning validated, roadmap prioritized (10 features), Match→Story killer feature confirmed

**Phase 2 (Design Review):** ✅ LOCKED
- Commit: a0f1672
- File: `design-brief-match-story-2026-09-04.md`
- Output: Card design brief (1080×1350px, committed color, measured achievement tone, native share flow)

**Phase 3a (Backend Scaffold):** ✅ DONE
- Commit: 355a78f
- Files: `backend/models.py` (MatchCard), `backend/card_generation.py` (Pillow render)
- Output: 
  - MatchCard model (match_id, winner_id, opponent_id, sport, score, rating_delta, card_image_url, shareable_url, expires_at)
  - Card generation function (PIL, 1080×1350px, sport-colored, text hierarchy: name → score → delta)

---

## Remaining (Next Session)

### Phase 3b (Backend Routes + Integration)

**Routes to add to `backend/routes/match_routes.py`:**

1. **POST /api/matches/:id/share**
   - Trigger card generation (async)
   - Insert MatchCard doc into DB
   - Return shareable_url

2. **GET /api/matches/:id/card**
   - Fetch MatchCard by match_id
   - Return metadata (card_image_url, shareable_url, rating_delta)
   - Used for polling on frontend

3. **GET /api/card/:card_id**
   - Public endpoint for social preview
   - Return card metadata + og:image URL
   - No auth required

**Integration points:**
- Modify `/api/matches/:id/score` (existing route) → enqueue card generation after score update succeeds
- Reuse existing Match, User, and rating_utils modules
- Add to requirements.txt: `pillow` (for card generation)

**Database:**
- `match_cards` collection (auto-created on first write)
- Add TTL index: `expires_at` (30 days)

### Phase 3c (Backend Tests)

- `tests/test_card_generation.py` — card render, Pillow output
- `tests/test_match_card_routes.py` — POST /share, GET /card, GET /c/:id
- Integration: submit match → card appears in DB within 5s

### Phase 4 (Frontend)

- Create `frontend/src/components/MatchCard.jsx` (preview card display)
- Add to `frontend/src/pages/ScoreReport.jsx`:
  - Polling logic (GET /api/matches/:id/card every 1s, max 10s)
  - Display MatchCard + "Share Victory" button
  - Native share sheet integration (navigator.share)
- Handle deep link: venlax.app/c/abc123 opens match card

---

## Quick Start (Next Session)

1. Start with Phase 3b routes:
   ```python
   # In backend/routes/match_routes.py
   @router.post("/{match_id}/share")
   async def share_match(match_id: str, request: Request):
       # Enqueue card generation
       # Insert MatchCard
       # Return shareable_url
   ```

2. Add card generation job (async task queue or direct):
   ```python
   # In backend/routes/match_routes.py or separate module
   async def generate_match_card_async(match_id: str, db):
       # Fetch match + user data
       # Call card_generation.generate_match_card()
       # Save image to disk/CDN
       # Update MatchCard.card_image_url in DB
   ```

3. Integrate with score submission:
   - Existing route: `/api/matches/{match_id}/score` (PATCH)
   - After success: enqueue card generation

4. Test with:
   ```bash
   # Submit match score
   curl -X PATCH http://localhost:8001/api/matches/abc123/score \
     -H "Content-Type: application/json" \
     -d '{"winner_id": "user1", "score": "6-4, 4-6, 6-4"}'
   
   # Check card status
   curl http://localhost:8001/api/matches/abc123/card
   ```

---

## Dependencies

**Already installed:**
- `fastapi`, `motor` (async MongoDB)
- `pydantic`, `python-multipart`

**To add:**
- `pillow` (for card generation) — `pip install pillow`

---

## Token Budget Notes

- Phase 1–3a completed in ~15K tokens (CEO review, design brief, backend scaffold)
- Phase 3b–4 estimate: ~12-15K tokens (routes, integration, frontend)
- Recommend splitting: routes+integration first (Phase 3b), then frontend (Phase 4) in separate session

---

## Files Reference

- **CEO Plan:** `ceo-review-positioning-2026-09-04.md` (222 lines)
- **Design Brief:** `design-brief-match-story-2026-09-04.md` (114 lines)
- **Backend Model:** `backend/models.py` (line 443+, MatchCard class)
- **Card Generation:** `backend/card_generation.py` (full module, Pillow render)

**Commits:**
- 8dc4ab9: CEO review complete
- a0f1672: Design brief locked
- 355a78f: Backend scaffold (model + card generation)
