"""Direct player challenges: lifecycle, scheduling, scoring, stats, notifications. In-memory fake database."""
import sys
import types
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import direct_challenge as dc  # noqa: E402
import email_service  # noqa: E402
from routes import direct_challenge_routes as routes  # noqa: E402
from test_league_schedule import Coll, Cursor, run  # noqa: E402


class FakeColl(Coll):
    """Coll plus array-membership matching, insert_one, update_many and cursor limit."""

    @classmethod
    def _match(cls, doc, q):
        for k, v in q.items():
            if k == "$or":
                if not any(cls._match(doc, sub) for sub in v):
                    return False
                continue
            have = doc.get(k)
            if isinstance(v, dict):
                if "$in" in v and have not in v["$in"]:
                    return False
                if "$ne" in v and have == v["$ne"]:
                    return False
                if "$gte" in v and not (have is not None and have >= v["$gte"]):
                    return False
                if "$regex" in v:
                    import re
                    if not re.search(v["$regex"], str(have or ""), re.I if "i" in v.get("$options", "") else 0):
                        return False
            elif isinstance(have, list):
                if v not in have:
                    return False
            elif have != v:
                return False
        return True

    def find(self, q=None, *a, **kw):
        cur = Cursor([d for d in self.docs if self._match(d, q or {})])
        cur.limit = lambda n: cur
        return cur

    async def insert_one(self, doc):
        doc.setdefault("_id", ObjectId())
        self.docs.append(doc)

    async def update_many(self, q, upd):
        for d in [d for d in self.docs if self._match(d, q)]:
            d.update(upd.get("$set", {}))


class Db:
    def __init__(self):
        self.users, self.direct_challenges = FakeColl(), FakeColl()
        self.user_notifications, self.audit_log = FakeColl(), FakeColl()
        self.ann = self.add("Ann Ace", city="Atlanta", skill_level="3.5")
        self.bob = self.add("Bob Baseline", city="Atlanta", skill_level="3.5")
        self.cy = self.add("Cy Court", city="Marietta", skill_level="4.5")
        self.di = self.add("Di Drop", city="Atlanta", skill_level="3.0")

    def add(self, name, **kw):
        uid = ObjectId()
        self.users.docs.append({"_id": uid, "name": name, "email": f"{name.split()[0].lower()}@example.com",
                                "tennis_rating": 3.0, "pickleball_rating": 3.0, **kw})
        return str(uid)

    def user(self, uid):
        return {**next(u for u in self.users.docs if str(u["_id"]) == uid), "_id": uid}


@pytest.fixture
def sent(monkeypatch):
    out = []

    def fake_schedule(coro):
        out.append(coro.cr_frame.f_locals.get("to"))
        coro.close()
    monkeypatch.setattr(email_service, "schedule", fake_schedule)
    return out


def make(db, who=None, opp=None, **kw):
    data = {"opponent_id": opp or db.bob, "sport": "tennis", "format": "singles", **kw}
    return run(dc.create(db, db.user(who or db.ann), data))


def future(hours=48):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def to_scheduling(db, **kw):
    ch = make(db, **kw)
    run(dc.accept(db, ch, db.user(db.bob), kw.get("partner_for_opponent")))
    return ch


def to_scheduled(db):
    ch = to_scheduling(db)
    run(dc.propose(db, ch, db.user(db.ann), future(), "Piedmont Park", None))
    run(dc.respond(db, ch, db.user(db.bob), ch["proposals"][0]["id"], "accept"))
    return ch


def err(fn, *a, **kw):
    with pytest.raises(dc.ChallengeError) as e:
        run(fn(*a, **kw))
    return e.value


# ── Create ────────────────────────────────────────────────────────────────────

def test_challenge_needs_no_ladder_and_notifies_the_opponent(sent):
    db = Db()
    ch = make(db, message="Saturday?")
    assert ch["status"] == "sent" and ch["side1"] == [db.ann] and ch["side2"] == [db.bob] and ch["source"] == "direct"
    note = db.user_notifications.docs[0]
    assert note["user_id"] == db.bob and note["type"] == "challenge_received" and note["read_at"] is None
    assert note["link"] == f"/challenges/{ch['_id']}"
    assert sent == ["bob@example.com"]


