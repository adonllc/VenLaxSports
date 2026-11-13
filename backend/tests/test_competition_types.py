"""Every competition carries a type; records from before the field existed are classified from their old markers."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import competition as comp  # noqa: E402
import challenge_config as cfg  # noqa: E402
import direct_challenge as dc  # noqa: E402
from test_direct_challenge import Db, make, run  # noqa: E402


def test_legacy_records_are_classified_from_their_markers():
    assert comp.type_of_ladder({}) == comp.ADMIN_LADDER
    assert comp.type_of_ladder({"type": "community"}) == comp.PLAYER_COMMUNITY_LADDER
    assert comp.type_of_challenge({"source": "direct"}) == comp.DIRECT_CHALLENGE
    assert comp.type_of_challenge({"source": "ladder"}) == comp.PLAYER_COMMUNITY_LADDER
    assert comp.type_of_challenge({"source": "open_board"}) == comp.OPEN_CHALLENGE
    assert comp.type_of_challenge({}) == comp.DIRECT_CHALLENGE


def test_new_challenges_are_stamped_and_shown():
    db = Db()
    ch = make(db)
    assert ch["competition_type"] == comp.DIRECT_CHALLENGE
    assert dc.view(ch, db.ann)["competition_type"] == comp.DIRECT_CHALLENGE
    open_ch = run(dc.create_accepted(db, [db.ann], [db.bob], "tennis", "singles", {}))
    assert open_ch["competition_type"] == comp.OPEN_CHALLENGE


def test_sports_come_from_one_rules_table():
    assert set(cfg.CHALLENGE_SPORTS) == set(comp.SPORT_RULES)
    assert comp.ADMIN_LADDER in comp.ALL_TYPES and len(comp.ALL_TYPES) == 4
