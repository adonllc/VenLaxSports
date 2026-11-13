"""Challenge by email: registered player gets a normal challenge, others an invitation that becomes one on sign-up."""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from bson import ObjectId

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import challenge_invite as ci  # noqa: E402
import direct_challenge as dc  # noqa: E402
import email_service  # noqa: E402
from test_league_schedule import run as _run  # noqa: E402
from test_open_challenge import OFake  # noqa: E402
from test_open_challenge import Db as BaseDb  # noqa: E402


PENDING = []      # emails scheduled "in the background"; delivered right after the call that scheduled them


def run(coro):
    result = _run(coro)
    while PENDING:
        _run(PENDING.pop(0))
    return result


class Db(BaseDb):
    def __init__(self):
        super().__init__()
        for n in ("challenge_email_invites", "email_suppressions", "referral_credits"):
            setattr(self, n, OFake())
        for u in self.users.docs:
            u["created_at"] = "2020-01-01T00:00:00+00:00"
            u["email"] = u["email"].lower()

    def newcomer(self, email="newbie@example.com", name="Nia Newbie"):
        uid = ObjectId()
        self.users.docs.append({"_id": uid, "name": name, "email": email, "skill_level": "3.5",
                                "created_at": datetime.now(timezone.utc).isoformat()})
        return self.user(str(uid))


@pytest.fixture(autouse=True)
def mail(monkeypatch):
    sent = []

    async def campaign(to, subject, title, body_html, cta_label, cta_url, unsubscribe_url, reason=None):
        sent.append({"to": to, "subject": subject, "cta": cta_url, "unsub": unsubscribe_url, "body": body_html})
        return True

    async def generic(to, subject, body):
        return None
    monkeypatch.setattr(email_service, "send_campaign_email", campaign)
    monkeypatch.setattr(email_service, "send_generic", generic)
    PENDING.clear()
    monkeypatch.setattr(email_service, "schedule", PENDING.append)
    return sent


def invite(db, email="friend@example.com", **kw):
    return run(ci.send(db, db.user(db.ann), {"email": email, "sport": "tennis", "format": "singles", **kw}))


def err(fn, *a, **kw):
    with pytest.raises(dc.ChallengeError) as e:
        run(fn(*a, **kw))
    return e.value


# ── Sending ───────────────────────────────────────────────────────────────────

def test_unregistered_email_gets_an_invitation_not_a_challenge(mail):
    db = Db()
    inv = invite(db, message="Saturday?")
    assert inv["kind"] == "email" and inv["status"] == "waiting" and db.direct_challenges.docs == []
    m = mail[0]
    assert m["to"] == "friend@example.com" and "Ann Ace" in m["subject"]
    assert f"/challenges/invite?token={inv['token']}" in m["cta"]
    assert "unsubscribe?token=" in m["unsub"] and "Saturday?" in m["body"]


def test_registered_email_gets_a_normal_challenge_and_no_invitation_email(mail):
    db = Db()
    inv = invite(db, email="Bob@Example.com")
    assert inv["kind"] == "user" and mail == []
    ch = db.direct_challenges.docs[0]
    assert ch["side1"] == [db.ann] and ch["side2"] == [db.bob] and ch["status"] == "sent"
    assert any(n["type"] == "challenge_received" and n["user_id"] == db.bob for n in db.user_notifications.docs)


def test_existing_account_problems_are_hidden_from_the_sender():
    db = Db()
    first = run(dc.create(db, db.user(db.ann), {"opponent_id": db.bob, "sport": "tennis", "format": "singles"}))
    out = invite(db, email="bob@example.com")        # an open challenge exists: dc would say 409; the sender must not learn that
    assert out["kind"] == "user" and len(db.direct_challenges.docs) == 1 and first["status"] == "sent"


def test_validation():
    db = Db()
    assert err(ci.send, db, db.user(db.ann), {"email": "nope", "sport": "tennis"}).status == 400
    assert err(ci.send, db, db.user(db.ann), {"email": "ann@example.com", "sport": "tennis"}).status == 400
    assert err(ci.send, db, db.user(db.ann), {"email": "a@b.com", "sport": "cricket"}).status == 400
    assert err(ci.send, db, db.user(db.ann), {"email": "a@b.com", "sport": "tennis", "format": "doubles"}).status == 400
    assert invite(db, email="d@b.com", format="doubles", partner_id=db.cy)["partner_id"] == db.cy


def test_daily_cap_and_same_address_rule(monkeypatch):
    db = Db()
    monkeypatch.setattr(ci.cfg, "EMAIL_INVITE_DAILY", 2)
    invite(db, "a@x.com")
    assert err(ci.send, db, db.user(db.ann), {"email": "a@x.com", "sport": "tennis"}).status == 409
    invite(db, "b@x.com")
    assert err(ci.send, db, db.user(db.ann), {"email": "c@x.com", "sport": "tennis"}).status == 429


def test_suppressed_address_is_never_emailed_but_sender_sees_success(mail):
    db = Db()
    run(db.email_suppressions.insert_one({"email": "nomail@x.com"}))
    inv = invite(db, "nomail@x.com")
    assert inv["status"] == "waiting" and mail == []


# ── Preview and claim ─────────────────────────────────────────────────────────

def test_preview_hides_the_email_and_last_name():
    db = Db()
    inv = invite(db, message="hi")
    p = ci.preview(inv)
    assert p["valid"] and p["claimable"] and p["sender_first_name"] == "Ann"
    assert "friend@example.com" not in str(p) and "Ace" not in str(p)
    assert ci.preview(None)["valid"] is False


