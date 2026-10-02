#!/usr/bin/env python3
"""Merge subagent SEO enrichment into clean records, with guardrail checks.

Reads ``data/clean/enriched/products_*.json`` + ``blogs_*.json`` and merges
the new SEO fields into copies of the clean records. Any batch that fails
validation is rejected wholesale (its records keep clean values, flagged
in the report) — enrichment must never corrupt source data.

Checks per product entry:
    handle/title byte-identical to the clean record at the same position
    meta_title 1-60 chars, meta_description 140-160 chars
    search_keywords 3-8 comma-separated phrases
Checks per blog entry:
    handle/title byte-identical, summary <= 160 chars plain text,
    every related_handle exists in the product handle set

Outputs:
    products.enriched.json / blogs.enriched.json (clean + SEO fields)
    enrichment_report.json (per-batch accept/reject + violation samples)
    review_queue.json (deterministic spot-check sample for human review)
"""

from __future__ import annotations

import glob
import json
import logging
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from utils.cli import create_parser, resolve_execute, configure_logging

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
CLEAN_DIR = DATA_DIR / "clean"
ENRICHED_DIR = CLEAN_DIR / "enriched"


def load(name: str):
    with open(CLEAN_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def check_product(entry: dict, clean: dict) -> list[str]:
    """Return a list of violations (empty = accept)."""
    problems = []
    if entry.get("handle") != clean.get("handle"):
        problems.append(f"handle changed: {entry.get('handle')!r}")
    if entry.get("title") != clean.get("title"):
        problems.append("title changed")
    mt = entry.get("meta_title") or ""
    if not (0 < len(mt) <= 60):
        problems.append(f"meta_title len {len(mt)}")
    md = entry.get("meta_description") or ""
    if not (140 <= len(md) <= 160):
        problems.append(f"meta_description len {len(md)}")
    kws = [k.strip() for k in (entry.get("search_keywords") or "").split(",")]
    if not (3 <= len([k for k in kws if k]) <= 8):
        problems.append(f"keywords count {len(kws)}")
    if set(entry.keys()) != {"handle", "title", "meta_title",
                             "meta_description", "search_keywords"}:
        problems.append(f"unexpected keys: {sorted(entry.keys())}")
    return problems


def check_blog(entry: dict, clean: dict, handles: set[str]) -> list[str]:
    problems = []
    if entry.get("handle") != clean.get("handle"):
        problems.append(f"handle changed: {entry.get('handle')!r}")
    if entry.get("title") != clean.get("title"):
        problems.append("title changed")
    summary = entry.get("summary") or ""
    if not summary or len(summary) > 160:
        problems.append(f"summary len {len(summary)}")
    elif re.search(r"<[^>]*>|&[a-z]+;|&#", summary, re.IGNORECASE):
        problems.append("summary is not plain text")
    for h in entry.get("related_handles") or []:
        if h not in handles:
            problems.append(f"unknown related_handle: {h!r}")
    if set(entry.keys()) != {"handle", "title", "summary",
                             "search_keywords", "related_handles"}:
        problems.append(f"unexpected keys: {sorted(entry.keys())}")
    return problems


def main() -> int:
    parser = create_parser("Merge SEO enrichment with guardrail checks")
    args = parser.parse_args()
    configure_logging(args.verbose)
    execute = resolve_execute(args)
    if not execute:
        print("DRY-RUN mode: no writes will be made. Pass --execute to write.")

    products = load("products.clean.json")
    blogs = load("blogs.clean.json")
    handles = {p["handle"] for p in products}

    report: dict = {"products": {}, "blogs": {},
                    "rejected_batches": [], "accepted_batches": []}
    enriched_products: dict[str, dict] = {}
    enriched_blogs: dict[str, dict] = {}

    for path in sorted(glob.glob(str(ENRICHED_DIR / "products_*.json"))):
        batch = Path(path).stem
        with open(path, encoding="utf-8") as f:
            entries = json.load(f)
        violations = []
        staged: dict[str, dict] = {}
        for i, entry in enumerate(entries):
            match = next((p for p in products
                          if p["handle"] == entry.get("handle")), None)
            if match is None:
                violations.append({"entry": i, "problems": ["no clean match"]})
                continue
            problems = check_product(entry, match)
            if problems:
                violations.append({"handle": entry.get("handle"),
                                   "problems": problems})
            else:
                staged[entry["handle"]] = {
                    "meta_title": entry["meta_title"],
                    "meta_description": entry["meta_description"],
                    "search_keywords": entry["search_keywords"],
                }
        # A rejected batch is rejected wholesale: nothing from it merges.
        if not violations:
            enriched_products.update(staged)
        report["products"][batch] = {"entries": len(entries),
                                     "violations": violations}
        (report["rejected_batches"] if violations
         else report["accepted_batches"]).append(batch)

    for path in sorted(glob.glob(str(ENRICHED_DIR / "blogs_*.json"))):
        batch = Path(path).stem
        with open(path, encoding="utf-8") as f:
            entries = json.load(f)
        violations = []
        staged: dict[str, dict] = {}
        for entry in entries:
            match = next((b for b in blogs
                          if b["handle"] == entry.get("handle")), None)
            if match is None:
                violations.append({"entry": entry.get("handle"),
                                   "problems": ["no clean match"]})
                continue
            problems = check_blog(entry, match, handles)
            if problems:
                violations.append({"handle": entry.get("handle"),
                                   "problems": problems})
            else:
                staged[entry["handle"]] = {
                    "summary": entry["summary"],
                    "search_keywords": entry.get("search_keywords", ""),
                    "related_handles": entry.get("related_handles", []),
                }
        # A rejected batch is rejected wholesale: nothing from it merges.
        if not violations:
            enriched_blogs.update(staged)
        report["blogs"][batch] = {"entries": len(entries),
                                  "violations": violations}
        (report["rejected_batches"] if violations
         else report["accepted_batches"]).append(batch)

    for p in products:
        p.update(enriched_products.get(p["handle"], {
            "meta_title": None, "meta_description": None,
            "search_keywords": None}))
    for b in blogs:
        b.update(enriched_blogs.get(b["handle"], {
            "summary": None, "search_keywords": None,
            "related_handles": []}))

    print(f"enriched: {len(enriched_products)}/{len(products)} products, "
          f"{len(enriched_blogs)}/{len(blogs)} blogs")
    print(f"accepted batches: {len(report['accepted_batches'])}, "
          f"rejected: {len(report['rejected_batches'])}")

    if not execute:
        return 0

    for name, payload in (
        ("products.enriched.json", products),
        ("blogs.enriched.json", blogs),
        ("enrichment_report.json", report),
        ("review_queue.json", {
            "note": "Deterministic spot-check: every 25th enriched product "
                    "plus the first 10 enriched blogs.",
            "products": [p["handle"] for i, p in enumerate(
                             p for p in products if p.get("meta_title"))
                         if i % 25 == 0],
            "blogs": [b["handle"] for b in blogs if b.get("summary")][:10],
        }),
    ):
        with open(CLEAN_DIR / name, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=1)
    logger.info("Merged enrichment into data/clean/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
