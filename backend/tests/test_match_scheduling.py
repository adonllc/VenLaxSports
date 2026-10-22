"""Match scheduling workflow: propose, counter, confirm, decline, reschedule, cancel, expiry,
conflicts, time zones, history and the organizer override (no live Mongo needed)."""
import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import email_service  # noqa: E402
import league_schedule  # noqa: E402
import match_scheduling as ms  # noqa: E402
import tz_utils  # noqa: E402
from test_league_schedule import as_user, league_of, make_league, request_for, run  # noqa: E402,F401
from routes import match_routes  # noqa: E402

NOW = lambda: datetime.now(timezone.utc)  # noqa: E731


@pytest.fixture
def sent(monkeypatch):
    out = []
    monkeypatch.setattr(email_service, "schedule", lambda coro: (out.append((coro.cr_code.co_name, coro.cr_frame.f_locals.get("to"))), coro.close()))
    return out


def setup(n=8, city="Atlanta"):
    db, lid, ids = make_league(n)
    lg = league_of(db)
    lg["city"] = city
    lg["start_date"] = NOW().strftime("%Y-%m-%d")
    lg["end_date"] = (NOW() + timedelta(days=60)).strftime("%Y-%m-%d")
    run(league_schedule.open_league_to_play(db, lg))
    m = db.matches.docs[0]
    return db, lg, m


def iso(days=3, hour=18):
    d = (NOW() + timedelta(days=days)).replace(hour=hour, minute=0, second=0, microsecond=0)
    return d.isoformat()


def propose(db, lg, m, uid, when=None, venue="Court 1", note=None):
    return run(ms.propose(db, m, lg, uid, when or iso(), venue, note))


def respond(db, lg, m, uid, action, message=None):
    return run(ms.respond(db, m, lg, uid, action, message))


def err(fn, *a, **kw):
    with pytest.raises(ms.SchedulingError) as e:
        fn(*a, **kw)
    return e.value


def actions(m):
    return [h["action"] for h in m.get("schedule_history", [])]


def test_naive_times_are_read_in_the_league_time_zone():
    assert tz_utils.parse_instant("2026-11-02T19:00", "America/New_York").isoformat() == "2026-11-03T00:00:00+00:00"
    assert tz_utils.parse_instant("2026-07-02T19:00", "America/Los_Angeles").isoformat() == "2026-07-03T02:00:00+00:00"
    assert tz_utils.parse_instant("2026-11-03T00:00:00Z", "America/Chicago").isoformat() == "2026-11-03T00:00:00+00:00"
    assert tz_utils.league_tz_name({"city": "Dallas"}) == "America/Chicago"
    assert tz_utils.league_tz_name({"city": "San Francisco"}) == "America/Los_Angeles"
    assert tz_utils.league_tz_name({"city": "Somewhere"}) == "America/New_York"


def test_propose_is_not_a_booking_and_only_home_can_start(sent):
    db, lg, m = setup()
    home, away = m["player1_id"], m["player2_id"]
    assert err(propose, db, lg, m, away).status == 403            # Away cannot make the first proposal
    stranger = "000000000000000000000000"
    assert err(propose, db, lg, m, stranger).status == 403
    p = propose(db, lg, m, home, note="bring balls")
    assert m["schedule_status"] == "proposed" and m["proposal"]["kind"] == "initial"
    assert m["scheduled_date"] == m["deadline"]                    # nothing is booked yet
    assert p["expires_at"] and actions(m) == ["proposed"]
    assert err(respond, db, lg, m, home, "confirm").status == 403  # the proposer cannot confirm own proposal
    assert any(name == "send_match_proposed" for name, _ in sent)


