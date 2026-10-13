#!/usr/bin/env python3
"""Publish the merged Punjabi Aa Gaye Oye listing; retire the two single-design ones.

Owner direction (2026-10-05): instead of a Text tee and a Map tee, there is ONE
tee with the TextOnly design on the front and the Map design on the back. This
script writes the same row set the admin's `createProductAction` would:

    products          status active, vendor "Diljit Dosanjh" (drives the
                      artist link + accent on the product page), SEO columns,
                      published_at = now (feeds `newest` sorting)
    product_variants  6 sizes XS..2XL, allocated in order so the size picker
                      renders in order (the page sorts variants by id)
    product_options   one "Size" option -- ProductInfo only renders the size
                      selector when product_options is non-empty
    product_images    4 rows, gallery order: front flat (chest print) -> back
                      flat (map print) -> model front -> model back; src and
                      storage_url both point at R2
    collects          one row in the diljit-dosanjh collection

It then retires the two previous listings (`RETIRE_HANDLES`) **without deleting
them**: status -> draft (so `getProductByHandleStatic` 404s and every catalog
query filters them out) and their collects rows are removed (the artist rail
counts collects rows, so a retired product must not keep inflating the tile).
Their rows and R2 objects stay in place as a rollback path.

Before any write, a snapshot of every affected row (both old products with
variants/options/images/collects, the merged product if it already exists, and
the collection row) is written to
`scripts/punjabi_tee_merge_snapshot-<timestamp>.json`. There is no automatic
restore -- re-insert by hand from that file if needed.

The `diljit-dosanjh` collection is left published; its `published_at` is only
written when the collection was unpublished (a re-publish stamp, not a rewrite).

Dry-run is the default. `--execute` writes; `--replace` rebuilds an existing
row with the merged handle first (cascades to its variants/images).

Usage:
    python publish_punjabi_tee_listings.py                 # plan only
    python publish_punjabi_tee_listings.py --execute       # upload + insert + retire
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent))

from utils.config import resolve_supabase_secret_key, resolve_supabase_url  # noqa: E402
from utils.r2_helpers import upload_product_image  # noqa: E402
from utils.supabase_helpers import get_supabase_client  # noqa: E402

load_dotenv()

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent
PLATES = ROOT / "agnes-out" / "punjabi-tees"
FINAL = PLATES / "final"

COLLECTION_HANDLE = "diljit-dosanjh"
PRICE = 1499
INVENTORY = 100
SIZES = ["XS", "S", "M", "L", "XL", "2XL"]

# The two single-design listings this merged product replaces. Retired as draft,
# never deleted (rollback path; see the module docstring).
RETIRE_HANDLES = [
    "diljit-dosanjh-punjabi-aa-gaye-oye-text-tee",
    "diljit-dosanjh-punjabi-aa-gaye-oye-map-tee",
]

BODY_COMMON = (
    "<p>Cut oversized from 240 GSM bio-washed cotton with half sleeves and a "
    "drop shoulder, it drapes the way a concert tee should. The DTF prints keep "
    "every Gurmukhi stroke crisp, wash after wash.</p>"
    "<ul>"
    "<li>100% pure cotton, bio-washed, 240 GSM</li>"
    "<li>Oversized unisex fit with half sleeves</li>"
    "<li>Exclusive YORD India design for Diljit Dosanjh fans</li>"
    "</ul>"
)

PRODUCT = {
    "handle": "diljit-dosanjh-punjabi-aa-gaye-oye-oversized-t-shirt",
    "title": "Punjabi Aa Gaye Oye Oversized T-Shirt — Diljit Dosanjh",
    "body_html": (
        "<p>The line that fills every stadium, printed exactly as it sounds. "
        "<strong>ਪੰਜਾਬੀ ਆ ਗਏ ਓਏ</strong> runs across the chest in soft cream ink, "
        "and the full back carries Punjab's outline wreathed in hand-drawn "
        "florals with the same Gurmukhi line beneath — a front-and-back salute "
        "to Diljit Dosanjh and the Dil-Luminati era.</p>" + BODY_COMMON
    ),
    "tags": (
        "diljit dosanjh t-shirt, diljit dosanjh fan merchandise, punjabi aa gaye "
        "oye, gurmukhi t-shirt, punjab map t-shirt, oversized t-shirt india, "
        "dil-luminati tour merch, concert merch india, buy t-shirt online india"
    ),
    "meta_title": "Punjabi Aa Gaye Oye Oversized T-Shirt | Diljit Dosanjh",
    "meta_description": (
        "Gurmukhi chest print and Punjab map back print in cream on black 240 "
        "GSM cotton. Diljit Dosanjh fan merchandise, oversized unisex fit. Free "
        "shipping on all orders."
    ),
    "search_keywords": (
        "diljit dosanjh t-shirt, punjabi aa gaye oye, punjab map t-shirt, "
        "gurmukhi t-shirt, dil-luminati merch, oversized black t-shirt india, "
        "punjabi fan merchandise"
    ),
    "images": [
        ("01-front-flat", FINAL / "diljit-dosanjh-punjabi-aa-gaye-oye-oversized-t-shirt__01-front-flat.png",
         "Punjabi Aa Gaye Oye tee — cream Gurmukhi chest print on black"),
        ("02-back-flat", FINAL / "diljit-dosanjh-punjabi-aa-gaye-oye-oversized-t-shirt__02-back-flat.png",
         "Punjabi Aa Gaye Oye tee — Punjab map and floral back print"),
        ("03-model-front", FINAL / "diljit-dosanjh-punjabi-aa-gaye-oye-oversized-t-shirt__03-model-front.png",
         "Punjabi Aa Gaye Oye tee worn — chest print in the street"),
        ("04-model-back", FINAL / "diljit-dosanjh-punjabi-aa-gaye-oye-oversized-t-shirt__04-model-back.png",
         "Punjabi Aa Gaye Oye tee worn — full back print in the street"),
    ],
}


def next_id(supabase, table: str) -> int:
    return supabase.rpc("admin_next_id", {"p_table": table}).execute().data


def verify_url(url: str) -> bool:
    try:
        response = requests.get(url, timeout=60, stream=True)
        ok = response.status_code == 200
        response.close()
        return ok
    except requests.RequestException:
        return False


def read_product_bundle(supabase, handle: str) -> dict | None:
    """Every row a handle owns, in the shape the snapshot stores it."""
    product = supabase.table("products").select("*").eq("handle", handle).execute().data
    if not product:
        return None
    product_id = product[0]["id"]
    return {
        "product": product[0],
        "variants": supabase.table("product_variants").select("*").eq("product_id", product_id).execute().data,
        "options": supabase.table("product_options").select("*").eq("product_id", product_id).execute().data,
        "images": supabase.table("product_images").select("*").eq("product_id", product_id).execute().data,
        "collects": supabase.table("collects").select("*").eq("product_id", product_id).execute().data,
    }


def write_snapshot(supabase) -> Path:
    """Pre-run copy of every row this script can change. Never overwritten."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    path = SCRIPTS_DIR / f"punjabi_tee_merge_snapshot-{stamp}.json"
    collection = supabase.table("collections").select("*").eq("handle", COLLECTION_HANDLE).execute().data
    collection_id = collection[0]["id"] if collection else None
    snapshot = {
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "collection": collection[0] if collection else None,
        "collection_collects": (
            supabase.table("collects").select("*").eq("collection_id", collection_id).execute().data
            if collection_id else []
        ),
        "products": {
            handle: read_product_bundle(supabase, handle)
            for handle in RETIRE_HANDLES + [PRODUCT["handle"]]
        },
    }
    path.write_text(json.dumps(snapshot, indent=2, default=str))
    return path


