"""Changing a player's name: validation, and updating the copies of the name stored on other records."""
import re

# (collection, field holding the player's id, field holding the copied name)
NAME_COPIES = [
    ("player_leagues", "player_id", "player_name"),
    ("player_leagues", "partner_id", "partner_name"),
    ("standings", "player_id", "player_name"),
    ("matches", "player1_id", "player1_name"),
    ("matches", "player2_id", "player2_name"),
    ("matches", "team1_partner_id", "team1_partner_name"),
    ("matches", "team2_partner_id", "team2_partner_name"),
    ("matches", "winner_id", "winner_name"),
    ("doubles_invites", "initiator_id", "initiator_name"),
]

MAX_PART = 50


def clean_name_part(value: str, label: str) -> str:
    """One trimmed name part, or ValueError(message)."""
    v = re.sub(r"\s+", " ", (value or "").strip())
    if not v:
        raise ValueError(f"Enter your {label}")
    if len(v) > MAX_PART:
        raise ValueError(f"{label.capitalize()} is too long")
    if re.search(r"[<>{}\[\]\\/@#$%^*=+|~`;:?!\d_]", v) or re.search(r"[\x00-\x1f]", v):
        raise ValueError(f"{label.capitalize()} can only contain letters, spaces, hyphens and apostrophes")
    return v


def full_name(first: str, last: str) -> str:
    return f"{first} {last}".strip()


async def propagate_name(db, user_id: str, name: str) -> None:
    """Update every stored copy of this player's name so standings, matches and teams show the new one."""
    for coll, id_field, name_field in NAME_COPIES:
        await getattr(db, coll).update_many({id_field: user_id}, {"$set": {name_field: name}})