def test_wall_clock_input_is_stored_in_utc_and_validated(sent):
    db, lg, m = setup()
    when = (NOW() + timedelta(days=4)).replace(hour=19, minute=0, second=0, microsecond=0, tzinfo=None)
    propose(db, lg, m, m["player1_id"], when=when.isoformat())
    expect = tz_utils.parse_instant(when.isoformat(), "America/New_York")
    assert m["proposal"]["date"] == expect.isoformat()
    assert err(propose, db, lg, m, m["player1_id"], when="2020-01-01T10:00").status == 400
    assert err(propose, db, lg, m, m["player1_id"], when=iso(days=200)).status == 400
    assert err(propose, db, lg, m, m["player1_id"], venue="  ").status == 400
    assert err(propose, db, lg, m, m["player1_id"], when="not a date").status == 400


def test_confirm_books_the_match_for_both_and_notifies_everyone(sent):
    db, lg, m = setup()
    home, away = m["player1_id"], m["player2_id"]
    propose(db, lg, m, home, when=iso(5))
    sent.clear()
    out = respond(db, lg, m, away, "confirm")
    assert m["schedule_status"] == "scheduled" and m["scheduled_date"] == out["scheduled_date"] and m["venue"] == "Court 1"
    assert m["proposal"] is None and actions(m) == ["proposed", "confirmed"]
    assert sorted(t for n, t in sent if n == "send_match_confirmed") == sorted([u["email"] for u in db.users.docs if str(u["_id"]) in (home, away)])


def test_decline_returns_to_unscheduled_with_the_reason(sent):
    db, lg, m = setup()
    propose(db, lg, m, m["player1_id"])
    respond(db, lg, m, m["player2_id"], "decline", "work that evening")
    assert m["schedule_status"] == "unscheduled" and m["last_decline"]["message"] == "work that evening"
    assert actions(m) == ["proposed", "declined"]
    assert err(respond, db, lg, m, m["player2_id"], "confirm").status == 400  # nothing left to answer


def test_away_can_suggest_another_time_and_home_confirms(sent):
    db, lg, m = setup()
    home, away = m["player1_id"], m["player2_id"]
    propose(db, lg, m, home, when=iso(4))
    propose(db, lg, m, away, when=iso(6), venue="Court 7")                 # counter-proposal
    assert m["proposal"]["kind"] == "counter" and m["proposal"]["proposer_side"] == 2
    assert err(respond, db, lg, m, away, "confirm").status == 403          # proposer cannot confirm
    respond(db, lg, m, home, "confirm")                                     # Home accepts the counter
    assert m["schedule_status"] == "scheduled" and m["venue"] == "Court 7"
    assert actions(m) == ["proposed", "countered", "confirmed"]


def book(db, lg, m, days=6):
    propose(db, lg, m, m["player1_id"], when=iso(days))
    respond(db, lg, m, m["player2_id"], "confirm")


def test_reschedule_keeps_the_booking_until_the_other_side_accepts(sent):
    db, lg, m = setup()
    book(db, lg, m, 6)
    booked = m["scheduled_date"]
    propose(db, lg, m, m["player2_id"], when=iso(8), venue="Court 9")      # Away asks to change
    assert m["schedule_status"] == "scheduled" and m["scheduled_date"] == booked and m["proposal"]["kind"] == "reschedule"
    respond(db, lg, m, m["player1_id"], "decline", "cannot do that day")    # declined: booking stays
    assert m["scheduled_date"] == booked and m["proposal"] is None and m["venue"] == "Court 1"
    propose(db, lg, m, m["player1_id"], when=iso(9), venue="Court 5")       # Home asks, Away accepts
    respond(db, lg, m, m["player2_id"], "confirm")
    assert m["venue"] == "Court 5" and m["scheduled_date"] != booked
    assert actions(m) == ["proposed", "confirmed", "change_requested", "declined", "change_requested", "confirmed"]
    assert m["schedule_history"][-1]["previous"]                          # the old time is recorded


def test_changes_and_cancellation_are_blocked_inside_24_hours(sent):
    db, lg, m = setup()
    book(db, lg, m, 6)
    m["scheduled_date"] = (NOW() + timedelta(hours=10)).isoformat()         # match is in 10 hours
    assert "organizer" in err(propose, db, lg, m, m["player2_id"], when=iso(9)).detail
    assert err(lambda: run(ms.cancel_time(db, m, lg, m["player1_id"]))).status == 400


