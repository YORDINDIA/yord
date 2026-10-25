"""The chroma-key maths in `render_hoodie_art.py`.

The feather band of a keyed render is ink *premultiplied over the artboard
fill*. `composite_diljit_art.py` composites with straight alpha, so saving the
band's RGB unchanged would multiply the residual artboard colour out of the ink
a second time — white print edges render with dark halos. These tests pin the
un-blend: partial-alpha pixels come back as pure ink colour, opaque and
transparent pixels keep theirs.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

SCRIPTS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRIPTS))

from render_hoodie_art import key_out_background  # noqa: E402

BG = (20, 20, 24)  # a cold near-black, like the real artboard fill
INK = (250, 250, 240)
BG_TOLERANCE_ALPHA = 1  # any alpha above fully-transparent qualifies as partial


def _write_render(path: Path, band_delta: int) -> None:
    """A 40x40 render: artboard fill, one opaque ink pixel, one feather pixel.

    The key colour is sampled a couple of pixels in from each corner, so the
    fixture has to be large enough that those sample points are pure fill.
    `band_delta` is the per-channel distance of the feather pixel from the
    fill, chosen to land inside `key_out_background`'s feather band
    (BG_TOLERANCE < delta <= BG_TOLERANCE + BG_FEATHER).
    """
    arr = np.full((40, 40, 3), BG, dtype=np.uint8)
    arr[20, 20] = INK  # opaque ink
    arr[20, 21] = tuple(v + band_delta for v in BG)  # partial alpha
    Image.fromarray(arr, "RGB").save(path)


def test_feather_band_rgb_is_unblended_from_the_artboard(tmp_path: Path):
    source = tmp_path / "art.png"
    _write_render(source, band_delta=20)

    bg, _ = key_out_background(source)

    assert bg == BG  # the key colour is sampled, not assumed
    saved = np.asarray(Image.open(source).convert("RGBA"))
    opaque = saved[20, 20]
    feather = saved[20, 21]

    assert tuple(opaque[:3]) == INK  # opaque ink is untouched
    alpha = int(feather[3])
    assert BG_TOLERANCE_ALPHA < alpha < 255  # really is a partial pixel

    # The input pixel at this position was the fill blended with 20/255 ink:
    # rgb = fill + 20 = (40, 40, 44). Un-blending that against the fill at the
    # observed alpha must give back the ink colour the blend carried.
    blended = tuple(v + 20 for v in BG)
    expected = tuple(
        round((observed - fill * (1 - alpha / 255)) / (alpha / 255))
        for observed, fill in zip(blended, BG)
    )
    # The point of the un-blend: the saved RGB is the *ink* the blend carried,
    # brighter than the blended pixel that was on disk, and never darker.
    assert tuple(feather[:3]) == pytest.approx(expected, abs=2)
    assert min(feather[:3]) > min(blended) + 20
