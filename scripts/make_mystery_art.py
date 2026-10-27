#!/usr/bin/env python3
"""Build the Diljit Dosanjh Mystery tee: print art + three gallery images.

The Mystery listing is the one Diljit product that stays buyable while the
other 26 sit at zero stock, so its imagery has to carry the collection on its
own. Three images:

  01-cover.png        flat-lay black tee with the "?" lockup
  02-model.png        the same print on the model plate
  03-what-you-get.png a 4x3 montage of the designs the shopper might receive

The print is a typographic lockup rather than one of the designer artboards:
a didone "?" over a letterspaced DILJIT DOSANJH wordmark. Everything is drawn
deterministically at 2400x3000 and composited with the same homography +
fabric shading the other listings use, so it sits on the plate exactly like a
designer print does.

Ink is #FEFEF3, measured off the published Punjabi Aa Gaye Oye composites (the
brightest 0.1% of pixels) rather than guessed, so the cream matches the rest of
the collection under the same INK_SHADE_MIN fold shading.

Usage:
    python3 make_mystery_art.py            # write art + composites
    python3 make_mystery_art.py --preview  # also write JPEG previews
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent
sys.path.insert(0, str(SCRIPTS_DIR))

from composite_diljit_art import composite  # noqa: E402
from diljit_listing_registry import BLANK_BLACK_PLATES  # noqa: E402

HANDLE = "diljit-dosanjh-mystery-random-design-oversized-t-shirt"
OUT_DIR = ROOT / "agnes-out" / "diljit-listings" / HANDLE
ART_PATH = OUT_DIR / "mystery-print.png"

CANVAS = (2400, 3000)
INK = (254, 254, 243)  # #FEFEF3, measured off the published composites
PAPER = (12, 12, 12)
MUTED = (190, 186, 170)

BODONI = "/System/Library/Fonts/Supplemental/Bodoni 72.ttc"
FUTURA = "/System/Library/Fonts/Supplemental/Futura.ttc"

FONT_QMARK = (BODONI, 2)  # Bodoni 72 Bold
FONT_NAME = (FUTURA, 0)  # Futura Medium
FONT_KICKER = (FUTURA, 3)  # Futura Condensed Medium

HEADLINE = "DILJIT DOSANJH"
KICKER = "MYSTERY DESIGN"

MONTAGE_TITLE = "ONE RANDOM DESIGN"
MONTAGE_SUB = [
    "Every order receives a single Diljit Dosanjh tee,",
    "chosen at random from the collection.",
]


def _font(spec: tuple[str, int], size: int) -> ImageFont.FreeTypeFont:
    path, index = spec
    return ImageFont.truetype(path, size, index=index)


def _fit(spec: tuple[str, int], text: str, target_h: int) -> ImageFont.FreeTypeFont:
    """Search for the size whose glyph box is at most `target_h` tall."""
    low, high = 10, 3000
    best = _font(spec, low)
    while low <= high:
        mid = (low + high) // 2
        font = _font(spec, mid)
        box = font.getbbox(text)
        if box[3] - box[1] <= target_h:
            best, low = font, mid + 1
        else:
            high = mid - 1
    return best


def _tracked_width(draw: ImageDraw.ImageDraw, text: str,
                   font: ImageFont.FreeTypeFont, tracking: float) -> float:
    if not text:
        return 0.0
    return sum(draw.textlength(c, font=font) for c in text) + tracking * (len(text) - 1)


def _tracked(draw: ImageDraw.ImageDraw, xy: tuple[float, float], text: str,
             font: ImageFont.FreeTypeFont, tracking: float, fill) -> None:
    """Draw `text` with extra letter spacing."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking


def build_art() -> Path:
    """Draw the print on a transparent artboard, trimmed to the ink."""
    width, _ = CANVAS
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    qmark = _fit(FONT_QMARK, "?", 1250)
    qbox = draw.textbbox((0, 0), "?", font=qmark)
    qw, qh = qbox[2] - qbox[0], qbox[3] - qbox[1]
    qy = 150 - qbox[1]
    draw.text(((width - qw) / 2 - qbox[0], qy), "?", font=qmark, fill=INK)

    name = _fit(FONT_NAME, HEADLINE, 150)
    name_tracking = 26.0
    name_w = _tracked_width(draw, HEADLINE, name, name_tracking)
    name_y = qy + qbox[1] + qh + 150
    _tracked(draw, ((width - name_w) / 2, name_y), HEADLINE, name, name_tracking, INK)

    rule_y = name_y + 190
    rule_w = name_w * 0.62
    draw.rectangle(
        [(width - rule_w) / 2, rule_y, (width + rule_w) / 2, rule_y + 6],
        fill=INK,
    )

    kicker = _fit(FONT_KICKER, KICKER, 62)
    kicker_tracking = 30.0
    kicker_w = _tracked_width(draw, KICKER, kicker, kicker_tracking)
    _tracked(
        draw,
        ((width - kicker_w) / 2, rule_y + 110),
        KICKER,
        kicker,
        kicker_tracking,
        INK,
    )

    bbox = canvas.getbbox()
    if bbox is None:
        raise RuntimeError("mystery art rendered empty")
    art = canvas.crop(bbox)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    art.save(ART_PATH)
    print(f"  art   {ART_PATH.relative_to(ROOT)}  {art.size[0]}x{art.size[1]} px")
    return ART_PATH


