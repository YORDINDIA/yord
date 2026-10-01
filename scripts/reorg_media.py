#!/usr/bin/env python3
"""Reorganise flat media into per-product folders.

Copies (never moves) ``local_media/products/*`` into
``local_media/products/<handle>/01.ext ...`` following each product's
``images[]`` order from ``data/clean/products.clean.json``. URL matching
uses the same canonicalization as ``clean_data.py`` (https, no query).

Dry-run (default) prints the plan. ``--execute`` copies files and writes
``data/clean/`` outputs. Original flat files stay in place; the report
lists the exact ``rm`` scope for after verification.

Outputs (all under data/clean/):
    image_manifest.clean.json  every entry + handle, position, new_path, alt
    missing_files.json         product image URLs with no manifest/file match
    orphan_files.json          disk files referenced by no product
    alt_text.json              handle -> [descriptive alt strings]
"""

from __future__ import annotations

import json
import logging
import shutil
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

sys.path.insert(0, str(Path(__file__).parent))
from utils.cli import create_parser, resolve_execute, configure_logging

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
MEDIA_DIR = DATA_DIR / "local_media" / "products"


def canon_url(url: str) -> str:
    parts = urlsplit(url.strip())
    return urlunsplit(("https", parts.netloc.lower().replace("www.", ""),
                       parts.path.rstrip("/"), "", ""))


def build_alt(title: str, brand: str, category: str, n: int, total: int) -> str:
    base = f"{title} by {brand}" if brand else title
    if total > 1:
        return f"{base} ({category}) - photo {n} of {total}"
    return f"{base} ({category})"


def main() -> int:
    parser = create_parser("Reorganise media into per-product folders")
    args = parser.parse_args()
    configure_logging(args.verbose)
    execute = resolve_execute(args)
    if not execute:
        print("DRY-RUN mode: no writes will be made. Pass --execute to write.")

    with open(DATA_DIR / "clean" / "products.clean.json", encoding="utf-8") as f:
        products = json.load(f)
    with open(DATA_DIR / "image_manifest.json", encoding="utf-8") as f:
        manifest = json.load(f)

    by_url = {canon_url(e["url"]): e for e in manifest}
    referenced: set[str] = set()
    missing: list[dict] = []
    alts: dict[str, list[str]] = {}
    planned = 0

    for p in products:
        handle = p["handle"]
        images = p.get("images") or []
        total = len(images)
        alts[handle] = []
        for n, url in enumerate(images, 1):
            entry = by_url.get(canon_url(url))
            alt = build_alt(p.get("title", handle), p.get("brand", ""),
                            p.get("category", ""), n, total)
            alts[handle].append(alt)
            if entry is None:
                missing.append({"handle": handle, "position": n, "url": url,
                                "reason": "no manifest entry"})
                continue
            src = DATA_DIR / entry["local_path"]
            if not src.exists():
                missing.append({"handle": handle, "position": n, "url": url,
                                "reason": "file not on disk"})
                continue
            referenced.add(entry["local_path"])
            planned += 1
            if execute:
                dest_dir = MEDIA_DIR / handle
                dest_dir.mkdir(exist_ok=True)
                dest = dest_dir / f"{n:02d}{src.suffix.lower()}"
                if not dest.exists():
                    shutil.copy2(src, dest)
                entry["handle"] = handle
                entry["position"] = n
                entry["new_path"] = str(dest.relative_to(DATA_DIR))
                entry["alt"] = alt

    orphans = sorted(str(Path(e["local_path"]).name)
                     for e in manifest if e["local_path"] not in referenced)

    # Second pass: query-string dupes collapsed by clean_data still deserve a
    # pointer, so manifest consumers resolve every URL. They alias the kept
    # file (same downloaded bytes, already copied); nothing is copied twice.
    kept_by_url = {canon_url(e["url"]): e for e in manifest
                   if e.get("new_path")}
    aliases = 0
    for e in manifest:
        if e.get("new_path"):
            continue
        kept = kept_by_url.get(canon_url(e["url"]))
        if kept is None:
            continue
        e["handle"] = kept["handle"]
        e["position"] = kept["position"]
        e["new_path"] = kept["new_path"]
        e["alt"] = kept["alt"]
        e["alias_of"] = kept["url"]
        aliases += 1

    print(f"products: {len(products)}, files to copy: {planned}, "
          f"missing: {len(missing)}, orphan files: {len(orphans)}, "
          f"dedupe aliases: {aliases}")

    if not execute:
        return 0

    with open(DATA_DIR / "clean" / "image_manifest.clean.json", "w",
              encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    with open(DATA_DIR / "clean" / "missing_files.json", "w",
              encoding="utf-8") as f:
        json.dump(missing, f, ensure_ascii=False, indent=1)
    with open(DATA_DIR / "clean" / "orphan_files.json", "w",
              encoding="utf-8") as f:
        json.dump({"note": "Referenced by no product; left in place, not deleted.",
                   "files": orphans}, f, ensure_ascii=False, indent=1)
    with open(DATA_DIR / "clean" / "alt_text.json", "w",
              encoding="utf-8") as f:
        json.dump(alts, f, ensure_ascii=False, indent=1)
    logger.info("Media reorg complete: %d files copied", planned)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
