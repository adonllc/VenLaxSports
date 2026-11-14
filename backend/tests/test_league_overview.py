"""Admin league overview and roster actions. In-memory fake database."""
import sys
from pathlib import Path

import pytest
from bson import ObjectId

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import league_overview  # noqa: E402
import league_roster  # noqa: E402
import permissions  # noqa: E402
from test_league_schedule import Coll, run  # noqa: E402


class FakeColl(Coll):
    @classmethod
    def _match(cls, doc, q):
        q = dict(q)
        for k, v in list(q.items()):
            if isinstance(v, dict) and "$gt" in v:
                have = doc.get(k)
                if not (have is not None and have > v["$gt"]):
                    return False
                q.pop(k)
        return super()._match(doc, q)

    async def insert_one(self, doc):
        doc.setdefault("_id", ObjectId())
        self.docs.append(doc)

    async def update_many(self, q, upd):
        for d in [d for d in self.docs if self._match(d, q)]:
            d.update(upd.get("$set", {}))

    async def update_one(self, q, upd, upsert=False):
        d = await self.find_one(q)
        if d:
            for k, v in upd.get("$inc", {}).items():
                d[k] = d.get(k, 0) + v
            d.update(upd.get("$set", {}))

    async def find_one_and_update(self, q, upd, return_document=False):
        d = await self.find_one(q)
        if not d:
            return None
        before = dict(d)
        for k, v in upd.get("$inc", {}).items():
            d[k] = round(d.get(k, 0) + v, 2)
        return d if return_document else before


class Db:
    def __init__(self):
        for n in ("leagues", "users", "player_leagues", "payment_transactions", "doubles_invites", "standings",
                  "promo_uses", "matches", "credit_ledger"):
            setattr(self, n, FakeColl())
        self.lid = ObjectId()
        self.leagues.docs.append({"_id": self.lid, "name": "Atlanta Singles", "sport": "tennis", "format": "singles",
                                  "status": "registration", "entry_fee": 9.99, "max_players": 8, "current_players": 0,
                                  "min_players_to_start": 4, "start_date": "2099-01-01"})

    def player(self, name, **kw):
        uid = ObjectId()
        self.users.docs.append({"_id": uid, "name": name, "email": f"{name.lower()}@x.com", "phone": "555", **kw})
        return str(uid)

    def register(self, uid, name, status="paid"):
        self.player_leagues.docs.append({"_id": ObjectId(), "league_id": str(self.lid), "player_id": uid, "player_name": name,
                                         "payment_status": status, "joined_at": "2026-11-01T00:00:00+00:00"})
        self.standings.docs.append({"league_id": str(self.lid), "player_id": uid, "wins": 1, "losses": 0, "matches_played": 1})
        self.leagues.docs[0]["current_players"] += 1

    def txn(self, uid, amount, session_id, status="complete", **extra):
        t = {"_id": ObjectId(), "user_id": uid, "user_email": "e@x.com", "league_id": str(self.lid), "session_id": session_id,
             "amount": amount, "status": status, "payment_status": "paid" if status == "complete" else "unpaid",
             "created_at": "2026-11-01T00:00:00+00:00", "metadata": extra.pop("metadata", {}), **extra}
        self.payment_transactions.docs.append(t)
        return t


def league(db):
    return db.leagues.docs[0]


def by_name(out):
    return {p["name"]: p for p in out["players"]}


def test_each_player_shows_how_they_paid():
    db = Db()
    card, zelle, coupon, credit, free = (db.player(n) for n in ("Card", "Zelle", "Coupon", "Credit", "Free"))
    for uid, n in ((card, "Card"), (coupon, "Coupon"), (credit, "Credit"), (free, "Free")):
        db.register(uid, n)
    db.txn(card, 9.99, "cs_live_1")
    db.txn(coupon, 0.0, f"promo:SAVE_{ObjectId()}", metadata={"method": "promo:SAVE", "promo_code": "SAVE"})
    db.txn(credit, 0.0, "credit_abc", metadata={"credit_applied": 9.99})
    db.txn(zelle, 9.99, "zelle_1", status="pending_admin", method="zelle", reference_number="ZZ99")
    db.promo_uses.docs.append({"code": "SAVE", "user_id": coupon, "league_id": str(db.lid)})
    p = by_name(run(league_overview.build(db, league(db))))
    assert (p["Card"]["payment_method"], p["Card"]["amount_paid"], p["Card"]["payment_status"]) == ("card", 9.99, "paid")
    assert (p["Coupon"]["payment_method"], p["Coupon"]["coupon"]) == ("coupon", "SAVE")
    assert (p["Credit"]["payment_method"], p["Credit"]["credit_applied"], p["Credit"]["total"]) == ("credit", 9.99, 9.99)
    assert (p["Zelle"]["payment_status"], p["Zelle"]["payment_method"], p["Zelle"]["registered"]) == ("pending_zelle", "zelle", False)
    assert p["Zelle"]["zelle_reference"] == "ZZ99"