def test_cannot_challenge_yourself_or_an_unknown_or_inactive_player(sent):
    db = Db()
    assert err(dc.create, db, db.user(db.ann), {"opponent_id": db.ann, "sport": "tennis", "format": "singles"}).status == 400
    assert err(dc.create, db, db.user(db.ann), {"opponent_id": str(ObjectId()), "sport": "tennis", "format": "singles"}).status == 404
    db.users.docs[1]["is_active"] = False
    assert err(dc.create, db, db.user(db.ann), {"opponent_id": db.bob, "sport": "tennis", "format": "singles"}).status == 404


def test_sport_and_format_are_validated(sent):
    db = Db()
    assert err(dc.create, db, db.user(db.ann), {"opponent_id": db.bob, "sport": "cricket", "format": "singles"}).status == 400
    assert err(dc.create, db, db.user(db.ann), {"opponent_id": db.bob, "sport": "tennis", "format": "triples"}).status == 400


def test_duplicate_open_challenge_is_blocked_in_both_directions(sent):
    db = Db()
    make(db)
    assert err(dc.create, db, db.user(db.ann), {"opponent_id": db.bob, "sport": "tennis", "format": "singles"}).status == 409
    assert err(dc.create, db, db.user(db.bob), {"opponent_id": db.ann, "sport": "tennis", "format": "singles"}).status == 409
    make(db, sport="pickleball")  # a different sport is a different challenge


def test_daily_send_limit(sent, monkeypatch):
    db = Db()
    monkeypatch.setattr(dc.cfg, "DAILY_SEND_LIMIT", 2)
    make(db, opp=db.bob)
    make(db, opp=db.cy)
    assert err(dc.create, db, db.user(db.ann), {"opponent_id": db.di, "sport": "tennis", "format": "singles"}).status == 429


def test_doubles_needs_a_distinct_partner_and_singles_has_none(sent):
    db = Db()
    base = {"opponent_id": db.bob, "sport": "tennis", "format": "doubles"}
    assert err(dc.create, db, db.user(db.ann), base).status == 400
    assert err(dc.create, db, db.user(db.ann), {**base, "partner_id": db.bob}).status == 400
    assert err(dc.create, db, db.user(db.ann), {"opponent_id": db.bob, "sport": "tennis", "format": "singles", "partner_id": db.cy}).status == 400
    ch = run(dc.create(db, db.user(db.ann), {**base, "partner_id": db.cy}))
    assert ch["side1"] == [db.ann, db.cy]
    assert {n["user_id"] for n in db.user_notifications.docs} == {db.bob, db.cy}


# ── Answer ────────────────────────────────────────────────────────────────────

def test_only_the_challenged_player_can_accept_or_decline(sent):
    db = Db()
    ch = make(db)
    assert err(dc.accept, db, ch, db.user(db.ann)).status == 403
    assert err(dc.decline, db, ch, db.user(db.cy)).status == 403
    run(dc.accept(db, ch, db.user(db.bob)))
    assert ch["status"] == "scheduling" and ch["accepted_at"]
    assert any(n["user_id"] == db.ann and n["type"] == "challenge_accepted" for n in db.user_notifications.docs)
    assert err(dc.decline, db, ch, db.user(db.bob)).status == 409   # already answered


def test_decline_notifies_the_challenger(sent):
    db = Db()
    ch = make(db)
    run(dc.decline(db, ch, db.user(db.bob)))
    assert ch["status"] == "declined"
    assert any(n["user_id"] == db.ann and n["type"] == "challenge_declined" for n in db.user_notifications.docs)


def test_doubles_accept_requires_a_partner(sent):
    db = Db()
    ch = run(dc.create(db, db.user(db.ann), {"opponent_id": db.bob, "sport": "tennis", "format": "doubles", "partner_id": db.cy}))
    assert err(dc.accept, db, ch, db.user(db.bob)).status == 400
    assert err(dc.accept, db, ch, db.user(db.bob), db.ann).status == 400   # already on the other side
    run(dc.accept(db, ch, db.user(db.bob), db.di))
    assert ch["side2"] == [db.bob, db.di] and ch["names"][db.di] == "Di Drop"


