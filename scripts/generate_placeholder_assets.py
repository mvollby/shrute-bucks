"""
One-off script to generate clearly-placeholder PNG assets for the Phaser
prototype. These exist only so the prototype has something to load and
display before real AI-generated art is dropped in -- not an attempt at
final art. Run with: python3 scripts/generate_placeholder_assets.py
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BUILDINGS_DIR = ROOT / "public" / "assets" / "buildings"
TERRAIN_DIR = ROOT / "public" / "assets" / "terrain"


def font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", size)
    except OSError:
        return ImageFont.load_default()


def draw_building(name: str, wall_color, roof_color, size=96) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    wall_top = size * 0.42
    wall_bottom = size * 0.92
    wall_left = size * 0.12
    wall_right = size * 0.88

    # walls
    draw.rectangle([wall_left, wall_top, wall_right, wall_bottom], fill=wall_color, outline=(0, 0, 0, 255), width=2)

    # peaked roof
    roof_peak = (size / 2, size * 0.06)
    roof_left = (size * 0.06, wall_top)
    roof_right = (size * 0.94, wall_top)
    draw.polygon([roof_peak, roof_left, roof_right], fill=roof_color, outline=(0, 0, 0, 255))

    # door
    door_w, door_h = size * 0.14, size * 0.22
    door_x = size / 2 - door_w / 2
    door_y = wall_bottom - door_h
    draw.rectangle([door_x, door_y, door_x + door_w, wall_bottom], fill=(60, 40, 30, 255), outline=(0, 0, 0, 255))

    # two windows
    win_w, win_h = size * 0.12, size * 0.12
    win_y = wall_top + size * 0.1
    draw.rectangle(
        [wall_left + size * 0.08, win_y, wall_left + size * 0.08 + win_w, win_y + win_h],
        fill=(180, 220, 235, 255), outline=(0, 0, 0, 255),
    )
    draw.rectangle(
        [wall_right - size * 0.08 - win_w, win_y, wall_right - size * 0.08, win_y + win_h],
        fill=(180, 220, 235, 255), outline=(0, 0, 0, 255),
    )

    # label so it's unmistakably a placeholder, not intended final art
    label_font = font(11)
    text = name.upper()
    bbox = draw.textbbox((0, 0), text, font=label_font)
    text_w = bbox[2] - bbox[0]
    draw.text((size / 2 - text_w / 2, size * 0.94), text, fill=(0, 0, 0, 255), font=label_font)
    draw.text((2, 2), "PLACEHOLDER", fill=(200, 0, 0, 200), font=font(8))

    return img


def draw_ground_tile(size=64) -> Image.Image:
    img = Image.new("RGBA", (size, size), (90, 168, 105, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, size - 1, size - 1], outline=(70, 140, 85, 255), width=1)
    return img


def main():
    BUILDINGS_DIR.mkdir(parents=True, exist_ok=True)
    TERRAIN_DIR.mkdir(parents=True, exist_ok=True)

    draw_building("Cafe", wall_color=(214, 160, 110, 255), roof_color=(160, 90, 60, 255)).save(
        BUILDINGS_DIR / "cafe_level_1.png"
    )
    draw_building("House", wall_color=(230, 210, 180, 255), roof_color=(150, 60, 60, 255)).save(
        BUILDINGS_DIR / "house_level_1.png"
    )
    draw_building("Bank", wall_color=(210, 210, 200, 255), roof_color=(120, 120, 130, 255)).save(
        BUILDINGS_DIR / "bank_level_1.png"
    )
    draw_ground_tile().save(TERRAIN_DIR / "grass.png")

    print("Wrote placeholder assets to", BUILDINGS_DIR, "and", TERRAIN_DIR)


if __name__ == "__main__":
    main()
