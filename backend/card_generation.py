"""Card generation for Match→Story feature."""
from PIL import Image, ImageDraw, ImageFont
from datetime import datetime
import io
import os


SPORT_COLORS = {
    "tennis": "#10B981",      # emerald
    "pickleball": "#F97316",  # orange
    "cricket": "#2563EB",     # blue
}

SPORT_NAMES = {
    "tennis": "Ranked Tennis",
    "pickleball": "Ranked Pickleball",
    "cricket": "Ranked Cricket",
}


def hex_to_rgb(hex_color: str) -> tuple:
    """Convert hex color to RGB tuple."""
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))


def generate_match_card(
    winner_name: str,
    opponent_name: str,
    score: str,
    rating_delta: float,
    sport: str,
    timestamp: datetime,
) -> Image.Image:
    """Generate a 1080x1350px match card image.

    Args:
        winner_name: Winner's name (e.g., "Alex Chen")
        opponent_name: Opponent's name (e.g., "Jordan Smith")
        score: Match score (e.g., "6-4, 4-6, 6-4")
        rating_delta: Rating increase (e.g., 47)
        sport: Sport type (tennis, pickleball, cricket)
        timestamp: Match completion time

    Returns:
        PIL Image object (1080x1350px)
    """
    width, height = 1080, 1350
    sport_color = hex_to_rgb(SPORT_COLORS.get(sport, "#10B981"))

    img = Image.new("RGB", (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Sport icon / color bar (top)
    draw.rectangle([(0, 0), (width, 80)], fill=sport_color)

    # Sport label (top-left, white text)
    sport_label = SPORT_NAMES.get(sport, "Ranked Sport")
    try:
        font_small = ImageFont.truetype("arial.ttf", 28)
        font_large = ImageFont.truetype("arial.ttf", 56)
        font_xl = ImageFont.truetype("arial.ttf", 72)
        font_md = ImageFont.truetype("arial.ttf", 40)
    except IOError:
        # Fallback to default font
        font_small = ImageFont.load_default()
        font_large = ImageFont.load_default()
        font_xl = ImageFont.load_default()
        font_md = ImageFont.load_default()

    draw.text((40, 20), sport_label, fill=(255, 255, 255), font=font_small)

    # Winner name (large, bold-feeling, centered)
    y_pos = 180
    draw.text(
        (width // 2, y_pos),
        winner_name,
        fill=(31, 41, 55),  # dark gray (#1F2937)
        font=font_xl,
        anchor="mm",
    )

    # "vs" opponent (smaller, gray)
    y_pos += 120
    draw.text(
        (width // 2, y_pos),
        f"vs {opponent_name}",
        fill=(75, 85, 99),  # medium gray (#4B5563)
        font=font_md,
        anchor="mm",
    )

    # Score (very large, sport color)
    y_pos += 140
    draw.text(
        (width // 2, y_pos),
        score,
        fill=sport_color,
        font=font_xl,
        anchor="mm",
    )

    # Rating delta (e.g., "+47", sport color, medium size)
    y_pos += 140
    delta_text = f"+{int(rating_delta)}"
    draw.text(
        (width // 2, y_pos),
        delta_text,
        fill=sport_color,
        font=font_md,
        anchor="mm",
    )

    # Timestamp (small, gray, bottom area)
    y_pos = height - 200
    timestamp_str = timestamp.strftime("%b %d, %I:%M %p")
    draw.text(
        (40, y_pos),
        timestamp_str,
        fill=(107, 114, 128),  # light gray (#6B7280)
        font=font_small,
    )

    # VENLAX watermark (bottom)
    y_pos = height - 80
    draw.text(
        (width // 2, y_pos),
        "VENLAX Sports",
        fill=(31, 41, 55),  # dark gray
        font=font_small,
        anchor="mm",
    )

    # "Join VENLAX" link (small, sport color, bottom)
    y_pos = height - 40
    draw.text(
        (width // 2, y_pos),
        "Join VENLAX →",
        fill=sport_color,
        font=font_small,
        anchor="mm",
    )

    return img


def save_card_image(img: Image.Image, output_path: str) -> str:
    """Save card image to disk and return path.

    Args:
        img: PIL Image object
        output_path: File path to save (e.g., "/path/to/cards/abc123.png")

    Returns:
        Path to saved image
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, format="PNG", quality=95)
    return output_path


def card_image_to_bytes(img: Image.Image) -> bytes:
    """Convert PIL Image to PNG bytes."""
    buffer = io.BytesIO()
    img.save(buffer, format="PNG", quality=95)
    return buffer.getvalue()