def test_cannot_accept_after_expiry(sent):
    db = Db()
    ch = make(db)
    ch["expires_at"] = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    assert err(dc.accept, db, ch, db.user(db.bob)).status == 409


def test_withdraw_is_for_the_challenger_only(sent):
    db = Db()
    ch = make(db)
    assert err(dc.cancel, db, ch, db.user(db.bob)).status == 403
    run(dc.cancel(db, ch, db.user(db.ann)))
    assert ch["status"] == "cancelled"
    assert err(dc.cancel, db, ch, db.user(db.ann)).status == 409


# ── Scheduling ────────────────────────────────────────────────────────────────

def test_propose_counter_and_accept_schedules_the_match(sent):
    db = Db()
    ch = to_scheduling(db)
    run(dc.propose(db, ch, db.user(db.ann), future(48), "Piedmont Park", "after work"))
    first = ch["proposals"][0]
    assert err(dc.respond, db, ch, db.user(db.ann), first["id"], "accept").status == 403   # not your own proposal
    run(dc.propose(db, ch, db.user(db.bob), future(72), "Chastain Park", None))             # counter
    assert [p["status"] for p in ch["proposals"]] == ["countered", "pending"]
    run(dc.respond(db, ch, db.user(db.ann), ch["proposals"][1]["id"], "accept"))
    assert ch["status"] == "scheduled" and ch["venue"] == "Chastain Park" and ch["scheduled_at"] == ch["proposals"][1]["when"]
    types_ = [n["type"] for n in db.user_notifications.docs]
    assert "schedule_proposed" in types_ and "match_scheduled" in types_


def test_proposal_validation(sent):
    db = Db()
    ch = to_scheduling(db)
    ann = db.user(db.ann)
    assert err(dc.propose, db, ch, ann, "not a date", "Park", None).status == 400
    assert err(dc.propose, db, ch, ann, future(-3), "Park", None).status == 400
    assert err(dc.propose, db, ch, ann, future(24 * 400), "Park", None).status == 400
    assert err(dc.propose, db, ch, ann, future(), "  ", None).status == 400
    assert err(dc.propose, db, ch, db.user(db.cy), future(), "Park", None).status == 403   # stranger
    fresh, unanswered = Db(), None
    unanswered = make(fresh)
    assert err(dc.propose, fresh, unanswered, fresh.user(fresh.ann), future(), "Park", None).status == 409  # not accepted yet


def test_declining_a_proposal_keeps_scheduling_open(sent):
    db = Db()
    ch = to_scheduling(db)
    run(dc.propose(db, ch, db.user(db.ann), future(), "Park", None))
    run(dc.respond(db, ch, db.user(db.bob), ch["proposals"][0]["id"], "decline"))
    assert ch["status"] == "scheduling" and ch["proposals"][0]["status"] == "declined"
    assert any(n["user_id"] == db.ann and n["type"] == "schedule_declined" for n in db.user_notifications.docs)


def test_a_scheduled_match_can_be_cancelled_until_the_cutoff(sent):
    db = Db()
    ch = to_scheduled(db)
    run(dc.cancel(db, ch, db.user(db.bob)))
    assert ch["status"] == "cancelled"
    db2 = Db()
    close = to_scheduled(db2)
    close["scheduled_at"] = future(2)
    assert err(dc.cancel, db2, close, {"_id": close["challenger_id"]}).status == 409
    # an admin can still cancel it
    run(dc.cancel(db2, close, {"_id": "admin1"}, is_admin=True))
    assert close["status"] == "cancelled"


# ── Result ────────────────────────────────────────────────────────────────────

def test_score_validation(sent):
    ok, winner = dc.validate_sets([{"a": 6, "b": 3}, {"a": 4, "b": 6}, {"a": 7, "b": 5}])
    assert winner == 1 and len(ok) == 3
    assert dc.validate_sets([{"a": 3, "b": 6}, {"a": 2, "b": 6}])[1] == 2
    for bad in ([], [{"a": 6, "b": 6}], [{"a": 6, "b": 3}, {"a": 3, "b": 6}], [{"a": -1, "b": 6}],
                [{"a": 99, "b": 6}], [{"a": "x", "b": 1}], "nope", [{"a": 6}]):
        with pytest.raises(dc.ChallengeError):
            dc.validate_sets(bad)


