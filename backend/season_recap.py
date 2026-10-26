"""Season recap cards and badges for a finished league.

Every number comes from the league's own records (standings, matches, rating history). A badge is only
given when its rule is met; nobody gets a badge for taking part. A card that fails to draw is logged and
skipped so one bad record never stops the rest of the batch.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

CARD_DIR = os.environ.get("RECAP_CARD_DIR", os.path.join("cards", "recaps"))

# brand colors (DESIGN.md)
GREEN, AMBER, INK, BODY, GREY = (0, 143, 112), (242, 169, 34), (61, 61, 61), (92, 92, 92), (241, 241, 241)

BADGES = {
    "league_leader": ("League leader", "Finished first in the standings"),
    "undefeated": ("Undefeated", "Won every match, at least 3 played"),
    "finisher": ("Finisher", "Played every match scheduled"),
    "rating_climber": ("Rating climber", "Biggest rating gain in the league"),
}


def compute_recaps(league: dict, standings: list[dict], matches: list[dict], history: list[dict]) -> list[dict]:
    """One dict per player in the standings: rank, record, rating change and earned badges."""
    def key(s):
        set_diff = s.get("sets_won", 0) - s.get("sets_lost", 0)
        game_diff = s.get("games_won", 0) - s.get("games_lost", 0)
        return (-round(s.get("points", 0), 4), -set_diff, -game_diff, -s.get("wins", 0))

    ordered = sorted(standings, key=key)
    delta_by_player: dict[str, float] = {}
    for h in history:
        if h.get("league_id") == league["id"]:
            delta_by_player[h["user_id"]] = delta_by_player.get(h["user_id"], 0.0) + float(h.get("delta", 0))

    out = []
    for rank, s in enumerate(ordered, start=1):
        pid = s["player_id"]
        mine = [m for m in matches if pid in (m.get("player1_id"), m.get("player2_id")) and m.get("status") != "cancelled"]
        completed = [m for m in mine if m.get("status") == "completed"]
        out.append({
            "player_id": pid, "player_name": s.get("player_name", ""), "rank": rank, "players": len(ordered),
            "wins": s.get("wins", 0), "losses": s.get("losses", 0), "played": s.get("matches_played", 0),
            "scheduled": len(mine), "completed": len(completed),
            "rating_delta": round(delta_by_player[pid], 3) if pid in delta_by_player else None,
        })

    best = max((r["rating_delta"] for r in out if r["rating_delta"] is not None), default=None)
    for r in out:
        badges = []
        if r["rank"] == 1 and r["played"] >= 1:
            badges.append("league_leader")
        if r["played"] >= 3 and r["losses"] == 0 and r["wins"] == r["played"]:
            badges.append("undefeated")
        if r["scheduled"] >= 1 and r["completed"] == r["scheduled"]:
            badges.append("finisher")
        if best is not None and best > 0 and r["rating_delta"] == best:
            badges.append("rating_climber")
        r["badges"] = badges
    return out


def _font(size: int, bold: bool = False):
    names = ("arialbd.ttf", "DejaVuSans-Bold.ttf") if bold else ("arial.ttf", "DejaVuSans.ttf")
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


def _fit(draw, text, max_width, start, bold=True):
    size = start
    while size > 24 and draw.textlength(text, font=_font(size, bold)) > max_width:
        size -= 4
    return _font(size, bold)


def generate_recap_card(recap: dict, league_name: str, sport: str) -> Image.Image:
    """A 1080x1350 recap card in the VENLAX colors."""
    w, h = 1080, 1350
    img = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(img)

    d.rectangle([(0, 0), (w, 120)], fill=GREEN)
    d.text((60, 60), "VENLAX SPORTS", fill=(255, 255, 255), font=_font(40, True), anchor="lm")
    d.text((w - 60, 60), ("Ranked " + sport.title()) if sport else "Season recap", fill=(255, 255, 255), font=_font(30), anchor="rm")

    d.text((60, 200), "SEASON RECAP", fill=GREEN, font=_font(30, True), anchor="lm")
    d.text((60, 250), league_name, fill=BODY, font=_fit(d, league_name, w - 120, 38, False), anchor="lm")
    d.text((60, 370), recap["player_name"], fill=INK, font=_fit(d, recap["player_name"], w - 120, 96), anchor="lm")
    d.rectangle([(60, 440), (260, 452)], fill=AMBER)

    stats = [("RANK", f"#{recap['rank']} of {recap['players']}"), ("RECORD", f"{recap['wins']}-{recap['losses']}")]
    if recap.get("rating_delta") is not None:
        stats.append(("RATING", f"{recap['rating_delta']:+.2f}"))
    col_w = (w - 120) // len(stats)
    for i, (label, value) in enumerate(stats):
        x = 60 + i * col_w
        d.text((x, 530), label, fill=BODY, font=_font(28, True), anchor="lm")
        d.text((x, 600), value, fill=INK, font=_fit(d, value, col_w - 20, 72), anchor="lm")

    y = 700
    if recap["badges"]:
        d.text((60, y), "BADGES", fill=GREEN, font=_font(28, True), anchor="lm")
        y += 54
        for key in recap["badges"][:4]:
            title, why = BADGES[key]
            d.rectangle([(60, y), (w - 60, y + 100)], fill=GREY)
            d.rectangle([(60, y), (76, y + 100)], fill=AMBER)
            d.text((110, y + 32), title, fill=INK, font=_font(40, True), anchor="lm")
            d.text((110, y + 73), why, fill=BODY, font=_font(26), anchor="lm")
            y += 114
    else:
        d.text((60, y + 20), "Thanks for playing the season.", fill=BODY, font=_font(36), anchor="lm")

    d.rectangle([(0, h - 110), (w, h)], fill=GREEN)
    d.text((60, h - 55), "venlaxsports.com", fill=(255, 255, 255), font=_font(36, True), anchor="lm")
    return img


def card_path(league_id: str, player_id: str) -> str:
    return os.path.join(CARD_DIR, league_id, f"{player_id}.png")


async def generate_for_league(db, league: dict, force: bool = False) -> dict:
    """Recap cards for every player of a finished league. Idempotent; a failed card is logged and skipped."""
    league_id = league["id"]
    standings = await db.standings.find({"league_id": league_id}).to_list(None)
    matches = await db.matches.find({"league_id": league_id, "is_playoff": {"$ne": True}}).to_list(None)
    history = await db.rating_history.find({"league_id": league_id}).to_list(None)
    created = skipped = failed = 0
    for r in compute_recaps(league, standings, matches, history):
        try:
            if not force and await db.season_recaps.find_one({"league_id": league_id, "player_id": r["player_id"]}):
                skipped += 1
                continue
            path = card_path(league_id, r["player_id"])
            os.makedirs(os.path.dirname(path), exist_ok=True)
            generate_recap_card(r, league.get("name", ""), league.get("sport", "")).save(path, format="PNG")
            doc = {**r, "league_id": league_id, "league_name": league.get("name", ""), "sport": league.get("sport", ""),
                   "image_path": path, "created_at": datetime.now(timezone.utc).isoformat()}
            await db.season_recaps.update_one({"league_id": league_id, "player_id": r["player_id"]}, {"$set": doc}, upsert=True)
            created += 1
        except Exception:  # noqa: BLE001
            logger.exception("season recap failed for player %s in league %s", r.get("player_id"), league_id)
            failed += 1
    return {"created": created, "skipped": skipped, "failed": failed}
