#!/usr/bin/env python3
"""Normalize archive-recovered data into ingest-ready clean files.

Reads the raw ``data/*.json`` captures and writes normalized copies to
``data/clean/``. Raw files are never modified. Quarantine, not deletion:
suspect rows (``-copy`` duplicates, coverage gaps) are flagged in reports
and all rows are kept for ingest.

Dry-run (default) prints what would change. ``--execute`` writes
``data/clean/``.

Outputs:
    products.clean.json      same records, image URLs canonicalized + deduped
    blogs.clean.json         same records, byline junk stripped (raw kept)
    collections.clean.json   passthrough copy (imageless, noted in coverage)
    dedupe_report.json       suspected -copy duplicates + image dupe counts
    collection_coverage.json held vs true membership counts per collection
    ingest_readiness.json    per-record field checklist for Supabase ingest
"""

from __future__ import annotations

import json
import logging
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

sys.path.insert(0, str(Path(__file__).parent))
from utils.cli import create_parser, resolve_execute, configure_logging

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
CLEAN_DIR = DATA_DIR / "clean"

BYLINE_RE = re.compile(
    r"^Yord India\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4}\s+\d+\s+min read\s*",
)
WS_RUN_RE = re.compile(r"\n{3,}")


def canon_url(url: str) -> str:
    """https + no query string. Dedupe key for image URLs."""
    parts = urlsplit(url.strip())
    scheme = "https"
    netloc = parts.netloc.lower().replace("www.", "")
    return urlunsplit((scheme, netloc, parts.path.rstrip("/"), "", ""))


def normalize_http(url: str) -> str:
    """Rewrite to https, keep the original query string (CDN versioning)."""
    parts = urlsplit(url.strip())
    return urlunsplit(("https", parts.netloc.lower(), parts.path, parts.query, ""))


def clean_blog_body(text: str) -> tuple[str, bool]:
    """Strip scraper byline prefix and collapse whitespace runs."""
    cleaned = BYLINE_RE.sub("", text or "").strip()
    cleaned = WS_RUN_RE.sub("\n\n", cleaned)
    return cleaned, cleaned != (text or "")


def clean_products(products: list[dict]) -> tuple[list[dict], dict]:
    """Canonicalize + dedupe image URLs. Returns (records, stats)."""
    image_dupes_removed = 0
    products_without_images = []
    for p in products:
        seen: set[str] = set()
        kept: list[str] = []
        for url in p.get("images") or []:
            key = canon_url(url)
            if key in seen:
                image_dupes_removed += 1
                continue
            seen.add(key)
            kept.append(normalize_http(url))
        p["images"] = kept
        p["image_count"] = len(kept)
        if not kept:
            products_without_images.append(p.get("handle"))
    stats = {
        "products": len(products),
        "image_dupes_removed": image_dupes_removed,
        "products_without_images": products_without_images,
    }
    return products, stats


def clean_blogs(blogs: list[dict]) -> tuple[list[dict], dict]:
    """Strip byline junk from body/description, keep raw text alongside."""
    bodies_fixed = 0
    for b in blogs:
        body = b.get("body_text") or ""
        cleaned, changed = clean_blog_body(body)
        if changed:
            b["body_text_raw"] = body
            b["body_text"] = cleaned
            b["word_count"] = len(cleaned.split())
            bodies_fixed += 1
        desc = b.get("description") or ""
        cleaned_desc, changed_desc = clean_blog_body(desc)
        if changed_desc:
            b["description_raw"] = desc
            b["description"] = cleaned_desc
    stats = {
        "blogs": len(blogs),
        "bodies_fixed": bodies_fixed,
        "blogs_without_images": sum(1 for b in blogs if not b.get("images")),
    }
    return blogs, stats


