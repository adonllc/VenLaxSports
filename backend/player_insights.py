"""Admin player insights: how far each account got (signup, verified, joined, paid, played), what each player
joined and paid for (format, free promo code, paid by a partner), and which open leagues they have not joined.

Pure functions over lists of documents so they are easy to test; the routes load the data.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from attribution import channel_for

SEGMENTS = {
    "all": "Everyone",
    "never_joined": "Signed up, never joined a league",
    "one_league": "Joined exactly one league",
    "paid": "Paid with money",
    "coupon": "Joined with a promo code",
    "partner_paid": "Joined on a partner's team fee",
    "doubles": "Played or joined doubles",
    "waiting_partner": "Doubles team waiting for a partner",
    "joined_not_played": "Joined, no match played yet",
    "played": "Played at least one match",
    "unverified": "Email not verified",
    "profile_incomplete": "Profile not finished",
}
STAGE_ORDER = ["signed_up", "email_verified", "profile_complete", "joined", "paid", "played"]


def _day(iso: str) -> str:
    return (iso or "")[:10]


def build_player_rows(users, regs, leagues, txns, promo_uses, played_counts, invites) -> list[dict]:
    """One row per player, newest account first.

    regs: player_leagues (only paid or free count as joined) · txns: payment_transactions
    promo_uses: promo_uses · played_counts: {user_id: completed matches} · invites: open doubles_invites
    """
    leagues_by_id = {str(lg["_id"]): lg for lg in leagues}
    paid_amount: dict[tuple, float] = defaultdict(float)
    for t in txns:
        if t.get("payment_status") == "paid" and t.get("league_id"):
            paid_amount[(str(t.get("user_id")), t["league_id"])] += float(t.get("amount", 0))
    coupon = {(str(p["user_id"]), p["league_id"]): p["code"] for p in promo_uses}
    waiting = {str(i["initiator_id"]) for i in invites}
    regs_by_player = defaultdict(list)
    for r in regs:
        if r.get("payment_status") in ("paid", "free"):
            regs_by_player[str(r["player_id"])].append(r)
    open_leagues = [lg for lg in leagues if lg.get("status") == "registration"]

    rows = []
    for u in users:
        uid = str(u["_id"])
        joined, total_paid, codes, formats = [], 0.0, [], set()
        for r in regs_by_player.get(uid, []):
            lg = leagues_by_id.get(r["league_id"], {})
            amount = paid_amount.get((uid, r["league_id"]), 0.0)
            code = coupon.get((uid, r["league_id"]))
            if code:
                how = f"promo {code}"
                codes.append(code)
            elif amount > 0:
                how = "paid"
            elif r.get("payment_status") == "paid":
                how = "partner paid the team fee"
            else:
                how = "free"
            fmt = lg.get("format") or "singles"
            formats.add(fmt)
            total_paid += amount
            joined.append({
                "league_id": r["league_id"], "name": lg.get("name", "(deleted league)"), "sport": lg.get("sport", ""),
                "format": fmt, "status": lg.get("status", ""), "how": how, "amount": round(amount, 2),
                "joined_at": r.get("joined_at") or r.get("registered_at") or "",
            })
        joined_ids = {j["league_id"] for j in joined}
        city = (u.get("city") or "").strip().lower()
        not_joined = [lg["name"] for lg in open_leagues
                      if str(lg["_id"]) not in joined_ids and city and (lg.get("city") or "").strip().lower() == city]
        played = played_counts.get(uid, 0)
        source, medium, campaign = channel_for(u.get("attribution"))

        if played:
            stage = "played"
        elif total_paid > 0:
            stage = "paid"
        elif joined:
            stage = "joined"
        elif u.get("profile_complete"):
            stage = "profile_complete"
        elif u.get("email_verified"):
            stage = "email_verified"
        else:
            stage = "signed_up"

        rows.append({
            "id": uid, "name": u.get("name", ""), "email": u.get("email", ""), "city": u.get("city") or "",
            "signed_up": u.get("created_at", ""), "source": source, "campaign": campaign,
            "email_verified": bool(u.get("email_verified")), "profile_complete": bool(u.get("profile_complete")),
            "stage": stage, "leagues": joined, "league_count": len(joined), "total_paid": round(total_paid, 2),
            "promo_codes": codes, "formats": sorted(formats), "matches_played": played,
            "waiting_for_partner": uid in waiting, "open_leagues_not_joined": not_joined,
        })
    rows.sort(key=lambda r: r["signed_up"], reverse=True)
    return rows


def in_segment(row: dict, segment: str) -> bool:
    return {
        "all": True,
        "never_joined": row["league_count"] == 0,
        "one_league": row["league_count"] == 1,
        "paid": row["total_paid"] > 0,
        "coupon": bool(row["promo_codes"]),
        "partner_paid": any(j["how"] == "partner paid the team fee" for j in row["leagues"]),
        "doubles": any(f in ("doubles", "mixed_doubles") for f in row["formats"]),
        "waiting_partner": row["waiting_for_partner"],
        "joined_not_played": row["league_count"] > 0 and row["matches_played"] == 0,
        "played": row["matches_played"] > 0,
        "unverified": not row["email_verified"],
        "profile_incomplete": not row["profile_complete"],
    }[segment]


def funnel(rows: list[dict]) -> list[dict]:
    """Counts of accounts that reached each step. Each step is a share of all signups."""
    n = len(rows)
    steps = [
        ("Signed up", n),
        ("Verified email", sum(r["email_verified"] for r in rows)),
        ("Finished profile", sum(r["profile_complete"] for r in rows)),
        ("Joined a league", sum(r["league_count"] > 0 for r in rows)),
        ("Paid with money", sum(r["total_paid"] > 0 for r in rows)),
        ("Played a match", sum(r["matches_played"] > 0 for r in rows)),
        ("Joined 2 or more leagues", sum(r["league_count"] > 1 for r in rows)),
    ]
    return [{"label": label, "count": c, "percent": round(100 * c / n) if n else 0} for label, c in steps]


def league_summary(leagues, regs, txns, promo_uses, users, invites) -> list[dict]:
    """One row per league: who joined and how, revenue, and how many players in its city have not joined it."""
    paid_by_league = defaultdict(float)
    for t in txns:
        if t.get("payment_status") == "paid" and t.get("league_id"):
            paid_by_league[t["league_id"]] += float(t.get("amount", 0))
    coupon_keys = {(str(p["user_id"]), p["league_id"]) for p in promo_uses}
    regs_by_league = defaultdict(list)
    for r in regs:
        if r.get("payment_status") in ("paid", "free"):
            regs_by_league[r["league_id"]].append(r)
    waiting_by_league = defaultdict(int)
    for i in invites:
        waiting_by_league[i["league_id"]] += 1
    users_by_city = defaultdict(set)
    for u in users:
        users_by_city[(u.get("city") or "").strip().lower()].add(str(u["_id"]))

    out = []
    for lg in leagues:
        lid = str(lg["_id"])
        members = regs_by_league.get(lid, [])
        member_ids = {str(r["player_id"]) for r in members}
        with_coupon = sum((str(r["player_id"]), lid) in coupon_keys for r in members)
        city_users = users_by_city.get((lg.get("city") or "").strip().lower(), set()) if lg.get("city") else set()
        out.append({
            "league_id": lid, "name": lg.get("name", ""), "city": lg.get("city", ""), "sport": lg.get("sport", ""),
            "format": lg.get("format") or "singles", "status": lg.get("status", ""), "start_date": lg.get("start_date", ""),
            "entry_fee": float(lg.get("entry_fee", 0)), "registered": len(members), "capacity": lg.get("max_players", 0),
            "with_promo": with_coupon, "revenue": round(paid_by_league.get(lid, 0.0), 2),
            "waiting_for_partner": waiting_by_league.get(lid, 0),
            "city_players_not_joined": len(city_users - member_ids),
        })
    out.sort(key=lambda r: (r["status"] != "registration", r["start_date"]))
    return out


def promo_summary(promo_uses, codes) -> list[dict]:
    """Per promo code: how many times it was used, by whom (count), and its limit.

    Personal coupons (one per player, like the thank-you $10) are one row per campaign: how many were made and used."""
    used = defaultdict(set)
    for p in promo_uses:
        used[p["code"]].add(str(p["user_id"]))
    rows, personal = [], {}
    for c in codes:
        code = c.get("code", "")
        if c.get("restricted_user_id"):
            key = "test emails" if str(c.get("campaign_key", "")).startswith("test_") else c.get("campaign_key", "")
            g = personal.setdefault(key, {"code": f"Personal coupons ({'admin test emails' if key == 'test emails' else c.get('description') or key})",
                                                                "description": "", "type": c.get("type", ""), "used": 0, "max_uses": 0, "players": 0, "active": True})
            g["max_uses"] += 1
            g["used"] += c.get("used_count", 0)
            g["players"] += len(used.get(code, ()))
            continue
        rows.append({"code": code, "description": c.get("description", ""), "type": c.get("type", ""),
                     "used": c.get("used_count", len(used.get(code, ()))), "max_uses": c.get("max_uses"),
                     "players": len(used.get(code, ())), "active": bool(c.get("active", True))})
    rows += list(personal.values())
    rows.sort(key=lambda r: -r["used"])
    return rows


CSV_COLUMNS = ["name", "email", "city", "signed_up", "source", "campaign", "stage", "email_verified", "profile_complete",
               "leagues", "formats", "how_joined", "total_paid", "promo_codes", "matches_played", "waiting_for_partner",
               "open_leagues_not_joined"]


def csv_row(r: dict) -> list:
    return [r["name"], r["email"], r["city"], _day(r["signed_up"]), r["source"], r["campaign"], r["stage"],
            "yes" if r["email_verified"] else "no", "yes" if r["profile_complete"] else "no",
            "; ".join(j["name"] for j in r["leagues"]), "; ".join(r["formats"]), "; ".join(j["how"] for j in r["leagues"]),
            f"{r['total_paid']:.2f}", "; ".join(r["promo_codes"]), r["matches_played"],
            "yes" if r["waiting_for_partner"] else "no", "; ".join(r["open_leagues_not_joined"])]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
