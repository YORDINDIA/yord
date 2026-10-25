#!/usr/bin/env python3
"""Extract the black-hoodie mockup frames from the delivered Placeit video.

The only finished mockup of the black hoodie is
`Merch Designs/Apparels/DD003 - Diljit Dosanjh's Dillumniati tour/Hoodies/
hoodie-video-featuring-a-woman-making-different-facial-expressions-4917v.mp4`
(1080x1920, 10 s). Its print is `diljit_design_2.ai`, the same file the
composite cover uses, so the gallery is internally consistent.

The storefront gallery is `aspect-[3/4]`, so each frame is centre-cropped to
3:4 (1080x1440) -- cropping in the extractor rather than at render time keeps
the stored file exactly what the shopper sees.

Usage:
    python extract_diljit_hoodie_mockups.py

Output: agnes-out/diljit-hoodie/mockups/hoodie-mockup-<n>.png
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent
DRIVE_ROOT = Path(
    "/Users/sakshammittal/Library/CloudStorage/GoogleDrive-saksham@techaintern.com"
    "/My Drive/YORD INDIA/Diljit Dosanjh"
)
VIDEO = (
    DRIVE_ROOT
    / "Merch Designs/Apparels/DD003 - Diljit Dosanjh's Dillumniati tour/Hoodies"
    / "hoodie-video-featuring-a-woman-making-different-facial-expressions-4917v.mp4"
)
OUT_DIR = ROOT / "agnes-out" / "diljit-hoodie" / "mockups"

# Frames chosen by eye from a 0.5 s scan. The video's first half is the
# full-garment walk-and-turn (print square-on); the second half is a face
# close-up with the hoodie cropped out, so nothing after ~5 s is usable.
FRAMES = [
    ("hoodie-mockup-1", 0.4, 300),
    ("hoodie-mockup-2", 1.2, 300),
    ("hoodie-mockup-3", 3.2, 300),
]
CROP_W, CROP_H = 1080, 1440


def main() -> int:
    if not VIDEO.exists():
        print(f"video missing: {VIDEO}", file=sys.stderr)
        return 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for name, ts, top in FRAMES:
        out = OUT_DIR / f"{name}.png"
        cmd = [
            "ffmpeg", "-v", "error",
            "-ss", str(ts), "-i", str(VIDEO),
            "-frames:v", "1",
            "-vf", f"crop={CROP_W}:{CROP_H}:0:{top}",
            "-y", str(out),
        ]
        subprocess.run(cmd, check=True)
        print(f"  {name} <- t={ts}s  {out.stat().st_size // 1024} KB")

    print(f"\n{len(FRAMES)} mockups -> {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
