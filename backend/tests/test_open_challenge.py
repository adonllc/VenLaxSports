"""Open Challenge Board: posting, discovery, one-winner acceptance, hand-off to the challenge engine, moderation."""
import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import direct_challenge as dc  # noqa: E402
import email_service  # noqa: E402
import open_challenge as oc  # noqa: E402
from routes import open_challenge_routes as routes  # noqa: E402
from test_direct_challenge import FakeColl  # noqa: E402
from test_league_schedule import run  # noqa: E402


class OFake(FakeColl):
    """FakeColl plus range operators, and a yield point on reads so concurrent requests really interleave."""

    @classmethod
    def _match(cls, doc, q):
        for k, v in q.items():
            if isinstance(v, dict) and any(op in v for op in ("$gt", "$lt", "$lte", "$nin")):
                have = doc.get(k)
                if "$gt" in v and not (have is not None and have > v["$gt"]):
                    return False
                if "$lt" in v and not (have is not None and have < v["$lt"]):
                    return False
                if "$lte" in v and not (have is not None and have <= v["$lte"]):
                    return False
                if "$nin" in v and have in v["$nin"]:
                    return False
                rest = {op: x for op, x in v.items() if op not in ("$gt", "$lt", "$lte", "$nin")}
                if rest and not super()._match(doc, {k: rest}):
                    return False
            elif not super()._match(doc, {k: v}):
                return False
        return True

    async def find_one(self, q=None, *a, **kw):
        await asyncio.sleep(0)
        return await super().find_one(q)

    async def delete_many(self, q):
        self.docs = [d for d in self.docs if not self._match(d, q)]

    async def count_documents(self, q=None):
        return len([d for d in self.docs if self._match(d, q or {})])


class Db:
    def __init__(self):
        for n in ("users", "direct_challenges", "user_notifications", "audit_log", "open_challenges",
                  "open_challenge_blocks", "open_challenge_reports", "open_challenge_shares"):
            setattr(self, n, OFake())
        self.ann = self.add("Ann Ace", city="Atlanta", skill_level="3.5", zip_code="30350", avatar="http://x/ann.png")
        self.bob = self.add("Bob Baseline", city="Atlanta", skill_level="3.5", zip_code="30350")
        self.cy = self.add("Cy Court", city="Atlanta", skill_level="5.0")
        self.di = self.add("Di Drop", city="Marietta", skill_level="3.0")
        self.ed = self.add("Ed Edge", city="Atlanta", skill_level="3.5")

    def add(self, name, **kw):
        uid = ObjectId()
        self.users.docs.append({"_id": uid, "name": name, "email": f"{name.split()[0].lower()}@example.com",
                                "tennis_rating": 3.0, "pickleball_rating": 3.0, **kw})
        return str(uid)

    def user(self, uid):
        return {**next(u for u in self.users.docs if str(u["_id"]) == uid), "_id": uid}


@pytest.fixture(autouse=True)
def mail(monkeypatch):
    out = []

    def fake_schedule(coro):
        out.append(coro.cr_frame.f_locals.get("to"))
        coro.close()
    monkeypatch.setattr(email_service, "schedule", fake_schedule)
    return out


def day(n=3):
    return (datetime.now(timezone.utc) + timedelta(days=n)).strftime("%Y-%m-%d")


def post_data(**kw):
    return {"sport": "tennis", "format": "singles", "venue": "Piedmont Park", "date": day(), "time_window": "morning",
            "city": "Atlanta", **kw}


def post(db, who=None, **kw):
    return run(oc.create(db, db.user(who or db.ann), post_data(**kw)))


def err(fn, *a, **kw):
    with pytest.raises(dc.ChallengeError) as e:
        run(fn(*a, **kw))
    return e.value


def future(hours=48):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


# ── Posting ───────────────────────────────────────────────────────────────────

def test_post_needs_no_ladder_and_goes_live():
    db = Db()
    p = post(db)
    assert p["status"] == "open" and p["owner_id"] == db.ann
    assert p["level"] == 3.5 and (p["min_level"], p["max_level"]) == (2.5, 4.5)       # range defaults to level +/- 1
    assert any(n["type"] == "open_challenge_published" and n["user_id"] == db.ann for n in db.user_notifications.docs)


def test_publishing_pings_nearby_eligible_players_in_app_only(mail):
    db = Db()
    post(db)
    pinged = {n["user_id"] for n in db.user_notifications.docs if n["type"] == "open_challenge_match"}
    assert pinged == {db.bob, db.ed}          # Cy is level 5.0, Di is in another city, Ann is the poster
    assert mail == []                         # no email blast


