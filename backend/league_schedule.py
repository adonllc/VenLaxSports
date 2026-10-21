"""Open a flex league to play: generate every player's matches for the season.

Each player (or doubles team) gets `matches_per_player` opponents drawn at random from
players of a compatible rating, never a repeat opponent unless the league allows rematches,
with a Home or Away role per match. Home proposes the date, time and court; Away confirms.

Shared by the admin "Open to Play" button, the nightly auto-open job, and the
regenerate / adjust tools (allowed only until someone starts scheduling or playing).
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from bson import ObjectId

import email_service
from models import Match
from pairing_utils import DEFAULT_BAND, pair_units

DEFAULT_MATCHES_PER_PLAYER = 4
MIN_PLAYERS_AUTO_START = 8  # players (or teams) needed before a league opens by itself


class ScheduleLocked(Exception):
    """Play has started, so the generated schedule can no longer be changed."""


async def build_units(db, league: dict):
    """Registered players (singles) or teams (doubles) as pairing units, plus the user docs."""
    league_id = str(league["_id"])
    sport = league["sport"]
    is_doubles = league.get("format") in ("doubles", "mixed")
    regs = await db.player_leagues.find(
        {"league_id": league_id, "payment_status": {"$in": ["paid", "free"]}}
    ).to_list(500)

    ids = {r["player_id"] for r in regs} | {r["partner_id"] for r in regs if r.get("partner_id")}
    users = {}
    async for u in db.users.find({"_id": {"$in": [ObjectId(i) for i in ids if ObjectId.is_valid(i)]}}):
        users[str(u["_id"])] = u

    def rating_of(uid: str) -> float:
        return float(users.get(uid, {}).get(f"{sport}_rating") or 3.0)

    def name_of(uid: str, fallback: str = "") -> str:
        return users.get(uid, {}).get("name", fallback)

    units = []
    for r in regs:
        pid = r["player_id"]
        if is_doubles:
            partner = r.get("partner_id")
            if not partner or pid > partner:
                continue  # one record per team
            units.append({
                "id": pid, "partner_id": partner, "members": [pid, partner],
                "name": f"{name_of(pid, r['player_name'])} & {name_of(partner, r.get('partner_name', ''))}",
                "rating": (rating_of(pid) + rating_of(partner)) / 2,
            })
        else:
            units.append({"id": pid, "members": [pid], "name": name_of(pid, r["player_name"]), "rating": rating_of(pid)})
    return units, users


def plan_schedule(units: list[dict], rounds: int, seed: str, band: float = DEFAULT_BAND):
    """Return [{"round": n, "pairs": [(home, away), ...], "bye": unit | None}, ...].

    Opponents are random within `band` rating points and never repeat unless unavoidable.
    The seed makes a given schedule reproducible (a regeneration uses a new seed).
    """
    rng = random.Random(seed)
    played: set = set()
    byes: set = set()
    home_count = {u["id"]: 0 for u in units}
    plan = []
    for n in range(1, rounds + 1):
        pairs, bye = pair_units(units, played, byes, rng=rng, band=band)
        out = []
        for a, b in pairs:
            played.add(frozenset({a["id"], b["id"]}))
            if home_count[a["id"]] == home_count[b["id"]]:
                home, away = (a, b) if rng.random() < 0.5 else (b, a)
            else:
                home, away = (a, b) if home_count[a["id"]] < home_count[b["id"]] else (b, a)
            home_count[home["id"]] += 1
            out.append((home, away))
        if bye:
            byes.add(bye["id"])
        plan.append({"round": n, "pairs": out, "bye": bye})
    return plan


def round_deadlines(league: dict, rounds: int, now: datetime) -> list[datetime]:
    """Evenly spaced play-by dates between the later of (start, now) and the league end."""
    def parse(s, default):
        try:
            return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
        except Exception:
            return default

    start = max(parse(league.get("start_date"), now), now)
    end = parse(league.get("end_date"), start + timedelta(days=rounds * 14))
    span_days = max((end - start).days, rounds * 7)
    step = span_days / rounds
    return [
        (start + timedelta(days=step * r)).replace(hour=23, minute=59, second=0, microsecond=0)
        for r in range(1, rounds + 1)
    ]


def _label(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso).strftime("%b %d, %Y")
    except Exception:
        return iso or ""


def _side(match: dict, which: int) -> list[str]:
    ids = [match["player1_id"], match.get("team1_partner_id")] if which == 1 else [match["player2_id"], match.get("team2_partner_id")]
    return [i for i in ids if i]


def _side_name(match: dict, which: int) -> str:
    if which == 1:
        names = [match.get("player1_name"), match.get("team1_partner_name")]
    else:
        names = [match.get("player2_name"), match.get("team2_partner_name")]
    return " & ".join(n for n in names if n)


async def email_player_schedules(db, league: dict, player_ids: set[str], updated: bool = False) -> None:
    """Email each player their full list of opponents (transactional, always sent)."""
    league_id = str(league["_id"])
    matches = await db.matches.find({"league_id": league_id, "round": {"$ne": None}, "deadline": {"$ne": None}}).to_list(2000)
    ids = {i for m in matches for i in _side(m, 1) + _side(m, 2)} | set(player_ids)
    users = {}
    async for u in db.users.find({"_id": {"$in": [ObjectId(i) for i in ids if ObjectId.is_valid(i)]}}):
        users[str(u["_id"])] = u

    def emails_of(members: list[str]) -> str:
        return ", ".join(e for e in (users.get(m, {}).get("email", "") for m in members) if e)

    rows: dict[str, list] = {}
    for m in matches:
        for me_side, other_side, role in ((1, 2, "Home"), (2, 1, "Away")):
            row = {"round": m.get("round"), "role": role, "opponent": _side_name(m, other_side),
                   "email": emails_of(_side(m, other_side)), "deadline": _label(m.get("deadline"))}
            for uid in _side(m, me_side):
                if uid in player_ids:
                    rows.setdefault(uid, []).append(row)
    for uid, items in rows.items():
        u = users.get(uid)
        if u and u.get("email"):
            email_service.schedule(email_service.send_league_open(
                u["email"], u.get("name", ""), league["name"], league_id,
                sorted(items, key=lambda r: r["round"] or 0), updated=updated))


def _has_activity(m: dict) -> bool:
    return m.get("schedule_status") in ("proposed", "scheduled") or m.get("status") != "scheduled"


async def open_league_to_play(db, league: dict, matches_per_player: int | None = None,
                              preview: bool = False, regenerate: bool = False) -> dict:
    """Generate the season schedule. preview=True changes nothing.

    regenerate=True replaces an existing generated schedule, but only while no match has been
    proposed, scheduled or played; otherwise ScheduleLocked is raised.
    """
    league_id = str(league["_id"])
    existing = await db.matches.find({"league_id": league_id, "deadline": {"$ne": None}}).to_list(2000)
    if existing and not regenerate:
        raise ValueError("This league already has a generated schedule")
    if existing and any(_has_activity(m) for m in existing):
        raise ScheduleLocked("Play has started (a match was scheduled or played), so the schedule can no longer be regenerated")

    units, users = await build_units(db, league)
    if len(units) < 2:
        raise ValueError("At least two registered players (or teams) are needed")

    wanted = int(matches_per_player or league.get("matches_per_player") or DEFAULT_MATCHES_PER_PLAYER)
    # Without rematches nobody can have more matches than there are other opponents.
    rounds = max(1, wanted if league.get("allow_rematches") else min(wanted, len(units) - 1))
    generation = int(league.get("schedule_generation") or 0) + 1
    plan = plan_schedule(units, rounds, f"{league_id}:{generation}", float(league.get("rating_band") or DEFAULT_BAND))
    now = datetime.now(timezone.utc)
    deadlines = round_deadlines(league, rounds, now)

    summary = {
        "players": len(units),
        "rounds": rounds,
        "matches": sum(len(p["pairs"]) for p in plan),
        "byes": [p["bye"]["name"] for p in plan if p["bye"]],
        "regenerating": bool(existing),
        "sample_round_1": [{"home": h["name"], "away": a["name"]} for h, a in plan[0]["pairs"]],
    }
    if preview:
        return {"preview": True, **summary}

    is_doubles = league.get("format") in ("doubles", "mixed")
    docs = []
    for p, deadline in zip(plan, deadlines):
        for home, away in p["pairs"]:
            docs.append(Match(
                league_id=league_id, sport=league["sport"],
                player1_id=home["id"], player2_id=away["id"],
                player1_name=users.get(home["id"], {}).get("name", home["name"]),
                player2_name=users.get(away["id"], {}).get("name", away["name"]),
                scheduled_date=deadline.isoformat(), deadline=deadline.isoformat(),
                schedule_status="unscheduled", round=p["round"], notes=f"Round {p['round']}",
                team1_partner_id=home.get("partner_id"), team2_partner_id=away.get("partner_id"),
                team1_partner_name=users.get(home.get("partner_id"), {}).get("name") if is_doubles else None,
                team2_partner_name=users.get(away.get("partner_id"), {}).get("name") if is_doubles else None,
            ).to_mongo())
    if existing:
        await db.matches.delete_many({"league_id": league_id, "deadline": {"$ne": None}})
    if docs:
        await db.matches.insert_many(docs)
    await db.leagues.update_one(
        {"_id": league["_id"]},
        {"$set": {"status": "active", "activated_at": league.get("activated_at") or now.isoformat(),
                  "matches_per_player": rounds, "schedule_generation": generation,
                  "updated_at": now.isoformat()}},
    )
    await email_player_schedules(db, league, {m for u in units for m in u["members"]}, updated=bool(existing))
    return {"preview": False, "created": len(docs), **summary}


async def adjust_match(db, league: dict, match: dict, new_home_id: str, new_away_id: str) -> dict:
    """Swap Home/Away or change the opponents of one generated match before play starts.

    new_home_id / new_away_id are unit ids (the player, or the first-listed member of a team).
    """
    if match.get("deadline") is None:
        raise ValueError("Only generated season matches can be adjusted")
    if _has_activity(match):
        raise ScheduleLocked("This match has already been scheduled or played")
    if new_home_id == new_away_id:
        raise ValueError("A match needs two different players")

    units, users = await build_units(db, league)
    by_id = {u["id"]: u for u in units}
    if new_home_id not in by_id or new_away_id not in by_id:
        raise ValueError("Both players must be registered in this league")

    league_id = str(league["_id"])
    if not league.get("allow_rematches"):
        clash = await db.matches.find_one({
            "league_id": league_id, "deadline": {"$ne": None}, "_id": {"$ne": match["_id"]},
            "$or": [{"player1_id": new_home_id, "player2_id": new_away_id},
                    {"player1_id": new_away_id, "player2_id": new_home_id}],
        })
        if clash:
            raise ValueError("Those two already play each other in this league")

    home, away = by_id[new_home_id], by_id[new_away_id]
    is_doubles = league.get("format") in ("doubles", "mixed")
    old_members = set(_side(match, 1) + _side(match, 2))
    update = {
        "player1_id": home["id"], "player2_id": away["id"],
        "player1_name": users.get(home["id"], {}).get("name", home["name"]),
        "player2_name": users.get(away["id"], {}).get("name", away["name"]),
        "team1_partner_id": home.get("partner_id"), "team2_partner_id": away.get("partner_id"),
        "team1_partner_name": users.get(home.get("partner_id"), {}).get("name") if is_doubles else None,
        "team2_partner_name": users.get(away.get("partner_id"), {}).get("name") if is_doubles else None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.matches.update_one({"_id": match["_id"]}, {"$set": update})
    await email_player_schedules(db, league, old_members | set(home["members"]) | set(away["members"]), updated=True)
    return {"id": str(match["_id"]), "home": home["name"], "away": away["name"]}
