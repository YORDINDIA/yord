#!/usr/bin/env python3
"""Composite each Diljit artboard onto a blank tee plate.

The art in the output is the designer's file, pixel for pixel: this script only
scales and perspective-warps it onto the garment and shades it with the fabric
underneath. Nothing is redrawn.

Method is the one proved on the 2026-10-05 Punjabi tee job
(`composite_punjabi_art.py`), reused here so the two listing families share a
look: the art's ink bounding box is homography-warped onto a quad on the plate,
then multiplied by the plate's own luminance so folds and shadows read through
the print.

Placement is measured, not guessed. Both plates were read off a 100 px grid
overlay:

    flat-front   shirt rows 512..1792 (height 1280), torso 483..1243 at the hem
    model-front  collar ~y=170, chest band y=430..760 clear of the crossed arm

Usage:
    python composite_diljit_art.py            # all designs with art
    python composite_diljit_art.py --preview  # preview JPEGs + contact sheet
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))

from diljit_listing_registry import BLANK_BLACK_PLATES, build  # noqa: E402

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent
OUT_DIR = ROOT / "agnes-out" / "diljit-listings"

# Fractions of garment height, collar -> hem. The model value is a fraction of
# the chest band (MODEL_PRINT_TOP..MODEL_PRINT_BOTTOM) instead, so the print
# fills the clear fabric between the collar and the crossed forearm.
PLACEMENT = {
    "tee-black": {
        "flat-front": {"center_y": 0.42, "height": 0.50},
        "model-front": {"center_y": 0.50, "height": 0.82},
    },
    # The hoodie flat plate is a ghost-mannequin: the garment runs y=361..1946
    # and the torso is 1116 px wide where the print lands, so the tee's 0.42 /
    # 0.50 sits the print just under the hood, above the kangaroo pocket.
    "hoodie-black": {
        "flat-front": {"center_y": 0.40, "height": 0.46},
        # Pushed down and in a little from the tee's 0.50 / 0.82: the hood's V
        # and its cast shadow reach further down the chest than a crew collar,
        # and the reflective art is wider than tall so it fills the width fast.
        "model-front": {"center_y": 0.56, "height": 0.66},
    },
}

# The model plate's crossed forearm cuts in around y=725 and the collar ends
# near y=280, so the print lives in that band. Hard bounds, not hints.
MODEL_PRINT_BAND = {
    "tee-black": (288, 722),
    # Hoodie model plate: the hood's V ends near y=430 and the kangaroo pocket
    # seam starts near y=930 (read off a 5% grid overlay).
    "hoodie-black": (440, 925),
}

MAX_PRINT_WIDTH_FRAC = 0.86  # of the torso width at the print row
INK_SHADE_MIN = 0.90         # ink brightness multiplier in the darkest fold


def ink_bbox(path: Path) -> tuple[int, int, int, int]:
    """Tight ink box of the art, ignoring sparse keying noise.

    A flat `alpha > 20` box is wrong for the hoodie art: those are `.ai` renders
    that were keyed off a solid backdrop, and a few thousand anti-aliased edge
    pixels survive across the whole canvas. Those strays stretch the box to the
    full artboard, and because the box's aspect ratio drives the print size, the
    design then warps in much smaller than intended.

    So a row or column only counts as ink when a small share of it is opaque.
    The 12 artboards are clean transparent PNGs, so this changes nothing for
    them.
    """
    image = Image.open(path).convert("RGBA")
    alpha = np.asarray(image)[:, :, 3]
    height, width = alpha.shape
    solid = alpha > 128

    rows = solid.sum(axis=1)
    cols = solid.sum(axis=0)
    row_keep = rows >= max(2, int(0.004 * width))
    col_keep = cols >= max(2, int(0.004 * height))

    if not row_keep.any() or not col_keep.any():
        ys, xs = np.where(alpha > 20)
        if len(xs) == 0:
            raise ValueError(f"{path}: art is fully transparent")
        return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1

    ys = np.where(row_keep)[0]
    xs = np.where(col_keep)[0]
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def silhouette(plate: np.ndarray) -> np.ndarray:
    """Dark-pixel mask of the black tee on the studio plate."""
    gray = plate[:, :, 0] * 0.299 + plate[:, :, 1] * 0.587 + plate[:, :, 2] * 0.114
    return gray < 70


def torso_width(mask: np.ndarray, y: int) -> tuple[int, int]:
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

    # The hem-level span is the torso (the sleeves have ended by then), so
    # keeping the print inside it stops a wide design spilling onto a sleeve.
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
    w_t, w_b = width * 0.985, width
    return [
        (int(cx_t - w_t / 2), y_t),
        (int(cx_t + w_t / 2), y_t),
        (int(cx_b + w_b / 2), y_b),
        (int(cx_b - w_b / 2), y_b),
    ]


def model_quad(plate: np.ndarray, spec: dict, aspect: float, band: tuple[int, int]) -> list[tuple[int, int]]:
    """Quad for the model plate, fitted inside the clear chest fabric.

    The model plate is a photograph, so `auto_quad`'s whole-image silhouette
    would be the model, not the garment. Two things are measured instead:

    * **Torso edges** from the *largest contiguous dark run* on each row of the
      chest band. Taking the union of dark pixels instead would include the
      hanging arm (x down to ~345) and let the print spill onto it.
    * **Vertical room** from `band`: the tee's collar ends near y=280 and its
      crossed forearm cuts in near y=725; the hoodie's hood ends near y=440 and
      its kangaroo pocket seam starts near y=925.

    The print is scaled to *fit* that box, never clipped -- a design taller than
    the box shrinks rather than losing its top.
    """
    print_top, print_bottom = band
    mask = silhouette(plate)
    lefts, rights = [], []
    for y in range(print_top, print_bottom, 8):
        row = mask[y]
        runs, start = [], None
        for x in range(plate.shape[1]):
            if row[x] and start is None:
                start = x
            elif not row[x] and start is not None:
                runs.append((start, x - 1))
                start = None
        if start is not None:
            runs.append((start, plate.shape[1] - 1))
        runs = [r for r in runs if r[1] - r[0] > 60]
        if not runs:
            continue
        widest = max(runs, key=lambda r: r[1] - r[0])
        lefts.append(widest[0])
        rights.append(widest[1])

    if not lefts:
        raise ValueError("model plate: no garment found in the chest band")

    torso_l = int(np.median(lefts))
    torso_r = int(np.median(rights))
    torso_w = torso_r - torso_l
    cx = (torso_l + torso_r) / 2

    band_h = print_bottom - print_top
    height = spec["height"] * band_h
    width = height * aspect

    max_w = MAX_PRINT_WIDTH_FRAC * torso_w
    if width > max_w:
        width = max_w
        height = width / aspect
    if height > band_h:
        height = band_h
        width = height * aspect
        if width > max_w:
            width = max_w
            height = width / aspect

    center_y = print_top + spec["center_y"] * band_h
    y_t = int(center_y - height / 2)
    y_b = int(center_y + height / 2)
    # Shift the box back inside the band rather than cropping the design.
    if y_t < print_top:
        y_b += print_top - y_t
        y_t = print_top
    if y_b > print_bottom:
        y_t -= y_b - print_bottom
        y_b = print_bottom
    y_t = max(y_t, print_top)

    w_t, w_b = width * 0.985, width
    return [
        (int(cx - w_t / 2), y_t),
        (int(cx + w_t / 2), y_t),
        (int(cx + w_b / 2), y_b),
        (int(cx - w_b / 2), y_b),
    ]


def homography(src, dst) -> np.ndarray:
    a = []
    for (x, y), (u, v) in zip(src, dst):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.asarray(a, dtype=float))
    h = vt[-1].reshape(3, 3)
    return h / h[2, 2]


def warp_art(art: Image.Image, box, quad, out_size) -> np.ndarray:
    """Perspective-warp the art's ink bbox onto `quad`; returns float RGBA."""
    art_arr = np.asarray(art.convert("RGBA")).astype(np.float32)
    x0, y0, x1, y1 = box
    src = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    h = homography(src, quad)
    h_inv = np.linalg.inv(h)

    w, hgt = out_size
    grid_x, grid_y = np.meshgrid(
        np.arange(w, dtype=np.float32), np.arange(hgt, dtype=np.float32)
    )
    denom = h_inv[2, 0] * grid_x + h_inv[2, 1] * grid_y + h_inv[2, 2]
    u = (h_inv[0, 0] * grid_x + h_inv[0, 1] * grid_y + h_inv[0, 2]) / denom
    v = (h_inv[1, 0] * grid_x + h_inv[1, 1] * grid_y + h_inv[1, 2]) / denom

    u0 = np.floor(u).astype(np.int64)
    v0 = np.floor(v).astype(np.int64)
    du = (u - u0)[..., None]
    dv = (v - v0)[..., None]
    ah, aw = art_arr.shape[:2]
    uc, vc = np.clip(u0, 0, aw - 1), np.clip(v0, 0, ah - 1)
    uc1, vc1 = np.clip(u0 + 1, 0, aw - 1), np.clip(v0 + 1, 0, ah - 1)
    top = art_arr[vc, uc] * (1 - du) + art_arr[vc, uc1] * du
    bottom = art_arr[vc1, uc] * (1 - du) + art_arr[vc1, uc1] * du
    sampled = top * (1 - dv) + bottom * dv

    inside = (u >= 0) & (u < aw - 1) & (v >= 0) & (v < ah - 1)
    sampled[..., 3] *= inside
    return sampled


