# Player Play Profile — Design

Date: 2026-11-03
Status: awaiting user review

## Goal

Let players describe how they play (court side, hand, style, availability, partner search) so opponents and doubles partners can be found and matched. Phone number is already built (signup + dashboard editor) and is out of scope.

## Decisions (from brainstorming)

- "Preference side" = **court side** (deuce/ad in tennis, left/right in pickleball).
- Fields in v1: court side, dominant hand, backhand, years playing, availability, looking-for-partner, play style (per sport).
- Visibility: **public profile**, gated by existing `profile_public`. Phone stays private.
- Entry points: **dashboard editor** and an **optional post-signup setup step**. Not on the signup form.
- Approach C: one `play_profile` sub-document on `User`; shared fields once, `play_style` per sport.

## Data model

Stored on the `users` document:

```
play_profile: {
  court_side:          "left" | "right" | "either",
  dominant_hand:       "right" | "left",
  backhand:            "one_hand" | "two_hand",          # tennis only
  years_playing:       int 0-60,
  availability:        subset of [weekday_morning, weekday_evening,
                                  weekend_morning, weekend_afternoon, weekend_evening],
  looking_for_partner: bool,
  play_style: {
    tennis:     baseline | serve_volley | all_court | aggressive | counterpuncher,
    pickleball: banger | dinker | all_court
  }
}
```

All keys optional. Missing = not set. `court_side` is stored normalized (`right` = deuce, `left` = ad); the UI labels it per sport.

## Backend

- `models.py`: `PlayProfile` Pydantic model with `Literal` enums and bounds; `User.play_profile: Optional[PlayProfile] = None`.
- `routes/user_routes.py`:
  - `UserProfileUpdate.play_profile: Optional[PlayProfile]`; `PATCH /users/me` saves it with `$set` (whole sub-document replace; `null` unsets). Invalid enum values are rejected by Pydantic (422).
  - `ProfileSetupIn.play_profile` accepted by `PATCH /users/me/setup`, same validation.
  - `/users/search` result adds `court_side`, `play_style`, `looking_for_partner` (from `play_profile`).
- `auth_utils.serialize_public_user`: include `play_profile` only when `profile_public` is true.

## Frontend

- New `components/PlayProfileCard.jsx`: edit form (view/edit toggle like the phone editor), every control has a kebab-case `data-testid`, DESIGN.md styling (square corners, green/amber).
  - Court side labels: Deuce / Ad / Either for tennis; Right / Left / Either for pickleball. Shown per sport in `sport_preferences`.
  - Backhand hidden when the user plays no tennis.
  - Style options per sport as listed above.
- `PlayerDashboard.jsx`: mount the card next to the phone section; save via `PATCH /users/me`.
- Post-signup setup flow: optional step using the same card with a Skip button; saves via `PATCH /users/me/setup`.
- Public profile page: read-only chips for the set fields.
- Opponent search (`OpponentSearch.jsx`): show court side, style, and a "looking for partner" badge when present.

## Errors

- Empty profile is valid.
- Failed save shows an inline error under the card (same pattern as `phoneError`).
- Server rejects unknown enum values; the UI only offers valid ones.

## Testing

- pytest (`backend/tests/`): valid save; invalid enum rejected; `null` unsets; `profile_public=false` hides `play_profile` from the public view; search returns the new keys.
- Playwright: edit and save the play profile on the dashboard, reload, values persist.

## Out of scope

Partner-finder page, matching algorithm, using style in ratings, per-league visibility, signup-form fields.
