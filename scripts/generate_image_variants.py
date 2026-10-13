#!/usr/bin/env python3
"""Pre-generate responsive WebP variants for product images on R2.

The bucket stores one web-optimized WebP per product image (max 1600px, see
``utils/r2_helpers.py``), so every `next/image` srcset entry used to resolve to
the same 1600px file. This script writes pre-generated siblings beside each
original::

    products/<handle>/01.webp          # original, unchanged
    products/<handle>/01-320.webp      # 320px wide, quality 80
    products/<handle>/01-640.webp
    products/<handle>/01-960.webp
    products/<handle>/01-1280.webp

``frontend/src/lib/media-loader.ts`` then maps the width Next asks for onto the
matching sibling. Two rules keep that mapping total, so a request can never
404:

* a target narrower than the original is downscaled (Lanczos, WebP q80);
* a target as wide as or wider than the original is uploaded as the original
  bytes ("alias") — never upscaled, and never a missing file. An image whose
  stored original is 750px wide still gets ``-960`` and ``-1280`` keys, they
  just hold the same bytes as the original.

Idempotent: variant keys already present in the bucket are skipped, so a
re-run only fills gaps. Dry-run is the default and downloads originals to
measure them (read-only); nothing is uploaded unless ``--execute`` is passed.

Usage:
    python generate_image_variants.py                  # dry run, all images
    python generate_image_variants.py --limit 20       # smoke-test 20 images
    python generate_image_variants.py --execute        # upload the variants
    python generate_image_variants.py --execute --limit 20
    python generate_image_variants.py --execute --resume

Run it from ``scripts/`` (the checkpoint and error log land in the cwd). No
database write happens: ``product_images.storage_url`` keeps pointing at the
original file, and the loader derives the sibling key from it.
"""

from __future__ import annotations

import io
import json
import logging
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import requests
from PIL import Image
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent))
from utils.cli import configure_logging, create_parser, resolve_execute
from utils.config import resolve_r2_bucket
from utils.r2_helpers import (
    VARIANT_QUALITY,
    configure_r2,
    is_r2_url,
    key_from_public_url,
    upload_image,
)
from utils.supabase_helpers import get_supabase_client

logger = logging.getLogger(__name__)

# Widths `media-loader.ts` maps onto; keep the two in step.
VARIANT_WIDTHS = (320, 640, 960, 1280)
# Width of the stored original (r2_helpers.MAX_VARIANT_WIDTH); nothing wider
# is ever requested from the bucket.
ORIGINAL_WIDTH = 1600

DEFAULT_WORKERS = 8
DOWNLOAD_RETRIES = 3

DEFAULT_CHECKPOINT = "image_variants_checkpoint.json"
ERROR_LOG = "image_variants_errors.json"

# Only product images get siblings; the key shape mirrors the loader's pattern.
PRODUCT_KEY_RE = re.compile(r"^products/[^/]+/[^/]+\.webp$")
WEBP_SUFFIX = ".webp"


# --------------------------------------------------------------------------
# Source data
# --------------------------------------------------------------------------


def fetch_product_images(supabase) -> List[Dict[str, Any]]:
    """Every `product_images` row that has a stored URL, ordered by id."""
    rows: List[Dict[str, Any]] = []
    offset = 0
    page = 1000
    while True:
        response = (
            supabase.table("product_images")
            .select("id, product_id, storage_url")
            .not_.is_("storage_url", "null")
            .neq("storage_url", "")
            .order("id")
            .range(offset, offset + page - 1)
            .execute()
        )
        if not response.data:
            break
        rows.extend(response.data)
        offset += page
        if len(response.data) < page:
            break
    return rows


def candidate_key(url: str) -> Optional[str]:
    """R2 object key for a product image URL, or None when unsupported."""
    if not is_r2_url(url):
        return None
    key = key_from_public_url(url)
    return key if PRODUCT_KEY_RE.match(key) else None


def list_existing_keys(prefix: str = "products/") -> Optional[Set[str]]:
    """All object keys under ``prefix``; None when the listing fails.

    One paginated listing is far cheaper than a HEAD per planned variant, and
    it is what makes the run idempotent.
    """
    try:
        client = configure_r2()
        bucket = resolve_r2_bucket()
        keys: Set[str] = set()
        token: Optional[str] = None
        while True:
            kwargs: Dict[str, Any] = {"Bucket": bucket, "Prefix": prefix, "MaxKeys": 1000}
            if token:
                kwargs["ContinuationToken"] = token
            response = client.list_objects_v2(**kwargs)
            keys.update(obj["Key"] for obj in response.get("Contents", []))
            if not response.get("IsTruncated"):
                return keys
            token = response.get("NextContinuationToken")
    except Exception as e:
        logger.warning(f"Could not list existing objects ({e}); treating the bucket as empty")
        return None


