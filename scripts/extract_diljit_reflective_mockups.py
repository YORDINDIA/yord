#!/usr/bin/env python3
"""Extract the real-customer photo mockups for the reflective Diljit hoodie.

`DiljitHOODIEOK.ai` ("DIL-LUMINATI TOUR / DILJIT / DOSANJH", white type over the
turbaned figure) is the black hoodie people are actually wearing at the shows:
the reflective print reads white in daylight and flares rainbow under a flash.
The proof shots live under `Recorded Videos/Diljit Reflector Tshirts: Hoodies/`
(Chandigarh, Indore).

Each source is centre-cropped to the storefront's 3:4 gallery ratio and resized
to 1080x1440, so the stored file is exactly what the shopper sees.

Usage:
    python extract_diljit_reflective_mockups.py

Output: agnes-out/diljit-hoodie/mockups-reflective/reflective-<n>.png
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent
DRIVE_ROOT = Path(
    "/Users/sakshammittal/Library/CloudStorage/GoogleDrive-saksham@techaintern.com"
    "/My Drive/YORD INDIA/Diljit Dosanjh"
)
HOODIES = DRIVE_ROOT / "Recorded Videos/Diljit Reflector Tshirts: Hoodies"
OUT_DIR = ROOT / "agnes-out" / "diljit-hoodie" / "mockups-reflective"

# (name, source file, horizontal centre fraction, vertical centre fraction)
# Chosen by eye: the hoodie front fills the frame and the print is legible.
# The first is the daylight shot of the reflective print flaring rainbow; the
# next two are the same garment reading white, from the front and from behind.
PICKS = [
    ("reflective-1", HOODIES / "Chandigarh/411B2C5B-6242-4FAF-A82F-72FF18E13C8C.JPG", 0.50, 0.46),
    ("reflective-2", HOODIES / "Chandigarh/03A595B4-AD5C-487C-BC45-015AD88D9FDB.JPG", 0.50, 0.46),
    ("reflective-3", HOODIES / "Indore/Snapinsta.app_469717382_1346075146446669_2185560651048097453_n_1080.jpg", 0.50, 0.50),
]
OUT_W, OUT_H = 1080, 1440


def centre_crop(im: Image.Image, cx: float, cy: float) -> Image.Image:
    """Largest 3:4 window inside `im` centred on (cx, cy) as fractions."""
    w, h = im.size
    ratio = OUT_W / OUT_H
    if w / h > ratio:
        ch, cw = h, int(round(h * ratio))
    else:
        cw, ch = w, int(round(w / ratio))
    left = min(max(int(cx * w - cw / 2), 0), w - cw)
    top = min(max(int(cy * h - ch / 2), 0), h - ch)
    return im.crop((left, top, left + cw, top + ch))


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    made = 0
    for name, src, cx, cy in PICKS:
        if not src.exists():
            print(f"  SKIP {name}: missing {src.name}", file=sys.stderr)
            continue
        im = Image.open(src)
        im = im.convert("RGB")
        out = centre_crop(im, cx, cy).resize((OUT_W, OUT_H), Image.LANCZOS)
        path = OUT_DIR / f"{name}.png"
        out.save(path)
        print(f"  {name} <- {src.name[:44]}  {im.size[0]}x{im.size[1]} -> {OUT_W}x{OUT_H}")
        made += 1
    print(f"\n{made} mockups -> {OUT_DIR}")
    return 0 if made else 1


if __name__ == "__main__":
    sys.exit(main())
