"""Community ladders: ranking methods, creation, invitations, joining, challenges and housekeeping. In-memory fake database."""
import sys
import types
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import challenge_config as cfg  # noqa: E402
import community_ladder as cl  # noqa: E402
import direct_challenge as dc  # noqa: E402
import email_service  # noqa: E402
import ladder_ranking as lr  # noqa: E402
from routes import community_ladder_routes as routes  # noqa: E402
from routes import ladder_routes  # noqa: E402
from test_direct_challenge import Db as ChallengeDb, FakeColl, run  # noqa: E402


class CopyingColl(FakeColl):
    """Hands out copies from find(), as a real database does, so a route that edits what it reads cannot corrupt storage."""

    def find(self, q=None, *a, **kw):
        import copy
        cur = super().find(q, *a, **kw)
        cur.docs = [copy.copy(d) for d in cur.docs]
        return cur


class Db(ChallengeDb):
    def __init__(self):
        super().__init__()
        self.ladders, self.ladder_invites, self.ladder_results = CopyingColl(), FakeColl(), FakeColl()
        self.eve = self.add("Eve Edge", city="Atlanta", skill_level="3.5")


@pytest.fixture
def env(monkeypatch):
    sent = []

    def fake_schedule(coro):
        sent.append(coro.cr_frame.f_locals.get("to"))
        coro.close()
    monkeypatch.setattr(email_service, "schedule", fake_schedule)
    monkeypatch.setattr(cfg, "DAILY_SEND_LIMIT", 100)
    monkeypatch.setattr(cfg, "LADDER_REMATCH_COOLDOWN_HOURS", 0)
    monkeypatch.setattr(cfg, "LADDER_MAX_OPEN_OUTGOING", 5)
    return sent


def cfg_in(**kw):
    return {"name": "Atlanta Social Ladder", "sport": "tennis", "format": "singles", "division_label": "Intermediate",
            "city": "Atlanta", "max_participants": 8, "visibility": "public", "join_mode": "open",
            "ranking_method": "leapfrog", "duration_days": 60, **kw}


def err(fn, *a, **kw):
    with pytest.raises(dc.ChallengeError) as e:
        run(fn(*a, **kw))
    return e.value


def make(db, method="leapfrog", owner=None, publish=True, **kw):
    owner = owner or db.ann
    ladder = run(cl.create_draft(db, db.user(owner), cfg_in(ranking_method=method, **kw)))
    if publish:
        run(cl.publish(db, ladder, db.user(owner), kw.get("partner_id")))
    return ladder


def join(db, ladder, uid, partner=None):
    return run(cl.join_public(db, ladder, db.user(uid), partner))


def full(db, method="leapfrog", players=None, **kw):
    """A published ladder with Ann (creator), Bob, Cy and Di in it."""
    ladder = make(db, method, **kw)
    for uid in players or (db.bob, db.cy, db.di):
        join(db, ladder, uid)
    return ladder


def play(db, ladder, challenger, challenged, challenger_wins=True):
    ch = run(cl.challenge(db, ladder, db.user(challenger), challenged))
    run(dc.accept(db, ch, db.user(challenged)))
    sets = [{"a": 6, "b": 3}, {"a": 6, "b": 2}] if challenger_wins else [{"a": 3, "b": 6}, {"a": 2, "b": 6}]
    run(dc.submit_score(db, ch, db.user(challenger), sets))
    run(dc.confirm_score(db, ch, db.user(challenged)))
    return ch


def rank_of(ladder, uid):
    return cl.member_entry(ladder, uid)["rank"]


def order(ladder):
    return [e["player_id"] for e in sorted((e for e in lr.live(ladder["entries"]) if e["rank"]), key=lambda e: e["rank"])]


# ── Ranking engine ────────────────────────────────────────────────────────────

def test_leapfrog_order_rules():
    assert lr.leapfrog_order(["a", "b", "c", "d"], "d", "b") == ["a", "d", "b", "c"]     # jump ahead, others move down
    assert lr.leapfrog_order(["a", "b", "c"], "a", "c") == ["a", "b", "c"]               # the favourite wins: nothing changes
    assert lr.leapfrog_order(["a", "b"], "n", "a") == ["n", "a", "b"]                    # a new entry that wins takes the place
    assert lr.leapfrog_order(["a", "b"], "b", "n") == ["a", "b", "n"]                    # a new entry that loses goes directly below
    assert lr.leapfrog_order([], "w", "l") == ["w", "l"]
    assert lr.leapfrog_order(["a"], "n", "m") == ["a", "n", "m"]


def test_nobody_is_ranked_before_playing_and_the_creator_gets_no_head_start(env):
    db = Db()
    ladder = full(db)
    assert all(e["rank"] is None and e["status"] == "provisional" for e in ladder["entries"])
    names = [r["name"] for r in lr.standings(ladder["entries"])]
    assert names == sorted(names, key=str.lower)           # unranked players are listed alphabetically, not by who joined first


