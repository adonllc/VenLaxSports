"""Everything an admin wants to know about one league on one screen: who is in, in what format, who paid how much by
which method, which coupons were used, doubles teams, matches and what needs attention.

Read-only. Every collection is read once for the whole league (no per-player queries). Contact details (email, phone)
are only included when the caller asks for them, which the route allows for the top admin role only.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from bson import ObjectId

DOUBLES_FORMATS = ("doubles", "mixed", "mixed_doubles")
PAID_TXN = ("complete", "paid")
PENDING_ZELLE = ("pending_admin", "pending_zelle")
DEAD_INVITES = ("declined", "expired", "merged", "cancelled")
MATCH_STATUSES = ("scheduled", "in_progress", "completed", "cancelled")


def _money(x) -> float:
    return round(float(x or 0), 2)


def _oids(ids) -> list:
    out = []
    for i in ids:
        try:
            out.append(ObjectId(i))
        except Exception:
            pass
    return out


def method_of(txn: dict | None, pl: dict | None, fee: float) -> str:
    """card | zelle | credit | coupon | manual | free. How this registration was paid for."""
    if not txn:
        return "free" if (pl or {}).get("payment_status") == "free" or fee <= 0 else "none"
    meta = txn.get("metadata") or {}
    sid = str(txn.get("session_id") or "")
    tag = str(meta.get("method") or "")
    if txn.get("method") == "zelle" or sid.startswith("zelle_") or tag == "zelle":
        return "zelle"
    if tag.startswith("promo:"):
        return "coupon"
    if sid.startswith("credit_"):
        return "credit"
    if tag in ("manual", "cash"):
        return "manual"
    if _money(txn.get("amount")) <= 0 and meta.get("promo_code"):
        return "coupon"
    return "card"


def entry_of(league: dict, invite: dict | None) -> tuple[str, str]:
    if league.get("format") not in DOUBLES_FORMATS:
        return "singles", "Singles player"
    if invite and invite.get("pair_by_venlax"):
        if invite.get("partner_user_id"):
            return "doubles_half", "Doubles (half fee): paired by VenLax"
        return "doubles_half", "Doubles (half fee): VenLax finds the partner"
    return "doubles_team", "Doubles team (full fee)"


def _days_to(start) -> int | None:
    try:
        d = date.fromisoformat(str(start)[:10])
    except ValueError:
        return None
    return (d - datetime.now(timezone.utc).date()).days


async def build(db, league: dict, include_contact: bool = False) -> dict:
    lid = str(league["_id"])
    fee = _money(league.get("entry_fee"))
    pls = await db.player_leagues.find({"league_id": lid}).to_list(None)
    txns = await db.payment_transactions.find({"league_id": lid}).to_list(None)
    invites = await db.doubles_invites.find({"league_id": lid}).to_list(None)
    standings = {s["player_id"]: s for s in await db.standings.find({"league_id": lid}).to_list(None)}
    uses = await db.promo_uses.find({"league_id": lid}).to_list(None)
    matches = await db.matches.find({"league_id": lid}).to_list(None)

    invite_by_token = {i.get("token"): i for i in invites if i.get("token")}
    live_invites = [i for i in invites if i.get("status") not in DEAD_INVITES]

    # One row per person: registered players first, then people who paid or started a team but are not registered yet.
    rows: dict[str, dict] = {}
    for pl in pls:
        rows[pl["player_id"]] = {"pl": pl, "invite": invite_by_token.get(pl.get("invite_token"))}
    registered_tokens = {pl.get("invite_token") for pl in pls if pl.get("invite_token")}
    for inv in live_invites:
        if inv.get("token") in registered_tokens:
            continue
        rows.setdefault(inv["initiator_id"], {"pl": None, "invite": inv})
    for t in txns:
        if t.get("status") in PENDING_ZELLE and t.get("user_id") not in rows:
            rows[t["user_id"]] = {"pl": None, "invite": invite_by_token.get((t.get("metadata") or {}).get("invite_token"))}

    users = {str(u["_id"]): u for u in await db.users.find({"_id": {"$in": _oids(rows)}}).to_list(None)} if rows else {}

    paid_txn: dict[str, dict] = {}
    pending_txn: dict[str, dict] = {}
    for t in sorted(txns, key=lambda x: str(x.get("created_at") or "")):
        if t.get("status") in PAID_TXN or t.get("payment_status") == "paid":
            paid_txn[t["user_id"]] = t
        elif t.get("status") in PENDING_ZELLE:
            pending_txn[t["user_id"]] = t
    coupon_of = {u["user_id"]: u["code"] for u in uses}

    players = []
    for uid, r in rows.items():
        pl, inv, user = r["pl"], r["invite"], users.get(uid, {})
        txn = paid_txn.get(uid)
        pend = pending_txn.get(uid)
        if not txn and not pend and inv and inv.get("initiator_id") != uid:
            payer = "partner"
        else:
            payer = "self"
        if txn:
            status = "paid"
        elif pend:
            status = "pending_zelle" if pend.get("status") == "pending_admin" else "awaiting_payment"
        elif payer == "partner":
            status = "covered_by_partner"
        elif pl and pl.get("payment_status") == "free":
            status = "free"
        elif pl and pl.get("payment_status") == "paid":
            status = "paid"   # registered as paid with no transaction row (legacy or hand-made)
        elif inv and float(inv.get("paid_amount") or 0) > 0:
            status = "paid"
        else:
            status = "unpaid"
        if inv and inv.get("refunded_at"):
            status = "refunded"
        shown = txn or pend
        meta = (shown or {}).get("metadata") or {}
        credit = _money(meta.get("credit_applied"))
        amount = _money((shown or {}).get("amount")) if shown else _money(inv.get("paid_amount") if inv and payer == "self" else 0)
        coupon = meta.get("promo_code") or coupon_of.get(uid)
        method = method_of(shown, pl, fee) if payer == "self" else "partner"
        if coupon and method == "card" and amount <= 0:
            method = "coupon"
        kind, label = entry_of(league, inv)
        st = standings.get(uid) or {}
        joined = (pl or {}).get("joined_at") or (pl or {}).get("registered_at") or (inv or {}).get("created_at") or (shown or {}).get("created_at")
        if pl and pl.get("partner_id"):
            team = "paired"
        elif kind != "singles" and (inv or pl):
            team = "waiting_partner"
        else:
            team = None
        row = {
            "player_id": uid, "name": (pl or {}).get("player_name") or user.get("name") or (inv or {}).get("initiator_name") or "Unknown",
            "registered": bool(pl), "joined_at": joined, "skill_level": user.get("skill_level"),
            "entry_type": kind, "entry_label": label,
            "payment_status": status, "payment_method": method, "amount_paid": amount, "credit_applied": credit,
            "total": _money(amount + credit), "coupon": coupon,
            "paid_at": (shown or {}).get("updated_at") or (shown or {}).get("created_at") if status == "paid" else None,
            "session_id": (shown or {}).get("session_id"),
            "zelle_reference": (pend or txn or {}).get("reference_number") if method == "zelle" else None,
            "partner_id": (pl or {}).get("partner_id"), "partner_name": (pl or {}).get("partner_name"),
            "team_status": team, "invite_token": (inv or {}).get("token"),
            "wins": st.get("wins", 0), "losses": st.get("losses", 0), "matches_played": st.get("matches_played", 0),
            "points": st.get("points", 0), "suspended": bool(user.get("suspended_at")),
        }
        if include_contact:
            row["email"] = user.get("email") or (shown or {}).get("user_email")
            row["phone"] = user.get("phone")
        players.append(row)
    players.sort(key=lambda p: str(p.get("joined_at") or ""))

    # Payments ledger: every real payment attempt for the league.
    name_of = {p["player_id"]: p["name"] for p in players}
    ledger = []
    for t in sorted(txns, key=lambda x: str(x.get("created_at") or ""), reverse=True):
        meta = t.get("metadata") or {}
        inv = invite_by_token.get(meta.get("invite_token"))
        kind, label = entry_of(league, inv)
        item = {
            "session_id": t.get("session_id"), "created_at": t.get("created_at"), "player_id": t.get("user_id"),
            "name": name_of.get(t.get("user_id")) or (users.get(t.get("user_id")) or {}).get("name") or "",
            "amount": _money(t.get("amount")), "credit_applied": _money(meta.get("credit_applied")),
            "method": method_of(t, None, fee), "status": t.get("status"), "coupon": meta.get("promo_code"),
            "entry_label": label, "reference": t.get("reference_number"),
        }
        if include_contact:
            item["email"] = t.get("user_email")
        ledger.append(item)

    # Money, by method and in total
    by_method: dict[str, dict] = {}
    collected = credit_used = pending_money = 0.0
    for p in players:
        if p["payment_status"] == "paid":
            collected += p["amount_paid"]
            credit_used += p["credit_applied"]
            m = by_method.setdefault(p["payment_method"], {"players": 0, "amount": 0.0})
            m["players"] += 1
            m["amount"] = _money(m["amount"] + p["amount_paid"])
        elif p["payment_status"] in ("pending_zelle", "awaiting_payment"):
            pending_money += p["amount_paid"]
    coupons: dict[str, dict] = {}
    for p in players:
        if p["coupon"]:
            c = coupons.setdefault(p["coupon"], {"code": p["coupon"], "uses": 0, "players": []})
            c["uses"] += 1
            c["players"].append(p["name"])

    teams = []
    seen = set()
    for inv in live_invites:
        tok = inv.get("token")
        if tok in seen or league.get("format") not in DOUBLES_FORMATS:
            continue
        seen.add(tok)
        members = [p for p in players if p["invite_token"] == tok]
        teams.append({
            "token": tok, "players": [p["name"] for p in members] or [inv.get("initiator_name")],
            "status": "paired" if len([p for p in members if p["registered"]]) >= 2 else "waiting_partner",
            "paid": _money(inv.get("paid_amount")), "pair_by_venlax": bool(inv.get("pair_by_venlax")),
            "partner_email": inv.get("partner_email") if include_contact else None,
        })

    match_counts = {s: 0 for s in MATCH_STATUSES}
    for m in matches:
        match_counts[m.get("status") or "scheduled"] = match_counts.get(m.get("status") or "scheduled", 0) + 1

    registered = [p for p in players if p["registered"]]
    filled = int(league.get("current_players") or len(registered))
    max_p = int(league.get("max_players") or 0)
    min_p = int(league.get("min_players_to_start") or 0)
    days = _days_to(league.get("start_date"))
    flags = []
    if min_p and filled < min_p and league.get("status") == "registration":
        flags.append({"key": "under_minimum", "label": f"Needs {min_p - filled} more to reach the minimum of {min_p}"})
    zelle = [p for p in players if p["payment_status"] == "pending_zelle"]
    if zelle:
        flags.append({"key": "zelle_pending", "label": f"{len(zelle)} Zelle payment(s) waiting for approval"})
    waiting = [p for p in players if p["team_status"] == "waiting_partner"]
    if waiting:
        flags.append({"key": "unpaired_doubles", "label": f"{len(waiting)} doubles player(s) without a partner"})
    if max_p and filled >= max_p:
        flags.append({"key": "full", "label": "League is full"})
    if days is not None and 0 <= days <= 3 and league.get("status") == "registration":
        flags.append({"key": "starts_soon", "label": f"Starts in {days} day(s)"})
    unpaid = [p for p in players if p["payment_status"] == "unpaid" and fee > 0]
    if unpaid:
        flags.append({"key": "unpaid", "label": f"{len(unpaid)} player(s) registered with no payment on record"})

    return {
        "league": {
            "id": lid, "name": league.get("name"), "sport": league.get("sport"), "format": league.get("format"),
            "league_type": league.get("league_type") or "flex", "city": league.get("city"), "status": league.get("status"),
            "start_date": league.get("start_date"), "end_date": league.get("end_date"), "entry_fee": fee,
            "currency": league.get("currency", "USD"), "venue": league.get("venue"),
        },
        "summary": {
            "filled": filled, "max_players": max_p, "min_players_to_start": min_p or None,
            "needs_more": max(0, min_p - filled) if min_p else 0, "days_to_start": days,
            "registered": len(registered), "waiting_partner": len(waiting),
            "collected": _money(collected), "credit_used": _money(credit_used), "pending": _money(pending_money),
            "coupon_entries": sum(c["uses"] for c in coupons.values()),
            "free_entries": len([p for p in players if p["payment_status"] == "free"]),
            "by_method": by_method,
        },
        "flags": flags,
        "players": players,
        "teams": teams,
        "ledger": ledger,
        "coupons": sorted(coupons.values(), key=lambda c: -c["uses"]),
        "matches": {"total": len(matches), **match_counts},
        "contact_visible": include_contact,
    }
