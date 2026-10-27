"""Player CRM: tags, private notes, account status (and that it is really enforced), saved segments, duplicates."""
import sys
import types
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import auth_utils  # noqa: E402
import bulk_email  # noqa: E402
import player_crm as crm  # noqa: E402
from routes import admin_player_crm_routes as routes  # noqa: E402
from test_admin_security import C, Db as BaseDb  # noqa: E402
from test_bulk_email import db_with_users, REG, emails  # noqa: E402
from test_league_schedule import run  # noqa: E402


# ── pure rules ────────────────────────────────────────────────────────────────

def test_tags_are_normalised_deduplicated_and_limited():
    assert crm.apply_tags(["vip"], add=["Club Member", "vip", "  Coach "], remove=[]) == ["club-member", "coach", "vip"]
    assert crm.apply_tags(["a", "b"], remove=["A"]) == ["b"]
    for bad in ("", "x" * 31, "no!", "-lead"):
        with pytest.raises(crm.CrmError):
            crm.clean_tag(bad)
    with pytest.raises(crm.CrmError):
        crm.apply_tags([f"t{i}" for i in range(20)], add=["one-more"])


def test_notes_and_reasons_have_length_limits():
    assert crm.clean_note("  called back  ") == "called back"
    for bad in ("", "  ", "x" * 2001):
        with pytest.raises(crm.CrmError):
            crm.clean_note(bad)
    with pytest.raises(crm.CrmError):
        crm.clean_reason("no")


def test_status_and_email_normalising():
    assert crm.status_of({}) == "active" and crm.status_of({"suspended_at": "x"}) == "suspended"
    assert crm.status_of({"is_active": False, "suspended_at": "x"}) == "deactivated"
    assert crm.normalize_email("Ann.Lee+promo@Gmail.com") == "annlee@gmail.com"
    assert crm.normalize_email("a.b+x@work.org") == "a.b@work.org"


def person(name, email, **kw):
    return {"_id": ObjectId(), "name": name, "email": email, "role": "player", "city": "Atlanta", "created_at": "2026-10-01", **kw}


def test_duplicates_group_by_mailbox_phone_and_name_and_never_include_admins():
    users = [person("Ann Lee", "ann.lee@gmail.com"), person("Annie", "annlee+x@gmail.com", city="Austin"),
             person("Bo Ray", "bo@x.com", phone="(404) 555-0100"), person("Robert", "rob@y.com", phone="404-555-0100", city="Dallas"),
             person("Cy Poe", "cy@x.com"), person("cy poe", "cy2@z.com"),
             person("Solo", "solo@x.com"), person("Boss", "boss@x.com", role="admin"), person("Boss", "boss2@x.com", role="admin")]
    groups = crm.find_duplicates(users)
    assert [(g["confidence"], len(g["players"])) for g in groups] == [("high", 2), ("high", 2), ("possible", 2)]
    assert {g["reasons"][0] for g in groups} == {"same email address", "same phone number", "same name and city"}
    assert all(p["name"] not in ("Solo", "Boss") for g in groups for p in g["players"])


# ── account status is enforced ────────────────────────────────────────────────

def test_a_suspended_or_deactivated_account_is_refused():
    crm_ok = {"role": "player"}
    auth_utils.check_account_allowed(crm_ok)
    for bad in ({"suspended_at": "2026-10-27"}, {"is_active": False}):
        with pytest.raises(HTTPException) as e:
            auth_utils.check_account_allowed(bad)
        assert e.value.status_code == 403 and "support@venlaxsports.com" in e.value.detail


def test_suspended_players_never_get_marketing_email():
    db = db_with_users()
    db.users.docs[0]["suspended_at"] = "2026-10-27"          # Ann
    assert emails(run(bulk_email.build_audience(db, REG))) == ["di@x.com"]


# ── routes ────────────────────────────────────────────────────────────────────

class Coll2(C):
    async def update_one(self, q, upd, upsert=False):
        d = await self.find_one(q)
        if d:
            for k, v in upd.get("$set", {}).items():
                d[k] = v
            for k in upd.get("$unset", {}):
                d.pop(k, None)


class Db(BaseDb):
    def __init__(self):
        super().__init__()
        self.users = Coll2()
        for n in ("player_notes", "saved_segments", "email_campaigns"):
            setattr(self, n, C())