def test_claim_turns_the_invitation_into_a_challenge_to_the_new_player():
    db = Db()
    inv = invite(db)
    nia = db.newcomer("friend@example.com")
    done = run(ci.claim(db, nia, inv["token"]))
    ch = db.direct_challenges.docs[0]
    assert ch["side1"] == [db.ann] and ch["side2"] == [nia["_id"]] and ch["status"] == "sent"
    assert done["challenge_id"] == str(ch["_id"]) and inv["status"] == "claimed"
    assert any(n["type"] == "challenge_invite_claimed" and n["user_id"] == db.ann for n in db.user_notifications.docs)
    assert run(ci.claim(db, nia, inv["token"]))["challenge_id"] == str(ch["_id"])      # opening twice is harmless
    assert len(db.direct_challenges.docs) == 1


def test_claim_works_even_if_they_sign_up_with_a_different_email():
    db = Db()
    inv = invite(db)
    other = db.newcomer("different@example.com")
    assert run(ci.claim(db, other, inv["token"]))["challenge_id"]


def test_claim_records_a_pending_referral_for_a_new_account_only():
    db = Db()
    inv = invite(db)
    nia = db.newcomer("friend@example.com")
    run(ci.claim(db, nia, inv["token"]))
    credit = db.referral_credits.docs[0]
    assert credit["referrer_id"] == db.ann and credit["referee_id"] == nia["_id"] and credit["status"] == "pending"
    assert credit["credit_amount"] == 5
    inv2 = invite(db, "second@example.com")
    run(ci.claim(db, db.user(db.ed), inv2["token"]))                  # Ed has had an account for years
    assert len(db.referral_credits.docs) == 1


def test_claim_errors():
    db = Db()
    inv = invite(db)
    assert err(ci.claim, db, db.user(db.bob), "bad-token").status == 404
    assert err(ci.claim, db, db.user(db.ann), inv["token"]).status == 400                # own invitation
    db.challenge_email_invites.docs[0]["expires_at"] = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    assert err(ci.claim, db, db.user(db.bob), inv["token"]).status == 410
    assert ci.preview(db.challenge_email_invites.docs[0])["claimable"] is False


def test_someone_else_cannot_take_an_already_claimed_invitation():
    db = Db()
    inv = invite(db)
    run(ci.claim(db, db.newcomer("friend@example.com"), inv["token"]))
    assert err(ci.claim, db, db.user(db.cy), inv["token"]).status == 410


def test_failed_challenge_creation_puts_the_invitation_back(monkeypatch):
    db = Db()
    inv = invite(db)

    async def boom(*a, **k):
        raise RuntimeError("db down")
    monkeypatch.setattr(dc, "create", boom)
    with pytest.raises(RuntimeError):
        run(ci.claim(db, db.newcomer("friend@example.com"), inv["token"]))
    assert db.challenge_email_invites.docs[0]["status"] == "waiting"


def test_verified_signup_attaches_waiting_invitations_without_the_link():
    db = Db()
    invite(db, "friend@example.com")
    invite(db, "other@example.com")
    nia = db.newcomer("friend@example.com")
    assert run(ci.attach_for_user(db, nia)) == 1
    assert [c["side2"] for c in db.direct_challenges.docs] == [[nia["_id"]]]


# ── Sender's list, resend, cancel, unsubscribe, scheduler ─────────────────────

def test_sent_tab_lists_waiting_invitations_and_allows_one_resend(mail):
    db = Db()
    inv = invite(db)
    rows = run(ci.list_waiting(db, db.user(db.ann)))
    assert rows[0]["status"] == "waiting_to_join" and rows[0]["can_resend"] and rows[0]["email"] == "friend@example.com"
    run(ci.resend(db, db.user(db.ann), str(inv["_id"])))
    assert len(mail) == 2 and "Reminder" in mail[1]["subject"]
    assert err(ci.resend, db, db.user(db.ann), str(inv["_id"])).status == 409
    assert run(ci.list_waiting(db, db.user(db.ann)))[0]["can_resend"] is False
    assert run(ci.list_waiting(db, db.user(db.bob))) == []


def test_only_the_sender_can_cancel_and_a_cancelled_link_stops_working():
    db = Db()
    inv = invite(db)
    assert err(ci.cancel, db, db.user(db.bob), str(inv["_id"])).status == 404
    run(ci.cancel(db, db.user(db.ann), str(inv["_id"])))
    assert run(ci.list_waiting(db, db.user(db.ann))) == []
    assert err(ci.claim, db, db.user(db.cy), inv["token"]).status == 410
    assert ci.preview(db.challenge_email_invites.docs[0])["claimable"] is False


def test_unsubscribe_blocks_future_emails_and_cancels_waiting_ones(mail):
    db = Db()
    inv = invite(db)
    assert run(ci.unsubscribe(db, inv["token"])) is True and run(ci.unsubscribe(db, "nope")) is False
    assert db.challenge_email_invites.docs[0]["status"] == "cancelled"
    before = len(mail)
    other = run(ci.send(db, db.user(db.cy), {"email": "friend@example.com", "sport": "tennis"}))
    assert other["status"] == "waiting" and len(mail) == before


def test_scheduler_sends_one_reminder_then_expires(mail):
    db = Db()
    invite(db)
    assert run(ci.process(db)) == {"expired": 0, "reminded": 0}
    later = datetime.now(timezone.utc) + timedelta(days=8)
    assert run(ci.process(db, later)) == {"expired": 0, "reminded": 1}
    assert run(ci.process(db, later)) == {"expired": 0, "reminded": 0}            # only once
    assert len(mail) == 2
    much_later = datetime.now(timezone.utc) + timedelta(days=15)
    assert run(ci.process(db, much_later)) == {"expired": 1, "reminded": 0}
    assert db.challenge_email_invites.docs[0]["status"] == "expired"
    assert any(n["type"] == "challenge_invite_expired" and n["user_id"] == db.ann for n in db.user_notifications.docs)