def test_submit_then_other_side_confirms_and_stats_update(sent):
    db = Db()
    ch = to_scheduled(db)
    run(dc.submit_score(db, ch, db.user(db.ann), [{"a": 6, "b": 4}, {"a": 6, "b": 2}]))
    assert ch["status"] == "result_submitted" and ch["result"]["winner_side"] == 1
    # nothing counts until it is confirmed
    assert run(dc.stats(db, db.ann))["completed"] == 0
    assert err(dc.confirm_score, db, ch, db.user(db.ann)).status == 403   # you cannot confirm your own score
    assert err(dc.dispute_score, db, ch, db.user(db.ann), "wrong score here").status == 403
    run(dc.confirm_score(db, ch, db.user(db.bob)))
    assert ch["status"] == "confirmed"
    a, b = run(dc.stats(db, db.ann, vs=db.bob)), run(dc.stats(db, db.bob, vs=db.ann))
    assert (a["completed"], a["wins"], a["losses"], a["win_pct"]) == (1, 1, 0, 100)
    assert (b["completed"], b["wins"], b["losses"], b["win_pct"]) == (1, 0, 1, 0)
    assert a["head_to_head"] == {"matches": 1, "wins": 1, "losses": 0}
    assert b["head_to_head"] == {"matches": 1, "wins": 0, "losses": 1}
    assert a["recent"][0]["won"] is True and b["recent"][0]["won"] is False
    types_ = [n["type"] for n in db.user_notifications.docs]
    assert {"score_confirmation_required", "match_completed"} <= set(types_)


def test_submitter_can_correct_a_score_before_it_is_confirmed(sent):
    db = Db()
    ch = to_scheduled(db)
    run(dc.submit_score(db, ch, db.user(db.ann), [{"a": 6, "b": 4}, {"a": 6, "b": 2}]))
    run(dc.submit_score(db, ch, db.user(db.ann), [{"a": 6, "b": 4}, {"a": 3, "b": 6}, {"a": 6, "b": 4}]))
    assert len(ch["result"]["sets"]) == 3
    assert err(dc.submit_score, db, ch, db.user(db.bob), [{"a": 1, "b": 6}, {"a": 1, "b": 6}]).status == 409


def test_dispute_then_admin_resolution(sent):
    db = Db()
    ch = to_scheduled(db)
    run(dc.submit_score(db, ch, db.user(db.ann), [{"a": 6, "b": 4}, {"a": 6, "b": 2}]))
    assert err(dc.dispute_score, db, ch, db.user(db.bob), "no").status == 400
    run(dc.dispute_score(db, ch, db.user(db.bob), "I won the second set 6-4"))
    assert ch["status"] == "disputed"
    assert run(dc.stats(db, db.ann))["completed"] == 0    # a disputed result counts for nobody
    admin = {"_id": "admin1"}
    run(dc.admin_resolve(db, ch, admin, "set_score", [{"a": 4, "b": 6}, {"a": 2, "b": 6}]))
    assert ch["status"] == "confirmed" and ch["result"]["winner_side"] == 2
    assert run(dc.stats(db, db.bob))["wins"] == 1
    assert err(dc.admin_resolve, db, ch, admin, "void").status == 409   # no longer disputed


def test_admin_can_void_a_disputed_match(sent):
    db = Db()
    ch = to_scheduled(db)
    run(dc.submit_score(db, ch, db.user(db.ann), [{"a": 6, "b": 4}, {"a": 6, "b": 2}]))
    run(dc.dispute_score(db, ch, db.user(db.bob), "we never played this"))
    run(dc.admin_resolve(db, ch, {"_id": "admin1"}, "void"))
    assert ch["status"] == "voided"
    assert run(dc.stats(db, db.ann))["completed"] == 0


def test_a_direct_challenge_never_touches_ladders_matches_or_ratings(sent):
    db = Db()                      # the fake has no ladders, matches or standings collections at all
    ch = to_scheduled(db)
    run(dc.submit_score(db, ch, db.user(db.ann), [{"a": 6, "b": 4}, {"a": 6, "b": 2}]))
    run(dc.confirm_score(db, ch, db.user(db.bob)))
    assert not hasattr(db, "ladders") and not hasattr(db, "matches")
    assert all(u["tennis_rating"] == 3.0 for u in db.users.docs)
    assert ch["source"] == "direct"


