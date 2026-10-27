#!/usr/bin/env python3
"""Take the Diljit Dosanjh catalog to zero stock, sparing the Mystery tee.

Stock in this schema is `product_variants.inventory_quantity`, and zero is a
real block, not a label: `frontend/src/lib/validate-cart.ts` rejects the line
with OUT_OF_STOCK before Razorpay is touched, and `apply_checkout_stock`
re-checks after capture. Nothing here hides products -- the catalog has no
default stock filter, so every listing still appears and renders "Sold out".

Scope:
  * every `diljit-dosanjh-*` product whose status is `active`
  * except the Mystery tee, which must stay sellable
  * draft products are left alone: they are not visible, and zeroing them would
    silently pre-break a listing somebody later publishes on purpose

The pre-write quantities go to `scripts/diljit_stock_snapshot-<timestamp>.json`
before anything is written; `--restore` is the way back.

Usage:
    python3 set_diljit_stock.py                    # dry run (default)
    python3 set_diljit_stock.py --execute          # snapshot, then write
    python3 set_diljit_stock.py --restore <file>   # put the quantities back
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent
sys.path.insert(0, str(SCRIPTS_DIR))

load_dotenv(ROOT / ".env")

from utils.config import resolve_supabase_url  # noqa: E402
from utils.supabase_helpers import get_supabase_client  # noqa: E402

PREFIX = "diljit-dosanjh-"
MYSTERY_HANDLE = "diljit-dosanjh-mystery-random-design-oversized-t-shirt"
TARGET_QUANTITY = 0


def _page(query, size: int = 1000) -> list[dict]:
    """PostgREST caps a response at 1000 rows; walk the range instead."""
    rows: list[dict] = []
    start = 0
    while True:
        batch = query.range(start, start + size - 1).execute().data
        rows += batch
        if len(batch) < size:
            return rows
        start += size


def load_products(supabase) -> list[dict]:
    return _page(
        supabase.table("products")
        .select("id,handle,title,status")
        .like("handle", f"{PREFIX}%")
        .order("id")
    )


def load_variants(supabase, product_ids: list[int]) -> list[dict]:
    if not product_ids:
        return []
    rows: list[dict] = []
    chunk = 100
    for i in range(0, len(product_ids), chunk):
        rows += _page(
            supabase.table("product_variants")
            .select("id,product_id,title,inventory_quantity,inventory_policy")
            .in_("product_id", product_ids[i:i + chunk])
            .order("id")
        )
    return rows


def build_plan(supabase) -> tuple[list[dict], list[dict], list[dict]]:
    """Returns (targets, spared, drafts) with their variants attached."""
    products = load_products(supabase)
    targets = [
        p for p in products
        if p["status"] == "active" and p["handle"] != MYSTERY_HANDLE
    ]
    spared = [p for p in products if p["handle"] == MYSTERY_HANDLE]
    drafts = [p for p in products if p["status"] != "active"]

    variants = load_variants(supabase, [p["id"] for p in targets])
    by_product: dict[int, list[dict]] = {}
    for v in variants:
        by_product.setdefault(v["product_id"], []).append(v)
    for p in targets:
        p["variants"] = sorted(by_product.get(p["id"], []), key=lambda v: v["id"])

    spared_variants = load_variants(supabase, [p["id"] for p in spared])
    for p in spared:
        p["variants"] = sorted(
            (v for v in spared_variants if v["product_id"] == p["id"]), key=lambda v: v["id"]
        )
    return targets, spared, drafts


def show(targets: list[dict], spared: list[dict], drafts: list[dict]) -> int:
    changed = 0
    print(f"{'product':62} {'variants':>8} {'stock':>12}")
    print("-" * 86)
    for p in targets:
        quantities = sorted({v["inventory_quantity"] for v in p["variants"]})
        before = ", ".join(str(q) for q in quantities) if quantities else "no variants"
        delta = [v for v in p["variants"] if v["inventory_quantity"] != TARGET_QUANTITY]
        changed += len(delta)
        short = p["handle"].removeprefix(PREFIX)
        print(f"  {short:60} {len(p['variants']):>8} {before:>12} -> {TARGET_QUANTITY}")

    print()
    for p in spared:
        quantities = sorted({v["inventory_quantity"] for v in p["variants"]})
        print(f"  SPARED  {p['handle']}")
        print(f"          {len(p['variants'])} variants, stock {quantities} -- stays buyable")
    for p in drafts:
        print(f"  DRAFT   {p['handle']}  (hidden, untouched)")

    total = sum(len(p["variants"]) for p in targets)
    print(f"\n{len(targets)} active products, {total} variants, {changed} need a write")
    return changed


def snapshot(supabase, targets: list[dict], spared: list[dict]) -> Path:
    payload = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "target_quantity": TARGET_QUANTITY,
        "spared": [p["handle"] for p in spared],
        "variants": [
            {
                "id": v["id"],
                "product_id": p["id"],
                "handle": p["handle"],
                "title": v["title"],
                "inventory_quantity": v["inventory_quantity"],
            }
            for p in targets
            for v in p["variants"]
        ],
    }
    path = SCRIPTS_DIR / f"diljit_stock_snapshot-{datetime.now():%Y%m%d-%H%M%S}.json"
    path.write_text(json.dumps(payload, indent=2))
    return path


def apply(supabase, targets: list[dict]) -> int:
    """One update per distinct prior quantity keeps the statement count small."""
    by_quantity: dict[int, list[int]] = {}
    for p in targets:
        for v in p["variants"]:
            if v["inventory_quantity"] != TARGET_QUANTITY:
                by_quantity.setdefault(v["inventory_quantity"], []).append(v["id"])

    written = 0
    for quantity, ids in by_quantity.items():
        for i in range(0, len(ids), 200):
            chunk = ids[i:i + 200]
            supabase.table("product_variants").update({
                "inventory_quantity": TARGET_QUANTITY,
            }).in_("id", chunk).execute()
            written += len(chunk)
        print(f"  {len(ids)} variants: {quantity} -> {TARGET_QUANTITY}")
    return written


def restore(supabase, path: Path) -> int:
    payload = json.loads(path.read_text())
    rows = payload.get("variants", [])
    if not rows:
        print(f"{path}: no variants in snapshot", file=sys.stderr)
        return 1

    by_quantity: dict[int, list[int]] = {}
    for row in rows:
        by_quantity.setdefault(int(row["inventory_quantity"]), []).append(int(row["id"]))

    restored = 0
    for quantity, ids in sorted(by_quantity.items()):
        for i in range(0, len(ids), 200):
            chunk = ids[i:i + 200]
            supabase.table("product_variants").update({
                "inventory_quantity": quantity,
            }).in_("id", chunk).execute()
            restored += len(chunk)
        print(f"  {len(ids)} variants -> {quantity}")
    print(f"\nrestored {restored} variants from {path.name}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="snapshot, then write")
    parser.add_argument("--restore", metavar="SNAPSHOT", help="restore quantities from a snapshot")
    args = parser.parse_args()

    supabase = get_supabase_client()
    print(f"credentials: {resolve_supabase_url()}\n")

    if args.restore:
        path = Path(args.restore)
        if not path.is_absolute():
            path = (ROOT / args.restore) if (ROOT / args.restore).exists() else SCRIPTS_DIR / args.restore
        return restore(supabase, path)

    targets, spared, drafts = build_plan(supabase)
    changed = show(targets, spared, drafts)

    if not args.execute:
        print("\nDRY RUN -- nothing written. Pass --execute to zero the stock.")
        return 0

    if not targets:
        print("\nnothing to do", file=sys.stderr)
        return 1

    snap = snapshot(supabase, targets, spared)
    print(f"\nsnapshot: {snap.relative_to(ROOT)}\n")
    written = apply(supabase, targets)
    print(f"\nzeroed {written} variants across {len(targets)} Diljit products")
    print(f"{MYSTERY_HANDLE} left at", [v["inventory_quantity"] for v in spared[0]["variants"]][:1] if spared else "MISSING")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
