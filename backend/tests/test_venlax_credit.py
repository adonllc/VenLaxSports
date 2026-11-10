"""VenLax Credit: grants, spends, retries and the credit-first split. Small in-memory fake database."""
import sys
from pathlib import Path

import pytest
from bson import ObjectId

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import venlax_credit  # noqa: E402
from test_bulk_email import C  # noqa: E402
from test_league_schedule import run  # noqa: E402


class Users(C):
    """find_one_and_update with $inc and return_document, the only shape venlax_credit uses."""
    async def find_one_and_update(self, q, upd, return_document=False):
        d = await self.find_one(q)
        if not d:
            return None
        before = dict(d)
        for k, v in upd.get("$inc", {}).items():
            d[k] = round(d.get(k, 0) + v, 2)
        return d if return_document else before


class Db:
    def __init__(self, credit=None):
        self.users, self.credit_ledger = Users(), C()
        self.uid = ObjectId()
        doc = {"_id": self.uid, "name": "Pat"}
        if credit is not None:
            doc["venlax_credit"] = credit
        self.users.docs.append(doc)
        self.u = str(self.uid)


def test_grant_adds_to_the_balance_and_writes_a_ledger_row():
    db = Db()
    assert run(venlax_credit.grant(db, db.u, 9.99, "Paired by VenLax", ref="r1", league_id="L")) == 9.99
    assert run(venlax_credit.balance(db, db.u)) == 9.99
    row = db.credit_ledger.docs[0]
    assert (row["amount"], row["balance_after"], row["league_id"]) == (9.99, 9.99, "L")


def test_the_same_ref_never_grants_twice():
    db = Db()
    run(venlax_credit.grant(db, db.u, 5, "x", ref="same"))
    assert run(venlax_credit.grant(db, db.u, 5, "x", ref="same")) is None
    assert run(venlax_credit.balance(db, db.u)) == 5 and len(db.credit_ledger.docs) == 1


def test_spend_takes_credit_and_refuses_more_than_the_balance():
    db = Db(credit=10)
    assert run(venlax_credit.spend(db, db.u, 4, "Entry fee", ref="s1")) == 6
    assert run(venlax_credit.spend(db, db.u, 7, "Entry fee", ref="s2")) is None
    assert run(venlax_credit.balance(db, db.u)) == 6
    assert [r["amount"] for r in db.credit_ledger.docs] == [-4]


def test_the_same_spend_ref_is_not_charged_twice():
    db = Db(credit=10)
    run(venlax_credit.spend(db, db.u, 4, "Entry fee", ref="once"))
    assert run(venlax_credit.spend(db, db.u, 4, "Entry fee", ref="once")) is None
    assert run(venlax_credit.balance(db, db.u)) == 6


@pytest.mark.parametrize("amount", [0, -1])
def test_non_positive_amounts_are_rejected(amount):
    db = Db(credit=10)
    with pytest.raises(ValueError):
        run(venlax_credit.grant(db, db.u, amount, "x", ref="a"))
    with pytest.raises(ValueError):
        run(venlax_credit.spend(db, db.u, amount, "x", ref="b"))


def test_a_missing_player_is_an_error_not_a_silent_grant():
    db = Db()
    with pytest.raises(ValueError):
        run(venlax_credit.grant(db, str(ObjectId()), 5, "x", ref="ghost"))


@pytest.mark.parametrize("due,available,expected", [
    (19.99, 0, (0, 19.99)),
    (19.99, 9.99, (9.99, 10.0)),
    (9.99, 25, (9.99, 0)),
    (9.99, 9.99, (9.99, 0)),
])
def test_credit_is_used_first_and_the_rest_is_paid_by_card(due, available, expected):
    assert venlax_credit.split_payment(due, available) == expected