def test_draft_is_not_announced_until_published():
    db = Db()
    p = run(oc.create(db, db.user(db.ann), post_data(), publish=False))
    assert p["status"] == "draft"
    assert [n for n in db.user_notifications.docs if n["type"] == "open_challenge_match"] == []
    run(oc.go_live(db, p, db.user(db.ann)))
    assert p["status"] == "open"


@pytest.mark.parametrize("bad", [
    {"sport": "cricket"}, {"format": "triples"}, {"venue": " "}, {"date": "tomorrow"}, {"date": "2001-01-01"},
    {"time_window": "midnight"}, {"court_pref": "roof"}, {"visibility": "secret"}, {"start_time": "25:00"},
    {"min_level": 4.5, "max_level": 3.0}, {"level": 9}, {"max_distance_miles": 500}, {"zip_code": "!!"},
    {"city": "", "zip_code": ""},
])
def test_invalid_posts_are_rejected(bad):
    db = Db()
    data = post_data(**bad)
    if "city" in bad:
        db.users.docs[0]["city"] = ""
    assert err(oc.create, db, db.user(db.ann), data).status in (400,)


def test_date_too_far_ahead_rejected():
    db = Db()
    assert err(oc.create, db, db.user(db.ann), post_data(date=day(400))).status == 400


def test_duplicate_post_for_same_sport_format_and_date_is_blocked():
    db = Db()
    post(db)
    assert err(oc.create, db, db.user(db.ann), post_data()).status == 409
    post(db, date=day(4))                      # another date is fine
    post(db, sport="pickleball")               # another sport is fine


def test_active_post_cap(monkeypatch):
    db = Db()
    monkeypatch.setattr(oc.cfg, "OPEN_MAX_ACTIVE", 2)
    post(db, date=day(2))
    post(db, date=day(3))
    assert err(oc.create, db, db.user(db.ann), post_data(date=day(4))).status == 429


def test_doubles_post_needs_a_partner():
    db = Db()
    assert err(oc.create, db, db.user(db.ann), post_data(format="doubles")).status == 400
    assert err(oc.create, db, db.user(db.ann), post_data(format="doubles", partner_id=db.ann)).status == 400
    p = post(db, format="doubles", partner_id=db.bob)
    assert p["partner_id"] == db.bob
    assert post(db, who=db.ed, date=day(5))["partner_id"] is None      # singles never keeps a partner


def test_expiry_is_capped_by_match_date_and_life():
    db = Db()
    p = post(db, date=day(1))
    assert p["expires_at"][:10] == day(1)
    q = post(db, date=day(40))
    assert datetime.fromisoformat(q["expires_at"]) <= datetime.now(timezone.utc) + timedelta(days=oc.cfg.OPEN_MAX_LIFE_DAYS, minutes=1)


# ── Owner controls ────────────────────────────────────────────────────────────

def test_owner_edits_pauses_resumes_and_cancels():
    db = Db()
    p = post(db)
    run(oc.edit(db, p, db.user(db.ann), {"venue": "Bitsy Grant", "notes": "bring balls"}))
    assert p["venue"] == "Bitsy Grant" and p["notes"] == "bring balls"
    run(oc.set_paused(db, p, db.user(db.ann), True))
    assert p["status"] == "paused"
    assert run(oc.browse(db, db.user(db.bob), {})) == []                        # paused is off the board
    run(oc.set_paused(db, p, db.user(db.ann), False))
    assert len(run(oc.browse(db, db.user(db.bob), {}))) == 1
    run(oc.withdraw(db, p, db.user(db.ann)))
    assert p["status"] == "cancelled"
    assert err(oc.edit, db, p, db.user(db.ann), {"venue": "x"}).status == 409


def test_only_the_owner_can_change_a_post():
    db = Db()
    p = post(db)
    assert err(oc.edit, db, p, db.user(db.bob), {"venue": "x"}).status == 403
    assert err(oc.set_paused, db, p, db.user(db.bob), True).status == 403
    assert err(oc.withdraw, db, p, db.user(db.bob)).status == 403


def test_changing_level_recentres_the_range():
    db = Db()
    p = post(db)
    run(oc.edit(db, p, db.user(db.ann), {"level": 4.0}))
    assert (p["min_level"], p["max_level"]) == (3.0, 5.0)


# ── Discovery ─────────────────────────────────────────────────────────────────