def test_leapfrog_ladder_updates_after_each_verified_match(env):
    db = Db()
    ladder = full(db)
    play(db, ladder, db.bob, db.cy, challenger_wins=True)          # both new: Bob (winner) above Cy
    assert order(ladder) == [db.bob, db.cy]
    play(db, ladder, db.di, db.cy, challenger_wins=False)          # a new player loses: placed directly below Cy
    assert order(ladder) == [db.bob, db.cy, db.di]
    play(db, ladder, db.di, db.bob, challenger_wins=True)          # Di (3rd) beats Bob (1st): leapfrogs to the top
    assert order(ladder) == [db.di, db.bob, db.cy]
    assert cl.member_entry(ladder, db.di)["status"] == "ranked" and cl.member_entry(ladder, db.ann)["rank"] is None
    assert len(db.ladder_results.docs) == 3 and db.ladder_results.docs[-1]["after"][0]["player_id"] == db.di


def test_points_ladder_ranks_by_points(env):
    db = Db()
    ladder = full(db, "points")
    play(db, ladder, db.bob, db.cy, True)
    play(db, ladder, db.di, db.cy, True)
    play(db, ladder, db.di, db.bob, True)
    bob, cy, di = (cl.member_entry(ladder, u) for u in (db.bob, db.cy, db.di))
    assert (di["points"], bob["points"], cy["points"]) == (6, 4, 2)    # 3 per win, 1 per loss
    assert order(ladder) == [db.di, db.bob, db.cy]


def test_elo_ladder_moves_ratings_by_opponent_strength(env):
    db = Db()
    ladder = full(db, "elo")
    play(db, ladder, db.bob, db.cy, True)
    bob, cy = cl.member_entry(ladder, db.bob), cl.member_entry(ladder, db.cy)
    assert (bob["elo"], cy["elo"]) == (1016, 984)                       # equal ratings: K/2 each way
    play(db, ladder, db.cy, db.bob, True)                               # the underdog wins: bigger swing
    bob, cy = cl.member_entry(ladder, db.bob), cl.member_entry(ladder, db.cy)
    assert cy["elo"] > 984 + 16 and bob["elo"] < 1016 - 15
    assert sum(e["elo"] for e in ladder["entries"] if e["played"]) == 2000   # ELO only moves rating between players


def test_a_result_is_applied_once_and_never_for_a_dispute(env):
    db = Db()
    ladder = full(db)
    ch = play(db, ladder, db.bob, db.cy, True)
    assert run(lr.apply_result(db, ch)) is False and len(db.ladder_results.docs) == 1
    other = run(cl.challenge(db, ladder, db.user(db.di), db.bob))
    run(dc.accept(db, other, db.user(db.bob)))
    run(dc.submit_score(db, other, db.user(db.di), [{"a": 6, "b": 0}, {"a": 6, "b": 0}]))
    run(dc.dispute_score(db, other, db.user(db.bob), "that score is wrong"))
    assert order(ladder) == [db.bob, db.cy]                              # a disputed result changes nothing
    run(dc.admin_resolve(db, other, {"_id": "admin1"}, "confirm"))
    assert order(ladder)[0] == db.di or db.di in order(ladder)           # settled by an admin: now it counts
    assert len(db.ladder_results.docs) == 2


def test_withdrawing_closes_the_gap_in_leapfrog(env):
    db = Db()
    ladder = full(db)
    play(db, ladder, db.bob, db.cy, True)
    play(db, ladder, db.di, db.cy, False)
    run(cl.withdraw(db, ladder, db.user(db.cy)))
    assert order(ladder) == [db.bob, db.di] and rank_of(ladder, db.di) == 2
    assert cl.member_entry(ladder, db.cy) is None
    assert lr.entry_of(ladder["entries"], db.cy) is None


def test_reconcile_applies_a_confirmed_result_that_was_missed(env):
    db = Db()
    ladder = full(db)
    ch = run(cl.challenge(db, ladder, db.user(db.bob), db.cy))
    run(dc.accept(db, ch, db.user(db.cy)))
    run(dc.submit_score(db, ch, db.user(db.bob), [{"a": 6, "b": 1}, {"a": 6, "b": 1}]))
    ch["status"] = "confirmed"                                           # confirmed, but the ranking step never ran
    ch["result"] = {**ch["result"], "confirmed_at": "2026-01-01T00:00:00+00:00"}
    assert order(ladder) == []
    assert run(lr.reconcile(db)) == 1
    assert order(ladder) == [db.bob, db.cy]


# ── Create, edit, publish ─────────────────────────────────────────────────────

