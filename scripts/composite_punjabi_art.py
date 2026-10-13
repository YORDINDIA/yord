#!/usr/bin/env python3
"""Composite the exact Punjabi Aa Gaye Oye artwork onto the blank tee plates.

The art in the output is the designer's file, pixel for pixel: this script only
scales and perspective-warps it onto the garment and shades it with the fabric
underneath. Agnes never draws the lettering (it garbles Gurmukhi).

The listing is ONE tee: TextOnly on the front, Map on the back (owner direction
2026-10-05, replacing the two single-design listings). Four gallery slots:

    01-front-flat   TextOnly on the plain front flat plate
    02-back-flat    Map on the plain back flat plate
    03-model-front  TextOnly on the street front plate (arm below the print)
    04-model-back   Map on the street back plate

Placement comes from the designer's own mockups, measured colourimetrically
(cream ink RGB ~ (251,245,203) against the black tee):

    text design   5.4% of shirt height tall, vertical centre 30.3% below the collar
    map design    62.7% of shirt height tall, vertical centre 51.0% below the collar

Flat plates get an automatic quad (shirt silhouette from a dark-pixel mask);
model plates use the manual quads in MODEL_QUADS, read off a 100 px grid overlay
(the model-front quads were verified against the arm position: the print box is
100% dark fabric).

Usage:
    python composite_punjabi_art.py            # composite + contact sheet
    python composite_punjabi_art.py --preview  # same, but write preview JPEGs only
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent
PLATES_DIR = ROOT / "agnes-out" / "punjabi-tees"
OUT_DIR = PLATES_DIR / "final"

DATA = ROOT / "data" / "Punjabi_Aa_Gaye_Oye_Gurmukhi_Designs"
ART = {
    "text": DATA / "TextOnly_Punjabi_Aa_Gaye_Oye_Gurmukhi"
    / "TextOnly_Punjabi_Aa_Gaye_Oye_Gurmukhi_Cream_8000px.png",
    "map": DATA / "Map_Punjabi_Aa_Gaye_Oye_Gurmukhi"
    / "Map_Punjabi_Aa_Gaye_Oye_Gurmukhi_Cream_8000px.png",
}

# Source plate handles: the blank plates were generated per design before the
# merge, and they are still the right plates -- only the destinations changed.
PLATE_HANDLES = {
    "text": "diljit-dosanjh-punjabi-aa-gaye-oye-text-tee",
    "map": "diljit-dosanjh-punjabi-aa-gaye-oye-map-tee",
}

# The merged listing every composited plate is written for.
HANDLE = "diljit-dosanjh-punjabi-aa-gaye-oye-oversized-t-shirt"

# (design, source plate, output slot) in gallery order.
JOBS = [
    ("text", "flat-front", "01-front-flat"),
    ("map", "flat-back", "02-back-flat"),
    ("text", "model-front", "03-model-front"),
    ("map", "model-back", "04-model-back"),
]

# Measured from the designer mockups (fraction of shirt height, collar -> hem).
PLACEMENT = {
    "text": {"center_y": 0.303, "height": 0.054},
    "map": {"center_y": 0.510, "height": 0.627},
}

# Manual quads on the model plates: (TL, TR, BR, BL) in plate pixels.
# The model-front chest is clear above the crossed forearm (y >= ~580 on the
# text plate); the print box was verified 100% dark fabric before being fixed.
MODEL_QUADS = {
    ("text", "model-front"): [(574, 464), (1046, 464), (1052, 526), (568, 526)],
    ("map", "model-back"): [(520, 858), (1245, 858), (1185, 1730), (545, 1730)],
}

MAX_PRINT_WIDTH_FRAC = 0.90  # of the torso width at the hem
INK_SHADE_MIN = 0.94         # ink brightness multiplier in the darkest fold


def ink_bbox(path: Path) -> tuple[int, int, int, int]:
    image = Image.open(path)
    alpha = np.asarray(image)[:, :, 3]
    ys, xs = np.where(alpha > 20)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def silhouette(plate: np.ndarray) -> np.ndarray:
    """Dark-pixel mask of the black tee on the studio plate."""
    gray = plate[:, :, 0] * 0.299 + plate[:, :, 1] * 0.587 + plate[:, :, 2] * 0.114
    return gray < 70


def torso_width(mask: np.ndarray, y: int) -> tuple[int, int]:
    """(xmin, xmax) of the shirt silhouette on one row."""
    row = np.where(mask[y])[0]
    if len(row) == 0:
        return 0, mask.shape[1] - 1
    return int(row.min()), int(row.max())


def auto_quad(plate: np.ndarray, spec: dict, aspect: float) -> list[tuple[int, int]]:
    """Quad for a studio flat-lay plate from its silhouette + measured ratios."""
    mask = silhouette(plate)
    ys = np.where(mask.any(axis=1))[0]
    top, hem = int(ys.min()), int(ys.max())
    shirt_h = hem - top
    height = spec["height"] * shirt_h
    width = height * aspect

    # The hem-level span is the torso (sleeves have ended); keep the print inside
    # it so it cannot spill onto the sleeves at upper-back height.
    hem_span = torso_width(mask, int(hem - 0.06 * shirt_h))
    torso_w = hem_span[1] - hem_span[0]
    if width > MAX_PRINT_WIDTH_FRAC * torso_w:
        width = MAX_PRINT_WIDTH_FRAC * torso_w
        height = width / aspect

    center_y = top + spec["center_y"] * shirt_h
    y_t, y_b = int(center_y - height / 2), int(center_y + height / 2)

    def centre_at(y: int) -> float:
        a, b = torso_width(mask, y)
        return (a + b) / 2

    cx_t, cx_b = centre_at(y_t), centre_at(y_b)
    # Tiny taper (top edge a hair narrower) reads as fabric curvature.
    w_t, w_b = width * 0.985, width
    return [
        (int(cx_t - w_t / 2), y_t),
        (int(cx_t + w_t / 2), y_t),
        (int(cx_b + w_b / 2), y_b),
        (int(cx_b - w_b / 2), y_b),
    ]


def homography(src: list[tuple[float, float]], dst: list[tuple[float, float]]) -> np.ndarray:
    """3x3 matrix mapping src points onto dst points (unit h33)."""
    a = []
    for (x, y), (u, v) in zip(src, dst):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.asarray(a, dtype=float))
    h = vt[-1].reshape(3, 3)
    return h / h[2, 2]


def warp_art(art: Image.Image, box: tuple[int, int, int, int], quad, out_size) -> np.ndarray:
    """Perspective-warp the art's ink bbox onto `quad`; returns float RGBA."""
    art_arr = np.asarray(art).astype(np.float32)
    x0, y0, x1, y1 = box
    src = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    h = homography(src, quad)
    h_inv = np.linalg.inv(h)

    w, hgt = out_size
    xs = np.arange(w, dtype=np.float32)
    ys = np.arange(hgt, dtype=np.float32)
    grid_x, grid_y = np.meshgrid(xs, ys)
    denom = h_inv[2, 0] * grid_x + h_inv[2, 1] * grid_y + h_inv[2, 2]
    u = (h_inv[0, 0] * grid_x + h_inv[0, 1] * grid_y + h_inv[0, 2]) / denom
    v = (h_inv[1, 0] * grid_x + h_inv[1, 1] * grid_y + h_inv[1, 2]) / denom

    u0 = np.floor(u).astype(np.int64)
    v0 = np.floor(v).astype(np.int64)
    du = (u - u0)[..., None]
    dv = (v - v0)[..., None]
    ah, aw = art_arr.shape[:2]
    uc = np.clip(u0, 0, aw - 1)
    vc = np.clip(v0, 0, ah - 1)
    uc1 = np.clip(u0 + 1, 0, aw - 1)
    vc1 = np.clip(v0 + 1, 0, ah - 1)
    p00 = art_arr[vc, uc]
    p10 = art_arr[vc, uc1]
    p01 = art_arr[vc1, uc]
    p11 = art_arr[vc1, uc1]
    top = p00 * (1 - du) + p10 * du
    bottom = p01 * (1 - du) + p11 * du
    sampled = top * (1 - dv) + bottom * dv

    inside = (u >= 0) & (u < aw - 1) & (v >= 0) & (v < ah - 1)
    sampled[..., 3] *= inside
    return sampled


