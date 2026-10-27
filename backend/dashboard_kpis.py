"""Admin dashboard numbers, computed from real records. Pure functions over lists of documents.

Every KPI has a definition in DEFINITIONS, shown next to the number in the admin. Rules that hold everywhere:
  * a "player" is a non-admin account that has not been deactivated;
  * a player has "joined a league" when they hold a league registration with payment_status paid or free
    (a pending checkout does not count), and each player is counted once however many leagues they joined;
  * "played" means the player is in at least one completed match (walkovers are not matches played);
  * conversion rates divide by the people who could have converted, and are None (shown as "n/a") when that is zero;
  * we do not guess: stages we have no data for are reported as not tracked.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from attribution import channel_for

ACTIVE_WINDOW_DAYS = 30
ACTIVATION_DAYS = 7
CLIENT_EVENTS = ("registration_started", "league_viewed", "league_registration_started")

DEFINITIONS = {
    "total_players": "Accounts that are not admins and have not been deactivated.",
    "new_players": "Players whose account was created in the period (today, the last 7 days, the last 30 days).",
    "active_players": f"Players who joined a league or completed a match in the last {ACTIVE_WINDOW_DAYS} days. Logging in alone is not tracked, so it does not count.",
    "inactive_players": "Players who are not active by the rule above.",
    "sport_distribution": "Distinct players with a paid or free league registration in that sport. A player in two sports counts in both.",
    "league_registrations": "Paid or free league registrations. A doubles team counts one per player. Pending checkouts are excluded.",
    "not_participating": "Players with no paid or free league registration, among the players in the filtered period.",
    "signup_to_league": "Players who joined at least one league, divided by players who signed up in the period.",
    "league_to_played": "Players who completed at least one match, divided by players who joined a league.",
    "activation_7d": f"Of players who signed up at least {ACTIVATION_DAYS} days ago, the share who joined a league within {ACTIVATION_DAYS} days of signing up.",
    "referral_registrations": "Players who signed up with a referral code or through a referral link.",
    "campaigns": "Emails sent per campaign, and signups that arrived with that campaign in their link. Opens and clicks are not tracked yet.",
}


def parse_dt(value) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value:
        try:
            d = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _rate(num: int, den: int):
    return round(100 * num / den, 1) if den else None


def parse_params(date_from: str = "", date_to: str = "", now: datetime | None = None) -> tuple[datetime, datetime]:
    """Inclusive start of `date_from` to the end of `date_to`. Default: the last 30 days."""
    now = now or datetime.now(timezone.utc)
    end_day = _day(date_to) or now.date()
    start_day = _day(date_from) or (end_day - timedelta(days=29))
    if start_day > end_day:
        raise ValueError("date_from is after date_to")
    if (end_day - start_day).days > 730:
        raise ValueError("The date range is limited to two years")
    start = datetime.combine(start_day, datetime.min.time(), tzinfo=timezone.utc)
    end = datetime.combine(end_day, datetime.max.time(), tzinfo=timezone.utc)
    return start, end


def _day(text: str) -> date | None:
    try:
        return date.fromisoformat(text[:10]) if text else None
    except ValueError:
        raise ValueError("Dates must look like 2026-10-27")


def compute(users, regs, leagues, matches, campaign_sends, referral_ids, events, now=None,
            start=None, end=None, sport="", league_id="", source="") -> dict:
    """users: player accounts · regs: player_leagues · leagues · matches: completed matches
    campaign_sends: email_campaigns rows · referral_ids: ids of players who were referred · events: funnel_events rows."""
    now = now or datetime.now(timezone.utc)
    if start is None or end is None:
        start, end = parse_params(now=now)
    leagues_by_id = {str(lg["_id"]): lg for lg in leagues}

    # Which registrations count: paid or free, optionally one sport and/or one league.
    def counts(r) -> bool:
        if r.get("payment_status") not in ("paid", "free"):
            return False
        if league_id and r.get("league_id") != league_id:
            return False
        if sport and (r.get("sport") or leagues_by_id.get(r.get("league_id"), {}).get("sport")) != sport:
            return False
        return True

    all_players = [u for u in users if u.get("role") != "admin" and u.get("is_active") is not False]
    sources = sorted({channel_for(u.get("attribution"))[0] for u in all_players})
    players = [u for u in all_players if not source or channel_for(u.get("attribution"))[0] == source]
    ids = {str(u["_id"]) for u in players}

    reg_rows = [r for r in regs if str(r.get("player_id")) in ids and counts(r)]
    first_join: dict[str, datetime] = {}
    last_join: dict[str, datetime] = {}
    joined: set[str] = set()      # includes joins whose date was never recorded
    for r in reg_rows:
        pid = str(r["player_id"])
        joined.add(pid)
        t = parse_dt(r.get("joined_at") or r.get("registered_at"))
        if t:
            first_join[pid] = min(t, first_join.get(pid, t))
            last_join[pid] = max(t, last_join.get(pid, t))

    played_ids, last_played = set(), {}
    for m in matches:
        t = parse_dt(m.get("updated_at"))
        for pid in (m.get("player1_id"), m.get("player2_id")):
            pid = str(pid) if pid else ""
            if pid in ids:
                played_ids.add(pid)
                if t and (pid not in last_played or t > last_played[pid]):
                    last_played[pid] = t

    created = {str(u["_id"]): parse_dt(u.get("created_at")) for u in players}
    cohort = [u for u in players if created[str(u["_id"])] and start <= created[str(u["_id"])] <= end]
    cohort_ids = {str(u["_id"]) for u in cohort}

    # ── players
    def made_since(days):
        cut = now - timedelta(days=days)
        return sum(1 for t in created.values() if t and t >= cut)

    day0 = datetime.combine(now.date(), datetime.min.time(), tzinfo=timezone.utc)
    window = now - timedelta(days=ACTIVE_WINDOW_DAYS)
    active = {pid for pid, t in last_join.items() if t >= window} | {pid for pid, t in last_played.items() if t >= window}
    active &= ids

    out: dict = {
        "range": {"from": start.date().isoformat(), "to": end.date().isoformat()},
        "filters": {"sport": sport, "league_id": league_id, "source": source},
        "available_sources": sources,
        "players": {
            "total": len(players),
            "new_today": sum(1 for t in created.values() if t and t >= day0),
            "new_week": made_since(7),
            "new_month": made_since(30),
            "new_in_range": len(cohort),
            "active": len(active),
            "inactive": len(ids - active),
        },
    }

    # ── sports and league registrations
    per_sport = defaultdict(set)
    for r in reg_rows:
        s = r.get("sport") or leagues_by_id.get(r.get("league_id"), {}).get("sport") or "other"
        per_sport[s].add(str(r["player_id"]))
    in_range = [r for r in reg_rows if (t := parse_dt(r.get("joined_at") or r.get("registered_at"))) and start <= t <= end]
    out["sport_distribution"] = {s: len(v) for s, v in sorted(per_sport.items())}
    out["league_registrations"] = {"total": len(reg_rows), "in_range": len(in_range), "distinct_players": len(joined)}
    out["not_participating"] = len([pid for pid in cohort_ids if pid not in joined])

    # ── funnel for the people who signed up in the range
    verified = sum(1 for u in cohort if u.get("email_verified"))
    profiled = sum(1 for u in cohort if u.get("profile_complete"))
    c_joined = len(cohort_ids & joined)
    c_played = len(cohort_ids & played_ids & joined)
    stages = [("Signed up", len(cohort)), ("Email verified", verified), ("Profile completed", profiled),
              ("Joined a league", c_joined), ("Played a match", c_played)]
    out["funnel"] = [{"stage": name, "count": n,
                      "pct_of_signups": _rate(n, len(cohort)),
                      "pct_of_previous": _rate(n, stages[i - 1][1]) if i else None} for i, (name, n) in enumerate(stages)]
    out["conversion"] = {
        "signup_to_league": _rate(c_joined, len(cohort)),
        "league_to_played": _rate(c_played, c_joined),
    }
    old_enough = [pid for pid in ids if created.get(pid) and created[pid] <= now - timedelta(days=ACTIVATION_DAYS)]
    fast = [pid for pid in old_enough if pid in first_join and first_join[pid] <= created[pid] + timedelta(days=ACTIVATION_DAYS)]
    out["activation_7d"] = {"rate": _rate(len(fast), len(old_enough)), "eligible": len(old_enough)}
    out["referral_registrations"] = len(cohort_ids & referral_ids)

    # ── events from the website (registration started, league viewed, league registration started)
    ev = [e for e in events if (t := parse_dt(e.get("at"))) and start <= t <= end and (not sport or e.get("sport") in ("", None, sport))
          and (not league_id or e.get("league_id") in ("", None, league_id))]
    counts_by_event = {name: sum(1 for e in ev if e.get("event") == name) for name in CLIENT_EVENTS}
    first_ev = min((parse_dt(e.get("at")) for e in events if parse_dt(e.get("at"))), default=None)
    out["site_events"] = {"counts": counts_by_event, "tracked_since": first_ev.date().isoformat() if first_ev else None,
                          "note": "Website visits are not tracked here. These counts start on the date shown."}

    # ── daily trend
    days = (end.date() - start.date()).days + 1
    signups_by_day = defaultdict(int)
    for u in cohort:
        signups_by_day[created[str(u["_id"])].date().isoformat()] += 1
    joins_by_day = defaultdict(int)
    for r in in_range:
        joins_by_day[parse_dt(r.get("joined_at") or r.get("registered_at")).date().isoformat()] += 1
    out["trend"] = [{"date": (start.date() + timedelta(days=i)).isoformat(),
                     "signups": signups_by_day[(start.date() + timedelta(days=i)).isoformat()],
                     "league_registrations": joins_by_day[(start.date() + timedelta(days=i)).isoformat()]} for i in range(days)]

    # ── email campaigns: sent, and signups that arrived with the campaign in their link
    sent = defaultdict(int)
    for c in campaign_sends:
        sent[c.get("campaign") or "(unknown)"] += 1
    arrived = defaultdict(lambda: [0, 0])
    for u in players:
        camp = channel_for(u.get("attribution"))[2]
        if camp and camp != "(none)":
            arrived[camp][0] += 1
            arrived[camp][1] += str(u["_id"]) in joined
    names = set(sent) | set(arrived)
    out["campaigns"] = sorted(({"campaign": n, "sent": sent.get(n, 0), "signups": arrived[n][0] if n in arrived else 0,
                                "joined_league": arrived[n][1] if n in arrived else 0} for n in names),
                              key=lambda r: (-r["sent"], r["campaign"]))[:30]

    # ── recent activity
    recent = sorted(players, key=lambda u: created[str(u["_id"])] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)[:8]
    by_id = {str(u["_id"]): u for u in players}
    recent_joins = sorted((r for r in reg_rows if parse_dt(r.get("joined_at") or r.get("registered_at"))),
                          key=lambda r: parse_dt(r.get("joined_at") or r.get("registered_at")), reverse=True)[:8]
    out["recent"] = {
        "signups": [{"name": u.get("name", ""), "email": u.get("email", ""), "at": u.get("created_at")} for u in recent],
        "joins": [{"name": by_id.get(str(r["player_id"]), {}).get("name", ""), "league": leagues_by_id.get(r["league_id"], {}).get("name", ""),
                   "at": r.get("joined_at") or r.get("registered_at")} for r in recent_joins],
    }
    out["definitions"] = DEFINITIONS
    return out