def test_summary_money_coupons_and_flags():
    db = Db()
    a, b = db.player("Ann"), db.player("Bea")
    db.register(a, "Ann")
    db.register(b, "Bea")
    db.txn(a, 9.99, "cs_1")
    db.txn(b, 0.0, "promo_x", metadata={"method": "promo:SAVE", "promo_code": "SAVE"})
    z = db.player("Zed")
    db.txn(z, 9.99, "zelle_2", status="pending_admin", method="zelle")
    out = run(league_overview.build(db, league(db)))
    s = out["summary"]
    assert s["collected"] == 9.99 and s["pending"] == 9.99 and s["coupon_entries"] == 1 and s["needs_more"] == 2
    assert out["coupons"][0]["code"] == "SAVE" and out["coupons"][0]["players"] == ["Bea"]
    assert {f["key"] for f in out["flags"]} >= {"under_minimum", "zelle_pending"}
    assert out["matches"]["total"] == 0


def test_contact_details_only_for_the_top_role():
    db = Db()
    a = db.player("Ann")
    db.register(a, "Ann")
    db.txn(a, 9.99, "cs_1")
    hidden = run(league_overview.build(db, league(db), include_contact=False))
    shown = run(league_overview.build(db, league(db), include_contact=True))
    assert "email" not in hidden["players"][0] and "phone" not in hidden["players"][0] and "email" not in hidden["ledger"][0]
    assert shown["players"][0]["email"] == "ann@x.com" and shown["players"][0]["phone"] == "555"
    assert permissions.effective_role({"role": "admin"}) == "super_admin"
    assert permissions.effective_role({"role": "admin", "admin_role": "operations"}) != "super_admin"


def test_unregistered_doubles_initiator_shows_as_waiting_for_a_partner():
    db = Db()
    league(db)["format"] = "doubles"
    a = db.player("Ann")
    db.doubles_invites.docs.append({"token": "t1", "league_id": str(db.lid), "initiator_id": a, "initiator_name": "Ann",
                                    "status": "initiator_paid", "paid_amount": 9.99, "pair_by_venlax": True})
    db.txn(a, 9.99, "cs_9", metadata={"invite_token": "t1", "is_doubles": "true"})
    out = run(league_overview.build(db, league(db)))
    ann = by_name(out)["Ann"]
    assert ann["registered"] is False and ann["team_status"] == "waiting_partner" and ann["entry_type"] == "doubles_half"
    assert out["teams"][0]["status"] == "waiting_partner" and any(f["key"] == "unpaired_doubles" for f in out["flags"])


def test_mark_paid_records_a_manual_payment():
    db = Db()
    a = db.player("Ann")
    db.register(a, "Ann", status="pending")
    run(league_roster.mark_paid(db, league(db), a, None, "cash at the courts"))
    assert db.player_leagues.docs[0]["payment_status"] == "paid"
    t = db.payment_transactions.docs[0]
    assert t["amount"] == 9.99 and t["metadata"]["method"] == "manual"
    with pytest.raises(league_roster.RosterError):
        run(league_roster.mark_paid(db, league(db), a, None, ""))


