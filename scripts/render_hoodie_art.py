#!/usr/bin/env python3
"""Rasterise the two black-hoodie `.ai` designs to transparent PNGs.

Both hoodie prints are Illustrator files with a PDF stream, and PIL cannot open
a PDF-backed `.ai` at all. So they are rendered once here with Ghostscript and
the PNGs are what `composite_diljit_art.py` warps onto the hoodie plates.

The artboards have **opaque** backgrounds (Ghostscript's `pngalpha` device still
paints the artboard fill), so each render is keyed to transparency by distance
from its own corner colour. The two backgrounds differ -- one is a warm near
black, the other a cold one -- so the key colour is sampled per file rather
than hardcoded.

Feather-band pixels are a blend of ink and artboard, which is ink *premultiplied
over the background*. The compositor downstream wants straight (unmultiplied)
alpha, so the RGB of every partial-alpha pixel is un-blended against the key
colour before saving -- otherwise the white print edges get multiplied by their
alpha twice and render with dark halos. Re-run with `--execute --again` to
regenerate the pinned PNGs after changing this.

The artboards live on the Google Drive mount; a checkout without it points
`DILJIT_DRIVE_ROOT` at its own copy of the folder (see
`diljit_listing_registry.py`).

Output: agnes-out/diljit-hoodie-art/<name>.png

Usage:
    python render_hoodie_art.py            # dry-run: list what it would render
    python render_hoodie_art.py --execute  # render
    python render_hoodie_art.py --execute --again   # re-render existing
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))

from diljit_listing_registry import DRIVE_ROOT  # noqa: E402

ROOT = SCRIPTS_DIR.parent
OUT_DIR = ROOT / "agnes-out" / "diljit-hoodie-art"

APPARELS = DRIVE_ROOT / "Merch Designs" / "Apparels"

SOURCES = {
    "dosanjhs-tour": APPARELS
    / "DD003 - Diljit Dosanjh's Dillumniati tour/diljit_design_2.ai",
    "reflective-tour": APPARELS / "Design 2 - Diljit Reflective/DiljitHOODIEOK.ai",
}

DPI = 200
# Keying tolerances: the artboard fill is not perfectly uniform after a render,
# so pixels within BG_TOLERANCE of the corner colour are fully transparent and
# the band above that fades in over BG_FEATHER more units of distance.
BG_TOLERANCE = 14
BG_FEATHER = 20


def key_out_background(path: Path) -> tuple[tuple[int, int, int], float]:
    """Replace the flat artboard fill with transparency, in place.

    Returns the sampled key colour and the share of pixels keyed fully out,
    for the run log. The un-blend of partial-alpha pixels is the reason this
    is not just `arr` + a mask: the feather band's RGB carries the artboard's
    near-black in it, and straight-alpha compositing would multiply that
    residual out of the ink a second time.
    """
    im = Image.open(path).convert("RGB")
    arr = np.asarray(im, dtype=np.int16)
    # The fill is whatever the four corners agree on.
    corners = [arr[2, 2], arr[2, -3], arr[-3, 2], arr[-3, -3]]
    bg = np.median(np.stack(corners), axis=0)
    distance = np.abs(arr - bg).max(axis=2)
    alpha = np.where(
        distance <= BG_TOLERANCE,
        0,
        np.where(
            distance <= BG_TOLERANCE + BG_FEATHER,
            (distance - BG_TOLERANCE) * 255 // BG_FEATHER,
            255,
        ),
    ).astype(np.int16)

    # Un-premultiply: solve ink = (rgb - bg * (1 - a)) / a for the partial
    # band. Fully opaque pixels (a == 255) keep their RGB as rendered; the
    # division is guarded so a == 0 never divides.
    a = alpha / 255.0
    safe_a = np.maximum(a, 1.0 / 255.0)
    unblended = (arr - bg[None, None, :] * (1.0 - safe_a)[..., None]) / safe_a[..., None]
    rgb = np.where((alpha > 0)[..., None] & (alpha < 255)[..., None], unblended, arr)
    rgb = np.clip(np.rint(rgb), 0, 255).astype(np.uint8)

    out = np.dstack([rgb, alpha.astype(np.uint8)])
    Image.fromarray(out, "RGBA").save(path)
    return tuple(int(v) for v in bg), float((alpha < 10).mean() * 100)


def main() -> int:
    execute = "--execute" in sys.argv
    again = "--again" in sys.argv
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    failures = 0
    for name, src in SOURCES.items():
        out = OUT_DIR / f"{name}.png"
        if not src.exists():
            print(f"  {name}: MISSING source {src}", file=sys.stderr)
            failures += 1
            continue
        if out.exists() and not again:
            print(f"  {name}: exists, skipping (use --again to re-render)")
            continue
        if not execute:
            print(f"  {name}: would render {src.name} -> {out.name}")
            continue
        subprocess.run(
            [
                "gs", "-q", "-dNOPAUSE", "-dBATCH",
                "-sDEVICE=pngalpha", f"-r{DPI}",
                "-dTextAlphaBits=4", "-dGraphicsAlphaBits=4",
                "-o", str(out), str(src),
            ],
            check=True,
        )
        bg, transparent_pct = key_out_background(out)
        print(f"  {name}: rendered, keyed bg={bg}, {transparent_pct:.1f}% transparent")

    if not execute:
        print("\ndry-run; pass --execute to render")
    # Missing sources fail the dry run too: a dry run is a preflight, and a
    # preflight that reports the render will fail but exits 0 cannot gate
    # anything.
    if failures:
        print(f"\n{failures} source(s) missing -- see stderr above", file=sys.stderr)
        return 1
    if not execute:
        return 0
    print(f"\ndone -> {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
