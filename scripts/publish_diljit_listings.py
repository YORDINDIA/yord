#!/usr/bin/env python3
"""Publish the Diljit Dosanjh listing backfill.

Writes the same row set the admin's `createProductAction` would, one listing per
design in `diljit_listing_registry.py`:

    products          status active, vendor "Diljit Dosanjh" (drives the artist
                      link + accent on the product page), SEO columns,
                      published_at = now (feeds `newest` sorting)
    product_variants  XS..2XL for tees, M..2XL for the hoodie, allocated in
                      order so the size picker renders in order
    product_options   one "Size" option -- ProductInfo only renders the size
                      selector when product_options is non-empty
    product_images    cover, model shot, then the design's verified mockups;
                      src and storage_url both point at R2
    collects          appended to the published `diljit-dosanjh` collection

Gallery order per design:

    01-cover    composited flat-lay (art on a blank black tee plate)
    02-model    composited on-body shot, same plate for every design
    03..        the design's verified mockups, best template first

A design with no flat art (mockups only) starts at 03.

Before any write, a snapshot of every row this script can touch -- all existing
products under the `diljit-dosanjh-` prefix with their variants, options,
images and collects rows, plus the collection row -- is written to
`scripts/diljit_listings_snapshot-<timestamp>.json`. There is no automatic
restore: re-insert by hand from that file if needed.

Dry-run is the default. `--execute` writes; `--only <key>` restricts the run;
`--replace` rebuilds a listing that already exists **in place**: the product
keeps its id and `published_at`, variants are matched by size so their ids
survive, and only a variant no order references is deleted (a product/variant
delete SETs NULL the `line_items` references of every historical order, which
is why the old delete-and-reinsert is gone). `--retire` unpublishes a listing
without deleting it: status goes to `draft` and its `collects` row is dropped,
because the artist rail counts `collects` rows and a retired product must not
keep inflating the tile. The row, its variants and its images stay in place
(and the R2 objects stay too), so re-publishing is a status flip.

A fresh insert goes in as a `draft` and is flipped to `active` only after every
variant, option, image and collect row has landed: a failure midway leaves a
hidden half-built listing, never a public product with nothing to buy.

Usage:
    python publish_diljit_listings.py                  # plan only
    python publish_diljit_listings.py --execute        # upload + insert
    python publish_diljit_listings.py --only jatt-life --execute
    python publish_diljit_listings.py --retire --execute
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent))

from diljit_listing_registry import (  # noqa: E402
    COLLECTION_HANDLE,
    HANDLE_PREFIX,
    INVENTORY,
    PRICE,
    VENDOR,
    build,
)
from utils.config import resolve_supabase_secret_key, resolve_supabase_url  # noqa: E402
from utils.r2_helpers import upload_product_image  # noqa: E402
from utils.supabase_helpers import get_supabase_client  # noqa: E402

load_dotenv()

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent
PLATES_DIR = ROOT / "agnes-out" / "diljit-listings"

SLOT_COVER = "01-cover"
SLOT_MODEL = "02-model"

# Listings published on 2026-10-24 from folders whose names lied, then dropped
# once the artwork was identified by eye: `...-graffiti` was built from DD004,
# which holds tour-dates mockups rather than any graffiti design. Retired rather
# than deleted so the rows and R2 objects stay as a rollback path.
#
# `...-reflective-hoodie` was retired alongside it for the same reason -- it had
# been built from four tee mockups -- but the hoodie itself is real: its art is
# `DiljitHOODIEOK.ai` and the Chandigarh/Indore photos show customers wearing it.
# It is back in the registry and rebuilt here with `--replace`, so it is not
# retired again.
RETIRED_HANDLES = [
    HANDLE_PREFIX + "punjabi-aa-gaye-oye-graffiti",
]


def next_id(supabase, table: str) -> int:
    return supabase.rpc("admin_next_id", {"p_table": table}).execute().data


def verify_url(url: str) -> bool:
    import requests

    try:
        return requests.head(url, timeout=20, allow_redirects=True).status_code == 200
    except Exception:
        return False


def read_bundle(supabase, handle: str) -> dict | None:
    """Every row belonging to one product handle, for the snapshot."""
    rows = supabase.table("products").select("*").eq("handle", handle).execute().data
    if not rows:
        return None
    product = rows[0]
    pid = product["id"]
    return {
        "product": product,
        "variants": supabase.table("product_variants").select("*").eq("product_id", pid).execute().data,
        "options": supabase.table("product_options").select("*").eq("product_id", pid).execute().data,
        "images": supabase.table("product_images").select("*").eq("product_id", pid).execute().data,
        "collects": supabase.table("collects").select("*").eq("product_id", pid).execute().data,
    }


def write_snapshot(supabase, handles: list[str]) -> Path:
    collection = supabase.table("collections").select("*").eq("handle", COLLECTION_HANDLE).execute().data
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "collection_handle": COLLECTION_HANDLE,
        "collection": collection,
        "products": {h: read_bundle(supabase, h) for h in handles},
    }
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = SCRIPTS_DIR / f"diljit_listings_snapshot-{stamp}.json"
    path.write_text(json.dumps(payload, indent=1, default=str))
    return path


def gallery_plan(record: dict) -> list[dict]:
    """Ordered gallery rows: composite cover, composite model, then mockups."""
    slots: list[dict] = []
    folder = PLATES_DIR / record["handle"]

    if record["art_path"]:
        for slot, alt in (
            (SLOT_COVER, f"{record['title']} — front print on a black tee"),
            (SLOT_MODEL, f"{record['title']} worn, front print in the street"),
        ):
            png = folder / f"{slot}.png"
            if not png.exists():
                raise FileNotFoundError(
                    f"{record['handle']}: {png} missing -- run composite_diljit_art.py first"
                )
            slots.append({"slot": slot, "path": png, "alt": alt})

    for index, mockup in enumerate(record["mockup_paths"], start=1):
        slots.append({
            "slot": f"{index + 2:02d}-mockup-{index}",
            "path": mockup,
            "alt": f"{record['title']} — worn shot {index}",
        })
    return slots


def upload_images(record: dict) -> list[dict]:
    rows = []
    for slot in gallery_plan(record):
        key = f"products/{record['handle']}/{slot['slot']}"
        url, error = upload_product_image(key, slot["path"].read_bytes())
        if error or not url:
            raise RuntimeError(f"upload failed for {key}: {error}")
        if not verify_url(url):
            raise RuntimeError(f"uploaded but not reachable: {url}")
        print(f"    uploaded {slot['slot']} -> {url.rsplit('/', 1)[-1]}")
        rows.append({"slot": slot["slot"], "url": url, "alt": slot["alt"]})
    return rows


def existing_product_id(supabase, handle: str) -> int | None:
    rows = supabase.table("products").select("id").eq("handle", handle).execute().data
    return rows[0]["id"] if rows else None


def referenced_variant_ids(supabase, product_id: int) -> set[int]:
    """Variants that historical `line_items` point at.

    `line_items.product_id` / `variant_id` are `ON DELETE SET NULL`, so
    deleting a variant a real order bought severs that order's product link
    forever. `--replace` refuses to delete any id in this set.
    """
    rows = (
        supabase.table("line_items")
        .select("variant_id")
        .eq("product_id", product_id)
        .execute()
        .data
    )
    return {row["variant_id"] for row in rows if row.get("variant_id") is not None}


def ensure_collect(supabase, product_id: int, now: str) -> int:
    """Membership in the campaign collection, added only when missing."""
    collection = (
        supabase.table("collections").select("id, published").eq("handle", COLLECTION_HANDLE).execute()
    )
    if not collection.data:
        raise RuntimeError(f"collection {COLLECTION_HANDLE} not found")
    collection_id = collection.data[0]["id"]

    existing = (
        supabase.table("collects").select("id, position")
        .eq("collection_id", collection_id)
        .eq("product_id", product_id)
        .execute()
        .data
    )
    if existing:
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

    if not collection.data[0]["published"]:
        supabase.table("collections").update({
            "published": True, "published_at": now, "updated_at": now,
        }).eq("id", collection_id).execute()
        print(f"    collection {COLLECTION_HANDLE} was unpublished -> published")
    else:
        print(f"    collection {COLLECTION_HANDLE} already published; published_at preserved")
    return position


def write_images(supabase, product_id: int, images: list[dict], now: str) -> int:
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
    return len(images)


def variant_row(vid: int, product_id: int, size: str, position: int, now: str) -> dict:
    return {
        "id": vid,
        "product_id": product_id,
        "title": size,
        "price": PRICE,
        "compare_at_price": None,
        "position": position,
        "inventory_quantity": INVENTORY,
        "inventory_policy": "deny",
        "inventory_management": None,
        "requires_shipping": True,
        "taxable": True,
        "option1": size,
        "created_at": now,
        "updated_at": now,
    }


def publish(supabase, record: dict, images: list[dict]) -> dict:
    """Insert a brand-new listing: draft first, activated only when complete."""
    handle = record["handle"]
    now = datetime.now(timezone.utc).isoformat()
    sizes = record["sizes"]

    product_id = next_id(supabase, "products")
    variant_ids = [next_id(supabase, "product_variants") for _ in sizes]

    # Draft, not active: a shopper hitting the row between this insert and the
    # last child write would otherwise see a published product with no sizes to
    # buy and no images. The flip below is the single moment it goes public.
    supabase.table("products").insert({
        "id": product_id,
        "title": record["title"],
        "handle": handle,
        "body_html": record["body_html"],
        "vendor": VENDOR,
        "product_type": record["type"],
        "status": "draft",
        "published_at": None,
        "published_scope": "web",
        "tags": record["tags"],
        "meta_title": record["meta_title"],
        "meta_description": record["meta_description"],
        "search_keywords": record["search_keywords"],
        "created_at": now,
        "updated_at": now,
    }).execute()

    supabase.table("product_variants").insert([
        variant_row(vid, product_id, size, index + 1, now)
        for index, (size, vid) in enumerate(zip(sizes, variant_ids))
    ]).execute()

    supabase.table("product_options").insert({
        "id": next_id(supabase, "product_options"),
        "product_id": product_id,
        "name": "Size",
        "position": 1,
        "values": sizes,
    }).execute()

    image_count = write_images(supabase, product_id, images, now)
    position = ensure_collect(supabase, product_id, now)

    # Every child row is in: the one write that makes the listing public.
    supabase.table("products").update({
        "status": "active",
        "published_at": now,
        "updated_at": now,
    }).eq("id", product_id).execute()

    return {
        "handle": handle,
        "product_id": product_id,
        "variants": len(variant_ids),
        "images": image_count,
        "collect_position": position,
    }


def replace_listing(supabase, record: dict, images: list[dict], old_id: int) -> dict:
    """Rebuild an existing listing in place, preserving the ids history needs.

    The old `--replace` deleted the product row and reinserted it with a fresh
    id. That cascaded the children and SET NULL'd `line_items.product_id` /
    `variant_id` on every order that ever bought the listing -- the order
    history lost its product links permanently. Here:

    * the product row is **updated** (same id, `published_at` preserved so
      `newest` ordering does not jump, briefly `draft` while children swap);
    * variants are matched by size title, so a size that already exists keeps
      its id (and its line_items references), just repriced;
    * only a variant **no order references** is deleted; a referenced one that
      is no longer in the size set is kept with a warning rather than severed;
    * images and collects are rebuilt -- nothing historical references them.

    A failure midway leaves the listing in `draft` (hidden, not broken);
    re-running `--replace` picks up where it stopped.
    """
    handle = record["handle"]
    now = datetime.now(timezone.utc).isoformat()
    sizes = record["sizes"]

    old_variants = (
        supabase.table("product_variants").select("id,title").eq("product_id", old_id).execute().data
    )
    by_title = {v["title"]: v["id"] for v in old_variants}
    keep_ids = referenced_variant_ids(supabase, old_id)

    supabase.table("products").update({
        "title": record["title"],
        "body_html": record["body_html"],
        "vendor": VENDOR,
        "product_type": record["type"],
        "tags": record["tags"],
        "meta_title": record["meta_title"],
        "meta_description": record["meta_description"],
        "search_keywords": record["search_keywords"],
        "status": "draft",
        "updated_at": now,
    }).eq("id", old_id).execute()

    matched = {size: by_title[size] for size in sizes if size in by_title}
    new_sizes = [size for size in sizes if size not in matched]

    if new_sizes:
        supabase.table("product_variants").insert([
            variant_row(next_id(supabase, "product_variants"), old_id, size, sizes.index(size) + 1, now)
            for size in new_sizes
        ]).execute()
    for size, vid in matched.items():
        supabase.table("product_variants").update({
            "price": PRICE,
            "inventory_quantity": INVENTORY,
            "position": sizes.index(size) + 1,
            "option1": size,
            "updated_at": now,
        }).eq("id", vid).execute()

    doomed = [v["id"] for v in old_variants if v["title"] not in matched and v["id"] not in keep_ids]
    if doomed:
        supabase.table("product_variants").delete().in_("id", doomed).execute()
    for v in old_variants:
        if v["title"] not in matched and v["id"] in keep_ids:
            print(f"    kept variant {v['id']} ({v['title']!r}): referenced by an order, not in the new size set")

    options = supabase.table("product_options").select("id").eq("product_id", old_id).execute().data
    if options:
        supabase.table("product_options").update({
            "values": sizes,
        }).eq("id", options[0]["id"]).execute()
    else:
        supabase.table("product_options").insert({
            "id": next_id(supabase, "product_options"),
            "product_id": old_id,
            "name": "Size",
            "position": 1,
            "values": sizes,
        }).execute()

    supabase.table("product_images").delete().eq("product_id", old_id).execute()
    image_count = write_images(supabase, old_id, images, now)
    position = ensure_collect(supabase, old_id, now)

    supabase.table("products").update({
        "status": "active",
        "updated_at": now,
    }).eq("id", old_id).execute()

    return {
        "handle": handle,
        "product_id": old_id,
        "replaced": True,
        "variants": len(sizes),
        "images": image_count,
        "collect_position": position,
    }


def retitle(supabase, record: dict) -> dict:
    """Update `title` / `meta_title` in place, leaving ids and images alone.

    Three tees were published without "Oversized" in the title even though they
    are the same oversized blank as the other twenty-one. Rebuilding them with
    `--replace` would mint new product ids and re-upload identical images (the
    old R2 objects would be orphaned), so the copy is patched directly.
    """
    rows = supabase.table("products").select("id,title,meta_title").eq("handle", record["handle"]).execute().data
    if not rows:
        return {"handle": record["handle"], "error": "not found"}
    pid, current = rows[0]["id"], rows[0]["title"]
    if current == record["title"] and rows[0].get("meta_title") == record["meta_title"]:
        return {"handle": record["handle"], "product_id": pid, "unchanged": True}
    supabase.table("products").update({
        "title": record["title"],
        "meta_title": record["meta_title"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", pid).execute()
    return {"handle": record["handle"], "product_id": pid, "was": current, "now": record["title"]}


def retire(supabase, handle: str) -> dict:
    """Unpublish one listing: draft status, collects row dropped."""
    rows = supabase.table("products").select("id,status").eq("handle", handle).execute().data
    if not rows:
        return {"handle": handle, "error": "not found"}
    pid = rows[0]["id"]
    now = datetime.now(timezone.utc).isoformat()

    dropped = supabase.table("collects").delete().eq("product_id", pid).execute().data
    supabase.table("products").update({
        "status": "draft", "updated_at": now,
    }).eq("id", pid).execute()
    return {"handle": handle, "product_id": pid, "status": "draft", "collects_removed": len(dropped)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="write to Supabase + R2")
    parser.add_argument("--only", help="one design key")
    parser.add_argument("--replace", action="store_true", help="rebuild an existing listing")
    parser.add_argument(
        "--retitle",
        action="store_true",
        help="patch title/meta_title in place (no rebuild, no re-upload)",
    )
    parser.add_argument(
        "--retire",
        action="store_true",
        help="unpublish RETIRED_HANDLES (draft + drop collects) instead of publishing",
    )
    args = parser.parse_args()

    if args.retire:
        print(f"{len(RETIRED_HANDLES)} listings to retire\n")
        for handle in RETIRED_HANDLES:
            print(f"  {handle}")
        if not args.execute:
            print("\nDRY RUN -- nothing written. Pass --execute to retire.")
            return 0
        supabase = get_supabase_client()
        print(f"\ncredentials: {resolve_supabase_url()}\n")
        snapshot = write_snapshot(supabase, RETIRED_HANDLES)
        print(f"snapshot: {snapshot}\n")
        results = [retire(supabase, handle) for handle in RETIRED_HANDLES]
        failed = [x for x in results if x.get("error")]
        for x in results:
            if x.get("error"):
                print(f"  FAILED {x['handle']}: {x['error']}")
            else:
                print(f"  {x['handle']}: -> draft, collects rows removed: {x['collects_removed']}")
        return 1 if failed else 0

    records = build()
    if args.only:
        records = [r for r in records if r["key"] == args.only]
        if not records:
            print(f"no design matches {args.only!r}", file=sys.stderr)
            return 1

    if args.retitle:
        print(f"{len(records)} listing(s) to retitle\n")
        for r in records:
            print(f"  {r['handle']}\n    -> {r['title']}")
        if not args.execute:
            print("\nDRY RUN -- nothing written. Pass --execute to retitle.")
            return 0
        supabase = get_supabase_client()
        print(f"\ncredentials: {resolve_supabase_url()}\n")
        # The snapshot promise covers this branch too: a retitle rewrites
        # title/meta_title in place, and the pre-write rows are the only record
        # of the copy being replaced.
        snapshot = write_snapshot(supabase, [r["handle"] for r in records])
        print(f"snapshot: {snapshot}\n")
        results = [retitle(supabase, r) for r in records]
        failed = [x for x in results if x.get("error")]
        for x in results:
            if x.get("error"):
                print(f"  FAILED {x['handle']}: {x['error']}")
            elif x.get("unchanged"):
                print(f"  {x['handle']}: already correct")
            else:
                print(f"  {x['handle']}:\n    was: {x['was']}\n    now: {x['now']}")
        return 1 if failed else 0

    print(f"{len(records)} designs\n")
    for r in records:
        plan = gallery_plan(r)
        print(f"  {r['handle']}")
        print(f"    {r['type']} / {len(r['sizes'])} sizes / {len(plan)} gallery images / Rs{PRICE}")

    if not args.execute:
        print("\nDRY RUN -- nothing written. Pass --execute to publish.")
        return 0

    supabase = get_supabase_client()
    print(f"\ncredentials: {resolve_supabase_url()}")

    snapshot = write_snapshot(supabase, [r["handle"] for r in records])
    print(f"snapshot: {snapshot}\n")

    results = []
    for r in records:
        print(f"  {r['handle']}")
        try:
            # Existing-handle check BEFORE the uploads: a rerun over a list
            # whose listings are already live must not need the source assets
            # or R2 credentials just to report "skipped".
            old_id = existing_product_id(supabase, r["handle"])
            if old_id is not None and not args.replace:
                print(f"    already exists ({old_id}), skipping (use --replace to rebuild)")
                results.append({"handle": r["handle"], "skipped": True})
                continue
            images = upload_images(r)
            result = (
                replace_listing(supabase, r, images, old_id)
                if old_id is not None
                else publish(supabase, r, images)
            )
        except Exception as error:
            print(f"    FAILED: {error}")
            results.append({"handle": r["handle"], "error": str(error)})
            continue
        results.append(result)

    published = [x for x in results if x.get("product_id")]
    skipped = [x for x in results if x.get("skipped")]
    failed = [x for x in results if x.get("error")]

    print(f"\npublished {len(published)}, skipped {len(skipped)}, failed {len(failed)}")
    for x in failed:
        print(f"  FAILED {x['handle']}: {x['error']}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
