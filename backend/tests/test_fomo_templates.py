"""City-aware registered-player emails: real numbers only, skipped when the data is not there. Fake database."""
import sys
import types
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from bson import ObjectId

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import bulk_email  # noqa: E402
import fomo_templates  # noqa: E402
from test_bulk_email import C  # noqa: E402
from test_league_schedule import run  # noqa: E402


@pytest.fixture(autouse=True)
def secrets(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret-for-unsubscribe-links")


def soon(days):
    return (datetime.now(timezone.utc) + timedelta(days=days)).date().isoformat()


class Db:
    def __init__(self):
        for n in ("users", "leagues", "player_leagues", "email_campaigns", "doubles_invites"):
            setattr(self, n, C())

    def league(self, city="Atlanta", sport="tennis", fmt="singles", players=0, max_players=16, status="registration", days=5):
        lid = ObjectId()
        self.leagues.docs.append({"_id": lid, "name": f"{city} {sport} {fmt}", "city": city, "sport": sport, "format": fmt,
                                  "status": status, "start_date": soon(days), "max_players": max_players, "current_players": players})
        return str(lid)

    def user(self, city="Atlanta", name="Sam Lee", **kw):
        uid = ObjectId()
        self.users.docs.append({"_id": uid, "name": name, "email": f"{uid}@x.com", "city": city, **kw})
        return str(uid)


def payload(template, variant=None):
    p = {"audience": "registered", "segment": "all", "template": template}
    if variant is not None:
        p["subject_variant"] = variant
    return p


def audience(db, template):
    return run(bulk_email.build_audience(db, payload(template)))


def test_league_template_uses_the_players_own_city_and_real_start_date():
    db = Db()
    db.league("Chicago")
    atl = db.league("Atlanta", days=5)
    db.user("Atlanta")
    a = audience(db, "m11_league_near")
    assert len(a["send"]) == 1 and a["send"][0]["ctx"]["league_id"] == atl and a["send"][0]["ctx"]["days_left"] == 5
    m = bulk_email.render(payload("m11_league_near"), a["send"][0])
    assert "Atlanta tennis singles" in m["subject"] and "/leagues/" + atl in m["cta_url"] and "{" not in m["body"]


def test_players_with_no_open_league_in_their_city_are_skipped_not_sent_made_up_facts():
    db = Db()
    db.league("Chicago")
    db.user("Atlanta")
    db.user("")
    a = audience(db, "m11_league_near")
    assert a["send"] == [] and a["skipped"]["no matching data"] == 2


def test_full_started_or_past_leagues_are_never_offered():
    db = Db()
    db.league("Atlanta", players=16)
    db.league("Atlanta", status="active")
    db.league("Atlanta", days=-2)
    db.user("Atlanta")
    assert audience(db, "m11_league_near")["send"] == []


def test_few_spots_only_when_the_league_is_really_nearly_full():
    db = Db()
    db.league("Atlanta", players=10)                       # 6 left
    db.user("Atlanta")
    a = audience(db, "m12_few_spots")
    assert a["send"][0]["ctx"]["spots_left"] == 6
    m = bulk_email.render(payload("m12_few_spots"), a["send"][0])
    assert "few spots left" in m["body"] and not any(ch.isdigit() for ch in m["subject"])
    db2 = Db()
    db2.league("Atlanta", players=4)                       # 12 left: plenty of room, so no urgency email
    db2.user("Atlanta")
    assert audience(db2, "m12_few_spots")["send"] == []


def test_last_spot_still_shows_no_number():
    db = Db()
    db.league("Atlanta", players=15)
    db.user("Atlanta")
    m = bulk_email.render(payload("m12_few_spots"), audience(db, "m12_few_spots")["send"][0])
    assert "few spots left" in m["body"]


def test_doubles_template_needs_a_doubles_league_in_the_city():
    db = Db()
    db.league("Atlanta", fmt="singles")
    db.user("Atlanta")
    assert audience(db, "m13_no_partner")["send"] == []
    db.league("Atlanta", fmt="mixed_doubles")
    assert len(audience(db, "m13_no_partner")["send"]) == 1


def test_player_count_is_real_and_only_used_above_the_minimum():
    db = Db()
    lid = db.league("Atlanta")
    db.user("Atlanta")
    for i in range(fomo_templates.CROWD_MIN - 1):
        db.player_leagues.docs.append({"league_id": lid, "player_id": f"p{i}", "payment_status": "paid"})
    assert audience(db, "m15_crowd")["send"] == []
    db.player_leagues.docs.append({"league_id": lid, "player_id": "last", "payment_status": "free"})
    db.player_leagues.docs.append({"league_id": lid, "player_id": "pending", "payment_status": "pending"})   # not counted
    a = audience(db, "m15_crowd")
    assert a["send"][0]["ctx"]["players_in_city"] == fomo_templates.CROWD_MIN
    assert f"{fomo_templates.CROWD_MIN} players" in bulk_email.render(payload("m15_crowd"), a["send"][0])["body"]


def test_first_free_needs_no_league_and_reaches_everyone_not_opted_out():
    db = Db()
    db.user("Atlanta")
    db.user("", name="Pat Kim")
    db.user("Atlanta", email_notifications=False)
    a = audience(db, "m14_first_free")
    assert len(a["send"]) == 2 and a["skipped"]["opted out"] == 1
    m = bulk_email.render(payload("m14_first_free"), a["send"][0])
    assert "PLAY1FREE" in m["body"]


def test_joined_not_playing_goes_only_to_players_with_no_league_and_offers_the_free_code():
    db = Db()
    db.league("Atlanta")
    idle, playing = db.user("Atlanta", name="Sam Lee"), db.user("Atlanta", name="Pat Kim")
    db.player_leagues = C()
    db.player_leagues.docs.append({"player_id": playing, "league_id": "x", "payment_status": "paid"})
    a = audience(db, "m17_joined_not_playing")
    assert [r["id"] for r in a["send"]] == [idle] and a["skipped"]["outside filter"] == 1
    m = bulk_email.render(payload("m17_joined_not_playing"), a["send"][0])
    assert "PLAY1FREE" in m["body"] and "Hi Sam" in m["body"] and "{" not in m["body"] and "/leagues" in m["cta_url"]


def test_subject_variants_pick_the_chosen_line_and_reject_bad_numbers():
    db = Db()
    db.league("Atlanta")
    db.user("Atlanta")
    rec = audience(db, "m11_league_near")["send"][0]
    subjects = {bulk_email.render(payload("m11_league_near", v), rec)["subject"] for v in range(3)}
    assert len(subjects) == 3
    with pytest.raises(bulk_email.PayloadError):
        bulk_email.render(payload("m11_league_near", 7), rec)


def test_names_with_markup_cannot_inject_html_into_the_body():
    db = Db()
    db.league("Atlanta")
    db.user("Atlanta", name="<b>Eve</b>")
    rec = audience(db, "m11_league_near")["send"][0]
    assert "<b>Eve" not in bulk_email.render(payload("m11_league_near"), rec)["body"]


def test_a_second_send_of_the_same_template_skips_people_already_sent():
    db = Db()
    db.league("Atlanta")
    uid = db.user("Atlanta")
    db.email_campaigns.docs.append({"user_id": uid, "campaign": "tpl_m11_league_near"})
    a = audience(db, "m11_league_near")
    assert a["send"] == [] and a["skipped"]["already sent"] == 1


def test_bring_your_partner_goes_only_to_players_whose_team_is_really_waiting():
    db = Db()
    lid = db.league("Atlanta", fmt="doubles", days=4)
    waiting, paired, other = db.user("Atlanta"), db.user("Atlanta"), db.user("Atlanta")
    db.doubles_invites.docs += [
        {"initiator_id": waiting, "league_id": lid, "status": "initiator_paid", "partner_user_id": None},
        {"initiator_id": paired, "league_id": lid, "status": "accepted", "partner_user_id": "x"},
    ]
    a = audience(db, "m16_bring_partner")
    assert [r["id"] for r in a["send"]] == [waiting] and a["skipped"]["no matching data"] == 2
    m = bulk_email.render(payload("m16_bring_partner"), a["send"][0])
    assert "Let VenLax find me a partner" in m["body"] and "/dashboard" in m["cta_url"] and "{" not in m["body"]


def test_no_bring_partner_email_once_the_league_has_started():
    db = Db()
    lid = db.league("Atlanta", fmt="doubles", status="active")
    uid = db.user("Atlanta")
    db.doubles_invites.docs.append({"initiator_id": uid, "league_id": lid, "status": "pending", "partner_user_id": None})
    assert audience(db, "m16_bring_partner")["send"] == []


def test_no_template_shows_a_calendar_date():
    """Emails say the league starts shortly; a calendar date goes stale when a league is moved."""
    import bulk_email
    import conversion_campaign as cc
    import re
    month = re.compile(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b")
    for source in (fomo_templates.FOMO_TEMPLATES, bulk_email.TEMPLATES):
        for key, t in source.items():
            text = " ".join([str(t.get("subject", "")), *map(str, t.get("subjects", [])), str(t.get("body", ""))])
            assert "{start_date}" not in text and "{{start_date}}" not in text, key
            assert not month.search(text), (key, month.search(text).group(0))


def test_no_template_counts_down_to_the_start():
    for key, t in fomo_templates.FOMO_TEMPLATES.items():
        text = " ".join([*map(str, t["subjects"]), str(t["body"])])
        assert "{days_word}" not in text and "{{days_word}}" not in text and "days to go" not in text, key
