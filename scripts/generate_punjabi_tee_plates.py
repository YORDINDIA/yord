#!/usr/bin/env python3
"""Generate the blank black-tee plates for the Punjabi Aa Gaye Oye listings.

Why plates and not finished product shots: the two delivered designs
(`data/Punjabi_Aa_Gaye_Oye_Gurmukhi_Designs/`) are Gurmukhi artwork, and AI
image models garble Gurmukhi lettering (the delivered Map mockup shows the
drift). So Agnes generates **blank** garments only -- no print, no lettering,
no logo anywhere -- and `composite_punjabi_art.py` pastes the exact vector art
onto the plate afterwards. The art in the final image is byte-identical to the
designer's file; the model only supplies fabric, light and a body.

Four plates per product (the gallery is `aspect-[3/4]`, so every plate is 2K
3:4 -- 1536x2048 -- and nothing crops):

    flat-front    studio flat, plain front
    flat-back     studio flat, plain back        <- gets the art
    model-back    street shot from behind        <- gets the art
    model-front   street shot, face out of frame (plain)

Usage:
    python generate_punjabi_tee_plates.py               # dry-run: print prompts only (default)
    python generate_punjabi_tee_plates.py --execute     # generate all 8
    python generate_punjabi_tee_plates.py --only text   # one product's plates
    python generate_punjabi_tee_plates.py --again       # overwrite existing

Output: agnes-out/punjabi-tees/<handle>__<plate>.png (+ plates_manifest.json)
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
OUT_DIR = ROOT / "agnes-out" / "punjabi-tees"
MANIFEST = OUT_DIR / "plates_manifest.json"

AGNES_DEFAULT_BASE_URL = "https://apihub.agnes-ai.com/v1"
AGNES_DEFAULT_IMAGE_MODEL = "agnes-image-2.5-flash"
IMAGE_SIZE = "2K"
IMAGE_RATIO = "3:4"
GENERATION_TIMEOUT = (10, 300)
DOWNLOAD_TIMEOUT = 300
BACKOFF_DELAYS = (1, 2, 4, 8, 16, 32)
MAX_WORKERS = 4

NO_TEXT = (
    "the fabric is entirely blank: absolutely no print, no graphic, no "
    "lettering, no text, no logo, no tag, no watermark anywhere on the garment"
)
NO_FACE = "his face is not visible in the frame"

PRODUCTS = [
    {
        "handle": "diljit-dosanjh-punjabi-aa-gaye-oye-text-tee",
        "design": "Text Tee (single-line Gurmukhi back print)",
    },
    {
        "handle": "diljit-dosanjh-punjabi-aa-gaye-oye-map-tee",
        "design": "Punjab Map Tee (map + floral garland back print)",
    },
]

FLATS_STYLE = (
    "seamless warm ivory studio backdrop, soft diffused daylight from the upper "
    "left, soft contact shadow under the garment, visible 240 GSM cotton "
    "texture with gentle natural folds, crisp focus, high-end fashion "
    "catalogue photography, 3:4 vertical composition"
)

STREET_STYLE = (
    "warm golden-hour light, blurred old-city heritage buildings and a "
    "mustard-yellow scooter in the background, shallow depth of field, "
    "documentary fashion photography, 50mm lens, natural colour, high detail, "
    "3:4 vertical composition"
)

PLATES = {
    "flat-front": (
        "Studio e-commerce photograph of a completely plain solid black "
        "oversized cotton t-shirt, front side facing the camera, laid flat in a "
        "ghost-mannequin style with no body inside; perfectly straight-on and "
        "symmetrical, shoulders level, half sleeves relaxed to the sides, hem "
        "straight; "
        + NO_TEXT
        + "; "
        + FLATS_STYLE
    ),
    "flat-back": (
        "Studio e-commerce photograph of a completely plain solid black "
        "oversized cotton t-shirt, back side facing the camera, laid flat in a "
        "ghost-mannequin style with no body inside; perfectly straight-on and "
        "symmetrical, the back panel flat and fully visible, ribbed back "
        "neckline, shoulders level, half sleeves relaxed to the sides, hem "
        "straight; "
        + NO_TEXT
        + "; "
        + FLATS_STYLE
    ),
    "model-back": (
        "Editorial street photograph shot from directly behind a young man "
        "walking through a sunlit old-city street in Punjab, India; he wears a "
        "completely plain solid black oversized cotton t-shirt and loose black "
        "trousers; his back fills the centre of the frame, the t-shirt back "
        "panel flat and fully visible with only gentle natural wrinkles, "
        "shoulders level, arms relaxed at his sides; "
        + NO_TEXT
        + "; "
        + STREET_STYLE
    ),
    "model-front": (
        "Editorial street photograph of a young man in a sunlit old-city street "
        "in Punjab, India, framed from the chin down so "
        + NO_FACE
        + "; he wears a completely plain solid black oversized cotton t-shirt "
        "and loose black trousers, one hand adjusting the sleeve; "
        + NO_TEXT
        + "; "
        + STREET_STYLE
    ),
}


def agnes_config() -> tuple[str, str, str]:
    base_url = (os.getenv("AGNES_BASE_URL") or AGNES_DEFAULT_BASE_URL).rstrip("/")
    model = os.getenv("AGNES_IMAGE_MODEL") or AGNES_DEFAULT_IMAGE_MODEL
    return base_url, model, os.getenv("AGNES_AI_API_KEY") or ""


def generate_image(prompt: str, base_url: str, model: str, api_key: str) -> bytes:
    body = {
        "model": model,
        "prompt": prompt,
        "size": IMAGE_SIZE,
        "ratio": IMAGE_RATIO,
        "extra_body": {"response_format": "url"},
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    last_error = "image generation failed"
    for delay in BACKOFF_DELAYS + (0,):
        if delay:
            time.sleep(delay)
        try:
            response = requests.post(
                f"{base_url}/images/generations",
                json=body,
                headers=headers,
                timeout=GENERATION_TIMEOUT,
            )
            if response.status_code == 200:
                items = (response.json() or {}).get("data") or []
                if not items:
                    raise RuntimeError("response contained no image data")
                item = items[0]
                if item.get("b64_json"):
                    return base64.b64decode(item["b64_json"])
                url = item.get("url")
                if not url:
                    raise RuntimeError("response item had neither url nor b64_json")
                download = requests.get(url, timeout=DOWNLOAD_TIMEOUT)
                download.raise_for_status()
                return download.content
            last_error = f"HTTP {response.status_code}: {(response.text or '')[:200]}"
            if response.status_code in (400, 401, 402, 403, 404):
                break  # not retryable
        except requests.RequestException as error:
            last_error = f"network error: {error}"
    raise RuntimeError(last_error)


def task(product: dict, plate: str, prompt: str, config: tuple[str, str, str], again: bool) -> dict:
    path = OUT_DIR / f"{product['handle']}__{plate}.png"
    if path.exists() and not again:
        return {"handle": product["handle"], "plate": plate, "path": str(path),
                "skipped": True, "prompt": prompt}
    started = time.monotonic()
    png = generate_image(prompt, *config)
    path.write_bytes(png)
    return {
        "handle": product["handle"],
        "plate": plate,
        "path": str(path),
        "bytes": len(png),
        "seconds": round(time.monotonic() - started, 1),
        "prompt": prompt,
    }


def main() -> int:
    parser = create_parser(__doc__)
    parser.add_argument("--only", action="append", default=[], help="substring filter on handle/plate")
    parser.add_argument("--again", action="store_true", help="regenerate plates that already exist")
    args = parser.parse_args()

    execute = resolve_execute(args)
    config = agnes_config()
    if execute and not config[2]:
        print("AGNES_AI_API_KEY is not set (.env)", file=sys.stderr)
        return 2

    jobs = []
    for product in PRODUCTS:
        for plate, prompt in PLATES.items():
            key = f"{product['handle']}__{plate}"
            if args.only and not any(f in key for f in args.only):
                continue
            jobs.append((product, plate, prompt))

    if not execute:
        for product, plate, prompt in jobs:
            print(f"\n=== {product['handle']}__{plate} ({product['design']}) ===\n{prompt}")
        print(f"\n{len(jobs)} plates, {IMAGE_SIZE} {IMAGE_RATIO}, model={config[1]}, base={config[0]}")
        return 0

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results, failures = [], []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(task, p, pl, pr, config, args.again): (p, pl) for p, pl, pr in jobs}
        for future in as_completed(futures):
            product, plate = futures[future]
            try:
                result = future.result()
                results.append(result)
                state = "SKIP" if result.get("skipped") else "OK"
                print(f"{state} {product['handle']}__{plate} -> {result['path']}", flush=True)
            except Exception as error:  # one bad plate must not sink the batch
                failures.append({"handle": product["handle"], "plate": plate, "error": str(error)})
                print(f"FAIL {product['handle']}__{plate}: {error}", flush=True)

    if results:
        existing = {}
        if MANIFEST.exists():
            try:
                existing = json.loads(MANIFEST.read_text())
            except json.JSONDecodeError:
                existing = {}
        merged = {**existing, **{f"{r['handle']}__{r['plate']}": r for r in results}}
        MANIFEST.write_text(json.dumps(
            {"generated_at": datetime.now(timezone.utc).isoformat(), "plates": merged},
            indent=2,
        ))
    print(f"\ndone: {len(results)} ok, {len(failures)} failed, out={OUT_DIR}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