def test_cancel_time_returns_to_not_scheduled_without_forfeit_and_tells_both(sent):
    db, lg, m = setup()
    book(db, lg, m, 6)
    sent.clear()
    run(ms.cancel_time(db, m, lg, m["player2_id"]))
    assert m["schedule_status"] == "unscheduled" and m["scheduled_date"] == m["deadline"] and m["venue"] is None
    assert m["status"] == "scheduled" and actions(m)[-1] == "time_cancelled"
    assert len([n for n, _ in sent if n == "send_match_cancelled_time"]) == 2
    assert err(lambda: run(ms.cancel_time(db, m, lg, m["player2_id"]))).status == 400  # nothing to cancel now


def test_a_clashing_time_is_refused_for_proposals_and_confirmations(sent):
    db, lg, m = setup()
    other = next(x for x in db.matches.docs if x is not m and m["player1_id"] in (x["player1_id"], x["player2_id"]))
    when = iso(5)
    other.update({"schedule_status": "scheduled", "scheduled_date": when})   # Home already plays then
    assert err(propose, db, lg, m, m["player1_id"], when=when).status == 409
    propose(db, lg, m, m["player1_id"], when=iso(7))                         # fine at another time
    other.update({"scheduled_date": iso(7)})                                  # a clash appears afterwards
    assert err(respond, db, lg, m, m["player2_id"], "confirm").status == 409


def test_proposals_expire_after_48h_with_a_reminder_at_24h(sent):
    db, lg, m = setup()
    propose(db, lg, m, m["player1_id"], when=iso(6))
    assert run(ms.process_proposals(db))["expired"] == 0
    in25 = NOW() + timedelta(hours=25)
    assert run(ms.process_proposals(db, in25)) == {"expired": 0, "reminded": 1, "flagged": 0, "forfeited": 0}
    assert run(ms.process_proposals(db, in25))["reminded"] == 0              # reminded once only
    sent.clear()
    in49 = NOW() + timedelta(hours=49)
    assert run(ms.process_proposals(db, in49))["expired"] == 1
    assert m["schedule_status"] == "unscheduled" and m["proposal"] is None and actions(m)[-1] == "expired"
    assert len([n for n, _ in sent if n == "send_proposal_expired"]) == 2


def test_an_expired_change_request_keeps_the_existing_booking(sent):
    db, lg, m = setup()
    book(db, lg, m, 6)
    booked = m["scheduled_date"]
    propose(db, lg, m, m["player2_id"], when=iso(8))
    run(ms.process_proposals(db, NOW() + timedelta(hours=49)))
    assert m["schedule_status"] == "scheduled" and m["scheduled_date"] == booked and m["proposal"] is None


def test_unresolved_matches_are_flagged_once_near_their_deadline(sent):
    db, lg, m = setup()
    m["deadline"] = (NOW() + timedelta(hours=30)).isoformat()
    sent.clear()
    assert run(ms.process_proposals(db))["flagged"] >= 1
    assert m["needs_help"] is True and len([n for n, _ in sent if n == "send_schedule_attention"]) >= 2
    sent.clear()
    assert run(ms.process_proposals(db))["flagged"] == 0                     # no repeat emails


def test_organizer_can_set_the_time_and_players_are_told(sent):
    db, lg, m = setup()
    m["needs_help"] = True
    sent.clear()
    out = run(ms.organizer_set_time(db, m, lg, "admin1", iso(5, 17), "Piedmont Park, Court 2"))
    assert m["schedule_status"] == "scheduled" and m["venue"] == "Piedmont Park, Court 2" and m["needs_help"] is False
    assert actions(m)[-1] == "organizer_set" and len([n for n, _ in sent if n == "send_organizer_set_time"]) == 2
    assert err(lambda: run(ms.organizer_set_time(db, m, lg, "admin1", "2020-01-01T10:00", "x"))).status == 400


