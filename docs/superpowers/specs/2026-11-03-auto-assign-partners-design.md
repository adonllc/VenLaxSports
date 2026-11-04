# Auto-assign Doubles Partners — Design

Date: 2026-11-03
Status: awaiting user review

## Goal

Doubles players who registered without a partner ("add partner later") can consent to let VenLax pick a partner. An admin runs a matcher per league, reviews suggested pairs, and confirms the ones to assign. A matched player can ask for a different partner until the league starts; after that, teams are locked.

## Decisions (from brainstorming)

- Pool: waiting players only, those with a `doubles_invites` row in `pending` / `initiator_paid` and no partner. No new "solo" pool.
- Money: when two paid players are merged, the later registrant's payment is flagged `refund_due`. **Admin refunds by hand.** Nothing is refunded automatically.
- Flow: **admin reviews suggestions, then confirms.** No automatic assignment.
- Consent: checkbox on the "add partner later" join step **and** a toggle on the waiting team in the dashboard.
- Location: add an optional `zip_code` to users. Same zip beats same city.
- Level: admin picks the tolerance per run: **Exact, ±0.5 or ±1.0**.
- Objection: a matched player files a **change request**; **admin approves** and the team dissolves. Requests can only be filed before the league starts.

## Data model

`users`
- `zip_code: str | None`. Trimmed, uppercased, 3-10 chars of letters, digits, space, dash.

