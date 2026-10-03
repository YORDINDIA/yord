#!/usr/bin/env python3
"""Ingest the Wayback-recovered enriched dataset into Supabase.

Source of truth: data/clean/*.enriched.json + data/clean/collections.clean.json
+ data/r2_media_manifest.json (R2 URLs). Nothing here touches Shopify.

Tables written (in dependency order): blogs, products, product_variants,
product_images, collections, collects, articles. Artists/concerts have no
tables: artists are artist-named collections + static frontend metadata,
concerts are static data in frontend/src/lib/data/concerts.ts.

ID strategy (stable + idempotent, no collision with admin_next_id which uses
MAX(id)+1): product id = int(product_group_id) when numeric else
8900000000+index; variant id = Shopify variant_id when present else
product_id*1000+idx; image id = product_id*1000+position (fits bigint);
collection id = 7000000000+idx; collect id = 7100000000+seq; blog id =
89876988081 (matches scripts/add_new_blogs.py); recovered articles =
810000001+idx (900000001+ is reserved for add_new_blogs.py).

Usage:
    python ingest_enriched.py                 # dry run: counts + violations
    python ingest_enriched.py --execute       # write to Supabase
    python ingest_enriched.py --execute --only products --limit 10
"""

from __future__ import annotations

import html
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))

from utils.cli import create_parser, resolve_execute, configure_logging
from utils.config import resolve_supabase_secret_key, resolve_supabase_url

load_dotenv()

ROOT = Path(__file__).parent.parent
CLEAN = ROOT / "data" / "clean"
ROWS = ROOT / "data" / "rows"
LOG_FILE = ROOT / "data" / "ingest_enriched_log.json"

BLOG_ID = 89876988081
BLOG_TITLE = "Blog"
ARTICLE_BASE = 810000001
PRODUCT_FALLBACK_BASE = 8900000000
COLLECTION_BASE = 7000000000
COLLECT_BASE = 7100000000

BATCH = 500