def test_create_draft_validates_every_setting(env):
    db = Db()
    ann = db.user(db.ann)
    for bad in ({"name": "ab"}, {"sport": "cricket"}, {"max_participants": 5}, {"ranking_method": "swiss"},
                {"duration_days": 45}, {"visibility": "secret"}, {"division_label": "Pro"}, {"city": " "}, {"zip_code": "!!"},
                {"format": "triples"}):
        assert err(cl.create_draft, db, ann, cfg_in(**bad)).status == 400, bad
    ladder = run(cl.create_draft(db, ann, cfg_in()))
    assert ladder["status"] == "draft" and ladder["entries"] == [] and ladder["is_active"] is False
    assert ladder["owner_id"] == db.ann and ladder["type"] == "community" and ladder["scheduling"] == "flexible"


def test_a_player_can_only_run_a_few_ladders(env, monkeypatch):
    db = Db()
    monkeypatch.setattr(cfg, "LADDER_MAX_OWNED_ACTIVE", 2)
    make(db, publish=False)
    make(db, publish=False)
    assert err(cl.create_draft, db, db.user(db.ann), cfg_in()).status == 409


def test_publish_registers_the_creator_unranked_and_opens_invitations(env):
    db = Db()
    ladder = run(cl.create_draft(db, db.user(db.ann), cfg_in()))
    assert err(cl.invite_email, db, ladder, db.user(db.ann), "x@y.com").status == 409          # not before publishing
    run(cl.publish(db, ladder, db.user(db.ann)))
    assert ladder["status"] == "active" and ladder["is_active"] and ladder["invite_token"] and ladder["ends_at"]
    assert [e["player_id"] for e in ladder["entries"]] == [db.ann] and ladder["entries"][0]["rank"] is None
    assert err(cl.publish, db, ladder, db.user(db.ann)).status == 409                           # already published
    assert err(cl.publish, db, run(cl.create_draft(db, db.user(db.ann), cfg_in(name="Other ladder"))), db.user(db.bob)).status == 403


def test_settings_lock_after_publishing(env):
    db = Db()
    draft = run(cl.create_draft(db, db.user(db.ann), cfg_in()))
    run(cl.update_settings(db, draft, db.user(db.ann), {"ranking_method": "elo", "city": "Marietta", "max_participants": 4}))
    assert draft["ranking_method"] == "elo" and draft["city"] == "Marietta"
    run(cl.publish(db, draft, db.user(db.ann)))
    assert err(cl.update_settings, db, draft, db.user(db.ann), {"ranking_method": "points"}).status == 409
    assert err(cl.update_settings, db, draft, db.user(db.bob), {"name": "Mine now"}).status == 403
    run(cl.update_settings(db, draft, db.user(db.ann), {"name": "Renamed ladder", "visibility": "private", "ranking_method": "elo"}))
    assert draft["name"] == "Renamed ladder" and draft["visibility"] == "private"


def test_player_limit_cannot_drop_below_current_players(env):
    db = Db()
    ladder = full(db, max_participants=8)
    run(cl.update_settings(db, ladder, db.user(db.ann), {"max_participants": 4}))      # 4 players, limit 4: allowed
    assert ladder["max_participants"] == 4
    join_fail = err(cl.join_public, db, ladder, db.user(db.eve))
    assert join_fail.status == 409 and "full" in join_fail.detail


# ── Invitations ───────────────────────────────────────────────────────────────

def test_invite_a_registered_player_by_name(env):
    db = Db()
    ladder = make(db)
    invite = run(cl.invite_user(db, ladder, db.user(db.ann), db.bob))
    assert invite["status"] == "invited" and invite["invitee_user_id"] == db.bob
    assert any(n["user_id"] == db.bob and n["type"] == "ladder_invite" and "token=" in n["link"] for n in db.user_notifications.docs)
    assert err(cl.invite_user, db, ladder, db.user(db.ann), db.bob).status == 409              # already has an open invitation
    assert err(cl.invite_user, db, ladder, db.user(db.bob), db.cy).status == 403               # only the creator invites
    run(cl.join_with_token(db, db.user(db.bob), invite["token"]))
    assert cl.member_entry(ladder, db.bob) and db.ladder_invites.docs[0]["status"] == "accepted"
    assert any(n["user_id"] == db.ann and n["type"] == "ladder_invite_accepted" for n in db.user_notifications.docs)
    assert err(cl.join_with_token, db, db.user(db.bob), invite["token"]).status == 409          # an invitation works once