`doubles_invites` (new fields, all optional)
- `auto_assign_opt_in: bool`, `auto_assign_opt_in_at: iso str`
- `rejected_partner_ids: [user_id]`. Players never suggested to this invite again.
- On the **team invite (A)** after an assignment: `assigned_by_admin: true`, `assigned_at`, `status_before_assign` (`pending` or `initiator_paid`), `merged_token` (B's token), `partner_change_request: {by_user_id, reason, requested_at, status: pending|approved|declined, resolved_at}`.
- On the **absorbed invite (B)**: `status: "merged"`, `merged_into` (A's token), `status_before_merge`, `refund_due: bool`, `refunded_at: iso str | None`.

New invite status: `merged`. Existing code that lists waiting teams only reads `pending` / `initiator_paid`, so merged invites drop out automatically.

## Level

`player_level(user, sport)` is a number on a 0.5 grid:
1. `skill_level` if set ("6.0+" counts as 6.0), snapped to the nearest 0.5.
2. Else the sport rating (`tennis_rating` / `pickleball_rating`) rounded to the nearest 0.5.
3. Else 3.0.

Declared level is used first because ratings drift with every match, so exact equality on them would almost never match.

## Matching (`backend/partner_matching.py`, pure functions, no DB)

Candidate: `{token, user_id, gender, city, zip_code, level, court_side, availability, registered_at, paid, rejected_partner_ids}`.

Hard rules (a pair is dropped if any fails):
- different people; neither id is in the other's `rejected_partner_ids`
- `abs(level_a - level_b) <= max_gap`, where `max_gap` is 0, 0.5 or 1.0
- `mixed_doubles` league: one male, one female (both genders set)

League-level checks (done by the caller, not per pair): league in `registration`, at least 2 spots free per pair, and in a paid league both invites are `initiator_paid`.

Score out of 100:

| Signal | Points |
|---|---|
| Level gap 0 / 0.5 / 1.0 | 40 / 25 / 10 |
| Same zip 25, same city (case-insensitive) 15, else 0 | up to 25 |
| Court side: left+right 20, "either" with anything 12, same side 0, unset 6 | up to 20 |
| Availability: any shared slot, or either is `flexible` 15; unset 5; none 0 | up to 15 |

`suggest_pairs(candidates, max_gap)` scores all legal pairs, sorts by score (ties: older `registered_at` first), and picks greedily so each player is in at most one pair. It returns `(pairs, unmatched)`. Each pair has `score` and `reasons` (readable strings such as "Same zip", "Both Atlanta", "Levels 3.5 / 3.5", "Left + right side", "Shared: weekend mornings"). Each unmatched entry has a `reason` ("Nobody else opted in", "No one within ±0.5, try a wider level", "Needs an opposite-gender partner").

Within a pair, **A is the earlier registrant, B the later one.** B is the one flagged for a refund.

## Backend endpoints

Player (`routes/doubles_routes.py`)
- `POST /api/doubles-invite/{token}/auto-assign {enabled: bool}`. Initiator only; invite must be `pending` / `initiator_paid` with no `partner_user_id`; league in `registration`. Sets or clears the flag.
- `POST /api/doubles-invite/{token}/change-request {reason?: str}`. `token` is the team invite (both players' `player_leagues` rows carry it as `invite_token`). Either team member may call it. Allowed only if the invite has `assigned_by_admin`, the league is in `registration`, today (UTC) is **before** `start_date`, and no pending request exists. Otherwise 409 with a clear message.
- `POST /api/leagues/{id}/join` accepts `auto_assign_partner: bool`, used only with `partner_later`.

Admin (`routes/admin_routes.py`, all behind `require_admin`)
- `GET /api/admin/partner-matches?league_id=&max_gap=` returns `{pairs, unmatched}` (no writes). `max_gap` must be 0, 0.5 or 1.0, else 400. Defaults to 0.
- `POST /api/admin/partner-matches/assign {pairs: [{token_a, token_b}]}`. Per pair, in one pass: re-load both invites and re-check every rule above (state may have changed). Then reserve 2 spots with the same atomic `find_one_and_update` that `add_partner` uses, call `_create_doubles_pair` for A's initiator and B's initiator, mark A `accepted` with the assignment fields, and mark B `merged` with `refund_due = B.paid`. Returns per-pair `{ok, error}`; one failure does not stop the others.
- `POST /api/admin/partner-matches/{token_b}/mark-refunded`. Sets `refunded_at` and clears `refund_due`.
- `GET /api/admin/partner-change-requests` lists pending requests with both players, league, reason.
- `POST /api/admin/partner-change-requests/{token}/resolve {action: "approve"|"decline"}`.
  - **decline:** request marked declined; requester emailed.
  - **approve (dissolve):** refused with 409 if the league is no longer in `registration`. Otherwise: delete both `player_leagues` rows for that `invite_token`; `$inc current_players -2`; restore A's invite to `status_before_assign` with no partner; restore B's invite to `status_before_merge`; add each player to the other's `rejected_partner_ids`; both keep `auto_assign_opt_in`. If B's refund was already marked refunded, B is restored as `pending` (unpaid) and the response says B must pay again, so a paid league will not re-match B until they have. Both players are emailed.

Emails (`email_service.py`): `send_partner_assigned` (to both: partner name, league, link to the dashboard change-request option), `send_partner_change_resolved` (approved or declined).

## Frontend

- Join flow ("add partner later" step): checkbox "Let VenLax pick my partner" with the consent sentence: "VenLax may pair me with another waiting player in my league. My name, level and city are shared with that partner."
- Dashboard: on a waiting team, an on/off switch for the same consent. On an assigned team, "Your partner: {name} (assigned by VenLax)" and a **Request a different partner** button with an optional reason. Shown only while the league is in registration and today is before `start_date`; afterwards the text "Teams are locked now that the league has started." A pending request shows "Change requested, waiting for review."
- Zip: optional field next to phone on the dashboard and in the profile-setup step.
- Admin, new card "Auto-assign partners" next to the waiting-teams table: league picker; **Level match** select (Exact / ±0.5 / ±1.0); "Find matches" button; table of suggested pairs with checkbox, both players, level badge, score and reason chips; "Assign selected (n)" button; unmatched list with reasons.
- Admin, two small lists: "Refund due" (merged, paid, not refunded; button "Mark refunded") and "Partner change requests" (Approve / Decline).
- All new controls carry kebab-case `data-testid`; styling follows DESIGN.md.

## Errors and edge cases

- Stale suggestion (a player paired, opted out, or the league filled between Find and Assign): that pair fails with a message and the rest proceed.
- League full: pair rejected with "No spots".
- Player withdraws consent after the admin ran Find but before Assign: the re-check catches it.
- Free leagues: no payment, no refund flag.
- Change request filed, then the league starts before admin resolves: the request stays resolvable only while the league is still in `registration`; otherwise approve returns 409 and the admin handles it manually.

## Testing

- `partner_matching`: each hard rule, level gap points, location tiers, court-side combinations, availability, tie-breaking, greedy uniqueness, odd player left unmatched with reason, `max_gap` 0 versus 0.5 versus 1.0.
- `player_level`: declared level, "6.0+", rating fallback, default.
- In-memory fake-DB tests (pattern of `tests/test_partner_later.py`) for assign (success, stale invite, mixed gender, full league, unpaid in a paid league, refund flag), change request (allowed, after start blocked, duplicate blocked, non-member blocked), approve (restores both invites, frees spots, rejected ids, refunded-B case) and decline.
- Playwright: admin finds and assigns a pair; a player files a change request. Needs seeded accounts; skipped without env vars like the play-profile spec.

## Out of scope

Automatic assignment on a timer, players accepting or declining a suggestion before it is final, automatic refunds, matching across leagues, an unpaid solo "need a partner" pool, cricket, and using play style in the score.
