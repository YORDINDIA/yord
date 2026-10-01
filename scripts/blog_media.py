#!/usr/bin/env python3
"""Assign each blog a usable OG image or a flagged placeholder plan.

Every blog `images[]` URL points at a deleted Supabase host (see
lost_assets.json): zero blog images survive. This script maps each blog to
the best available substitute instead of leaving ingest to guess:

- blogs with related_handles -> first image of the first related product's
  by-product folder (a real file on disk, topical by construction)
- blogs without -> {"og_image": None, "status": "needs_placeholder"} with a
  category tag (concert / cricket / culture) so placeholders can be batched

Output: data/clean/blog_media.json. Dry-run (default) prints the split.
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from utils.cli import create_parser, resolve_execute, configure_logging

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
CLEAN_DIR = DATA_DIR / "clean"
MEDIA_ROOT = DATA_DIR / "local_media" / "products"

CRICKET_HINTS = ("ipl", "cricket", "rcb", "csk", "kohli", "dhoni", "wankhede")


def category(handle: str, keywords: str) -> str:
    text = f"{handle} {keywords}".lower()
    if any(h in text for h in CRICKET_HINTS):
        return "cricket"
    if any(h in text for h in ("concert", "tour", "festival", "gig", "lollapalooza")):
        return "concert"
    return "culture"


def main() -> int:
    parser = create_parser("Map blogs to OG images or placeholder plan")
    args = parser.parse_args()
    configure_logging(args.verbose)
    execute = resolve_execute(args)
    if not execute:
        print("DRY-RUN mode: no writes will be made. Pass --execute to write.")

    with open(CLEAN_DIR / "blogs.enriched.json", encoding="utf-8") as f:
        blogs = json.load(f)

    rows = []
    for b in blogs:
        og_image = None
        for h in b.get("related_handles") or []:
            folder = MEDIA_ROOT / h
            if folder.is_dir():
                first = sorted(folder.iterdir())
                if first:
                    og_image = str(first[0].relative_to(DATA_DIR))
                    break
        rows.append({
            "handle": b["handle"],
            "og_image": og_image,
            "status": "substitute" if og_image else "needs_placeholder",
            "placeholder_category": None if og_image
            else category(b["handle"], b.get("search_keywords") or ""),
            "lost_originals": len(b.get("lost_image_urls") or []),
        })

    sub = sum(1 for r in rows if r["og_image"])
    print(f"blogs: {len(rows)}, with substitute OG: {sub}, "
          f"needing placeholder: {len(rows) - sub}")

    if not execute:
        return 0
    with open(CLEAN_DIR / "blog_media.json", "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    logger.info("Wrote data/clean/blog_media.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