def test_invite_by_email_for_a_non_member_sends_a_link_and_survives_registration(env):
    db = Db()
    ladder = make(db)
    invite = run(cl.invite_email(db, ladder, db.user(db.ann), "New.Friend@Example.com"))
    assert invite["type"] == "email" and invite["email"] == "new.friend@example.com" and invite["invitee_user_id"] is None
    assert env == ["new.friend@example.com"]
    # the token is all the new player needs after they register
    newbie = db.add("Newbie Net", city="Atlanta")
    preview = run(cl.resolve_token(db, invite["token"]))
    assert preview[0] == "invite" and cl.preview(preview[2], preview[1])["name"] == ladder["name"]
    run(cl.join_with_token(db, db.user(newbie), invite["token"]))
    assert cl.member_entry(ladder, newbie)


def test_invite_by_email_of_an_existing_player_becomes_a_normal_invitation(env):
    db = Db()
    ladder = make(db)
    invite = run(cl.invite_email(db, ladder, db.user(db.ann), "bob@example.com"))
    assert invite["type"] == "user" and invite["invitee_user_id"] == db.bob
    assert env == ["bob@example.com"]                                                           # an in-app notice plus an email to a member
    assert err(cl.invite_email, db, ladder, db.user(db.ann), "not-an-email").status == 400


def test_invitation_to_someone_else_is_refused_and_decline_expire_revoke_work(env):
    db = Db()
    ladder = make(db)
    invite = run(cl.invite_user(db, ladder, db.user(db.ann), db.bob))
    assert err(cl.join_with_token, db, db.user(db.cy), invite["token"]).status == 403
    run(cl.join_with_token(db, db.user(db.bob), invite["token"], "decline"))
    assert db.ladder_invites.docs[0]["status"] == "declined" and not cl.member_entry(ladder, db.bob)
    assert any(n["type"] == "ladder_invite_declined" for n in db.user_notifications.docs)

    expired = run(cl.invite_user(db, ladder, db.user(db.ann), db.cy))
    expired["expires_at"] = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    assert err(cl.join_with_token, db, db.user(db.cy), expired["token"]).status == 409
    assert db.ladder_invites.docs[1]["status"] == "expired"

    revoked = run(cl.invite_user(db, ladder, db.user(db.ann), db.di))
    run(cl.revoke_invite(db, ladder, db.user(db.ann), str(revoked["_id"])))
    assert err(cl.join_with_token, db, db.user(db.di), revoked["token"]).status == 409
    assert err(cl.join_with_token, db, db.user(db.di), "no-such-token").status == 404


def test_share_link_is_reusable_until_rotated(env):
    db = Db()
    ladder = make(db, visibility="private")
    token = ladder["invite_token"]
    run(cl.join_with_token(db, db.user(db.bob), token))
    run(cl.join_with_token(db, db.user(db.cy), token))
    assert len(lr.live(ladder["entries"])) == 3
    run(cl.rotate_link(db, ladder, db.user(db.ann)))
    assert err(cl.join_with_token, db, db.user(db.di), token).status == 404
    run(cl.join_with_token(db, db.user(db.di), ladder["invite_token"]))
    assert cl.member_entry(ladder, db.di)


# ── Joining ───────────────────────────────────────────────────────────────────

def test_public_open_ladder_lets_players_join_and_blocks_duplicates_and_overflow(env):
    db = Db()
    ladder = make(db, max_participants=4)
    assert join(db, ladder, db.bob) == {"joined": True, "requested": False}
    assert err(cl.join_public, db, ladder, db.user(db.bob)).status == 409
    join(db, ladder, db.cy)
    join(db, ladder, db.di)
    assert err(cl.join_public, db, ladder, db.user(db.eve)).status == 409
    assert any(n["type"] == "ladder_new_participant" for n in db.user_notifications.docs)


def test_private_ladder_needs_an_invitation(env):
    db = Db()
    ladder = make(db, visibility="private")
    assert err(cl.join_public, db, ladder, db.user(db.bob)).status == 403
    assert cl.can_view(ladder, db.user(db.bob)) is False
    assert cl.can_view(ladder, db.user(db.bob), token_ok=True) is True
    assert cl.can_view(ladder, db.user(db.ann)) is True
    assert cl.can_view(ladder, None) is False
    assert cl.can_view(ladder, {"_id": "x", "role": "admin"}) is True


def test_approval_ladder_queues_requests_for_the_creator(env):
    db = Db()
    ladder = make(db, join_mode="approval")
    assert join(db, ladder, db.bob) == {"joined": False, "requested": True}
    assert not cl.member_entry(ladder, db.bob)
    assert err(cl.join_public, db, ladder, db.user(db.bob)).status == 409                     # already asked
    assert any(n["user_id"] == db.ann and n["type"] == "ladder_join_request" for n in db.user_notifications.docs)
    req = db.ladder_invites.docs[0]
    assert err(cl.answer_request, db, ladder, db.user(db.bob), str(req["_id"]), "approve").status == 403
    run(cl.answer_request(db, ladder, db.user(db.ann), str(req["_id"]), "approve"))
    assert cl.member_entry(ladder, db.bob) and req["status"] == "accepted"
    join(db, ladder, db.cy)
    run(cl.answer_request(db, ladder, db.user(db.ann), str(db.ladder_invites.docs[1]["_id"]), "decline"))
    assert not cl.member_entry(ladder, db.cy)


