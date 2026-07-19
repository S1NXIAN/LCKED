"""Generate LCKED extension icons (16/32/48/128 PNG).

Diamond shape (rotated square) with a keyhole cutout.
Mauve fill #cba6f7 on transparent background, with a subtle darker edge.
"""
from PIL import Image, ImageDraw
import math
import os

# Catppuccin Mocha Mauve
MAUVE = (203, 166, 247, 255)
# Slightly darker mauve for the edge (Mauve darkened ~25%)
EDGE = (137, 96, 176, 255)
# Keyhole color (base background, dark navy for visibility on light pages)
KEYHOLE = (30, 30, 46, 255)

OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def draw_diamond(draw, cx, cy, half, fill, edge):
    """Draw a diamond (rotated square) as a polygon."""
    pts = [(cx, cy - half), (cx + half, cy), (cx, cy + half), (cx - half, cy)]
    # Outer edge (slightly bigger) by drawing two polygons
    edge_pts = [(cx, cy - half - 1), (cx + half + 1, cy), (cx, cy + half + 1), (cx - half - 1, cy)]
    draw.polygon(edge_pts, fill=edge)
    draw.polygon(pts, fill=fill)


def draw_keyhole(draw, cx, cy, size):
    """Draw a keyhole: circle on top, narrowing rectangle below."""
    # Scale keyhole relative to icon size
    r = max(1, int(size * 0.12))
    # Circle (top of keyhole)
    draw.ellipse(
        [cx - r, cy - r - int(size * 0.06), cx + r, cy + r - int(size * 0.06)],
        fill=KEYHOLE,
    )
    # Tapered slot below (trapezoid that narrows downward)
    top_w = max(1, int(size * 0.07))
    bot_w = max(1, int(size * 0.025))
    top_y = cy + int(size * 0.04)
    bot_y = cy + int(size * 0.22)
    slot_pts = [
        (cx - top_w, top_y),
        (cx + top_w, top_y),
        (cx + bot_w, bot_y),
        (cx - bot_w, bot_y),
    ]
    draw.polygon(slot_pts, fill=KEYHOLE)


def make_icon(size: int) -> Image.Image:
    # Use supersampling for crisp edges on small sizes
    scale = 4
    big = size * scale
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx = big // 2
    cy = big // 2
    # Diamond half-extent: leave ~15% padding
    half = int(big * 0.40)

    draw_diamond(draw, cx, cy, half, MAUVE, EDGE)
    draw_keyhole(draw, cx, cy, big)

    # Downsample with LANCZOS for smooth edges
    return img.resize((size, size), Image.LANCZOS)


def main():
    for size in (16, 32, 48, 128):
        img = make_icon(size)
        out = os.path.join(OUT_DIR, f"icon-{size}.png")
        img.save(out, "PNG")
        print(f"Wrote {out} ({img.size})")


if __name__ == "__main__":
    main()