def sign_in(db, monkeypatch, role="admin", **fields):
    uid = ObjectId()
    me = {"_id": uid, "email": f"{role}@x.com", "name": "Me", "role": role, **fields}
    db.users.docs.append(me)

    async def fake(request, database):
        return {**me, "_id": str(uid)}
    monkeypatch.setattr(routes, "get_current_user", fake)
    return types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace(db=db)), headers={}, client=None)


def add_player(db, name="Pat", **kw):
    uid = ObjectId()
    db.users.docs.append({"_id": uid, "name": name, "email": f"{name.lower()}@x.com", "role": "player", "city": "Atlanta", "created_at": "2026-10-01", **kw})
    return str(uid)


def actions(db):
    return [r["action"] for r in db.audit_log.docs]


def test_tags_change_one_player_or_many_and_are_audited(monkeypatch):
    db = Db()
    pid, other = add_player(db, "Pat"), add_player(db, "Quin", tags=["vip"])
    req = sign_in(db, monkeypatch)
    assert run(routes.set_tags(pid, routes.TagChange(add=["Club Member"]), req)) == {"tags": ["club-member"]}
    res = run(routes.bulk_tags(routes.BulkTagChange(user_ids=[pid, other, pid, str(ObjectId())], add=["spring"]), req))
    assert res == {"selected": 3, "changed": 2}
    assert [t["tag"] for t in run(routes.all_tags(req))["tags"]] == ["club-member", "spring", "vip"]
    assert actions(db) == ["player.tags", "player.bulk_tags"]
    with pytest.raises(HTTPException) as e:
        run(routes.set_tags(pid, routes.TagChange(add=["bad tag!"]), req))
    assert e.value.status_code == 400


def test_admins_cannot_be_the_target_of_player_actions(monkeypatch):
    db = Db()
    req = sign_in(db, monkeypatch)
    boss = add_player(db, "Boss", role="admin")
    for call in (lambda: routes.profile(boss, req), lambda: routes.set_tags(boss, routes.TagChange(add=["x"]), req)):
        with pytest.raises(HTTPException) as e:
            run(call())
        assert e.value.status_code == 404


def test_suspend_and_reactivate_follow_the_rules(monkeypatch):
    db = Db()
    pid = add_player(db)
    req = sign_in(db, monkeypatch)
    with pytest.raises(HTTPException) as e:
        run(routes.suspend(pid, routes.ReasonIn(reason=""), req))
    assert e.value.status_code == 400                                   # a reason is required
    assert run(routes.suspend(pid, routes.ReasonIn(reason="Abusive messages to opponent"), req)) == {"status": "suspended"}
    user = next(u for u in db.users.docs if str(u["_id"]) == pid)
    assert user["suspended_reason"] == "Abusive messages to opponent" and crm.status_of(user) == "suspended"
    with pytest.raises(HTTPException) as e:
        auth_utils.check_account_allowed(user)
    assert e.value.status_code == 403
    with pytest.raises(HTTPException) as e:
        run(routes.suspend(pid, routes.ReasonIn(reason="again please"), req))
    assert e.value.status_code == 409
    assert run(routes.reactivate(pid, req)) == {"status": "active"}
    assert crm.status_of(user) == "active" and "suspended_at" not in user
    assert actions(db) == ["player.suspend", "player.reactivate"]
    assert db.audit_log.docs[0]["after"]["reason"] == "Abusive messages to opponent"


def test_deactivate_hides_the_player_and_blocks_login(monkeypatch):
    db = Db()
    pid = add_player(db)
    req = sign_in(db, monkeypatch)
    run(routes.deactivate(pid, routes.ReasonIn(reason="Requested account closure"), req))
    user = next(u for u in db.users.docs if str(u["_id"]) == pid)
    assert user["is_active"] is False and crm.status_of(user) == "deactivated"
    run(routes.reactivate(pid, req))
    assert user["is_active"] is True


def test_you_cannot_suspend_yourself_and_only_the_right_roles_may_suspend(monkeypatch):
    db = Db()
    pid = add_player(db)
    support = sign_in(db, monkeypatch, admin_role="support")
    with pytest.raises(HTTPException) as e:
        run(routes.suspend(pid, routes.ReasonIn(reason="not allowed for support"), support))
    assert e.value.status_code == 403
    assert db.audit_log.docs == []