def test_paused_or_closed_ladders_take_no_new_players(env):
    db = Db()
    ladder = make(db)
    run(cl.set_paused(db, ladder, db.user(db.ann), True))
    assert err(cl.join_public, db, ladder, db.user(db.bob)).status == 409
    run(cl.set_paused(db, ladder, db.user(db.ann), False))
    join(db, ladder, db.bob)
    run(cl.close(db, ladder, db.user(db.ann)))
    assert err(cl.join_public, db, ladder, db.user(db.cy)).status == 409


# ── Doubles ───────────────────────────────────────────────────────────────────

def test_doubles_ladder_is_made_of_teams(env):
    db = Db()
    ladder = make(db, format="doubles", partner_id=db.bob)
    assert err(cl.join_public, db, ladder, db.user(db.cy)).status == 400                       # a partner is required
    assert err(cl.join_public, db, ladder, db.user(db.cy), db.cy).status == 400
    assert err(cl.join_public, db, ladder, db.user(db.cy), db.bob).status == 409               # Bob is already on a team
    join(db, ladder, db.cy, db.di)
    assert [e["name"] for e in ladder["entries"]] == ["Ann Ace & Bob Baseline", "Cy Court & Di Drop"]
    assert cl.member_entry(ladder, db.di)["player_id"] == db.cy                                 # the team is found by either member
    assert any(n["user_id"] == db.di and n["type"] == "ladder_partner" for n in db.user_notifications.docs)


def test_doubles_ladder_match_ranks_the_team(env):
    db = Db()
    ladder = make(db, format="doubles", partner_id=db.bob)
    join(db, ladder, db.cy, db.di)
    ch = run(cl.challenge(db, ladder, db.user(db.ann), db.cy))
    assert ch["side1"] == [db.ann, db.bob] and ch["side2"] == [db.cy, db.di] and ch["ladder_id"] == str(ladder["_id"])
    run(dc.accept(db, ch, db.user(db.di)))                                                      # either teammate may answer
    run(dc.submit_score(db, ch, db.user(db.bob), [{"a": 6, "b": 2}, {"a": 6, "b": 2}]))
    run(dc.confirm_score(db, ch, db.user(db.di)))
    assert order(ladder) == [db.ann, db.cy]


# ── Challenges ────────────────────────────────────────────────────────────────

def test_only_members_of_the_same_active_ladder_can_challenge(env):
    db = Db()
    ladder = full(db)
    assert err(cl.challenge, db, ladder, db.user(db.eve), db.bob).status == 403                # not in the ladder
    assert err(cl.challenge, db, ladder, db.user(db.bob), db.eve).status == 400                # target not in it
    assert err(cl.challenge, db, ladder, db.user(db.bob), db.bob).status == 400
    ch = run(cl.challenge(db, ladder, db.user(db.bob), db.cy, "Saturday?"))
    assert ch["ladder_id"] == str(ladder["_id"]) and ch["source"] == "ladder" and ch["ladder_name"] == ladder["name"]
    run(cl.set_paused(db, ladder, db.user(db.ann), True))
    assert err(cl.challenge, db, ladder, db.user(db.bob), db.di).status == 400                 # paused
    assert any(n["user_id"] == db.cy and n["type"] == "challenge_received" for n in db.user_notifications.docs)


def test_leapfrog_challenges_reach_a_limited_distance_above(env, monkeypatch):
    db = Db()
    monkeypatch.setattr(cfg, "LADDER_CHALLENGE_RANK_RANGE", 1)
    ladder = full(db, players=(db.bob, db.cy, db.di, db.eve))
    play(db, ladder, db.bob, db.cy, True)
    play(db, ladder, db.di, db.cy, False)
    play(db, ladder, db.eve, db.di, False)            # order: bob, cy, di, eve
    assert order(ladder) == [db.bob, db.cy, db.di, db.eve]
    assert err(cl.challenge, db, ladder, db.user(db.eve), db.bob).status == 400                # 3 places up, range is 1
    assert err(cl.challenge, db, ladder, db.user(db.cy), db.di).status == 400                  # cannot challenge below
    run(cl.challenge(db, ladder, db.user(db.eve), db.di))
    me = cl.member_entry(ladder, db.bob)
    assert cl.eligible_targets(ladder, me) == [db.ann]          # Bob is rank 1: only an unranked player is left to challenge


