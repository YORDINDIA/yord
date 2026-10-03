#!/usr/bin/env python3
"""Upload the local media archive to Cloudflare R2.

`data/local_media/` is the only copy of the product and article media recovered
from the Wayback captures, and nothing in this repo ingests it into Supabase.
This script publishes it to R2 and writes the URL map that ingest needs:

    products/<handle>/01.jpg   -> products/<handle>/01.webp
    products/<loose>.png       -> products/_unmatched/<loose>.webp
    blog/<name>.jpg            -> blog/<name>.webp
    collections/<name>.jpg     -> collections/<name>.webp

Every image lands as a single web-optimized WebP variant (max 1600px wide, see
`utils/r2_helpers.py`), so one object serves every breakpoint and the storefront
never serves an 8 MB original. Files already recorded in the checkpoint are
skipped, so re-running after an interruption resumes instead of re-uploading
8.7 GB.

Outputs (all safe to delete; the checkpoint is the resume state):

    data/r2_upload_checkpoint.json  relative path -> public URL
    data/r2_media_manifest.json     ingest-facing map (files + products)
    data/r2_upload_errors.json      only written when something failed

Usage:
    python upload_local_media.py                      # dry run: plan + sizes
    python upload_local_media.py --execute            # upload everything
    python upload_local_media.py --execute --resume   # continue after a stop
    python upload_local_media.py --execute --only products --limit 100
"""

from __future__ import annotations

import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

from dotenv import load_dotenv
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent))

from utils.cli import create_parser, resolve_execute, configure_logging
from utils.config import (
    resolve_r2_access_key_id,
    resolve_r2_bucket,
    resolve_r2_endpoint,
    resolve_r2_public_base_url,
    resolve_r2_secret_access_key,
)
from utils.r2_helpers import R2NotConfiguredError, configure_r2, to_webp_variant, upload_image

load_dotenv()

ROOT = Path(__file__).parent.parent
MEDIA_ROOT = ROOT / "data" / "local_media"
CHECKPOINT_FILE = ROOT / "data" / "r2_upload_checkpoint.json"
MANIFEST_FILE = ROOT / "data" / "r2_media_manifest.json"
ERROR_FILE = ROOT / "data" / "r2_upload_errors.json"

# Top-level archive folders and where their keys live.
GROUPS = ("products", "blog", "collections")

IMAGE_EXTENSIONS = frozenset(
    {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".svg", ".avif"}
)

# Anything larger is not an image we want on the storefront; fail loudly
# instead of pushing a stray video or layered file to R2.
MAX_FILE_BYTES = 25 * 1024 * 1024

# Dry-run samples this many files to project the uploaded size.
SAMPLE_SIZE = 25


def key_for(relative: Path) -> str:
    """Map an archive-relative path to an R2 object key (extension-less).

    `upload_image` appends the extension of the stored variant, so the key
    never carries the archive's original one.
    """
    parts = relative.parts
    group = parts[0]

    if group == "products":
        rest = parts[1:]
        if len(rest) == 1:
            # Loose file: recovered but not matched to a product folder.
            return f"products/_unmatched/{Path(rest[0]).stem}"
        return f"products/{rest[0]}/{Path(rest[-1]).stem}"

    if group in ("blog", "collections"):
        return f"{group}/{Path(parts[-1]).stem}"

    return "/".join((*parts[:-1], Path(parts[-1]).stem))


def iter_files(only: str) -> List[Path]:
    """Archive-relative paths of every uploadable image, sorted for resume."""
    files: List[Path] = []
    for group in GROUPS:
        if only != "all" and only != group:
            continue
        group_dir = MEDIA_ROOT / group
        if not group_dir.is_dir():
            continue
        for path in sorted(group_dir.rglob("*")):
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
                files.append(path.relative_to(MEDIA_ROOT))
    return files