def dedupe_report(products: list[dict]) -> dict:
    """Flag suspected -copy duplicates. All rows are kept regardless."""
    groups: dict[str, list[str]] = {}
    for p in products:
        handle = p.get("handle", "")
        canonical = re.sub(r"-copy(-\d+)?$", "", handle)
        if canonical != handle:
            groups.setdefault(canonical, []).append(handle)
    return {
        "note": "Quarantine only: every row is kept for ingest. "
                "Collapse these manually in Shopify/Supabase after review.",
        "suspected_duplicate_groups": len(groups),
        "groups": [
            {"canonical": k, "copies": v} for k, v in sorted(groups.items())
        ],
    }


def collection_coverage(collections: list[dict]) -> dict:
    """Held vs true membership per collection."""
    rows = []
    for c in collections:
        rows.append({
            "handle": c.get("handle"),
            "title": c.get("title"),
            "held": len(c.get("products") or []),
            "true_count": c.get("true_product_count"),
            "missing": c.get("products_missing", 0),
            "imageless": not c.get("images"),
        })
    return {
        "collections": len(rows),
        "imageless_collections": sum(1 for r in rows if r["imageless"]),
        "memberships_held": sum(r["held"] for r in rows),
        "rows": rows,
    }


def readiness(products: list[dict], blogs: list[dict]) -> dict:
    """Per-record checklist against the fields the storefront renders."""
    product_issues = []
    for p in products:
        missing = [f for f in ("title", "handle", "description")
                   if not p.get(f)]
        if not (p.get("price_min") or 0):
            missing.append("price")
        if not p.get("images"):
            missing.append("images")
        if not p.get("variants"):
            missing.append("variants")
        if missing:
            product_issues.append({"handle": p.get("handle"), "missing": missing})
    blog_issues = []
    for b in blogs:
        missing = [f for f in ("title", "slug", "body_text", "date_published")
                   if not b.get(f)]
        if (b.get("word_count") or 0) < 100:
            missing.append("word_count<100")
        if missing:
            blog_issues.append({"handle": b.get("handle"), "missing": missing})
    return {
        "products_total": len(products),
        "products_with_issues": len(product_issues),
        "blogs_total": len(blogs),
        "blogs_with_issues": len(blog_issues),
        "product_issues": product_issues,
        "blog_issues": blog_issues,
    }


def load(name: str):
    with open(DATA_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def main() -> int:
    parser = create_parser("Normalize data/*.json into data/clean/ for ingest")
    args = parser.parse_args()
    configure_logging(args.verbose)
    execute = resolve_execute(args)
    if not execute:
        print("DRY-RUN mode: no writes will be made. Pass --execute to write.")

    products = load("products.json")
    blogs = load("blogs.json")
    collections = load("collections.json")

    products, product_stats = clean_products(products)
    blogs, blog_stats = clean_blogs(blogs)
    dupes = dedupe_report(products)
    coverage = collection_coverage(collections)
    ready = readiness(products, blogs)

    print(f"products: {product_stats['products']}, "
          f"image dupes removed: {product_stats['image_dupes_removed']}, "
          f"imageless: {len(product_stats['products_without_images'])}")
    print(f"blogs: {blog_stats['blogs']}, "
          f"bodies fixed: {blog_stats['bodies_fixed']}")
    print(f"copy-handle groups flagged: {dupes['suspected_duplicate_groups']} "
          f"(kept, not merged)")
    print(f"collections: {coverage['collections']}, "
          f"memberships held: {coverage['memberships_held']}")
    print(f"readiness: {ready['products_with_issues']} products / "
          f"{ready['blogs_with_issues']} blogs with issues")

    if not execute:
        return 0

    CLEAN_DIR.mkdir(exist_ok=True)
    for name, payload in (
        ("products.clean.json", products),
        ("blogs.clean.json", blogs),
        ("collections.clean.json", collections),
        ("dedupe_report.json", dupes),
        ("collection_coverage.json", coverage),
        ("ingest_readiness.json", ready),
    ):
        with open(CLEAN_DIR / name, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=1)
    logger.info("Wrote data/clean/ (%d files)", 6)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