def composite(record: dict, plate_name: str, out_path: Path, preview: bool) -> Path:
    plate_path = ROOT / record["plate_paths"][plate_name]
    plate = Image.open(plate_path).convert("RGB")
    art_path = record["art_path"]
    art = Image.open(art_path).convert("RGBA")
    box = ink_bbox(art_path)
    aspect = (box[2] - box[0]) / (box[3] - box[1])

    plate_arr = np.asarray(plate).astype(np.float32)
    garment = record["garment"]
    spec = dict(PLACEMENT[garment][plate_name])
    spec["height"] *= record.get("art_scale", 0.60) / 0.60

    quad = (
        model_quad(plate_arr, spec, aspect, MODEL_PRINT_BAND[garment])
        if plate_name.startswith("model")
        else auto_quad(plate_arr, spec, aspect)
    )

    xs = [p[0] for p in quad]
    ys = [p[1] for p in quad]
    pad = 4
    region = (min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad)
    local_quad = [(x - region[0], y - region[1]) for x, y in quad]
    rw, rh = region[2] - region[0], region[3] - region[1]

    warped = warp_art(art, box, local_quad, (rw, rh))

    base = plate_arr.copy()
    dest = base[region[1]:region[3], region[0]:region[2], :].copy()
    gray = (dest[:, :, 0] * 0.299 + dest[:, :, 1] * 0.587 + dest[:, :, 2] * 0.114) / 255.0

    alpha = (warped[:, :, 3:4] / 255.0) * 0.97
    ink = warped[:, :, :3] * (INK_SHADE_MIN + (1 - INK_SHADE_MIN) * gray[:, :, None])
    dest = dest * (1 - alpha) + ink * alpha
    base[region[1]:region[3], region[0]:region[2], :] = dest

    out = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if preview:
        out.save(out_path.with_suffix(".jpg"), quality=90)
    else:
        out.save(out_path)
    return out_path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true", help="write preview JPEGs")
    parser.add_argument("--only", help="one design key")
    args = parser.parse_args()

    # `only` is passed INTO `build` so the registry validates just the chosen
    # design: filtering afterwards would still require every other design's
    # art and mockups to be present on this machine, which defeats the point of
    # reworking one listing on a checkout that lacks the Drive mount.
    try:
        records = [r for r in build(args.only) if r["art_path"]]
    except SystemExit as exit_request:
        print(exit_request, file=sys.stderr)
        return 1
    if args.only and not records:
        print(f"no design with art matches {args.only!r}", file=sys.stderr)
        return 1

    made: list[tuple[str, Path]] = []
    for record in records:
        folder = OUT_DIR / record["handle"]
        for plate_name in record["plates"]:
            slot = "01-cover" if plate_name == "flat-front" else "02-model"
            suffix = ".jpg" if args.preview else ".png"
            out = folder / f"{slot}{suffix}"
            composite(record, plate_name, out, args.preview)
            made.append((f"{record['key']} / {slot}", out))
            print(f"  {record['handle']} {slot}")

    # Contact sheet for a visual pass.
    if made:
        tiles = []
        for label, path in made:
            im = Image.open(path).convert("RGB")
            th = 300
            tiles.append((label, im.resize((th, int(im.height * th / im.width)), Image.LANCZOS)))
        cols = 6
        tw = tiles[0][1].width
        th_h = max(t.height for _, t in tiles)
        rows = (len(tiles) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * tw + 8, rows * (th_h + 22) + 8), (22, 22, 22))
        draw = ImageDraw.Draw(sheet)
        for i, (label, t) in enumerate(tiles):
            x = 4 + (i % cols) * tw
            y = 4 + (i // cols) * (th_h + 22)
            sheet.paste(t, (x, y))
            draw.text((x + 4, y + t.height + 3), label[:44], fill=(240, 235, 210))
        sheet_path = Path("/tmp/diljit_preview/composite_sheet.png")
        sheet_path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(sheet_path)
        print(f"\ncontact sheet: {sheet_path}")

    print(f"\n{len(made)} plates written under {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