def test_board_shows_only_what_the_player_may_accept():
    db = Db()
    post(db, min_level=3.0, max_level=4.0)
    assert [c["owner"]["name"] for c in run(oc.browse(db, db.user(db.bob), {}))] == ["Ann Ace"]
    assert run(oc.browse(db, db.user(db.cy), {})) == []                         # level 5.0 is outside 3.0 to 4.0
    assert run(oc.browse(db, db.user(db.ann), {})) == []                        # never your own


def test_link_only_posts_stay_off_the_board():
    db = Db()
    post(db, visibility="link_only")
    assert run(oc.browse(db, db.user(db.bob), {})) == []


def test_filters():
    db = Db()
    post(db, date=day(2), time_window="morning", zip_code="30350")
    post(db, date=day(3), time_window="evening", sport="pickleball", zip_code="30350")
    post(db, date=day(4), time_window="any", city="Marietta", zip_code="30060")
    bob = db.user(db.bob)
    assert len(run(oc.browse(db, bob, {}))) == 3
    assert len(run(oc.browse(db, bob, {"sport": "pickleball"}))) == 1
    assert len(run(oc.browse(db, bob, {"city": "marietta"}))) == 1
    assert len(run(oc.browse(db, bob, {"zip_code": "30060"}))) == 1
    assert len(run(oc.browse(db, bob, {"date": day(2)}))) == 1
    assert {c["date"] for c in run(oc.browse(db, bob, {"time_window": "evening"}))} == {day(3), day(4)}   # "any" fits every window
    assert len(run(oc.browse(db, bob, {"format": "doubles"}))) == 0
    assert len(run(oc.browse(db, bob, {"near": "city"}))) == 2                  # Bob lives in Atlanta
    assert len(run(oc.browse(db, bob, {"near": "zip"}))) == 2                   # 30350 is Bob's ZIP too


def test_nearest_first_and_proximity_label():
    db = Db()
    post(db, date=day(2), city="Marietta", zip_code="30060")
    post(db, date=day(3))
    cards = run(oc.browse(db, db.user(db.bob), {}))
    assert [c["proximity"] for c in cards] == ["same_city", "other"]
    assert all(c["distance_miles"] is None for c in cards)


def test_cards_never_leak_contact_details():
    db = Db()
    post(db)
    card = run(oc.browse(db, db.user(db.bob), {}))[0]
    text = str(card).lower()
    assert "@example.com" not in text and "email" not in text and "phone" not in text
    assert card["owner"]["avatar"] == "http://x/ann.png"


def test_private_profile_hides_the_avatar():
    db = Db()
    db.users.docs[0]["profile_public"] = False
    post(db)
    assert run(oc.browse(db, db.user(db.bob), {}))[0]["owner"]["avatar"] is None


def test_public_preview_hides_venue_notes_and_last_name():
    db = Db()
    p = post(db, notes="my number is private")
    out = oc.public_preview(p, db.users.docs[0])
    assert out["owner_first_name"] == "Ann" and out["available"] is True
    assert "venue" not in out and "notes" not in out and "Ace" not in str(out)


# ── Accepting ─────────────────────────────────────────────────────────────────

def test_accept_reserves_the_post_and_starts_a_match_in_scheduling(mail):
    db = Db()
    p = post(db)
    p2, ch = run(oc.accept(db, p, db.user(db.bob)))
    assert p2["status"] == "accepted" and p2["acceptor_id"] == db.bob and p2["challenge_id"] == str(ch["_id"])
    assert ch["status"] == "scheduling" and ch["source"] == "open_board" and ch["open_id"] == str(p["_id"])
    assert ch["side1"] == [db.ann] and ch["side2"] == [db.bob]
    assert run(oc.browse(db, db.user(db.ed), {})) == []                         # gone from the board
    note = next(n for n in db.user_notifications.docs if n["type"] == "open_challenge_accepted")
    assert note["user_id"] == db.ann and note["link"] == f"/challenges/{ch['_id']}"
    assert "ann@example.com" in mail


def test_two_players_accepting_at_once_only_one_wins():
    db = Db()
    p = post(db)

    async def both():
        return await asyncio.gather(oc.accept(db, p, db.user(db.bob)), oc.accept(db, p, db.user(db.ed)), return_exceptions=True)
    results = run(both())
    winners = [r for r in results if isinstance(r, tuple)]
    losers = [r for r in results if isinstance(r, dc.ChallengeError)]
    assert len(winners) == 1 and len(losers) == 1 and losers[0].status == 409
    assert len(db.direct_challenges.docs) == 1                                  # exactly one match, ever
    assert db.open_challenges.docs[0]["acceptor_id"] == winners[0][0]["acceptor_id"]