def load_checkpoint() -> Dict[str, str]:
    if not CHECKPOINT_FILE.exists():
        return {}
    try:
        with open(CHECKPOINT_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        # A truncated checkpoint (interrupted write) must not block a resume.
        print(f"WARN: {CHECKPOINT_FILE.name} is unreadable; starting a fresh map")
        return {}


def save_json(path: Path, payload) -> None:
    """Write JSON atomically so an interrupt never truncates the record."""
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def build_manifest(urls: Dict[str, str], counts: Dict[str, int]) -> dict:
    """Ingest-facing map: flat `files` plus `products` grouped by handle."""
    products: Dict[str, Dict[str, str]] = {}
    unmatched: Dict[str, str] = {}
    for relative, url in sorted(urls.items()):
        parts = Path(relative).parts
        if parts[0] != "products":
            continue
        if len(parts) == 2:
            unmatched[Path(parts[1]).stem] = url
        elif len(parts) >= 3:
            products.setdefault(parts[1], {})[Path(parts[-1]).stem] = url

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "bucket": resolve_r2_bucket(),
        "public_base_url": resolve_r2_public_base_url(),
        "counts": counts,
        "files": dict(sorted(urls.items())),
        "products": dict(sorted(products.items())),
        "products_unmatched": dict(sorted(unmatched.items())),
    }


def upload_one(relative: Path) -> Tuple[str, str | None, str | None]:
    """Upload one archive file. Returns (relative, url, error)."""
    source = MEDIA_ROOT / relative
    size = source.stat().st_size
    if size > MAX_FILE_BYTES:
        return str(relative), None, f"skipped: {size / 1024 / 1024:.1f} MB exceeds the cap"

    try:
        data = source.read_bytes()
    except OSError as error:
        return str(relative), None, f"read failed: {error}"

    url, error = upload_image(key_for(relative), data, content_type=_mime_for(source))
    if error:
        return str(relative), None, error
    return str(relative), url, None


def _mime_for(path: Path) -> str:
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".heic": "image/heic",
        ".svg": "image/svg+xml",
        ".avif": "image/avif",
    }.get(path.suffix.lower(), "application/octet-stream")


def report_plan(files: List[Path], checkpoint: Dict[str, str]) -> None:
    """Dry-run output: what would be uploaded, and how much smaller it gets."""
    def group_of(relative: Path) -> str:
        parts = relative.parts
        if parts[0] == "products":
            return "products/<handle>" if len(parts) > 2 else "products (unmatched)"
        return parts[0]

    counts: Dict[str, int] = {}
    remaining = []
    for relative in files:
        counts[group_of(relative)] = counts.get(group_of(relative), 0) + 1
        if str(relative) not in checkpoint:
            remaining.append(relative)

    print(f"Archive: {MEDIA_ROOT}")
    for group, count in sorted(counts.items()):
        print(f"  {group:<22} {count:>5} files")
    print(f"  {'total':<22} {len(files):>5} files")
    print(f"Already uploaded (checkpoint): {len(files) - len(remaining)}")
    print(f"To upload this run:            {len(remaining)}")

    sample = remaining[:SAMPLE_SIZE]
    if sample:
        original = variant = 0
        for relative in sample:
            source = MEDIA_ROOT / relative
            data = source.read_bytes()
            original += len(data)
            transformed = to_webp_variant(data)
            variant += len(transformed) if transformed is not None else len(data)
        ratio = variant / original if original else 0
        # Project from the biggest slice we are willing to stat up front.
        slice_ = remaining[:2000]
        total_local = sum((MEDIA_ROOT / r).stat().st_size for r in slice_)
        projected = total_local * ratio * (len(remaining) / len(slice_))
        print(
            f"\nSample of {len(sample)}: {original / 1024 / 1024:.2f} MB -> "
            f"{variant / 1024 / 1024:.2f} MB ({ratio * 100:.0f}%)"
        )
        print(
            f"Projected upload: ~{projected / 1024 / 1024 / 1024:.2f} GB for "
            f"{len(remaining)} files"
        )