def test_notes_are_private_append_only_and_only_super_admins_can_delete(monkeypatch):
    db = Db()
    pid = add_player(db)
    support = sign_in(db, monkeypatch, admin_role="support")
    note = run(routes.add_note(pid, routes.NoteIn(text="Prefers evening matches"), support))
    assert run(routes.profile(pid, support))["notes"][0]["text"] == "Prefers evening matches"
    with pytest.raises(HTTPException) as e:
        run(routes.delete_note(pid, note["id"], support))
    assert e.value.status_code == 403

    marketing = sign_in(db, monkeypatch, admin_role="marketing")
    assert run(routes.profile(pid, marketing))["notes"] is None                        # not even visible
    with pytest.raises(HTTPException) as e:
        run(routes.add_note(pid, routes.NoteIn(text="x"), marketing))
    assert e.value.status_code == 403

    boss = sign_in(db, monkeypatch)
    run(routes.delete_note(pid, note["id"], boss))
    assert db.player_notes.docs == [] and db.audit_log.docs[-1]["before"]["text"] == "Prefers evening matches"


def test_profile_pulls_the_whole_picture_together(monkeypatch):
    db = Db()
    lid = ObjectId()
    db.leagues.docs.append({"_id": lid, "name": "Atlanta Tennis", "sport": "tennis"})
    pid = add_player(db, "Pat", tags=["vip"], attribution={"first": {"ref": "ABC"}}, referral_code="PAT1")
    db.player_leagues.docs.append({"player_id": pid, "league_id": str(lid), "sport": "tennis", "payment_status": "paid", "joined_at": "2026-10-05"})
    db.matches.docs.append({"_id": ObjectId(), "league_id": str(lid), "player1_id": pid, "player1_name": "Pat", "player2_id": "z", "player2_name": "Zoe",
                            "status": "completed", "winner_id": pid, "scheduled_date": "2026-10-20"})
    db.email_campaigns.docs.append({"user_id": pid, "campaign": "tpl_m01_launch", "sent_at": "2026-10-27"})
    p = run(routes.profile(pid, sign_in(db, monkeypatch)))
    assert p["leagues"][0]["name"] == "Atlanta Tennis" and p["matches"][0]["opponent"] == "Zoe" and p["matches"][0]["result"] == "won"
    assert p["communications"] == [{"campaign": "tpl_m01_launch", "sent_at": "2026-10-27"}]
    assert p["referral"]["referred_by_code"] == "ABC" and p["tags"] == ["vip"] and p["status"] == "active"
    assert "password_hash" not in str(p)


def test_saved_segments_can_be_shared_but_only_deleted_by_their_owner_or_a_super_admin(monkeypatch):
    db = Db()
    ann = sign_in(db, monkeypatch, admin_role="support")
    seg = run(routes.create_segment(routes.SegmentIn(name="Never joined, Atlanta", filters={"segment": "never_joined", "city": "Atlanta", "evil": "x", "q": ""}), ann))
    assert seg["filters"] == {"segment": "never_joined", "city": "Atlanta"}
    assert run(routes.list_segments(ann))["segments"][0]["name"] == "Never joined, Atlanta"
    other = sign_in(db, monkeypatch, admin_role="marketing")
    with pytest.raises(HTTPException) as e:
        run(routes.delete_segment(seg["id"], other))
    assert e.value.status_code == 403
    boss = sign_in(db, monkeypatch)
    assert run(routes.delete_segment(seg["id"], boss)) == {"deleted": True}


def test_duplicate_report_needs_player_access(monkeypatch):
    db = Db()
    add_player(db, "Ann", email="ann@x.com")
    add_player(db, "Ann2", email="a.nn@x.com")
    assert run(routes.duplicates(sign_in(db, monkeypatch, admin_role="read_only")))["total_groups"] == 0   # different mailboxes
    with pytest.raises(HTTPException) as e:
        run(routes.duplicates(sign_in(db, monkeypatch, admin_role="analytics_viewer")))
    assert e.value.status_code == 403
