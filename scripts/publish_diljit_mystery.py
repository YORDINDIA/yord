#!/usr/bin/env python3
"""Publish the Diljit Dosanjh Mystery tee -- the one buyable Diljit listing.

The other 26 Diljit products are taken to zero stock by
`set_diljit_stock.py`; this is the single listing that must keep selling, so it
is built the same way `publish_diljit_listings.py::publish` builds a design tee
(product draft first, activated only once every child row is in) with three
deliberate differences:

  * price is Rs1,100, not the line's Rs1,499 -- owner-set, and it is the only
    Diljit product at that price;
  * the imagery comes from `make_mystery_art.py`, not a designer artboard;
  * it joins `random-designs` as well as the campaign collection, because the
    randomness is the product.

`tidy_collections.py` adds `clothing` and `oversized` afterwards from the
product type and the "oversized" tag, so those two are not written here.

Usage:
    python3 publish_diljit_mystery.py             # dry run
    python3 publish_diljit_mystery.py --execute   # write to Supabase + R2
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

from publish_diljit_listings import (  # noqa: E402
    existing_product_id,
    next_id,
    verify_url,
)
from utils.config import resolve_supabase_url  # noqa: E402
from utils.r2_helpers import upload_product_image  # noqa: E402
from utils.supabase_helpers import get_supabase_client  # noqa: E402

TITLE = "Diljit Dosanjh Mystery Random Design Oversized T-Shirt"
HANDLE = "diljit-dosanjh-mystery-random-design-oversized-t-shirt"
VENDOR = "Diljit Dosanjh"
PRODUCT_TYPE = "T-Shirts"
PRICE = 1100.00
INVENTORY = 100
SIZES = ["XS", "S", "M", "L", "XL", "2XL"]

# `diljit-dosanjh` because the Aura quiz campaign discounts that collection;
# `random-designs` because that is what this product is. Both are curated
# (rule-free) in tidy_collections.py, so neither membership is ever rewritten.
COLLECTIONS = ["diljit-dosanjh", "random-designs"]

# "oversized" is load-bearing: tidy_collections.py files any product whose tags
# or title contain it into the `oversized` fit collection. Deliberately no
# "hoodie" token, and nothing that could re-file it as a different garment.
TAGS = (
    "diljit dosanjh t-shirt, diljit dosanjh mystery tee, diljit dosanjh fan "
    "merchandise, random design t-shirt, oversized t-shirt india, concert merch "
    "india, buy t-shirt online india"
)

META_TITLE = "Diljit Dosanjh Mystery Tee | Random Design T-Shirt"
META_DESCRIPTION = (
    "One random Diljit Dosanjh oversized t-shirt, chosen from the collection. "
    "240 GSM bio-washed cotton, XS to 2XL. Free shipping across India."
)
SEARCH_KEYWORDS = (
    "diljit dosanjh mystery tee, diljit dosanjh random t-shirt, diljit dosanjh "
    "fan merchandise, mystery t-shirt india, random design t-shirt, oversized "
    "t-shirt india, punjabi t-shirt, concert merch india"
)

BODY_HTML = (
    "<p>One tee, one design, chosen at random from the Diljit Dosanjh "
    "collection. You pick the size &mdash; we pick the print.</p>"
    "<p>Cut oversized from 240 GSM bio-washed cotton with half sleeves and a "
    "drop shoulder, it drapes the way a concert tee should. The DTF print keeps "
    "every edge crisp, wash after wash.</p>"
    "<ul>"
    "<li>100% pure cotton, bio-washed, 240 GSM</li>"
    "<li>Oversized unisex fit with half sleeves</li>"
    "<li>One randomly selected design per order, never chosen by you</li>"
    "<li>Sizes XS to 2XL</li>"
    "</ul>"
    "<p><strong>Please note:</strong> because the design is random, Mystery "
    "orders are not eligible for returns or replacements on the grounds of "
    "which print you received. Size exchanges work exactly as they do on every "
    "other tee.</p>"
    "<p>Free shipping across India.</p>"
)

GALLERY = [
    {
        "slot": "01-cover",
        "file": "01-cover.png",
        "alt": f"{TITLE} — front print",
    },
    {
        "slot": "02-model",
        "file": "02-model.png",
        "alt": f"{TITLE} — worn shot",
    },
    {
        "slot": "03-what-you-get",
        "file": "03-what-you-get.png",
        "alt": "Twelve Diljit Dosanjh designs the Mystery tee is drawn from",
    },
]

ASSET_DIR = ROOT / "agnes-out" / "diljit-listings" / HANDLE


def gallery_plan() -> list[dict]:
    plan = []
    for item in GALLERY:
        path = ASSET_DIR / item["file"]
        if not path.exists():
            raise RuntimeError(f"missing gallery image {path.relative_to(ROOT)}")
        plan.append({**item, "path": path})
    return plan


def upload_images() -> list[dict]:
    rows = []
    for item in gallery_plan():
        key = f"products/{HANDLE}/{item['slot']}"
        url, error = upload_product_image(key, item["path"].read_bytes())
        if error or not url:
            raise RuntimeError(f"upload failed for {key}: {error}")
        if not verify_url(url):
            raise RuntimeError(f"uploaded but not reachable: {url}")
        print(f"    uploaded {item['slot']} -> {url.rsplit('/', 1)[-1]}")
        rows.append({"slot": item["slot"], "url": url, "alt": item["alt"]})
    return rows


def ensure_collect(supabase, product_id: int, handle: str, now: str) -> int | None:
    """Add membership only when missing; never republish a hidden collection."""
    found = supabase.table("collections").select("id, published").eq("handle", handle).execute().data
    if not found:
        raise RuntimeError(f"collection {handle} not found")
    collection_id = found[0]["id"]

    existing = (
        supabase.table("collects").select("id, position")
        .eq("collection_id", collection_id)
        .eq("product_id", product_id)
        .execute()
        .data
    )
    if existing:
        print(f"    already in {handle}")
        return existing[0]["position"]

    collected = (
        supabase.table("collects").select("position").eq("collection_id", collection_id).execute().data
    )
    position = max([row["position"] or 0 for row in collected] or [0]) + 1
    supabase.table("collects").insert({
        "id": next_id(supabase, "collects"),
        "collection_id": collection_id,
        "product_id": product_id,
        "position": position,
        "created_at": now,
    }).execute()
    print(f"    added to {handle} at position {position}")

    if not found[0]["published"]:
        print(f"    WARNING: {handle} is unpublished; left as-is")
    return position


def snapshot(supabase, handle: str) -> Path:
    """Pre-write copy of anything this run could overwrite (usually nothing)."""
    payload = {
        "handle": handle,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "product": supabase.table("products").select("*").eq("handle", handle).execute().data,
    }
    path = SCRIPTS_DIR / f"diljit_mystery_snapshot-{datetime.now():%Y%m%d-%H%M%S}.json"
    path.write_text(json.dumps(payload, indent=2, default=str))
    return path


def publish(supabase, images: list[dict]) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    product_id = next_id(supabase, "products")
    variant_ids = [next_id(supabase, "product_variants") for _ in SIZES]

    # Draft, not active: a shopper landing between this insert and the last
    # child write would otherwise see a published product with no sizes and no
    # images. The flip below is the single moment it goes public.
    supabase.table("products").insert({
        "id": product_id,
        "title": TITLE,
        "handle": HANDLE,
        "body_html": BODY_HTML,
        "vendor": VENDOR,
        "product_type": PRODUCT_TYPE,
        "status": "draft",
        "published_at": None,
        "published_scope": "web",
        "tags": TAGS,
        "meta_title": META_TITLE,
        "meta_description": META_DESCRIPTION,
        "search_keywords": SEARCH_KEYWORDS,
        "created_at": now,
        "updated_at": now,
    }).execute()

    supabase.table("product_variants").insert([
        {
            "id": vid,
            "product_id": product_id,
            "title": size,
            "price": PRICE,
            "compare_at_price": None,
            "position": index + 1,
            "inventory_quantity": INVENTORY,
            "inventory_policy": "deny",
            "inventory_management": None,
            "requires_shipping": True,
            "taxable": True,
            "option1": size,
            "created_at": now,
            "updated_at": now,
        }
        for index, (size, vid) in enumerate(zip(SIZES, variant_ids))
    ]).execute()

    # ProductInfo renders the size picker only when product_options is present.
    supabase.table("product_options").insert({
        "id": next_id(supabase, "product_options"),
        "product_id": product_id,
        "name": "Size",
        "position": 1,
        "values": SIZES,
    }).execute()

    supabase.table("product_images").insert([
        {
            "id": next_id(supabase, "product_images"),
            "product_id": product_id,
            "position": index + 1,
            "src": image["url"],
            "storage_url": image["url"],
            "alt": image["alt"],
            "created_at": now,
            "updated_at": now,
        }
        for index, image in enumerate(images)
    ]).execute()

    for handle in COLLECTIONS:
        ensure_collect(supabase, product_id, handle, now)

    supabase.table("products").update({
        "status": "active",
        "published_at": now,
        "updated_at": now,
    }).eq("id", product_id).execute()

    return {
        "handle": HANDLE,
        "product_id": product_id,
        "variants": len(variant_ids),
        "images": len(images),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="write to Supabase + R2")
    args = parser.parse_args()

    plan = gallery_plan()
    print(f"{TITLE}\n  handle   {HANDLE}")
    print(f"  price    Rs{PRICE:,.0f}  ({len(SIZES)} sizes: {', '.join(SIZES)})")
    print(f"  stock    {INVENTORY} per size")
    print(f"  type     {PRODUCT_TYPE} / vendor {VENDOR}")
    print(f"  images   {len(plan)}: {', '.join(i['slot'] for i in plan)}")
    print(f"  collects {', '.join(COLLECTIONS)}  (+ clothing, oversized via tidy)")

    if not args.execute:
        print("\nDRY RUN -- nothing written. Pass --execute to publish.")
        return 0

    supabase = get_supabase_client()
    print(f"\ncredentials: {resolve_supabase_url()}")

    old_id = existing_product_id(supabase, HANDLE)
    if old_id is not None:
        print(f"  already exists ({old_id}) -- refusing to create a duplicate.", file=sys.stderr)
        return 1

    snap = snapshot(supabase, HANDLE)
    print(f"snapshot: {snap.relative_to(ROOT)}\n")

    images = upload_images()
    try:
        result = publish(supabase, images)
    except Exception as error:
        print(f"\nFAILED after uploads: {error}", file=sys.stderr)
        print("The product may be left in draft; re-run --execute after inspecting.", file=sys.stderr)
        return 1

    print(f"\npublished {result['handle']} (id {result['product_id']})")
    print(f"  {result['variants']} variants, {result['images']} images")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