def test_my_matches_card_shows_time_zone_history_and_who_can_respond(sent, monkeypatch):
    db, lg, m = setup(city="Chicago")
    home, away = m["player1_id"], m["player2_id"]
    propose(db, lg, m, home, when=iso(6))
    as_user(monkeypatch, db, away)
    page = run(match_routes.my_league_matches(str(lg["_id"]), request_for(db)))
    assert page["league"]["tz"] == "America/Chicago" and page["league"]["tz_abbr"] in ("CST", "CDT")
    card = next(c for c in page["matches"] if c["id"] == str(m["_id"]))
    assert card["state"] == "awaiting_confirmation" and card["proposal"]["can_respond"] and not card["proposal"]["by_me"]
    assert card["history"][-1]["action"] == "proposed" and card["history"][-1]["by_name"]
    as_user(monkeypatch, db, home)
    card_h = next(c for c in run(match_routes.my_league_matches(str(lg["_id"]), request_for(db)))["matches"] if c["id"] == str(m["_id"]))
    assert card_h["proposal"]["by_me"] and not card_h["proposal"]["can_respond"]
    respond(db, lg, m, away, "confirm")
    card_h = next(c for c in run(match_routes.my_league_matches(str(lg["_id"]), request_for(db)))["matches"] if c["id"] == str(m["_id"]))
    assert card_h["state"] == "scheduled" and card_h["can_change"] is True and card_h["proposal"] is None


def test_no_proposal_by_the_play_by_date_forfeits_to_away(sent):
    db, lg, m = setup()
    m["deadline"] = (NOW() - timedelta(hours=1)).isoformat()
    sent.clear()
    assert run(ms.process_proposals(db))["forfeited"] == 1
    assert m["status"] == "walkover" and m["walkover_reason"] == "home_no_proposal"
    assert m["winner_id"] == m["player2_id"]                                   # Away is awarded the match
    assert "forfeited" in actions(m)
    assert len([n for n, _ in sent if n == "send_match_forfeited"]) == 2
    assert run(ms.process_proposals(db))["forfeited"] == 0                     # only once
    rows = {s["player_id"]: s for s in db.standings.docs}
    assert rows[m["player2_id"]]["wins"] == 1 and rows[m["player1_id"]]["losses"] == 1
    assert rows[m["player2_id"]]["points"] == 3.0 and rows[m["player1_id"]]["points"] == 0.0
    assert match_view_state(m) == "completed"


def test_home_who_proposed_is_not_forfeited_and_future_deadlines_are_left_alone(sent):
    db, lg, m = setup()
    propose(db, lg, m, m["player1_id"])
    run(ms.process_proposals(db, NOW() + timedelta(hours=49)))                 # proposal expires, Home had proposed
    m["deadline"] = (NOW() - timedelta(hours=1)).isoformat()
    assert run(ms.process_proposals(db))["forfeited"] == 0
    assert m["status"] == "scheduled"
    other = db.matches.docs[1]
    assert other["status"] == "scheduled"                                      # deadline still in the future


def match_view_state(m):
    import match_view
    return match_view.match_state(m, NOW(), set())


def test_a_finished_match_shows_no_pending_proposal_and_is_ignored_by_housekeeping(sent, monkeypatch):
    db, lg, m = setup()
    book(db, lg, m)
    run(ms.propose(db, m, lg, m["player1_id"], iso(8), "Court 2", None))          # pending change request
    m["status"], m["winner_id"] = "completed", m["player1_id"]                    # score reported meanwhile
    as_user(monkeypatch, db, m["player2_id"])
    card = next(c for c in run(match_routes.my_league_matches(str(lg["_id"]), request_for(db)))["matches"] if c["id"] == str(m["_id"]))
    assert card["state"] == "completed" and card["proposal"] is None and card["pending_change"] is False
    sent.clear()
    assert run(ms.process_proposals(db, NOW() + timedelta(hours=60)))["expired"] == 0
    assert sent == [] and m["proposal"] is not None                                # nobody emailed about a finished match
