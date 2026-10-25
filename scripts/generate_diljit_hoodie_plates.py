#!/usr/bin/env python3
"""Generate the blank black-hoodie plates for the Diljit Dosanjh hoodie listings.

Same reason as the Punjabi tee job: the hoodie art is the designer's exact
vector file, and AI image models garble type and faces. So Agnes generates
**blank** black hoodies only -- no print, no lettering, no logo anywhere -- and
`composite_diljit_art.py` warps the designer's art onto the chest afterwards.

Two plates, both 2K 3:4 (1536x2048) so nothing crops in the `aspect-[3/4]`
gallery:

    flat-front     studio flat, hood down, plain chest panel
    model-front    on-body street shot, chin out of frame, chest panel clear

The chest has to come back clean: `composite_diljit_art.py` measures the dark
fabric run per row and refuses to place a print over a fold, the hood, the
drawstrings or the kangaroo pocket.

Usage:
    python generate_diljit_hoodie_plates.py             # dry-run: print prompts only
    python generate_diljit_hoodie_plates.py --execute   # generate both
    python generate_diljit_hoodie_plates.py --again     # overwrite existing

Output: agnes-out/diljit-hoodie/<plate>.png (+ plates_manifest.json)
"""

from __future__ import annotations

import base64
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

from utils.cli import create_parser, resolve_execute

load_dotenv()

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent
OUT_DIR = ROOT / "agnes-out" / "diljit-hoodie"
MANIFEST = OUT_DIR / "plates_manifest.json"

AGNES_DEFAULT_BASE_URL = "https://apihub.agnes-ai.com/v1"
AGNES_DEFAULT_IMAGE_MODEL = "agnes-image-2.5-flash"
IMAGE_SIZE = "2K"
IMAGE_RATIO = "3:4"
GENERATION_TIMEOUT = (10, 300)
DOWNLOAD_TIMEOUT = 300
BACKOFF_DELAYS = (1, 2, 4, 8, 16, 32)
MAX_WORKERS = 2

NO_TEXT = (
    "the fabric is entirely blank: absolutely no print, no graphic, no "
    "lettering, no text, no logo, no tag, no watermark anywhere on the garment"
)
NO_FACE = "his face is not visible in the frame, the crop ends below the chin"

FLATS_STYLE = (
    "seamless warm ivory studio backdrop, soft diffused daylight from the upper "
    "left, soft contact shadow under the garment, visible heavyweight 320 GSM "
    "brushed fleece texture with gentle natural folds, crisp focus, high-end "
    "fashion catalogue photography, 3:4 vertical composition"
)

STREET_STYLE = (
    "warm golden-hour light, blurred old-city heritage buildings in the "
    "background, shallow depth of field, documentary fashion photography, 50mm "
    "lens, natural colour, high detail, 3:4 vertical composition"
)

# Both prompts keep the chest panel flat and empty: the print lands there, and
# a fold, a drawstring or the hood would break the warp.
PLATES = {
    "flat-front": (
        "Studio e-commerce photograph of a completely plain solid black "
        "pullover hoodie, front side facing the camera, laid flat in a "
        "ghost-mannequin style with no body inside; the hood is down and folded "
        "back behind the shoulders, the two drawstrings hang straight down "
        "either side of the collar well clear of the centre chest, no kangaroo "
        "pocket seam across the upper chest; perfectly straight-on and "
        "symmetrical, shoulders level, long sleeves relaxed to the sides, hem "
        "straight; the whole centre chest panel is smooth flat black fleece; "
        + NO_TEXT
        + "; "
        + FLATS_STYLE
    ),
    "model-front": (
        "Editorial street photograph of a young man standing three-quarter on "
        "in a sunlit old-city street in Punjab, India; he wears a completely "
        "plain solid black pullover hoodie with the hood down and loose black "
        "trousers, hands in the front pocket; "
        + NO_FACE
        + ", the frame is cropped at the chin so the head is out of shot and the "
        "chest fills the centre of the frame; the centre chest panel of the "
        "hoodie is smooth flat black fleece with only gentle natural wrinkles "
        "and no fold crossing it, shoulders level; "
        + NO_TEXT
        + "; "
        + STREET_STYLE
    ),
}


def agnes_config() -> tuple[str, str, str]:
    # Non-raising on purpose (the punjabi/covers shape): a dry run prints
    # prompts and the model default without a key; only --execute needs one.
    base = os.getenv("AGNES_BASE_URL") or AGNES_DEFAULT_BASE_URL
    model = os.getenv("AGNES_IMAGE_MODEL") or AGNES_DEFAULT_IMAGE_MODEL
    return base.rstrip("/"), model, os.getenv("AGNES_AI_API_KEY") or ""