def test_remove_with_credit_refunds_as_credit_and_frees_the_place():
    db = Db()
    a = db.player("Ann")
    db.register(a, "Ann")
    db.txn(a, 9.99, "cs_1")
    # played a match -> cannot be removed
    db.matches.docs.append({"league_id": str(db.lid), "player1_id": a, "player2_id": "x", "status": "scheduled"})
    with pytest.raises(league_roster.RosterError) as e:
        run(league_roster.remove_player(db, league(db), a, "credit"))
    assert e.value.status == 409 and len(db.player_leagues.docs) == 1
    db.matches.docs.clear()
    out = run(league_roster.remove_player(db, league(db), a, "credit"))
    assert out["credited"] == 9.99 and db.users.docs[0]["venlax_credit"] == 9.99
    assert db.player_leagues.docs == [] and db.standings.docs == [] and league(db)["current_players"] == 0


def test_card_refund_needs_a_real_card_payment():
    db = Db()
    a = db.player("Ann")
    db.register(a, "Ann")
    db.txn(a, 9.99, "zelle_5", method="zelle")
    with pytest.raises(league_roster.RosterError) as e:
        run(league_roster.remove_player(db, league(db), a, "card"))
    assert e.value.status == 409 and len(db.player_leagues.docs) == 1


def test_card_refund_calls_stripe_then_removes(monkeypatch):
    import scheduler_jobs
    calls = []
    monkeypatch.setattr(scheduler_jobs, "_stripe_refund", lambda sid, key: calls.append((sid, key)) or "re_1")
    db = Db()
    a = db.player("Ann")
    db.register(a, "Ann")
    db.txn(a, 9.99, "cs_live_7")
    out = run(league_roster.remove_player(db, league(db), a, "card"))
    assert calls[0][0] == "cs_live_7" and out["stripe_refund_id"] == "re_1" and db.player_leagues.docs == []
    assert db.payment_transactions.docs[0]["refund_id"] == "re_1"


def test_failed_stripe_refund_removes_nobody(monkeypatch):
    import scheduler_jobs

    def boom(sid, key):
        raise RuntimeError("stripe down")
    monkeypatch.setattr(scheduler_jobs, "_stripe_refund", boom)
    db = Db()
    a = db.player("Ann")
    db.register(a, "Ann")
    db.txn(a, 9.99, "cs_live_7")
    with pytest.raises(league_roster.RosterError) as e:
        run(league_roster.remove_player(db, league(db), a, "card"))
    assert e.value.status == 502 and len(db.player_leagues.docs) == 1 and league(db)["current_players"] == 1


def test_move_player_carries_registration_standing_and_payment():
    db = Db()
    a = db.player("Ann")
    db.register(a, "Ann")
    db.txn(a, 9.99, "cs_1")
    other = ObjectId()
    db.leagues.docs.append({"_id": other, "name": "Marietta Singles", "sport": "tennis", "format": "singles",
                            "status": "registration", "entry_fee": 9.99, "max_players": 8, "current_players": 0})
    out = run(league_roster.move_player(db, league(db), a, str(other)))
    assert out["to_league"] == "Marietta Singles" and out["fee_changed"] is False
    assert db.player_leagues.docs[0]["league_id"] == str(other) and db.standings.docs[0]["league_id"] == str(other)
    assert db.payment_transactions.docs[0]["league_name"] == "Marietta Singles"
    assert league(db)["current_players"] == 0 and db.leagues.docs[1]["current_players"] == 1


def test_move_is_refused_to_a_full_or_different_format_league():
    db = Db()
    a = db.player("Ann")
    db.register(a, "Ann")
    full, dbl = ObjectId(), ObjectId()
    db.leagues.docs += [
        {"_id": full, "name": "Full", "sport": "tennis", "format": "singles", "status": "registration", "max_players": 2, "current_players": 2},
        {"_id": dbl, "name": "Doubles", "sport": "tennis", "format": "doubles", "status": "registration", "max_players": 8, "current_players": 0},
    ]
    for target in (full, dbl):
        with pytest.raises(league_roster.RosterError) as e:
            run(league_roster.move_player(db, league(db), a, str(target)))
        assert e.value.status == 409
    assert db.player_leagues.docs[0]["league_id"] == str(db.lid)


def test_a_paired_doubles_player_cannot_be_removed_alone():
    db = Db()
    a = db.player("Ann")
    db.register(a, "Ann")
    db.player_leagues.docs[0]["partner_id"] = "p2"
    with pytest.raises(league_roster.RosterError) as e:
        run(league_roster.remove_player(db, league(db), a, "none"))
    assert e.value.status == 409
