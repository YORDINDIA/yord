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

Prerequisites: `ffmpeg` on PATH (`brew install ffmpeg`), and the source video
on the Google Drive mount -- point `DILJIT_DRIVE_ROOT` at your copy of the
folder if the default mount is not yours, or pass `--video <path>` for a copy
kept somewhere else.

Usage:
    python extract_diljit_hoodie_mockups.py [--video <path-to-mp4>]

Output: agnes-out/diljit-hoodie/mockups/hoodie-mockup-<n>.png
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))

from diljit_listing_registry import DRIVE_ROOT  # noqa: E402

ROOT = SCRIPTS_DIR.parent
DEFAULT_VIDEO = (
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--video",
        type=Path,
        default=DEFAULT_VIDEO,
        help="source mp4 (default: the Drive-mounted Placeit delivery)",
    )
    args = parser.parse_args()
    video = args.video

    # Preflight both hard dependencies before creating any output: a machine
    # without ffmpeg used to fail on the first frame with a FileNotFoundError
    # *after* the output directory had been created, which reads as a half-run.
    if shutil.which("ffmpeg") is None:
        print("ffmpeg not found on PATH -- install it first (brew install ffmpeg)", file=sys.stderr)
        return 2
    if not video.exists():
        print(f"video missing: {video}", file=sys.stderr)
        return 2

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for name, ts, top in FRAMES:
        out = OUT_DIR / f"{name}.png"
        cmd = [
            "ffmpeg", "-v", "error",
            "-ss", str(ts), "-i", str(video),
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