def test_second_accept_after_the_first_is_refused():
    db = Db()
    p = post(db)
    run(oc.accept(db, p, db.user(db.bob)))
    stale = dict(p, status="open")                                              # a client still holding the old "open" card
    assert err(oc.accept, db, stale, db.user(db.ed)).status == 409
    assert len(db.direct_challenges.docs) == 1


def test_cannot_accept_own_expired_ineligible_or_unavailable_posts():
    db = Db()
    p = post(db, min_level=3.0, max_level=4.0)
    assert err(oc.accept, db, p, db.user(db.ann)).status == 403
    assert err(oc.accept, db, p, db.user(db.cy)).status == 403                  # level 5.0
    p["expires_at"] = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    db.open_challenges.docs[0]["expires_at"] = p["expires_at"]
    assert err(oc.accept, db, p, db.user(db.bob)).status == 409
    q = post(db, date=day(5))
    run(oc.set_paused(db, q, db.user(db.ann), True))
    assert err(oc.accept, db, q, db.user(db.bob)).status == 409


def test_blocked_players_cannot_accept_either_way():
    db = Db()
    p = post(db)
    run(oc.block(db, db.user(db.ann), db.bob))
    assert err(oc.accept, db, p, db.user(db.bob)).status == 404
    assert run(oc.browse(db, db.user(db.bob), {})) == []
    run(oc.unblock(db, db.user(db.ann), db.bob))
    run(oc.block(db, db.user(db.ed), db.ann))                                   # Ed blocks Ann: Ann's posts vanish for Ed
    assert run(oc.browse(db, db.user(db.ed), {})) == [] and len(run(oc.browse(db, db.user(db.bob), {}))) == 1


def test_failed_hand_off_reopens_the_post(monkeypatch):
    db = Db()
    p = post(db)

    async def boom(*a, **k):
        raise RuntimeError("db down")
    monkeypatch.setattr(dc, "create_accepted", boom)
    with pytest.raises(RuntimeError):
        run(oc.accept(db, p, db.user(db.bob)))
    assert db.open_challenges.docs[0]["status"] == "open" and db.open_challenges.docs[0]["acceptor_id"] is None


def test_doubles_accept_needs_a_valid_partner():
    db = Db()
    p = post(db, format="doubles", partner_id=db.bob, min_level=2.0, max_level=5.0)
    assert err(oc.accept, db, p, db.user(db.ed)).status == 400
    assert err(oc.accept, db, p, db.user(db.ed), db.ed).status == 400
    assert err(oc.accept, db, p, db.user(db.ed), db.bob).status == 400          # already on the poster's team
    _, ch = run(oc.accept(db, p, db.user(db.ed), db.di))
    assert ch["side1"] == [db.ann, db.bob] and ch["side2"] == [db.ed, db.di]
    assert any(n["type"] == "challenge_partner" and n["user_id"] == db.di for n in db.user_notifications.docs)


def test_singles_accept_rejects_a_partner():
    db = Db()
    p = post(db)
    assert err(oc.accept, db, p, db.user(db.bob), db.ed).status == 400


# ── After acceptance: the existing engine does the rest ───────────────────────

def play_out(db):
    p = post(db)
    _, ch = run(oc.accept(db, p, db.user(db.bob)))
    run(dc.propose(db, ch, db.user(db.ann), future(), "Piedmont Park", None))
    run(dc.respond(db, ch, db.user(db.bob), ch["proposals"][0]["id"], "accept"))
    return p, ch


def test_full_lifecycle_updates_stats_and_head_to_head():
    db = Db()
    p, ch = play_out(db)
    assert ch["status"] == "scheduled"
    assert oc.effective_status(p, ch) == "scheduled"
    run(dc.submit_score(db, ch, db.user(db.ann), [{"a": 6, "b": 3}, {"a": 6, "b": 4}]))
    assert oc.effective_status(p, ch) == "in_progress"
    run(dc.confirm_score(db, ch, db.user(db.bob)))
    assert oc.effective_status(p, ch) == "completed"
    s = run(dc.stats(db, db.ann, vs=db.bob))
    assert s["wins"] == 1 and s["completed"] == 1 and s["head_to_head"] == {"matches": 1, "wins": 1, "losses": 0}