def upload_images(product: dict) -> list[dict]:
    rows = []
    for slot, path, alt in product["images"]:
        if not path.exists():
            raise FileNotFoundError(f"missing image for {product['handle']}: {path}")
        key = f"products/{product['handle']}/{slot}"
        url, error = upload_product_image(
            key, path.read_bytes(), content_type="image/png"
        )
        if error or not url:
            raise RuntimeError(f"upload failed for {key}: {error}")
        if not verify_url(url):
            raise RuntimeError(f"uploaded but not reachable: {url}")
        print(f"  uploaded {slot} -> {url}")
        rows.append({"slot": slot, "url": url, "alt": alt})
    return rows


def publish(supabase, product: dict, images: list[dict], replace: bool) -> dict:
    existing = supabase.table("products").select("id").eq("handle", product["handle"]).execute()
    if existing.data:
        if not replace:
            raise RuntimeError(
                f"a product with handle {product['handle']} already exists "
                f"(id {existing.data[0]['id']}); re-run with --replace to rebuild it"
            )
        old_id = existing.data[0]["id"]
        supabase.table("collects").delete().eq("product_id", old_id).execute()
        supabase.table("products").delete().eq("id", old_id).execute()
        print(f"  replaced existing product {old_id}")

    now = datetime.now(timezone.utc).isoformat()
    product_id = next_id(supabase, "products")
    variant_ids = [next_id(supabase, "product_variants") for _ in SIZES]
    option_id = next_id(supabase, "product_options")
    image_ids = [next_id(supabase, "product_images") for _ in images]

    supabase.table("products").insert({
        "id": product_id,
        "title": product["title"],
        "handle": product["handle"],
        "body_html": product["body_html"],
        "vendor": "Diljit Dosanjh",
        "product_type": "T-Shirts",
        "status": "active",
        "published_at": now,
        "published_scope": "web",
        "tags": product["tags"],
        "meta_title": product["meta_title"],
        "meta_description": product["meta_description"],
        "search_keywords": product["search_keywords"],
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

    supabase.table("product_options").insert({
        "id": option_id,
        "product_id": product_id,
        "name": "Size",
        "position": 1,
        "values": SIZES,
    }).execute()

    supabase.table("product_images").insert([
        {
            "id": image_ids[index],
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

    collection = supabase.table("collections").select("id, published").eq("handle", COLLECTION_HANDLE).execute()
    if not collection.data:
        raise RuntimeError(f"collection {COLLECTION_HANDLE} not found")
    collection_id = collection.data[0]["id"]
    collected = supabase.table("collects").select("position").eq("collection_id", collection_id).execute()
    position = max([row["position"] or 0 for row in collected.data] or [0]) + 1

    supabase.table("collects").insert({
        "id": next_id(supabase, "collects"),
        "collection_id": collection_id,
        "product_id": product_id,
        "position": position,
        "created_at": now,
    }).execute()

    if not collection.data[0]["published"]:
        # Re-publish stamp only; a published collection keeps its published_at.
        supabase.table("collections").update({
            "published": True,
            "published_at": now,
            "updated_at": now,
        }).eq("id", collection_id).execute()
        print(f"  collection {COLLECTION_HANDLE} was unpublished -> published")
    else:
        print(f"  collection {COLLECTION_HANDLE} already published; published_at preserved")

    return {
        "handle": product["handle"],
        "product_id": product_id,
        "variants": len(variant_ids),
        "images": len(image_ids),
        "collection_id": collection_id,
        "collect_position": position,
    }


def retire(supabase, handle: str) -> dict | None:
    """Draft a retired listing and drop its collects rows (rows stay in place)."""
    rows = supabase.table("products").select("id, status").eq("handle", handle).execute().data
    if not rows:
        print(f"  {handle}: not present, nothing to retire")
        return None
    product_id = rows[0]["id"]
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("collects").delete().eq("product_id", product_id).execute()
    supabase.table("products").update({
        "status": "draft",
        "updated_at": now,
    }).eq("id", product_id).execute()
    print(f"  {handle}: status {rows[0]['status']} -> draft, collects removed")
    return {"handle": handle, "product_id": product_id, "previous_status": rows[0]["status"]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="upload + write rows")
    parser.add_argument("--replace", action="store_true", help="rebuild an existing merged product row")
    args = parser.parse_args()

    supabase = get_supabase_client()
    print(f"target: {resolve_supabase_url()}")
    print(f"collection: {COLLECTION_HANDLE} | price ₹{PRICE} | sizes {'/'.join(SIZES)}")
    print(f"\nmerged listing: {PRODUCT['handle']}")
    print(f"  title: {PRODUCT['title']}")
    for slot, path, _alt in PRODUCT["images"]:
        print(f"  image {slot}: {path.relative_to(ROOT)} ({'ok' if path.exists() else 'MISSING'})")
    print("\nretires (draft, collects removed, rows kept):")
    for handle in RETIRE_HANDLES:
        rows = supabase.table("products").select("id, status").eq("handle", handle).execute().data
        state = f"id {rows[0]['id']}, status {rows[0]['status']}" if rows else "not present"
        print(f"  {handle}: {state}")

    if not args.execute:
        print("\ndry run: nothing uploaded, nothing written. Use --execute.")
        return 0

    snapshot_path = write_snapshot(supabase)
    print(f"\nsnapshot: {snapshot_path}")

    print(f"\n{PRODUCT['handle']}")
    images = upload_images(PRODUCT)
    summary = publish(supabase, PRODUCT, images, args.replace)

    print("\nretiring old listings:")
    retired = [entry for entry in (retire(supabase, h) for h in RETIRE_HANDLES) if entry]

    print("\npublished:")
    print(json.dumps(summary, indent=2))
    if retired:
        print("retired:")
        print(json.dumps(retired, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