def _cover_sources(limit: int) -> list[Path]:
    """Published Diljit tee covers to show in the montage."""
    root = ROOT / "agnes-out" / "diljit-listings"
    found = []
    for path in sorted(root.glob("*/01-cover.png")):
        name = path.parent.name
        if name in (HANDLE, "diljit-dosanjh-punjabi-aa-gaye-oye-text-tee"):
            continue
        if "hoodie" in name:
            continue
        found.append(path)
    # Spread across the collection instead of taking the first N alphabetically.
    if len(found) > limit:
        step = len(found) / limit
        found = [found[int(i * step)] for i in range(limit)]
    return found[:limit]


def build_montage(columns: int = 4, rows: int = 3) -> Path:
    """'What you get' card: a grid of the designs a shopper might receive."""
    width, height = CANVAS
    margin = 110
    header = 430
    footer = 300
    gap = 34

    canvas = Image.new("RGB", CANVAS, PAPER)
    draw = ImageDraw.Draw(canvas)

    title = _fit(FONT_NAME, MONTAGE_TITLE, 96)
    tw = _tracked_width(draw, MONTAGE_TITLE, title, 22.0)
    _tracked(draw, ((width - tw) / 2, margin), MONTAGE_TITLE, title, 22.0, INK)

    sub = _font(FONT_NAME, 46)
    for i, line in enumerate(MONTAGE_SUB):
        lw = draw.textlength(line, font=sub)
        draw.text(((width - lw) / 2, margin + 150 + i * 62), line, font=sub, fill=MUTED)

    sources = _cover_sources(columns * rows)
    if not sources:
        raise RuntimeError("no Diljit covers found for the montage")

    grid_w = width - margin * 2
    grid_h = height - header - footer
    tile_w = (grid_w - gap * (columns - 1)) // columns
    tile_h = (grid_h - gap * (rows - 1)) // rows

    for i, src in enumerate(sources):
        r, c = divmod(i, columns)
        x = margin + c * (tile_w + gap)
        y = header + r * (tile_h + gap)
        tile = Image.open(src).convert("RGB")
        scale = max(tile_w / tile.width, tile_h / tile.height)
        resized = tile.resize(
            (max(1, int(tile.width * scale)), max(1, int(tile.height * scale))),
            Image.LANCZOS,
        )
        left = (resized.width - tile_w) // 2
        top = int((resized.height - tile_h) * 0.30)
        canvas.paste(resized.crop((left, top, left + tile_w, top + tile_h)), (x, y))

    out = OUT_DIR / "03-what-you-get.png"
    canvas.save(out)
    print(f"  card  {out.relative_to(ROOT)}  {len(sources)} designs")
    return out


def build_composites(art_path: Path) -> list[Path]:
    """Place the art on the blank black tee plates."""
    record = {
        "plate_paths": BLANK_BLACK_PLATES,
        "art_path": art_path,
        "garment": "tee-black",
    }
    written = []
    for plate, name in (("flat-front", "01-cover.png"), ("model-front", "02-model.png")):
        out = OUT_DIR / name
        composite(record, plate, out, preview=False)
        written.append(out)
        print(f"  photo {out.relative_to(ROOT)}  ({plate})")
    return written


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true", help="also write JPEG previews")
    args = parser.parse_args()

    print(f"Building {HANDLE}")
    art = build_art()
    build_composites(art)
    build_montage()

    if args.preview:
        for png in sorted(OUT_DIR.glob("*.png")):
            png.with_suffix(".jpg").unlink(missing_ok=True)
            Image.open(png).convert("RGB").save(png.with_suffix(".jpg"), quality=88)
        print(f"  previews in {OUT_DIR.relative_to(ROOT)}/*.jpg")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
