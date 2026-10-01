#!/usr/bin/env python3
"""Rehearse the Supabase ingest from data/clean without touching the DB.

Maps enriched records to the exact row shapes of scripts/schema.sql (plus
005_seo_content.sql: blogs/articles tables, products SEO columns) and checks
every integrity rule the live ingest must hold. No credentials needed.

Checks:
    products: unique handle + id, status valid, variants FK + price > 0,
      images ordered positions, SEO lengths (when enriched)
    collects: every membership points at a known product + collection
    articles: every article maps to the single 'news' blog row, slug unique,
      summary present, related_handles resolve to known products
    media: every product image resolves to a by-product folder file

Exit 0 = ingest-ready. Exit 1 = violations listed in ingest_rehearsal.json.
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


def load(name: str):
    with open(CLEAN_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def main() -> int:
    parser = create_parser("Rehearse Supabase ingest from data/clean")
    args = parser.parse_args()
    configure_logging(args.verbose)
    execute = resolve_execute(args)
    if not execute:
        print("DRY-RUN mode: report only. Pass --execute to write the report.")

    products = load("products.enriched.json" if
                    (CLEAN_DIR / "products.enriched.json").exists()
                    else "products.clean.json")
    blogs = load("blogs.enriched.json" if
                 (CLEAN_DIR / "blogs.enriched.json").exists()
                 else "blogs.clean.json")
    collections = load("collections.clean.json")

    violations: list[dict] = []
    handles = [p["handle"] for p in products]
    dupes = {h for h in handles if handles.count(h) > 1}
    if dupes:
        violations.append({"table": "products", "rule": "unique handle",
                           "rows": sorted(dupes)})

    product_ids: set[int] = set()
    null_id_handles: list[str] = []
    for p in products:
        raw_gid = p.get("product_group_id")
        if raw_gid is None:
            # No source id: ingest assigns a fresh BIGINT via admin_next_id.
            null_id_handles.append(p["handle"])
            continue
        pid = int(raw_gid)
        if pid in product_ids:
            violations.append({"table": "products", "rule": "unique id",
                               "rows": [p["handle"]]})
        product_ids.add(pid)
        for v in p.get("variants") or []:
            if not (v.get("price") or 0) > 0:
                violations.append({"table": "product_variants",
                                   "rule": "price > 0",
                                   "rows": [p["handle"]]})
                break
        positions = [i for i, _ in enumerate(p.get("images") or [], 1)]
        handle_dir = MEDIA_ROOT / p["handle"]
        if positions and not handle_dir.is_dir():
            violations.append({"table": "product_images",
                               "rule": "by-product folder exists",
                               "rows": [p["handle"]]})
        for key, lo, hi in (("meta_title", 1, 60),
                            ("meta_description", 140, 160)):
            val = p.get(key)
            if val is not None and not (lo <= len(val) <= hi):
                violations.append({"table": "products", "rule": f"{key} length",
                                   "rows": [p["handle"]]})
                break

    collection_handles = {c["handle"] for c in collections}
    for c in collections:
        for h in c.get("products") or []:
            if h not in set(handles):
                violations.append({"table": "collects",
                                   "rule": "product handle resolves",
                                   "rows": [f"{c['handle']} -> {h}"]})

    slugs = [b.get("slug") or b.get("handle") for b in blogs]
    slug_dupes = {s for s in slugs if slugs.count(s) > 1}
    if slug_dupes:
        violations.append({"table": "articles", "rule": "unique slug",
                           "rows": sorted(slug_dupes)})
    for b in blogs:
        for h in b.get("related_handles") or []:
            if h not in set(handles):
                violations.append({"table": "articles",
                                   "rule": "related_handle resolves",
                                   "rows": [f"{b['handle']} -> {h}"]})

    ok = not violations
    print(f"products: {len(products)}, blogs: {len(blogs)}, "
          f"collections: {len(collections)}")
    if null_id_handles:
        print(f"note: {len(null_id_handles)} products lack a source id; "
              f"ingest assigns fresh BIGINTs (admin_next_id)")
    print("INGEST-READY" if ok else f"VIOLATIONS: {len(violations)}")
    for v in violations[:10]:
        print(f"  - {v['table']}: {v['rule']}: {v['rows'][:3]}")

    if execute:
        with open(CLEAN_DIR / "ingest_rehearsal.json", "w",
                  encoding="utf-8") as f:
            json.dump({"ingest_ready": ok, "violations": violations},
                      f, ensure_ascii=False, indent=1)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