def test_challenge_limits_prevent_spam_and_repeat_farming(env, monkeypatch):
    db = Db()
    ladder = full(db)
    monkeypatch.setattr(cfg, "LADDER_MAX_OPEN_OUTGOING", 2)
    run(cl.challenge(db, ladder, db.user(db.bob), db.cy))
    run(cl.challenge(db, ladder, db.user(db.bob), db.di))
    assert err(cl.challenge, db, ladder, db.user(db.bob), db.ann).status == 409
    assert err(cl.challenge, db, ladder, db.user(db.bob), db.cy).status in (409,)               # one open challenge per pair
    monkeypatch.setattr(cfg, "LADDER_MAX_OPEN_OUTGOING", 5)
    monkeypatch.setattr(cfg, "LADDER_REMATCH_COOLDOWN_HOURS", 24)
    ch = run(cl.challenge(db, ladder, db.user(db.ann), db.cy))
    run(dc.accept(db, ch, db.user(db.cy)))
    run(dc.submit_score(db, ch, db.user(db.ann), [{"a": 6, "b": 0}, {"a": 6, "b": 0}]))
    run(dc.confirm_score(db, ch, db.user(db.cy)))
    again = err(cl.challenge, db, ladder, db.user(db.cy), db.ann)        # the loser asks straight back for a rematch
    assert again.status == 409 and "24 hours" in again.detail


def test_closing_a_ladder_cancels_open_challenges_but_keeps_the_record(env):
    db = Db()
    ladder = full(db)
    play(db, ladder, db.bob, db.cy, True)
    open_ch = run(cl.challenge(db, ladder, db.user(db.di), db.bob))
    run(cl.close(db, ladder, db.user(db.ann)))
    assert open_ch["status"] == "cancelled" and ladder["status"] == "closed" and ladder["is_active"] is False
    assert order(ladder) == [db.bob, db.cy]
    assert any(n["type"] == "ladder_closed" for n in db.user_notifications.docs)
    assert err(cl.close, db, ladder, db.user(db.ann)).status == 409


def test_ladder_matches_stay_out_of_friendly_challenge_stats(env):
    db = Db()
    ladder = full(db)
    play(db, ladder, db.bob, db.cy, True)
    assert run(dc.stats(db, db.bob))["completed"] == 0 and run(dc.stats(db, db.bob))["total_challenges"] == 0
    groups = run(dc.mine(db, db.user(db.bob)))
    assert len(groups["completed"]) == 1                                                       # but they still show in the list


# ── Permissions ───────────────────────────────────────────────────────────────

def test_withdraw_and_removal_rules(env):
    db = Db()
    ladder = full(db)
    assert err(cl.withdraw, db, ladder, db.user(db.ann)).status == 409                         # the creator closes instead
    assert err(cl.remove_participant, db, ladder, db.user(db.bob), db.cy).status == 403
    assert err(cl.remove_participant, db, ladder, db.user(db.ann), db.ann).status == 409
    play(db, ladder, db.bob, db.cy, True)
    assert err(cl.remove_participant, db, ladder, db.user(db.ann), db.bob).status == 409       # played: stays on the record
    run(cl.remove_participant(db, ladder, db.user(db.ann), db.di, "no response"))
    assert cl.member_entry(ladder, db.di) is None
    assert any(n["user_id"] == db.di and n["type"] == "ladder_removed" for n in db.user_notifications.docs)
    run(cl.remove_participant(db, ladder, {"_id": "admin1", "role": "admin"}, db.bob, "moderation"))   # admins can
    assert order(ladder) == [db.cy] and rank_of(ladder, db.cy) == 1


def test_withdrawing_cancels_that_players_open_challenges(env):
    db = Db()
    ladder = full(db)
    ch = run(cl.challenge(db, ladder, db.user(db.bob), db.cy))
    run(cl.withdraw(db, ladder, db.user(db.cy)))
    assert ch["status"] == "cancelled"


def test_the_creator_cannot_touch_scores_or_ranks(env):
    db = Db()
    ladder = full(db)
    ch = run(cl.challenge(db, ladder, db.user(db.bob), db.cy))
    run(dc.accept(db, ch, db.user(db.cy)))
    run(dc.submit_score(db, ch, db.user(db.bob), [{"a": 6, "b": 1}, {"a": 6, "b": 1}]))
    ann = db.user(db.ann)                                                                      # the creator, not in this match
    for call in (lambda: dc.confirm_score(db, ch, ann), lambda: dc.submit_score(db, ch, ann, [{"a": 6, "b": 0}]),
                 lambda: dc.dispute_score(db, ch, ann, "I do not like it"), lambda: dc.admin_resolve(db, ch, ann, "void")):
        with pytest.raises(dc.ChallengeError):
            run(call())
    assert order(ladder) == []


# ── Dashboard and discovery ───────────────────────────────────────────────────