def variant_key(key: str, width: int) -> str:
    """``products/<handle>/01.webp`` + 640 -> ``products/<handle>/01-640.webp``."""
    stem = key[: -len(WEBP_SUFFIX)] if key.endswith(WEBP_SUFFIX) else key
    return f"{stem}-{width}{WEBP_SUFFIX}"


# --------------------------------------------------------------------------
# Image work
# --------------------------------------------------------------------------


def download_image(url: str, max_retries: int = DOWNLOAD_RETRIES) -> bytes:
    """Download bytes with the scripts' usual exponential backoff."""
    last_error: Optional[Exception] = None
    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return response.content
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                time.sleep(2**attempt)
    raise last_error if last_error else RuntimeError(f"could not download {url}")


def downscale_to_webp(data: bytes, target_width: int) -> Optional[bytes]:
    """Lanczos-downscale to ``target_width`` and re-encode as WebP q80."""
    try:
        with Image.open(io.BytesIO(data)) as image:
            if getattr(image, "n_frames", 1) > 1:
                return None  # animated: a frozen first frame would be a regression
            width, height = image.size
            if width <= target_width:
                return None  # caller aliases instead; never upscale
            scale = target_width / float(width)
            resized = image.resize(
                (target_width, max(1, round(height * scale))),
                Image.Resampling.LANCZOS,
            )
            if resized.mode not in ("RGB", "RGBA"):
                resized = resized.convert("RGBA" if "A" in resized.getbands() else "RGB")
            buffer = io.BytesIO()
            resized.save(buffer, format="WEBP", quality=VARIANT_QUALITY, method=6)
            return buffer.getvalue()
    except Exception as e:
        logger.warning(f"Could not build a {target_width}px variant: {e}")
        return None


def probe(data: bytes) -> Tuple[int, int, str]:
    """(width, height, format) of downloaded bytes."""
    with Image.open(io.BytesIO(data)) as image:
        return image.size[0], image.size[1], (image.format or "").upper()


def process_image(
    row: Dict[str, Any],
    existing_keys: Set[str],
    execute: bool,
) -> Dict[str, Any]:
    """Plan (and, when executing, upload) the siblings for one product image."""
    result: Dict[str, Any] = {
        "id": row["id"],
        "product_id": row.get("product_id"),
        "url": row["storage_url"],
        "key": None,
        "width": None,
        "height": None,
        "planned": [],  # [{'key', 'kind', 'bytes'}]
        "skipped": [],
        "errors": [],
        "bytes": 0,
    }

    key = candidate_key(row["storage_url"])
    if not key:
        result["errors"].append(f"not an R2 product image URL: {row['storage_url']}")
        return result
    result["key"] = key

    if key not in existing_keys:
        # The row exists but the object does not (or the listing failed): the
        # download below is the source of truth, so keep going.
        logger.debug(f"{key} was not in the bucket listing; trying the download anyway")

    try:
        data = download_image(row["storage_url"])
    except Exception as e:
        result["errors"].append(f"download failed: {e}")
        return result

    try:
        width, height, image_format = probe(data)
    except Exception as e:
        result["errors"].append(f"unreadable image: {e}")
        return result
    result["width"], result["height"] = width, height
    if image_format != "WEBP":
        logger.debug(f"{key} is stored as {image_format or 'unknown'}, not WebP")

    for target in VARIANT_WIDTHS:
        vkey = variant_key(key, target)
        if vkey in existing_keys:
            result["skipped"].append(vkey)
            continue

        if target >= width:
            variant_bytes = data  # alias: the original, never an upscale
            kind = "alias"
        else:
            variant_bytes = downscale_to_webp(data, target)
            kind = "downscale"
            if variant_bytes is None:
                result["errors"].append(f"{vkey}: could not build the variant")
                continue

        entry = {"key": vkey, "kind": kind, "bytes": len(variant_bytes)}
        result["planned"].append(entry)
        result["bytes"] += len(variant_bytes)

        if execute:
            _url, error = upload_image(vkey[: -len(WEBP_SUFFIX)], variant_bytes, "image/webp")
            if error:
                result["errors"].append(f"{vkey}: upload failed: {error}")
                result["planned"][-1]["uploaded"] = False
            else:
                result["planned"][-1]["uploaded"] = True

    return result