def generate_image(prompt: str, base_url: str, model: str, api_key: str) -> bytes:
    url = f"{base_url}/images/generations"
    # Same contract as generate_punjabi_tee_plates.py and the admin's
    # `agnes.ts`: the aspect field is `ratio`, and `response_format` must sit
    # under `extra_body` or Agnes rejects the request outright.
    payload = {
        "model": model,
        "prompt": prompt,
        "n": 1,
        "size": IMAGE_SIZE,
        "ratio": IMAGE_RATIO,
        "extra_body": {"response_format": "url"},
    }
    last: Exception | None = None
    for attempt, delay in enumerate((0,) + BACKOFF_DELAYS):
        if delay:
            time.sleep(delay)
        try:
            r = requests.post(
                url,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
                timeout=GENERATION_TIMEOUT,
            )
            if r.status_code == 429 or r.status_code >= 500:
                last = RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
                continue
            if r.status_code in (400, 401, 402, 403, 404):
                # Not retryable: a malformed request, a bad key, an exhausted
                # quota or a missing model will fail identically next time, and
                # ~63 s of backoff per plate only delays the operator seeing it.
                raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
            r.raise_for_status()
            body = r.json()
            item = (body.get("data") or [{}])[0]
            if item.get("b64_json"):
                return base64.b64decode(item["b64_json"])
            if item.get("url"):
                d = requests.get(item["url"], timeout=DOWNLOAD_TIMEOUT)
                d.raise_for_status()
                return d.content
            raise RuntimeError(f"no image in response: {json.dumps(body)[:300]}")
        except requests.RequestException as exc:
            # Transport failures are the retryable class; the RuntimeErrors
            # above carry their own verdict and propagate immediately.
            last = exc
    raise RuntimeError(f"generation failed after {len(BACKOFF_DELAYS) + 1} attempts: {last}")


def task(plate: str, prompt: str, config: tuple[str, str, str], again: bool) -> dict:
    out = OUT_DIR / f"{plate}.png"
    if out.exists() and not again:
        print(f"  {plate}: exists, skipping")
        return {"plate": plate, "path": str(out), "skipped": True}
    print(f"  {plate}: generating...")
    data = generate_image(prompt, *config)
    out.write_bytes(data)
    print(f"  {plate}: wrote {len(data) // 1024} KB")
    return {"plate": plate, "path": str(out), "bytes": len(data)}


def main() -> int:
    parser = create_parser("Generate blank black-hoodie plates for the Diljit listings")
    parser.add_argument("--again", action="store_true", help="regenerate plates that already exist")
    args = parser.parse_args()
    execute = resolve_execute(args)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Resolved before the dry-run branch so a prompt-only run works without a
    # key; the key itself is only required (and only checked) for --execute.
    config = agnes_config()

    if not execute:
        for plate, prompt in PLATES.items():
            print(f"\n=== {plate} ===\n{prompt}")
        print(f"\n{len(PLATES)} plates, {IMAGE_SIZE} {IMAGE_RATIO}, model={config[1]}")
        print("dry-run; pass --execute to generate")
        return 0

    if not config[2]:
        print("AGNES_AI_API_KEY is not set (.env)", file=sys.stderr)
        return 2

    print(f"\n{len(PLATES)} plates, {IMAGE_SIZE} {IMAGE_RATIO}, model={config[1]}, base={config[0]}")
    results: list[dict] = []
    failures: list[dict] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(task, p, pr, config, args.again): p for p, pr in PLATES.items()}
        for fut in as_completed(futures):
            plate = futures[fut]
            try:
                results.append(fut.result())
            except Exception as error:  # one bad plate must not sink the batch
                failures.append({"plate": plate, "error": str(error)})
                print(f"FAIL {plate}: {error}", file=sys.stderr)

    # Always written: the other worker's success must reach the manifest even
    # when its sibling fails, or the next run cannot tell done from missing.
    merged = []
    if MANIFEST.exists():
        merged = json.loads(MANIFEST.read_text()).get("plates", [])
    recorded = {r["plate"] for r in results}
    merged = [p for p in merged if p["plate"] not in recorded] + results
    MANIFEST.write_text(json.dumps(
        {"generated_at": datetime.now(timezone.utc).isoformat(), "plates": merged},
        indent=1,
    ))
    print(f"\n{len(results)} plates -> {OUT_DIR}")
    if failures:
        for failure in failures:
            print(f"  FAILED {failure['plate']}: {failure['error']}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