def test_dashboard_view_for_player_owner_and_stranger(env):
    db = Db()
    ladder = full(db)
    play(db, ladder, db.bob, db.cy, True)
    run(cl.challenge(db, ladder, db.user(db.di), db.bob))
    owner = run(cl.view(db, ladder, db.user(db.ann)))
    assert owner["participant_count"] == 4 and owner["matches_played"] == 1 and owner["is_owner"] and owner["can"]["invite"]
    assert owner["invite_link"].endswith(ladder["invite_token"]) and len(owner["activity"]) == 4
    assert [s["name"] for s in owner["standings"][:2]] == ["Bob Baseline", "Cy Court"]
    assert owner["standings"][0]["win_pct"] == 100 and owner["standings"][1]["win_pct"] == 0
    assert len(owner["recent"]) == 1 and owner["recent"][0]["winner_side"] == 1
    bob = run(cl.view(db, ladder, db.user(db.bob)))
    assert bob["my_entry"]["rank"] == 1 and bob["eligible_targets"] and "invite_link" not in bob and not bob["is_owner"]
    assert len(bob["pending"]) == 1 and bob["pending"][0]["can"]["accept"]
    stranger = run(cl.view(db, ladder, db.user(db.eve)))
    assert stranger["can"]["join"] and stranger["my_entry"] is None and stranger["eligible_targets"] == []
    assert stranger["pending"] == []
    assert owner["recommendation"] is None
    assert run(cl.view(db, make(Db()), None))["recommendation"]                                # one player: nudged to invite more


def test_ranking_history_is_kept_as_an_audit_trail(env):
    db = Db()
    ladder = full(db)
    play(db, ladder, db.bob, db.cy, True)
    hist = run(cl.history(db, ladder))
    assert len(hist) == 1 and hist[0]["winner"] == db.bob and hist[0]["before"] != hist[0]["after"] and hist[0]["method"] == "leapfrog"


def test_official_ladders_are_untouched(env, monkeypatch):
    db = Db()
    official = {"_id": ObjectId(), "city": "Atlanta", "sport": "tennis", "division_label": "Advanced", "format": "singles",
                "is_active": True, "created_at": "2026-01-01", "entries": [{"player_id": db.bob, "name": "Bob", "rank": 1, "elo": 1500}]}
    db.ladders.docs.append(official)
    official_id = str(official["_id"])
    pub = make(db)
    pub_id = str(pub["_id"])
    priv = make(db, visibility="private", name="Hidden ladder")
    priv_id = str(priv["_id"])
    as_anon = types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)), cookies={}, headers={})

    async def nobody(request, database):
        return None
    monkeypatch.setattr(ladder_routes, "get_optional_user", nobody)
    listing = run(ladder_routes.list_ladders(as_anon))
    ids = [l["id"] for l in listing]
    assert official_id in ids and pub_id in ids and priv_id not in ids
    community = next(l for l in listing if l["id"] == pub_id)
    assert community["entry_count"] == 1 and community["entries"] == [] and "invite_token" not in community
    assert next(l for l in listing if l["id"] == official_id)["entries"] == []         # official: unchanged behaviour (counts hidden)
    with pytest.raises(HTTPException) as e:
        run(ladder_routes.get_ladder(pub_id, as_anon))                                  # community ladders are read elsewhere
    assert e.value.status_code == 404
    assert run(ladder_routes.get_ladder(official_id, as_anon))["id"] == official_id


# ── Housekeeping ──────────────────────────────────────────────────────────────

def test_ladders_complete_when_time_runs_out_and_inactive_ones_close(env):
    db = Db()
    ladder = full(db)
    play(db, ladder, db.bob, db.cy, True)
    later = datetime.now(timezone.utc) + timedelta(days=ladder["duration_days"], minutes=1)
    assert run(cl.process(db, later))["completed"] == 1
    assert ladder["status"] == "completed" and ladder["is_active"] is False and order(ladder) == [db.bob, db.cy]

    quiet = make(db, name="Quiet ladder")
    assert run(cl.process(db, datetime.now(timezone.utc) + timedelta(days=cfg.LADDER_INACTIVE_DAYS, hours=1)))["inactive"] == 1
    assert quiet["status"] == "closed"

    draft = run(cl.create_draft(db, db.user(db.cy), cfg_in(name="Forgotten draft")))
    assert run(cl.process(db, datetime.now(timezone.utc) + timedelta(days=cfg.LADDER_DRAFT_EXPIRY_DAYS + 1)))["drafts_expired"] == 1
    assert draft["status"] == "expired"


def test_stale_invitations_expire(env):
    db = Db()
    ladder = make(db)
    run(cl.invite_user(db, ladder, db.user(db.ann), db.bob))
    out = run(cl.process(db, datetime.now(timezone.utc) + timedelta(days=cfg.LADDER_INVITE_EXPIRY_DAYS + 1)))
    assert out["invites_expired"] == 1 and db.ladder_invites.docs[0]["status"] == "expired"