# ── Views ─────────────────────────────────────────────────────────────────────

def test_view_permissions_follow_the_viewer(sent):
    db = Db()
    ch = make(db)
    ann, bob = dc.view(ch, db.ann), dc.view(ch, db.bob)
    assert ann["can"]["cancel"] and not ann["can"]["accept"] and ann["my_side"] == 1
    assert bob["can"]["accept"] and bob["can"]["decline"] and not bob["can"]["cancel"] and bob["needs_my_action"]
    stranger = dc.view(ch, db.cy)
    assert stranger["my_side"] is None and not any(stranger["can"].values())
    assert [bucket for bucket in (dc.bucket_of(ch, db.ann), dc.bucket_of(ch, db.bob))] == ["sent", "received"]


def test_phase_is_in_progress_once_the_scheduled_time_arrives(sent):
    db = Db()
    ch = to_scheduled(db)
    assert dc.view(ch, db.ann)["phase"] == "scheduled"
    ch["scheduled_at"] = future(-1)
    assert dc.view(ch, db.ann)["phase"] == "in_progress"


def test_mine_groups_challenges_into_buckets(sent):
    db = Db()
    make(db, opp=db.bob)
    make(db, who=db.cy, opp=db.ann)
    to_scheduled_ch = make(db, opp=db.di)
    run(dc.accept(db, to_scheduled_ch, db.user(db.di)))
    groups = run(dc.mine(db, db.user(db.ann)))
    assert (len(groups["sent"]), len(groups["received"]), len(groups["active"]), len(groups["completed"])) == (1, 1, 1, 0)


# ── Expiry ────────────────────────────────────────────────────────────────────

def test_unanswered_challenges_warn_then_expire(sent):
    db = Db()
    ch = make(db)
    soon = datetime.fromisoformat(ch["expires_at"]) - timedelta(hours=dc.cfg.EXPIRING_WARN_HOURS - 1)
    assert run(dc.process_expiries(db, soon)) == {"expired": 0, "warned": 1, "reminded": 0}
    assert run(dc.process_expiries(db, soon)) == {"expired": 0, "warned": 0, "reminded": 0}        # warned only once
    assert any(n["type"] == "challenge_expiring" and n["user_id"] == db.bob for n in db.user_notifications.docs)
    later = datetime.fromisoformat(ch["expires_at"]) + timedelta(minutes=1)
    assert run(dc.process_expiries(db, later)) == {"expired": 1, "warned": 0, "reminded": 0}
    assert ch["status"] == "expired"
    make(db)   # an expired challenge no longer blocks a new one


# ── Search ────────────────────────────────────────────────────────────────────

def search(db, **kw):
    return run(dc.search_players(db, db.user(db.ann), **kw))


def test_search_filters_and_hides_private_profiles_and_the_searcher(sent):
    db = Db()
    names = lambda r: sorted(c["name"] for c in r)
    assert names(search(db)) == ["Bob Baseline", "Cy Court", "Di Drop"]               # never Ann herself
    assert names(search(db, city="atlanta")) == ["Bob Baseline", "Di Drop"]            # case-insensitive city
    assert names(search(db, min_level=3.5)) == ["Bob Baseline", "Cy Court"]
    assert names(search(db, max_level=3.0)) == ["Di Drop"]
    assert names(search(db, q="cy")) == ["Cy Court"]
    assert search(db, q="c") == []                                                      # one letter is too short
    db.users.docs[1]["profile_public"] = False
    assert "Bob Baseline" not in names(search(db))
    db.users.docs[2]["is_active"] = False
    assert "Cy Court" not in names(search(db))


def test_search_respects_sport_preferences_and_never_returns_email(sent):
    db = Db()
    db.users.docs[1]["sport_preferences"] = ["pickleball"]
    assert "Bob Baseline" not in [c["name"] for c in search(db, sport="tennis")]
    assert "Bob Baseline" in [c["name"] for c in search(db, sport="pickleball")]
    assert all("email" not in c for c in search(db))
    card = search(db)[0]
    assert {"id", "name", "city", "level", "wins", "losses", "head_to_head"} <= set(card)