# --------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------


class VariantBackfill:
    def __init__(
        self,
        execute: bool,
        limit: int = 0,
        workers: int = DEFAULT_WORKERS,
        resume: bool = False,
        checkpoint_file: str = DEFAULT_CHECKPOINT,
        batch_size: int = 50,
    ):
        self.execute = execute
        self.limit = limit
        self.workers = max(1, workers)
        self.resume = resume
        self.checkpoint_file = Path(checkpoint_file)
        self.error_log_file = Path(ERROR_LOG)
        self.batch_size = max(1, batch_size)

        self.stats: Dict[str, Any] = {
            "total_rows": 0,
            "candidates": 0,
            "processed": 0,
            "failed": 0,
            "uploaded": 0,
            "planned": 0,
            "downscaled": 0,
            "aliased": 0,
            "skipped_existing": 0,
            "planned_bytes": 0,
            "width_histogram": {},  # bucket -> count of originals
            "alias_by_width": {},  # target width -> count of aliased uploads
            "sample_keys": [],
            "errors": [],
        }

    def load_checkpoint(self) -> Set[int]:
        if not self.resume or not self.checkpoint_file.exists():
            return set()
        with open(self.checkpoint_file) as f:
            data = json.load(f)
        processed = set(data.get("processed", []))
        print(f"Resuming from {self.checkpoint_file}: {len(processed)} images already done")
        return processed

    def save_checkpoint(self, processed_ids: Set[int]) -> None:
        with open(self.checkpoint_file, "w") as f:
            json.dump(
                {
                    "timestamp": datetime.now().isoformat(),
                    "processed": sorted(processed_ids),
                    "total_processed": len(processed_ids),
                },
                f,
                indent=2,
            )

    def run(self) -> None:
        print("=" * 60)
        print("PRODUCT IMAGE VARIANT BACKFILL (R2)")
        print("=" * 60)
        if not self.execute:
            print("\n*** DRY RUN - nothing will be uploaded ***")
            print("    (originals are downloaded to measure them; pass --execute to write)\n")

        supabase = get_supabase_client()
        print("Fetching product_images rows...")
        rows = fetch_product_images(supabase)
        self.stats["total_rows"] = len(rows)

        candidates = [row for row in rows if candidate_key(row["storage_url"])]
        self.stats["candidates"] = len(candidates)
        unsupported = len(rows) - len(candidates)
        if unsupported:
            print(f"Skipping {unsupported} row(s) without an R2 product-image URL")

        processed_ids = self.load_checkpoint()
        if processed_ids:
            candidates = [row for row in candidates if row["id"] not in processed_ids]

        if self.limit > 0:
            candidates = candidates[: self.limit]
            print(f"--limit {self.limit}: processing {len(candidates)} image(s)")

        print(f"Product images to process: {len(candidates)}")

        print("Listing existing objects under products/ ...")
        existing = list_existing_keys()
        existing_keys = existing if existing is not None else set()
        print(f"Existing objects under products/: {len(existing_keys)}")

        if not candidates:
            print("\nNothing to do.")
            self.print_summary()
            return

        # Cumulative across --resume runs: each checkpoint write keeps every id
        # an earlier run already finished, so the file never shrinks.
        done_ids: Set[int] = set(processed_ids)
        batch_size = self.batch_size
        with tqdm(total=len(candidates), desc="Variants") as pbar:
            for start in range(0, len(candidates), batch_size):
                batch = candidates[start : start + batch_size]
                with ThreadPoolExecutor(max_workers=self.workers) as executor:
                    futures = {
                        executor.submit(process_image, row, existing_keys, self.execute): row
                        for row in batch
                    }
                    for future in as_completed(futures):
                        row = futures[future]
                        try:
                            result = future.result()
                        except Exception as e:  # defensive: never kill the run
                            result = {"id": row["id"], "errors": [str(e)], "planned": [], "skipped": []}
                        self.record(result)
                        if result.get("errors"):
                            self.stats["failed"] += 1
                        else:
                            self.stats["processed"] += 1
                            done_ids.add(row["id"])
                        pbar.update(1)

                if self.execute:
                    self.save_checkpoint(done_ids)

        self.print_summary()

        if self.stats["errors"]:
            with open(self.error_log_file, "w") as f:
                json.dump(self.stats["errors"], f, indent=2)
            print(f"\nError log saved to: {self.error_log_file}")

    def record(self, result: Dict[str, Any]) -> None:
        width = result.get("width")
        if width:
            for upper, label in ((320, "<320"), (640, "320-639"), (960, "640-959"), (1280, "960-1279")):
                if width < upper:
                    bucket = label
                    break
            else:
                bucket = ">=1280"
            self.stats["width_histogram"][bucket] = self.stats["width_histogram"].get(bucket, 0) + 1

        for entry in result.get("planned", []):
            self.stats["planned"] += 1
            self.stats["planned_bytes"] += entry.get("bytes", 0)
            if entry.get("kind") == "alias":
                self.stats["aliased"] += 1
                target = entry["key"].rsplit("-", 1)[-1].removesuffix(WEBP_SUFFIX)
                self.stats["alias_by_width"][target] = self.stats["alias_by_width"].get(target, 0) + 1
            else:
                self.stats["downscaled"] += 1
            if entry.get("uploaded"):
                self.stats["uploaded"] += 1
            if len(self.stats["sample_keys"]) < 8:
                self.stats["sample_keys"].append(entry["key"])

        self.stats["skipped_existing"] += len(result.get("skipped", []))
        for error in result.get("errors", []):
            self.stats["errors"].append({"id": result.get("id"), "key": result.get("key"), "error": error})

    def print_summary(self) -> None:
        s = self.stats
        action = "uploaded" if self.execute else "planned uploads"
        print("\n" + "=" * 60)
        print("SUMMARY" + (" (DRY RUN)" if not self.execute else ""))
        print("=" * 60)
        print(f"product_images rows:        {s['total_rows']}")
        print(f"R2 product-image rows:      {s['candidates']}")
        print(f"Images processed:           {s['processed']}")
        print(f"Images with errors:         {s['failed']}")
        print(f"Variant files {action}:     {s['uploaded'] if self.execute else s['planned']}")
        print(f"  - downscaled:             {s['downscaled']}")
        print(f"  - aliased (original bytes, no upscale): {s['aliased']}")
        print(f"  - skipped (already there): {s['skipped_existing']}")
        print(f"Estimated upload bytes:     {s['planned_bytes'] / 1024 / 1024:.1f} MB")
        if s["width_histogram"]:
            print("Original widths:            " + ", ".join(
                f"{k}: {v}" for k, v in sorted(s["width_histogram"].items())
            ))
        if s["alias_by_width"]:
            print("Aliases by target width:    " + ", ".join(
                f"-{k}: {v}" for k, v in sorted(s["alias_by_width"].items())
            ))
        if s["sample_keys"]:
            print("Sample keys:                " + s["sample_keys"][0])
            for key in s["sample_keys"][1:]:
                print("                            " + key)
        if s["errors"]:
            print(f"\n{len(s['errors'])} error(s):")
            for err in s["errors"][:5]:
                print(f"  - id={err['id']} {err.get('key') or ''}: {err['error']}")
            if len(s["errors"]) > 5:
                print(f"  ... and {len(s['errors']) - 5} more")
        print("=" * 60)