def test_match_reminders_go_out_once_before_a_booked_match(env):
    db = Db()
    ladder = full(db)
    ch = run(cl.challenge(db, ladder, db.user(db.bob), db.cy))
    run(dc.accept(db, ch, db.user(db.cy)))
    soon = (datetime.now(timezone.utc) + timedelta(hours=10)).isoformat()
    run(dc.propose(db, ch, db.user(db.bob), (datetime.now(timezone.utc) + timedelta(hours=10)).isoformat(), "Piedmont Park", None))
    run(dc.respond(db, ch, db.user(db.cy), ch["proposals"][0]["id"], "accept"))
    assert run(dc.process_expiries(db))["reminded"] == 1
    assert run(dc.process_expiries(db))["reminded"] == 0
    assert sum(1 for n in db.user_notifications.docs if n["type"] == "match_reminder") == 2
    assert soon


# ── Routes ────────────────────────────────────────────────────────────────────

def req(db):
    return types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)), client=None, cookies={}, headers={})


def as_user(monkeypatch, db, uid):
    async def fake(request, database):
        return db.user(uid) if uid else None
    monkeypatch.setattr(routes, "get_current_user", fake)
    monkeypatch.setattr(routes, "get_optional_user", fake)


def test_routes_create_publish_invite_join_challenge(env, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.ann)
    draft = run(routes.create_ladder(routes.LadderIn(**cfg_in(visibility="private")), req(db)))
    lid = draft["id"]
    assert draft["status"] == "draft" and draft["can"]["publish"]
    live = run(routes.publish(lid, routes.PartnerIn(), req(db)))
    assert live["status"] == "active" and live["participant_count"] == 1 and live["invite_link"]
    token = live["invite_link"].split("token=")[1]

    as_user(monkeypatch, db, db.bob)                                            # private: invisible without a token
    with pytest.raises(HTTPException) as e:
        run(routes.get_ladder(lid, req(db)))
    assert e.value.status_code == 404
    seen = run(routes.get_ladder(lid, req(db), token=token))
    assert seen["name"] == "Atlanta Social Ladder"
    preview = run(routes.preview_invite(req(db), token=token))
    assert preview["name"] == "Atlanta Social Ladder" and "standings" not in preview
    as_user(monkeypatch, db, None)
    assert run(routes.preview_invite(req(db), token=token))["participants"] == 1               # no login needed to preview
    as_user(monkeypatch, db, db.bob)
    assert run(routes.join_with_token(routes.TokenIn(token=token), req(db)))["id"] == lid
    as_user(monkeypatch, db, db.cy)
    run(routes.join_with_token(routes.TokenIn(token=token), req(db)))

    as_user(monkeypatch, db, db.bob)
    ch = run(routes.challenge(lid, routes.ChallengeIn(opponent_id=db.cy, message="Game on"), req(db)))
    assert ch["ladder_id"] == lid and ch["status"] == "sent"
    with pytest.raises(HTTPException) as e:
        run(routes.challenge(lid, routes.ChallengeIn(opponent_id=db.ann), req(db)))
        run(routes.challenge(lid, routes.ChallengeIn(opponent_id=db.ann), req(db)))
    assert e.value.status_code in (400, 409)

    as_user(monkeypatch, db, db.cy)
    mine = run(routes.my_ladders(req(db)))
    assert [m["id"] for m in mine] == [lid] and mine[0]["is_owner"] is False
    as_user(monkeypatch, db, db.eve)
    with pytest.raises(HTTPException) as e:
        run(routes.update_ladder(lid, routes.LadderPatch(name="Hijacked ladder"), req(db)))
    assert e.value.status_code == 403
    with pytest.raises(HTTPException) as e:
        run(routes.close(lid, routes.ReasonIn(), req(db)))
    assert e.value.status_code == 403


def test_admin_can_moderate_any_ladder_and_it_is_audited(env, monkeypatch):
    db = Db()
    ladder = full(db)
    db.audit_log = FakeColl()
    admin = db.add("Root Admin")
    next(u for u in db.users.docs if str(u["_id"]) == admin)["role"] = "admin"
    as_user(monkeypatch, db, admin)
    run(routes.pause(str(ladder["_id"]), req(db)))
    assert ladder["status"] == "paused"
    out = run(routes.close(str(ladder["_id"]), routes.ReasonIn(reason="spam"), req(db)))
    assert out["status"] == "closed"
    assert [a["action"] for a in db.audit_log.docs] == ["community_ladder.pause", "community_ladder.close"]
    assert len(run(routes.admin_list(req(db)))) == 1
    as_user(monkeypatch, db, db.bob)
    with pytest.raises(HTTPException) as e:
        run(routes.admin_list(req(db)))
    assert e.value.status_code == 403