# ── Routes ────────────────────────────────────────────────────────────────────

def req(db):
    return types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)), client=None)


def as_user(monkeypatch, db, uid):
    async def fake(request, database):
        return db.user(uid)
    monkeypatch.setattr(routes, "get_current_user", fake)


def test_routes_end_to_end_and_authorization(sent, monkeypatch):
    db = Db()
    as_user(monkeypatch, db, db.ann)
    out = run(routes.create_challenge(routes.CreateIn(opponent_id=db.bob, sport="tennis"), req(db)))
    cid = out["id"]
    assert out["status"] == "sent" and out["can"]["cancel"]

    as_user(monkeypatch, db, db.cy)                      # a stranger cannot read or act on it
    for call in (lambda: routes.get_challenge(cid, req(db)), lambda: routes.accept(cid, routes.AcceptIn(), req(db))):
        with pytest.raises(HTTPException) as e:
            run(call())
        assert e.value.status_code == 403

    as_user(monkeypatch, db, db.bob)
    assert run(routes.accept(cid, routes.AcceptIn(), req(db)))["status"] == "scheduling"
    with pytest.raises(HTTPException) as e:              # domain errors surface as HTTP errors
        run(routes.accept(cid, routes.AcceptIn(), req(db)))
    assert e.value.status_code == 409
    with pytest.raises(HTTPException) as e:
        run(routes.get_challenge("not-an-id", req(db)))
    assert e.value.status_code == 404

    run(routes.propose(cid, routes.ProposeIn(when=future(), venue="Piedmont Park"), req(db)))
    as_user(monkeypatch, db, db.ann)
    pid = run(routes.get_challenge(cid, req(db)))["pending_proposal"]["id"]
    assert run(routes.respond_to_proposal(cid, pid, routes.RespondIn(action="accept"), req(db)))["status"] == "scheduled"
    run(routes.submit_score(cid, routes.ScoreIn(sets=[{"a": 6, "b": 1}, {"a": 6, "b": 2}]), req(db)))
    as_user(monkeypatch, db, db.bob)
    done = run(routes.confirm(cid, req(db)))
    assert done["status"] == "confirmed" and done["result"]["winner_side"] == 1
    assert run(routes.my_stats(req(db)))["losses"] == 1
    assert run(routes.player_stats(db.ann, req(db)))["head_to_head"]["wins"] == 1


def test_inbox_lists_and_marks_read_only_own_notifications(sent, monkeypatch):
    db = Db()
    make(db)
    as_user(monkeypatch, db, db.bob)
    inbox = run(routes.inbox(req(db)))
    assert inbox["unread"] == 1 and inbox["items"][0]["type"] == "challenge_received"
    as_user(monkeypatch, db, db.cy)
    run(routes.read_all(req(db)))                         # someone else's read-all must not touch Bob's
    as_user(monkeypatch, db, db.bob)
    assert run(routes.inbox(req(db)))["unread"] == 1
    run(routes.read_one(inbox["items"][0]["id"], req(db)))
    assert run(routes.inbox(req(db)))["unread"] == 0


def test_admin_dispute_endpoints(sent, monkeypatch):
    db = Db()
    ch = to_scheduled(db)
    run(dc.submit_score(db, ch, db.user(db.ann), [{"a": 6, "b": 4}, {"a": 6, "b": 2}]))
    run(dc.dispute_score(db, ch, db.user(db.bob), "I won the second set"))

    async def fake_admin(request, database):
        return {"_id": "admin1", "email": "a@x.com", "role": "admin"}
    monkeypatch.setattr(routes, "require_admin", fake_admin)
    rows = run(routes.admin_list(req(db)))
    assert [r["id"] for r in rows] == [str(ch["_id"])] and rows[0]["can"]["resolve"]
    out = run(routes.admin_resolve(str(ch["_id"]), routes.ResolveIn(action="void"), req(db)))
    assert out["status"] == "voided"
    assert db.audit_log.docs and db.audit_log.docs[0]["action"] == "challenge.resolve"