def main() -> None:
    parser = create_parser(
        "Pre-generate 320/640/960/1280px WebP variants for R2 product images",
        default_checkpoint=DEFAULT_CHECKPOINT,
    )
    parser.add_argument("--limit", type=int, default=0, help="Process only the first N images (smoke test)")
    parser.add_argument(
        "--workers", type=int, default=DEFAULT_WORKERS, help=f"Parallel workers (default: {DEFAULT_WORKERS})"
    )
    parser.add_argument("--resume", action="store_true", help="Skip images recorded in the checkpoint")
    args = parser.parse_args()
    configure_logging(args.verbose)

    execute = resolve_execute(args)
    if not execute:
        print("DRY-RUN mode: no uploads. Pass --execute to write to R2.")

    if args.limit < 0:
        parser.error("--limit must be >= 0")

    backfill = VariantBackfill(
        execute=execute,
        limit=args.limit,
        workers=args.workers,
        resume=args.resume,
        checkpoint_file=args.checkpoint_file or DEFAULT_CHECKPOINT,
        batch_size=args.batch_size,
    )
    try:
        backfill.run()
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)
    except Exception as e:
        print(f"\nFatal error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)

    print("\n" + ("BACKFILL COMPLETE" if execute else "DRY RUN COMPLETE — pass --execute to upload"))
    if not execute:
        print("Recommended next command: python generate_image_variants.py --execute")
        print("(then deploy the frontend: the loader now requests these sibling keys)")


if __name__ == "__main__":
    main()