def composite(design: str, plate_name: str, slot: str, preview: bool) -> Path:
    plate_path = PLATES_DIR / f"{PLATE_HANDLES[design]}__{plate_name}.png"
    plate = Image.open(plate_path).convert("RGB")
    art = Image.open(ART[design]).convert("RGBA")
    box = ink_bbox(ART[design])
    aspect = (box[2] - box[0]) / (box[3] - box[1])

    quad = MODEL_QUADS.get((design, plate_name))
    if quad is None:
        quad = auto_quad(np.asarray(plate).astype(np.float32), PLACEMENT[design], aspect)

    xs = [p[0] for p in quad]
    ys = [p[1] for p in quad]
    pad = 4
    region = (min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad)
    local_quad = [(x - region[0], y - region[1]) for x, y in quad]
    rw, rh = region[2] - region[0], region[3] - region[1]

    warped = warp_art(art, box, local_quad, (rw, rh))

    base = np.asarray(plate).astype(np.float32)
    dest = base[region[1]:region[3], region[0]:region[2], :].copy()
    gray = (dest[:, :, 0] * 0.299 + dest[:, :, 1] * 0.587 + dest[:, :, 2] * 0.114) / 255.0

    alpha = (warped[:, :, 3:4] / 255.0) * 0.97
    ink = warped[:, :, :3] * (INK_SHADE_MIN + (1 - INK_SHADE_MIN) * gray[:, :, None])
    dest = dest * (1 - alpha) + ink * alpha
    base[region[1]:region[3], region[0]:region[2], :] = dest

    out = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    suffix = ".jpg" if preview else ".png"
    path = OUT_DIR / f"{HANDLE}__{slot}{suffix}"
    if preview:
        out.save(path, quality=90)
    else:
        out.save(path)
    print(f"{HANDLE}__{slot} ({design} on {plate_name}): quad={quad} -> {path}")
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true", help="write preview JPEGs")
    args = parser.parse_args()

    paths = [composite(design, plate, slot, args.preview) for design, plate, slot in JOBS]

    tiles = []
    for path in paths:
        im = Image.open(path).convert("RGB")
        th = im.resize((420, int(im.height * 420 / im.width)), Image.LANCZOS)
        tiles.append((path.stem, th))
    th_h = max(t.height for _, t in tiles)
    sheet = Image.new("RGB", (420 * 2 + 12, (th_h + 26) * 2 + 12), (25, 25, 25))
    draw = ImageDraw.Draw(sheet)
    for i, (name, t) in enumerate(tiles):
        x = 4 + (i % 2) * 424
        y = 4 + (i // 2) * (th_h + 26)
        sheet.paste(t, (x, y))
        draw.text((x + 4, y + t.height + 4), name.replace("diljit-dosanjh-punjabi-aa-gaye-oye-", ""), fill=(240, 240, 240))
    sheet.save("/tmp/punjabi_preview/composite_sheet.png")
    print("contact sheet: /tmp/punjabi_preview/composite_sheet.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