def main() -> int:
    parser = create_parser("Upload data/local_media to Cloudflare R2")
    parser.add_argument(
        "--force", action="store_true",
        help="Re-upload files already recorded in the checkpoint (e.g. after "
             "the bucket was cleared). Without it, a re-run resumes.",
    )
    parser.add_argument(
        "--workers", type=int, default=4,
        help="Parallel uploads (default: 4)",
    )
    parser.add_argument(
        "--limit", type=int, default=0,
        help="Upload at most N files from this run (0 = no limit)",
    )
    parser.add_argument(
        "--only", choices=(*GROUPS, "all"), default="all",
        help="Restrict to one top-level archive folder (default: all)",
    )
    args = parser.parse_args()
    configure_logging(args.verbose)
    execute = resolve_execute(args)

    files = iter_files(args.only)
    if not files:
        print(f"No images found under {MEDIA_ROOT} ({args.only})")
        return 0

    checkpoint = load_checkpoint()

    if not execute:
        print("DRY-RUN mode: nothing will be uploaded. Pass --execute to upload.\n")
        report_plan(files, checkpoint)
        return 0

    try:
        configure_r2()
    except R2NotConfiguredError as error:
        print(f"FAIL: {error}")
        return 1

    missing = [
        name for name, value in (
            ("R2_BUCKET", resolve_r2_bucket()),
            ("R2_ACCESS_KEY_ID", resolve_r2_access_key_id()),
            ("R2_SECRET_ACCESS_KEY", resolve_r2_secret_access_key()),
        ) if not value
    ]
    if missing:
        print(f"FAIL: missing {', '.join(missing)} in .env")
        return 1
    if not resolve_r2_public_base_url():
        print(
            "FAIL: R2_PUBLIC_BASE_URL is not set. Enable the bucket's public "
            "development URL (or connect a custom domain) and copy it into .env; "
            "without it the stored URLs would be empty."
        )
        return 1

    todo = [relative for relative in files if args.force or str(relative) not in checkpoint]
    if args.limit > 0:
        todo = todo[:args.limit]

    print(f"Archive: {MEDIA_ROOT}")
    print(f"Bucket:  {resolve_r2_bucket()} ({resolve_r2_endpoint()})")
    print(f"Files:   {len(files)} total, {len(files) - len(todo)} already uploaded, "
          f"{len(todo)} to upload\n")

    if not todo:
        print("Nothing to do; writing the manifest from the checkpoint.")
        save_json(MANIFEST_FILE, build_manifest(checkpoint, {
            "total": len(files), "uploaded": len(checkpoint),
            "skipped": 0, "failed": 0,
        }))
        print(f"Manifest: {MANIFEST_FILE}")
        return 0

    errors: List[dict] = []
    uploaded = 0
    skipped = 0
    processed = len(files) - len(todo)

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = {executor.submit(upload_one, relative): relative for relative in todo}
        with tqdm(total=len(futures), desc="Uploading", unit="file") as bar:
            for future in as_completed(futures):
                relative, url, error = future.result()
                bar.update(1)
                if error:
                    if error.startswith("skipped:"):
                        skipped += 1
                    errors.append({"path": relative, "error": error})
                    continue
                checkpoint[relative] = url
                uploaded += 1

                # Checkpoint every 25 files: an interrupted 8.7 GB run must not
                # lose more than a moment of progress.
                if uploaded % 25 == 0:
                    save_json(CHECKPOINT_FILE, checkpoint)

    save_json(CHECKPOINT_FILE, checkpoint)
    counts = {
        "total": len(files),
        "uploaded": uploaded,
        "skipped": skipped,
        "failed": len(errors) - skipped,
        "already_uploaded": processed,
        "variant_max_width": 1600,
    }
    save_json(MANIFEST_FILE, build_manifest(checkpoint, counts))

    if errors:
        save_json(ERROR_FILE, errors)
        print(f"\n{len(errors)} file(s) failed; details in {ERROR_FILE}")
        for item in errors[:10]:
            print(f"  - {item['path']}: {item['error']}")

    print(f"\nUploaded {uploaded}, skipped {skipped}, failed {len(errors) - skipped}")
    print(f"Checkpoint: {CHECKPOINT_FILE}")
    print(f"Manifest:   {MANIFEST_FILE}")
    return 1 if len(errors) - skipped else 0


if __name__ == "__main__":
    raise SystemExit(main())
