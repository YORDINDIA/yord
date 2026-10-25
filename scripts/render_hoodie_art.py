#!/usr/bin/env python3
"""Rasterise the two black-hoodie `.ai` designs to transparent PNGs.

Both hoodie prints are Illustrator files with a PDF stream, and PIL cannot open
a PDF-backed `.ai` at all. So they are rendered once here with Ghostscript and
the PNGs are what `composite_diljit_art.py` warps onto the hoodie plates.

The artboards have **opaque** backgrounds (Ghostscript's `pngalpha` device still
paints the artboard fill), so each render is keyed to transparency by distance
from its own corner colour. The two backgrounds differ -- one is a warm near
-black, the other a cold one -- so the key colour is sampled per file rather
than hardcoded.

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
ROOT = SCRIPTS_DIR.parent
OUT_DIR = ROOT / "agnes-out" / "diljit-hoodie-art"

DRIVE_ROOT = Path(
    "/Users/sakshammittal/Library/CloudStorage/GoogleDrive-saksham@techaintern.com"
    "/My Drive/YORD INDIA/Diljit Dosanjh"
)
APPARELS = DRIVE_ROOT / "Merch Designs" / "Apparels"

# name -> source .ai. Both paths are the ones the composite registry pins.
SOURCES = {
    # "DILJIT DOSANJH'S / DIL-LUMINATI TOUR" over the masked figure. Also the
    # print on the Placeit studio video in the same folder.
    "dosanjhs-tour": APPARELS / "DD003 - Diljit Dosanjh's Dillumniati tour/diljit_design_2.ai",
    # "DIL-LUMINATI TOUR / DILJIT / DOSANJH" over the turbaned figure. The
    # reflective print; identical md5 in DD001 - Dil-luminati White/ and
    # Design 2 - Diljit Reflective/.
    "reflective-tour": APPARELS / "Design 2 - Diljit Reflective/DiljitHOODIEOK.ai",
}

DPI = 200
# Distance from the sampled background colour at which a pixel counts as ink.
# The art is white type on near-black, so the two are far apart and a tight
# band is safe; the soft edge between them is what gets the partial alpha.
BG_TOLERANCE = 14
BG_FEATHER = 20


def key_out_background(path: Path) -> tuple[int, int]:
    """Replace the flat artboard fill with transparency, in place."""
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
    ).astype(np.uint8)
    out = np.dstack([np.asarray(im, dtype=np.uint8), alpha])
    Image.fromarray(out, "RGBA").save(path)
    return tuple(int(v) for v in bg), int((alpha < 10).mean() * 100)


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
        print(f"  {name}: rendered, keyed bg={bg}, {transparent_pct}% transparent")

    if not execute:
        print("\ndry-run; pass --execute to render")
        return 0
    print(f"\ndone -> {OUT_DIR}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