def test_dispute_shows_as_disputed():
    db = Db()
    p, ch = play_out(db)
    run(dc.submit_score(db, ch, db.user(db.ann), [{"a": 6, "b": 3}, {"a": 6, "b": 4}]))
    run(dc.dispute_score(db, ch, db.user(db.bob), "Wrong score"))
    assert oc.effective_status(p, ch) == "disputed"


def test_acceptor_cancelling_the_match_cancels_the_post_view():
    db = Db()
    p = post(db)
    _, ch = run(oc.accept(db, p, db.user(db.bob)))
    run(dc.cancel(db, ch, db.user(db.bob)))
    assert oc.effective_status(p, ch) == "cancelled"


def test_owner_withdrawing_after_accept_cancels_the_match_and_tells_the_acceptor():
    db = Db()
    p = post(db)
    _, ch = run(oc.accept(db, p, db.user(db.bob)))
    run(oc.withdraw(db, p, db.user(db.ann)))
    assert ch["status"] == "cancelled"
    assert any(n["type"] == "open_challenge_withdrawn" and n["user_id"] == db.bob for n in db.user_notifications.docs)


def test_open_matches_do_not_touch_ladders_or_ratings():
    db = Db()
    p, ch = play_out(db)
    run(dc.submit_score(db, ch, db.user(db.ann), [{"a": 6, "b": 3}, {"a": 6, "b": 4}]))
    run(dc.confirm_score(db, ch, db.user(db.bob)))
    assert ch["ladder_id"] is None and ch.get("ladder_applied_at") is None
    assert db.users.docs[0]["tennis_rating"] == 3.0 and db.users.docs[1]["tennis_rating"] == 3.0


def test_dashboard_buckets_and_summary():
    db = Db()
    open_post = post(db, date=day(6))
    played, ch = play_out(db)
    run(dc.submit_score(db, ch, db.user(db.ann), [{"a": 6, "b": 3}, {"a": 6, "b": 4}]))
    run(dc.confirm_score(db, ch, db.user(db.bob)))
    gone = post(db, date=day(7))
    run(oc.withdraw(db, gone, db.user(db.ann)))
    out = run(oc.mine(db, db.user(db.ann)))
    assert [v["id"] for v in out["published"]] == [str(open_post["_id"])]
    assert [v["id"] for v in out["completed"]] == [str(played["_id"])]
    assert [v["id"] for v in out["expired"]] == [str(gone["_id"])]
    assert out["summary"] == {"active": 1, "pending_responses": 0, "upcoming": 0, "completed": 1, "expired": 1}
    bob = run(oc.mine(db, db.user(db.bob)))
    assert [v["id"] for v in bob["completed"]] == [str(played["_id"])] and bob["published"] == []


def test_accepted_dashboard_flags_pending_response_and_upcoming():
    db = Db()
    p = post(db)
    _, ch = run(oc.accept(db, p, db.user(db.bob)))
    run(dc.propose(db, ch, db.user(db.ann), future(), "Park", None))
    bob = run(oc.mine(db, db.user(db.bob)))
    assert bob["summary"]["pending_responses"] == 1 and bob["accepted"][0]["status"] == "scheduling"
    run(dc.respond(db, ch, db.user(db.bob), ch["proposals"][0]["id"], "accept"))
    assert run(oc.mine(db, db.user(db.bob)))["summary"]["upcoming"] == 1


# ── Expiry, moderation, sharing ───────────────────────────────────────────────

def test_old_posts_expire_and_notify_the_owner():
    db = Db()
    p = post(db)
    db.open_challenges.docs[0]["expires_at"] = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    assert run(oc.process(db)) == {"expired": 1}
    assert db.open_challenges.docs[0]["status"] == "expired"
    assert any(n["type"] == "open_challenge_expired" for n in db.user_notifications.docs)
    assert run(oc.process(db)) == {"expired": 0}
    assert p["owner_id"] == db.ann


def test_accepted_posts_do_not_expire():
    db = Db()
    p = post(db)
    run(oc.accept(db, p, db.user(db.bob)))
    db.open_challenges.docs[0]["expires_at"] = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    assert run(oc.process(db)) == {"expired": 0}