def parse_captured(ts: str | None) -> str | None:
    if not ts or len(str(ts)) < 14:
        return None
    try:
        dt = datetime.strptime(str(ts)[:14], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
        return dt.isoformat()
    except ValueError:
        return None


def md_to_html(text: str) -> str:
    """Convert recovered markdown-ish body text to simple sanitized HTML."""
    if not text:
        return ""
    # Drop repeated title/byline noise lines (all-caps title echoes, bare ** **).
    lines = [ln.strip() for ln in text.splitlines()]
    paras: list[str] = []
    buf: list[str] = []
    for ln in lines:
        if not ln or ln in ("**", "****", "** **"):
            if buf:
                paras.append(" ".join(buf))
                buf = []
            continue
        buf.append(ln)
    if buf:
        paras.append(" ".join(buf))
    out = []
    for p in paras:
        p = html.escape(p)
        p = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", p)
        out.append(f"<p>{p}</p>")
    return "\n".join(out)


def load_json(path: Path, default=None):
    if not path.exists():
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def rest_upsert(base: str, secret: str, table: str, rows: list[dict]) -> tuple[int, list[dict]]:
    """Upsert rows in batches. Returns (written, errors)."""
    errors: list[dict] = []
    written = 0
    url = f"{base}/rest/v1/{table}"
    headers = {
        "apikey": secret,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    for i in range(0, len(rows), BATCH):
        chunk = rows[i : i + BATCH]
        try:
            r = requests.post(url, headers=headers, json=chunk, timeout=60)
        except Exception as e:  # noqa: BLE001
            errors.append({"table": table, "batch": i // BATCH, "error": str(e)[:300]})
            continue
        if r.status_code in (200, 201, 204):
            written += len(chunk)
        else:
            errors.append(
                {"table": table, "batch": i // BATCH, "error": f"{r.status_code}: {r.text[:300]}"}
            )
    return written, errors


def build() -> dict:
    products_raw = load_json(CLEAN / "products.enriched.json", [])
    blogs_raw = load_json(CLEAN / "blogs.enriched.json", [])
    collections_raw = load_json(CLEAN / "collections.clean.json", [])
    alt_text = load_json(CLEAN / "alt_text.json", {})
    blog_media = {b["handle"]: b for b in load_json(CLEAN / "blog_media.json", [])}
    manifest = load_json(ROOT / "data" / "r2_media_manifest.json", {})
    if not manifest:
        manifest = {"products": {}, "files": {}}
        ckpt = load_json(ROOT / "data" / "r2_upload_checkpoint.json", {})
        # Rebuild a minimal products map from the checkpoint.
        prods: dict[str, dict[str, str]] = {}
        for rel, url in ckpt.items():
            parts = Path(rel).parts
            if parts[0] == "products" and len(parts) >= 3:
                prods.setdefault(parts[1], {})[Path(parts[-1]).stem] = url
        manifest = {"products": prods, "files": ckpt}

    violations: list[str] = []
    product_ids: dict[str, int] = {}
    products: list[dict] = []
    variants: list[dict] = []
    images: list[dict] = []
    seen_variant_ids: set[int] = set()

    for idx, p in enumerate(products_raw):
        handle = p.get("handle")
        if not handle:
            violations.append(f"product idx {idx}: missing handle")
            continue
        gid = str(p.get("product_group_id") or "")
        pid = int(gid) if gid.isdigit() else PRODUCT_FALLBACK_BASE + idx
        if pid in product_ids.values():
            violations.append(f"product {handle}: id collision {pid}")
        product_ids[handle] = pid
        ts = parse_captured(p.get("captured_at"))
        products.append(
            {
                "id": pid,
                "title": (p.get("title") or handle)[:255],
                "body_html": p.get("description_html") or None,
                "vendor": (p.get("brand") or p.get("organization") or "YORD")[:255],
                "product_type": (p.get("category") or None),
                "handle": handle,
                "status": "active",
                "tags": (p.get("search_keywords") or None),
                "meta_title": (p.get("meta_title") or None),
                "meta_description": (p.get("meta_description") or None),
                "search_keywords": (p.get("search_keywords") or None),
                "created_at": ts,
                "updated_at": ts,
            }
        )
        r2imgs: dict[str, str] = (manifest.get("products") or {}).get(handle, {})
        ordered_keys = sorted(r2imgs.keys())
        srcs: list[str] = p.get("images") or []
        n = max(len(ordered_keys), len(srcs), 0)
        for pos in range(n):
            stem = ordered_keys[pos] if pos < len(ordered_keys) else None
            storage = r2imgs.get(stem) if stem else None
            if storage is None and ordered_keys:
                storage = r2imgs[ordered_keys[pos % len(ordered_keys)]]
            src = srcs[pos] if pos < len(srcs) else (srcs[0] if srcs else None)
            images.append(
                {
                    "id": pid * 1000 + pos + 1,
                    "product_id": pid,
                    "position": pos + 1,
                    "src": src or storage or "",
                    "alt": str(alt_text.get(handle, "") or "")[:512] or None,
                    "storage_url": storage,
                }
            )
        for vidx, v in enumerate(p.get("variants") or []):
            raw_vid = v.get("variant_id")
            vid = int(raw_vid) if str(raw_vid or "").isdigit() else pid * 1000 + vidx + 1
            if vid in seen_variant_ids:
                vid = pid * 1000 + vidx + 1 + 500000
            seen_variant_ids.add(vid)
            try:
                price = float(v.get("price")) if v.get("price") is not None else None
            except (TypeError, ValueError):
                price = None
            avail = str(v.get("available") or "")
            variants.append(
                {
                    "id": vid,
                    "product_id": pid,
                    "title": (v.get("title") or f"Default ({vidx + 1})")[:255],
                    "price": price,
                    "position": vidx + 1,
                    "sku": v.get("sku"),
                    "option1": (v.get("option1") or None),
                    "option2": (v.get("option2") or None),
                    "inventory_quantity": 100 if avail == "InStock" else 0,
                    "inventory_policy": "deny",
                    "fulfillment_service": "manual",
                    "requires_shipping": True,
                    "taxable": True,
                }
            )

    collections: list[dict] = []
    collection_ids: dict[str, int] = {}
    for idx, c in enumerate(collections_raw):
        handle = c.get("handle")
        if not handle:
            violations.append(f"collection idx {idx}: missing handle")
            continue
        cid = COLLECTION_BASE + idx
        collection_ids[handle] = cid
        img = (c.get("images") or [None])[0]
        collections.append(
            {
                "id": cid,
                "title": (c.get("label") or c.get("title") or handle)[:255],
                "handle": handle,
                "body_html": c.get("description") or None,
                "collection_type": "custom",
                "published": True,
                "image_src": img,
            }
        )

    collects: list[dict] = []
    seq = 0
    for c in collections_raw:
        ch = c.get("handle")
        cid = collection_ids.get(ch)
        if cid is None:
            continue
        for pos, ph in enumerate(c.get("products") or []):
            pid = product_ids.get(ph)
            if pid is None:
                violations.append(f"collect {ch}: unknown product {ph}")
                continue
            collects.append(
                {
                    "id": COLLECT_BASE + seq,
                    "collection_id": cid,
                    "product_id": pid,
                    "position": pos + 1,
                }
            )
            seq += 1

    blogs = [
        {
            "id": BLOG_ID,
            "title": BLOG_TITLE,
            "handle": "blog",
            "commentable": "no",
        }
    ]
    articles: list[dict] = []
    for idx, a in enumerate(blogs_raw):
        handle = a.get("handle") or a.get("slug")
        if not handle:
            violations.append(f"article idx {idx}: missing handle")
            continue
        body = md_to_html(a.get("body_text") or a.get("description") or "")
        summary = a.get("summary") or (a.get("body_text") or "")[:300]
        bm = blog_media.get(handle, {})
        storage = None
        og = bm.get("og_image")
        if og:
            og_key = og.replace("local_media/", "", 1)
            storage = (manifest.get("files") or {}).get(og_key)
        articles.append(
            {
                "id": ARTICLE_BASE + idx,
                "blog_id": BLOG_ID,
                "title": (a.get("title") or handle)[:255],
                "handle": handle,
                "author": a.get("author") or "YORD India",
                "body_html": body or None,
                "summary_html": f"<p>{html.escape(summary[:500])}</p>" if summary else None,
                "tags": (a.get("search_keywords") or None),
                "image_src": og,
                "storage_image_url": storage,
                "published": True,
                "published_at": a.get("date_published"),
                "created_at": a.get("date_published"),
                "updated_at": a.get("date_modified") or a.get("date_published"),
            }
        )

    return {
        "blogs": blogs,
        "products": products,
        "product_variants": variants,
        "product_images": images,
        "collections": collections,
        "collects": collects,
        "articles": articles,
        "violations": violations,
        "counts": {
            "products": len(products),
            "variants": len(variants),
            "images": len(images),
            "collections": len(collections),
            "collects": len(collects),
            "articles": len(articles),
        },
    }


def main() -> int:
    parser = create_parser("Ingest data/clean enriched dataset into Supabase")
    parser.add_argument("--only", default="all",
                        choices=("all", "blogs", "products", "product_variants",
                                 "product_images", "collections", "collects", "articles"))
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    configure_logging(args.verbose)
    execute = resolve_execute(args)

    data = build()
    counts = data["counts"]
    print("Planned rows:")
    for k, v in counts.items():
        print(f"  {k:<18} {v:>6}")
    print(f"Violations: {len(data['violations'])}")
    for v in data["violations"][:20]:
        print(f"  ! {v}")

    if not execute:
        print("\nDRY-RUN: nothing written. Pass --execute to upsert.")
        return 0

    base = resolve_supabase_url()
    secret = resolve_supabase_secret_key()
    if not base or not secret:
        print("FAIL: missing SUPABASE URL/secret in .env")
        return 1

    order = ["blogs", "products", "product_variants", "product_images",
             "collections", "collects", "articles"]
    if args.only != "all":
        order = [args.only]
    total = 0
    all_errors: list[dict] = []
    for table in order:
        rows = data[table]
        if args.limit > 0:
            rows = rows[: args.limit]
        print(f"Upserting {table}: {len(rows)} rows...")
        written, errors = rest_upsert(base, secret, table, rows)
        total += written
        all_errors.extend(errors)
        print(f"  wrote {written}, errors {len(errors)}")
        for e in errors[:5]:
            print(f"    - {e}")

    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump({"counts": counts, "written": total,
                   "errors": all_errors,
                   "at": datetime.now(timezone.utc).isoformat()}, f, indent=1)
    print(f"\nWrote {total} rows. Log: {LOG_FILE}")
    return 1 if all_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
