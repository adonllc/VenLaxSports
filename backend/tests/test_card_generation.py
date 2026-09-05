"""Test card generation module."""
import pytest
from datetime import datetime, timezone
from card_generation import generate_match_card, card_image_to_bytes


class TestCardGeneration:
    def test_generate_match_card_returns_image(self):
        """Card generation returns PIL Image object."""
        img = generate_match_card(
            winner_name="Alice",
            opponent_name="Bob",
            score="6-4, 4-6, 6-4",
            rating_delta=47.5,
            sport="tennis",
            timestamp=datetime.now(timezone.utc),
        )
        assert img is not None
        assert img.size == (1080, 1350)
        assert img.format == "PNG" or img.format is None  # PIL doesn't set format until saved

    def test_generate_match_card_pickleball(self):
        """Card generation works for pickleball."""
        img = generate_match_card(
            winner_name="Alex",
            opponent_name="Jordan",
            score="11-8, 11-9",
            rating_delta=32,
            sport="pickleball",
            timestamp=datetime.now(timezone.utc),
        )
        assert img.size == (1080, 1350)

    def test_generate_match_card_cricket(self):
        """Card generation works for cricket."""
        img = generate_match_card(
            winner_name="Player1",
            opponent_name="Player2",
            score="150/8 vs 140/10",
            rating_delta=20,
            sport="cricket",
            timestamp=datetime.now(timezone.utc),
        )
        assert img.size == (1080, 1350)

    def test_card_image_to_bytes_returns_png(self):
        """Card image converts to PNG bytes."""
        img = generate_match_card(
            winner_name="Test",
            opponent_name="User",
            score="6-0",
            rating_delta=10,
            sport="tennis",
            timestamp=datetime.now(timezone.utc),
        )
        png_bytes = card_image_to_bytes(img)
        assert isinstance(png_bytes, bytes)
        assert len(png_bytes) > 0
        # PNG header: 0x89 'P' 'N' 'G'
        assert png_bytes[:4] == b'\x89PNG'