def test_report_once_and_admin_removes():
    db = Db()
    p = post(db)
    assert err(oc.report, db, db.user(db.ann), p, "spam spam").status == 400            # own post
    assert err(oc.report, db, db.user(db.bob), p, "x").status == 400                     # needs a reason
    run(oc.report(db, db.user(db.bob), p, "Rude language in notes"))
    assert err(oc.report, db, db.user(db.bob), p, "again please").status == 409
    listing = run(oc.admin_list(db))
    assert listing[0]["reports"] == 1 and listing[0]["report_reasons"] == ["Rude language in notes"]
    run(oc.admin_remove(db, p, {"_id": "admin1", "role": "admin"}, "Inappropriate"))
    assert p["status"] == "removed" and run(oc.browse(db, db.user(db.bob), {})) == []
    assert any(n["type"] == "open_challenge_removed" and n["user_id"] == db.ann for n in db.user_notifications.docs)
    assert db.open_challenge_reports.docs[0]["status"] == "actioned"


def test_admin_remove_cancels_an_accepted_match():
    db = Db()
    p = post(db)
    _, ch = run(oc.accept(db, p, db.user(db.bob)))
    run(oc.admin_remove(db, p, {"_id": "admin1", "role": "admin"}, "Abuse"))
    assert ch["status"] == "cancelled" and p["status"] == "removed"


def test_share_by_email_is_owner_only_validated_and_rate_limited(mail, monkeypatch):
    db = Db()
    p = post(db)
    assert err(oc.share_by_email, db, p, db.user(db.bob), ["a@b.com"]).status == 403
    assert err(oc.share_by_email, db, p, db.user(db.ann), ["not-an-email"]).status == 400
    assert run(oc.share_by_email(db, p, db.user(db.ann), ["Friend@Example.com", "friend@example.com", "x@y.org"])) == 2
    assert mail == ["friend@example.com", "x@y.org"]
    monkeypatch.setattr(oc.cfg, "OPEN_SHARE_DAILY", 3)
    assert err(oc.share_by_email, db, p, db.user(db.ann), ["p@q.com", "r@s.com"]).status == 429


# ── Routes ────────────────────────────────────────────────────────────────────

def test_route_load_hides_drafts_and_blocked_owners_from_others():
    db = Db()
    draft = run(oc.create(db, db.user(db.ann), post_data(), publish=False))
    with pytest.raises(HTTPException) as e:
        run(routes._load(db, str(draft["_id"]), db.user(db.bob)))
    assert e.value.status_code == 404
    assert run(routes._load(db, str(draft["_id"]), db.user(db.ann)))["_id"] == draft["_id"]
    live = post(db, date=day(5))
    run(oc.block(db, db.user(db.bob), db.ann))
    with pytest.raises(HTTPException) as e2:
        run(routes._load(db, str(live["_id"]), db.user(db.bob)))
    assert e2.value.status_code == 404
    with pytest.raises(HTTPException) as e3:
        run(routes._load(db, "not-an-id", db.user(db.bob)))
    assert e3.value.status_code == 404


def test_view_flags_what_the_viewer_can_do():
    db = Db()
    p = post(db, min_level=3.0, max_level=4.0)
    mine_v = run(oc.view(db, p, db.user(db.ann)))
    assert mine_v["can"]["accept"] is False and mine_v["can"]["edit"] and mine_v["can"]["pause"] and mine_v["can"]["share"]
    bob_v = run(oc.view(db, p, db.user(db.bob)))
    assert bob_v["can"]["accept"] and bob_v["can"]["report"] and not bob_v["can"]["edit"] and bob_v["challenge_id"] is None
    cy_v = run(oc.view(db, p, db.user(db.cy)))
    assert cy_v["can"]["accept"] is False and "level" in cy_v["ineligible_reason"].lower()


def test_once_taken_only_the_two_players_and_admins_can_open_the_post():
    db = Db()
    p = post(db)
    run(oc.accept(db, p, db.user(db.bob)))
    for outsider in (db.ed, db.cy):
        with pytest.raises(HTTPException) as e:
            run(routes._load(db, str(p["_id"]), db.user(outsider)))
        assert e.value.status_code == 404
    assert run(routes._load(db, str(p["_id"]), db.user(db.bob)))["_id"] == p["_id"]
    assert run(routes._load(db, str(p["_id"]), {"_id": "adm", "role": "admin"}))["_id"] == p["_id"]


def test_board_can_be_searched_by_player_name():
    db = Db()
    post(db, date=day(2))
    post(db, who=db.ed, date=day(3))
    bob = db.user(db.bob)
    assert [c["owner"]["name"] for c in run(oc.browse(db, bob, {"q": "ann"}))] == ["Ann Ace"]
    assert [c["owner"]["name"] for c in run(oc.browse(db, bob, {"q": " EDGE "}))] == ["Ed Edge"]
    assert run(oc.browse(db, bob, {"q": "zzz"})) == []
