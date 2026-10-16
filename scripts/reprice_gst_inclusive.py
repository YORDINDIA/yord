#!/usr/bin/env python3
"""
Reprice the catalog to GST-inclusive pricing.

Why this exists
---------------
The storefront used to display an ex-GST price and add 18% at checkout. Google
Merchant Center (India) requires the feed price to INCLUDE GST and to match the
landing page price, and the true GST slab for garments is 5% up to (and
including) Rs 2,500 per piece (18% above it), not a flat 18%. The storefront
now treats stored prices as the final amount the customer pays and extracts the
GST component for the order record (see `frontend/src/lib/pricing.ts`), so this
script rescales the stored prices so the seller's NET per piece is unchanged:

    new = round(old * (1 + rate)),  rate = 5% if old <= 2500 else 18%

A repriced value that would cross INTO the 18% slab is capped at Rs 2,500 (a
Rs 2,400 piece stays a 5% piece instead of becoming a Rs 2,520 / 18% one).
`compare_at_price` is scaled with the same rule; when a repriced anchor would
stop showing a discount it is REMOVED (set to NULL) and reported — never
invented upward.

ORDER OF OPERATIONS — READ THIS
-------------------------------
Run this ONLY AFTER the GST-inclusive pricing code is deployed. If the old
code (which adds GST at checkout) is still live when prices are raised, every
checkout would charge new_price + 18%. Deploy first, then execute the reprice.

Usage (run from `scripts/`):
    python3 reprice_gst_inclusive.py             # dry run (default)
    python3 reprice_gst_inclusive.py --execute   # write

`--execute` writes `reprice_gst_inclusive_snapshot-<timestamp>.json` (every
variant's pre-run price and compare_at_price) to the current directory before
writing anything, one file per run, never overwritten. Undo by hand: re-apply
the snapshot values with the same per-row update this script uses.

Re-running is NOT a no-op — a second run scales everything again. A prior
snapshot file in the cwd blocks `--execute` unless `--force` is passed.

The DB trigger `trg_refresh_product_min_price` (supabase/migrations/001) keeps
the cached `products.min_price` in step on every variant write, so this script
does not touch `products` at all.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

# scripts/ modules import their helpers through the local package layout.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from utils.cli import configure_logging, create_parser, resolve_execute  # noqa: E402
from utils.supabase_helpers import get_supabase_client  # noqa: E402

LOW_RATE = Decimal("0.05")
HIGH_RATE = Decimal("0.18")
HIGH_RATE_MIN_PRICE = Decimal("2500")
PAGE_SIZE = 1000
SNAPSHOT_PREFIX = "reprice_gst_inclusive_snapshot-"


def target_price(old: Decimal) -> Decimal:
    """GST-inclusive target for an ex-GST price, capped inside its slab."""
    rate = LOW_RATE if old <= HIGH_RATE_MIN_PRICE else HIGH_RATE
    new = (old * (1 + rate)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    if old <= HIGH_RATE_MIN_PRICE and new > HIGH_RATE_MIN_PRICE:
        # Prefer the slab boundary over an 18% jump: Rs 2,400 -> Rs 2,500.
        return HIGH_RATE_MIN_PRICE
    return new


def net_of(price: Decimal) -> Decimal:
    """The seller's net for a GST-inclusive price (price / (1 + rate))."""
    rate = LOW_RATE if price <= HIGH_RATE_MIN_PRICE else HIGH_RATE
    return (price / (1 + rate)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def fetch_variants(supabase) -> list[dict]:
    rows: list[dict] = []
    start = 0
    while True:
        page = (
            supabase.table("product_variants")
            .select("id, product_id, price, compare_at_price")
            .order("id")
            .range(start, start + PAGE_SIZE - 1)
            .execute()
        )
        batch = page.data or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            return rows
        start += PAGE_SIZE


def to_decimal(value) -> Decimal | None:
    if value is None or value == "":
        return None
    return Decimal(str(value))


def plan_row(row: dict) -> dict | None:
    """The write a row needs (or None when it is already at target)."""
    old_price = to_decimal(row.get("price"))
    if old_price is None or old_price <= 0:
        return None
    new_price = target_price(old_price)

    update: dict = {}
    if new_price != old_price:
        update["price"] = new_price

    old_compare = to_decimal(row.get("compare_at_price"))
    anchor_dropped = False
    if old_compare is not None and old_compare > 0:
        new_compare = target_price(old_compare)
        if new_compare <= new_price:
            # Scaling (or the slab cap) collapsed the anchor. Dropping it is
            # the honest option; bumping it upward would invent a "was" price.
            update["compare_at_price"] = None
            anchor_dropped = True
        elif new_compare != old_compare:
            update["compare_at_price"] = new_compare

    if not update:
        return None

    return {
        "update": update,
        "old_price": old_price,
        "new_price": new_price,
        "old_compare": old_compare,
        "anchor_dropped": anchor_dropped,
    }


def jsonable(update: dict) -> dict:
    """PostgREST payload: Decimal is not JSON-serializable, float is fine."""
    return {key: (float(value) if isinstance(value, Decimal) else value) for key, value in update.items()}


def main() -> int:
    parser = create_parser("Reprice product variants to GST-inclusive (5%/18%)")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Execute even when a previous snapshot exists in this directory",
    )
    args = parser.parse_args()
    configure_logging(args.verbose)
    execute = resolve_execute(args)

    supabase = get_supabase_client()
    rows = fetch_variants(supabase)
    print(f"Read {len(rows)} product variants.")

    plans: list[tuple[dict, dict]] = []
    transitions: Counter = Counter()
    dropped_anchors: list[int] = []
    net_delta_total = Decimal("0")
    capped = 0
    for row in rows:
        plan = plan_row(row)
        if plan is None:
            continue
        plans.append((row, plan))
        transitions[(str(plan["old_price"]), str(plan["new_price"]))] += 1
        net_delta_total += net_of(plan["new_price"]) - plan["old_price"]
        if "price" in plan["update"] and plan["new_price"] == HIGH_RATE_MIN_PRICE:
            capped += 1
        if plan["anchor_dropped"]:
            dropped_anchors.append(row["id"])

    print("\nTRANSITIONS (old -> new, variants):")
    for (old, new), count in sorted(
        transitions.items(), key=lambda item: (Decimal(item[0][0]), Decimal(item[0][1]))
    ):
        print(f"  {old:>8} -> {new:>8}   {count:>5}")

    print(f"\nVariants to update: {len(plans)} of {len(rows)}")
    print(f"Landing on the Rs 2,500 slab cap: {capped}")
    print(f"Net change across all variants: {net_delta_total:+.2f} (target: ~0.00)")
    if dropped_anchors:
        print(f"\nREVIEW — compare-at anchor removed (no discount left): {dropped_anchors[:20]}")

    if not execute:
        print("\nDRY-RUN mode: no writes were made. Pass --execute to write.")
        return 0

    prior = sorted(Path.cwd().glob(f"{SNAPSHOT_PREFIX}*.json"))
    if prior and not args.force:
        print(
            f"\nREFUSING --execute: a previous snapshot exists ({prior[-1].name}).\n"
            "A second full run would scale prices again. Pass --force only if the\n"
            "earlier run did not write (check its output / this project's history)."
        )
        return 1

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    snapshot_path = Path.cwd() / f"{SNAPSHOT_PREFIX}{stamp}.json"
    snapshot = [
        {
            "id": row["id"],
            "product_id": row.get("product_id"),
            "price": row.get("price"),
            "compare_at_price": row.get("compare_at_price"),
        }
        for row, _ in plans
    ]
    snapshot_path.write_text(json.dumps(snapshot, indent=2))
    print(f"\nSnapshot written: {snapshot_path}")

    errors: list[str] = []
    for index, (row, plan) in enumerate(plans, start=1):
        try:
            (
                supabase.table("product_variants")
                .update(jsonable(plan["update"]))
                .eq("id", row["id"])
                .execute()
            )
        except Exception as error:  # one bad row must not stop the run
            errors.append(f"variant {row['id']}: {error}")
            print(f"  ERROR variant {row['id']}: {error}")
        if index % 200 == 0 or index == len(plans):
            print(f"  updated {index}/{len(plans)}")

    print(f"\nDone. Updated {len(plans) - len(errors)} variants, {len(errors)} errors.")
    print("Next: verify a product page shows the new price, then check out a test order.")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
