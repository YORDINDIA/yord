#!/usr/bin/env python3
"""
Collection Tidy — rebuild storefront collection membership.

Why this exists
---------------
The Shopify migration left the catalog in a state the storefront cannot use
(figures below are the pre-cleanup state observed before the first run):

* 10 collections were published but held zero products. Three of them
  (`new-arrivals`, `bestsellers`, `limited-edition`) are linked from the
  header and footer, so the main navigation led to empty pages.
* 264 of 463 products belonged to no collection at all.
* Several collections were truncated at exactly 16 products (positions
  1..16), including `all` (16 of 463) and `clothing` (16 of 453 apparel).
* `products.published_at` was NULL for every row, so the storefront's
  `newest` sort (`ORDER BY published_at DESC`) had nothing to order by.
* Duplicate collections existed for the same concept (`best-sellers` vs
  `bestsellers`, five magnet/band collections, a typo'd
  `coldplay-rainbow-relfective-collection`, ...).

The Shopify store is unreachable, so membership is rebuilt from product
title / tags / product_type using the rules in RULES below (`vendor` is
selected and available to a rule, but no current rule reads it).

Usage (run from `scripts/`; the repo-root `.env` is found from either
directory, but the snapshot lands in the *current* one):

    cd scripts
    python3 tidy_collections.py                          # dry run (default)
    python3 tidy_collections.py --execute                # write
    python3 tidy_collections.py --execute --no-delete    # skip deletes

Dry-run prints a per-collection before/after diff with the product ids it
would add and remove, the delete list, the unpublish list and the products
left in no collection. `--execute` writes a snapshot of every `collections`
row and every `collects` row it read (plus each product's `published_at`) to
`collection_tidy_snapshot-<timestamp>.json` before writing anything, and
prints the path it wrote. One file per run: an earlier run's snapshot is
never overwritten.

Re-running is NOT guaranteed to be a no-op. Rules are authoritative — a
rule-driven collection is replaced by "everything the rule matches now", so
a product that only entered the collection through an earlier MERGES union
(or by hand in the admin) is removed by the next `--execute`. The dry run
prints every removal under "MEMBERSHIP DIFF" — read it before executing.

Undoing a run
-------------
The snapshot is a pre-run dump, not a restore script. It holds:

* `collections`: every collection row with the columns this script reads —
  `id, title, handle, published, image_src, collection_type, body_html,
  sort_order, published_at, image_alt, published_scope, template_suffix,
  disjunctive, updated_at`;
* `collects`: every membership row (`collection_id, product_id`);
* `products_published_at`: each product's `published_at`.

To undo a deletion, re-insert the collection from its `collections` row and
re-insert the `collects` rows carrying that `collection_id`. There is no
automatic restore path: `set_collection_products()` (admin RPC) or a small
insert script does the write, and `collects.id` / `collects.position` from
the snapshot are not preserved (the RPC renumbers them). Deleting a
collection cascades to its `collects` rows, so the snapshot is the only copy.
The `collects` select is `collection_id, product_id` only, so a restore also
loses the storefront product order (`position`), and `smart_collection_rules`
rows of a deleted smart collection cascade away unsnapshotted (the migrated
collections are all `collection_type = 'custom'`, so there are none today).
A rebuild writes membership as product ids sorted ascending, so `position` is
regenerated for every collection a run touches — re-order in the admin if the
product order matters.

Known gap: the first two runs (2026-10-02) both wrote the un-stamped
`collection_tidy_snapshot.json`, so run 2 overwrote run 1's file. The 11
collections run 1 deleted — `best-sellers`, `accessories-1`, `bands`,
`magnet`, `magnets`, `bands-magnets`, `magnets-and-bands`, `lollapalooza`,
`trending`, `frontpage`, `yoyohoneysingh` — cannot be restored from a
snapshot. The surviving file (`created_at` 2026-10-02T23:43:18) is run 2's
and covers the two run 2 deleted: `coldplay-glow-in-dark-single-side-print`
and `coldplay-rainbow-relfective-collection`. Snapshots older than this
docstring update also lack the extra collection columns listed above.

This script never writes `image_src`: a merge moves membership, not covers,
and it says so in the report instead of pretending the cover moved.
"""

import copy
import json
import re
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))

from utils.cli import configure_logging, create_parser, resolve_execute  # noqa: E402
from utils.logging_config import setup_logging  # noqa: E402
from utils.supabase_helpers import get_supabase_client  # noqa: E402

load_dotenv()

logger = setup_logging(__name__)

# Written next to the cwd (run from `scripts/` and it lands beside the script),
# stamped with the run time so a second `--execute` cannot overwrite it.
SNAPSHOT_FILE = Path.cwd() / "collection_tidy_snapshot.json"

# ── Rules ─────────────────────────────────────────────────────────────────────
#
# A rule has up to two parts, combined with AND when both are present:
#   "any"   — at least one (scope, keyword) pair must match   (OR inside)
#   "every" — a list of groups; every group needs one match   (OR inside a
#             group, AND across groups)
# A spec with neither part matches nothing.
#
# Scopes map to product columns; `body_html` is deliberately excluded — it
# produced false positives ("Karan" in "Karakoram", "king" in anything)
# during analysis. Keywords are lowercased, regex-escaped (so `kr$na` works)
# and matched with lookarounds instead of `\b` so a keyword may start or end
# with a non-word character; a trailing `s` is optional, which is what lets
# `magnet` match `magnets`. The tolerance is one-directional: `big dawgs`
# does not match `big dawg`.
#
# A rule replaces its collection's membership with everything it matches
# today (only `status = 'active'` products are considered). A rule that
# matches zero products is refused and the collection is left untouched.
#
# Collections that are curated rather than keyword-derived are NOT listed
# here and keep their existing products: `premium-store`, `tshirts-adt`,
# `random-designs`, `kaleshi-aurat`, `chill-guy-tshirt`, `rishab-sharma`,
# `coldplay-custom-designs-collection`, `lollapalooza-india` (festival lineup).
# A collection with no rule can still be unpublished by `unpublish_empty`
# (a published collection with zero products is never valid storefront copy)
# but its membership is never replaced — a merge or a seed only adds.
#
# A rule can only ever write what the catalog data says. When the owner curated
# a product into a rule-driven collection by hand — or it arrived there from a
# merged duplicate — no rule can reproduce that choice, and the next
# `--execute` would drop the product again. PINNED_MEMBERS below names those
# products explicitly: a pin is unioned into the collection's desired set after
# the rules run, so it survives the rule replace (and stops appearing in the
# REVIEW list). A pin never expires on its own — re-check it when the product
# is edited, retagged or deleted, because nothing else will.
COLDPLAY = [
    ("title", "coldplay"), ("tags", "coldplay"),
    ("title", "chris martin"), ("title", "music of the spheres"),
]

RULES: dict[str, dict] = {
    # Artist collections
    "coldplay": {"any": COLDPLAY},
    "coldplay-glow-in-the-dark-collection": {
        "any": COLDPLAY,
        "every": [[("title", "glow"), ("tags", "glow"), ("product_type", "glow")]],
    },
    "rainbow-reflector-coldplay-single-side-print": {
        "any": COLDPLAY,
        "every": [[
            ("title", "rainbow"), ("tags", "rainbow"),
            ("title", "reflective"), ("tags", "reflective"),
            ("title", "reflector"), ("tags", "reflector"),
        ]],
    },
    "guns-and-roses": {
        "any": [
            ("title", "guns n' roses"), ("title", "guns n roses"),
            ("title", "guns and roses"), ("tags", "guns n' roses"),
            ("tags", "guns n roses"), ("title", "gnr"), ("tags", "gnr"),
        ],
    },
    "sidhu-moosewala": {
        "any": [
            ("title", "sidhu moosewala"), ("title", "moosewala"), ("tags", "moosewala"),
            ("title", "moose wala"), ("title", "sidhu moose"),
        ],
    },
    "honey-singh": {
        "any": [
            ("title", "honey singh"), ("tags", "honey singh"), ("title", "yoyo honey"),
            ("title", "yo yo honey"), ("title", "honeysingh"), ("tags", "honeysingh"),
            ("title", "yoyo"), ("title", "desi kalakar"),
        ],
    },
    "ed-sheeran": {
        "any": [
            ("title", "ed sheeran"), ("tags", "ed sheeran"), ("title", "sheeran"),
            ("tags", "sheeran"),
        ],
    },
    # NOTE: `lollapalooza-india` is deliberately rule-free — it is the store
    # owner's festival-lineup curation (ZEDD, John Summit, Hanumankind, …).
    # The old `lollapalooza` duplicate's products merge into it (see MERGES).
    "krsna": {"any": [("title", "krsna"), ("tags", "krsna"), ("title", "kr$na"), ("tags", "kr$na")]},
    "hanumankind": {
        "any": [("title", "hanumankind"), ("tags", "hanumankind"), ("title", "big dawgs")],
    },
    "taylor-swift": {
        "any": [
            ("title", "taylor swift"), ("tags", "taylor swift"), ("title", "swiftie"),
            ("tags", "swiftie"), ("title", "eras tour"),
        ],
    },
    "john-summit": {"any": [("title", "john summit"), ("tags", "john summit")]},
    "shawn-mendes": {"any": [("title", "shawn mendes"), ("tags", "shawn mendes")]},
    # Cricket / IPL
    "csk": {
        "any": [
            ("title", "csk"), ("tags", "csk"), ("title", "chennai super kings"),
            ("tags", "chennai super kings"),
        ],
    },
    "ms-dhoni": {
        "any": [("title", "dhoni"), ("tags", "dhoni"), ("title", "msd"), ("tags", "msd")],
    },
    "rcb": {
        "any": [
            ("title", "rcb"), ("tags", "rcb"), ("title", "royal challengers"),
            ("tags", "royal challengers"),
        ],
    },
    "virat": {
        "any": [
            ("title", "virat"), ("tags", "virat"), ("title", "kohli"), ("tags", "kohli"),
        ],
    },
    # Facets
    "oversized": {"any": [("title", "oversized"), ("tags", "oversized")]},
    "crop-tops": {"any": [("title", "crop top"), ("tags", "crop top")]},
    "hoodies": {
        "any": [("title", "hoodie"), ("tags", "hoodie"), ("product_type", "hoodie")],
    },
    "limited-edition": {"any": [("tags", "limited edition merch")]},
    "accessories": {
        "any": [
            ("title", "magnet"), ("tags", "magnet"), ("title", "wristband"),
            ("tags", "wristband"), ("title", "bracelet"), ("tags", "bracelet"),
            ("title", "collectible"), ("tags", "collectible"), ("title", "band set"),
            ("product_type", "refrigerator magnets"), ("product_type", "wristbands"),
            ("product_type", "bracelets"), ("product_type", "collectibles"),
        ],
    },
}

# Curated collections seeded from other collections' current membership
# (instead of a keyword rule). `bestsellers` is the storefront's Bestsellers
# nav target; it was empty, and there are no orders to rank by, so it is
# seeded from the three curated Shopify sets and managed in admin afterwards.
SEED_FROM: dict[str, list[str]] = {
    "bestsellers": ["best-sellers", "frontpage", "home-page-trending", "trending"],
}

# Product types counted as apparel for the `clothing` collection.
CLOTHING_TYPES = {
    "t-shirts", "hoodies", "sweatshirts", "denim", "coats & jackets", "apparel",
}

# Collections computed at read time by the storefront. Membership in `collects`
# is ignored for these, so the script clears their rows instead of writing.
AUTO_HANDLES = {"new-arrivals", "all"}

# Canonical handle ← duplicate handles. Product membership of every duplicate is
# merged into the canonical collection before the duplicate rows are deleted.
MERGES: dict[str, list[str]] = {
    "bestsellers": ["best-sellers"],
    "accessories": [
        "accessories-1", "bands", "magnet", "magnets", "bands-magnets",
        "magnets-and-bands",
    ],
    "lollapalooza-india": ["lollapalooza"],
    "home-page-trending": ["trending", "frontpage"],
    "honey-singh": ["yoyohoneysingh"],
    # Coldplay sub-themes: the single-side-print list and the typo'd
    # "relfective" handle are the same idea as the collections they merge into.
    "coldplay-glow-in-the-dark-collection": ["coldplay-glow-in-dark-single-side-print"],
    "rainbow-reflector-coldplay-single-side-print": ["coldplay-rainbow-relfective-collection"],
}

# Products a rule cannot express, unioned into the collection's desired set
# after the rules run (a pin is authoritative: the rule cannot match these, so
# without the pin every run would remove them). Keep each entry next to the
# reason it exists, and re-check it whenever the product is edited — a pin
# outlives the data change that motivated it. A pin on an auto handle or on a
# product missing from the catalog is reported as an error, not applied.
PINNED_MEMBERS: dict[str, set[int]] = {
    # "Coldplay Oversize French Terry Cotton T-shirt - Premium Luxury Concert
    # Wear" (tags: `coldplay …`; no rainbow/reflect* keyword anywhere), curated
    # in from the merged `coldplay-rainbow-relfective-collection` duplicate.
    # The rule matches the other 19 members only.
    "rainbow-reflector-coldplay-single-side-print": {8190803706033},
}

# Never publish a collection with zero products.
UNPUBLISH_EMPTY = True


def _norm(value) -> str:
    return str(value or "").lower()


def _match_any(product: dict, rules: list[tuple[str, str]]) -> bool:
    """Word-boundary, plural-tolerant keyword match across the named scopes.

    Boundaries stop `csk` matching inside a random word; the optional trailing
    `s` is what lets `magnet` match the `fridge magnets` tag (a plain
    `\\bmagnet\\b` misses the plural and silently emptied the rule).
    """
    for scope, keyword in rules:
        hay = _norm(product.get(scope))
        if not hay or not keyword:
            continue
        pattern = r"(?<![a-z0-9])" + re.escape(keyword) + r"s?(?![a-z0-9])"
        if re.search(pattern, hay):
            return True
    return False


def _matches(product: dict, spec: dict) -> bool:
    """True when the product satisfies the rule spec (`any` / `every`)."""
    any_rules = spec.get("any") or []
    if any_rules and not _match_any(product, any_rules):
        return False
    for group in spec.get("every") or []:
        if not _match_any(product, group):
            return False
    return bool(any_rules or spec.get("every"))


class CollectionTidy:
    def __init__(self, execute: bool, delete: bool = True):
        self.execute = execute
        self.delete = delete
        self.supabase = get_supabase_client()
        self.products: list[dict] = []
        self.collections: list[dict] = []
        self.collects: list[dict] = []
        self.by_handle: dict[str, dict] = {}
        self.by_id: dict[int, dict] = {}
        self.membership: dict[int, set[int]] = {}
        self.collection_ids: set[int] = set()
        self.product_ids: set[int] = set()
        # Untouched copy of the rows as read, so the snapshot is the true
        # pre-run state even though `plan()` annotates rows in `self.collections`.
        self.collections_before: list[dict] = []
        self.covers_not_copied: list[str] = []
        self.duplicates_already_gone: list[str] = []
        self.errors: list[str] = []

    # ── Reads ────────────────────────────────────────────────────────────────
    def _paged(self, table: str, select: str) -> list[dict]:
        rows: list[dict] = []
        offset = 0
        limit = 1000
        while True:
            response = (
                self.supabase.table(table).select(select).range(offset, offset + limit - 1).execute()
            )
            batch = response.data or []
            rows.extend(batch)
            if len(batch) < limit:
                return rows
            offset += limit

    def load(self) -> None:
        # Every column here is in the snapshot: a deleted collection row cannot
        # be recovered from anywhere else (its `collects` rows cascade away).
        self.collections = self._paged(
            "collections",
            "id, title, handle, published, image_src, collection_type, body_html, "
            "sort_order, published_at, image_alt, published_scope, template_suffix, "
            "disjunctive, updated_at",
        )
        self.collections_before = copy.deepcopy(self.collections)
        self.products = self._paged(
            "products", "id, title, handle, tags, product_type, vendor, status, created_at, published_at"
        )
        self.collects = self._paged("collects", "collection_id, product_id")
        self.by_handle = {c["handle"]: c for c in self.collections if c.get("handle")}
        self.by_id = {p["id"]: p for p in self.products}
        self.collection_ids = {c["id"] for c in self.collections}
        self.product_ids = {p["id"] for p in self.products}
        for row in self.collects:
            if row["collection_id"] in self.collection_ids and row["product_id"] in self.product_ids:
                self.membership.setdefault(row["collection_id"], set()).add(row["product_id"])
        logger.info(
            "Loaded %d collections, %d products, %d collects rows",
            len(self.collections), len(self.products), len(self.collects),
        )

    # ── Plan ─────────────────────────────────────────────────────────────────
    def plan(self) -> dict[int, set[int]]:
        """Return the desired membership per collection id (before writes)."""
        desired: dict[int, set[int]] = {cid: set(set_) for cid, set_ in self.membership.items()}
        active = [p for p in self.products if p.get("status") == "active"]

        for handle, rules in RULES.items():
            collection = self.by_handle.get(handle)
            if not collection:
                logger.warning("Rule for %s skipped: collection not found", handle)
                continue
            matched = {p["id"] for p in active if _matches(p, rules)}
            if not matched:
                self.errors.append(f"{handle}: rule matched 0 products; left untouched")
                logger.warning("  %-42s rule matched 0 products — left untouched", handle)
                continue
            desired[collection["id"]] = matched
            logger.info("  rule %-44s %4d products", handle, len(matched))

        # Pinned members: kept although the rule cannot match them (see
        # PINNED_MEMBERS). A missing target or a product that is no longer in
        # the catalog is an error — the pin is skipped and the run exits
        # non-zero rather than writing a product id the FK would reject.
        for handle, pinned in PINNED_MEMBERS.items():
            collection = self.by_handle.get(handle)
            if not collection:
                self.errors.append(f"pin target missing: {handle}")
                logger.warning("Pin target %s not found — skipped", handle)
                continue
            if handle in AUTO_HANDLES:
                self.errors.append(
                    f"{handle}: pinned members ignored — auto collections are cleared by design"
                )
                logger.warning("  pin %-44s refused (auto collection)", handle)
                continue
            missing = sorted(pinned - self.product_ids)
            if missing:
                self.errors.append(f"{handle}: pinned product(s) not in the catalog: {missing}")
                logger.warning("  pin %-44s product(s) not in the catalog: %s", handle, missing)
                continue
            desired[collection["id"]] = desired.get(collection["id"], set()) | pinned
            logger.info("  pin %-44s %4d products", handle, len(desired[collection["id"]]))

        # Curated seeds: union of other collections' *current* membership.
        for handle, sources in SEED_FROM.items():
            collection = self.by_handle.get(handle)
            if not collection:
                self.errors.append(f"seed target missing: {handle}")
                logger.warning("Seed target %s not found", handle)
                continue
            seeded = set(desired.get(collection["id"], set()))
            for source_handle in sources:
                source = self.by_handle.get(source_handle)
                if source:
                    seeded |= self.membership.get(source["id"], set())
            desired[collection["id"]] = seeded
            logger.info("  seed %-44s %4d products", handle, len(seeded))

        clothing = self.by_handle.get("clothing")
        if clothing:
            matched = {p["id"] for p in active if _norm(p.get("product_type")) in CLOTHING_TYPES}
            if matched:
                desired[clothing["id"]] = matched

        # Merge duplicates into their canonical collection (the canonical's
        # membership is written below, before any row is deleted).
        for canonical, duplicates in MERGES.items():
            target = self.by_handle.get(canonical)
            if not target:
                self.errors.append(f"merge target missing: {canonical}")
                logger.warning("Merge target %s not found — skipping its duplicates", canonical)
                continue
            merged = set(desired.get(target["id"], set()))
            for handle in duplicates:
                source = self.by_handle.get(handle)
                if not source:
                    # Already deleted by an earlier run: expected on a re-run,
                    # so it is a note, not a failure (and never a new deletion).
                    self.duplicates_already_gone.append(handle)
                    continue
                merged |= desired.get(source["id"], set())
                if source.get("image_src") and not target.get("image_src"):
                    # Recorded only. This script writes membership, the
                    # published flag and products.published_at — never
                    # image_src — so the cover is lost with the deleted row.
                    self.covers_not_copied.append(f"{handle} (had image_src) -> {canonical}")
            desired[target["id"]] = merged
        if self.duplicates_already_gone:
            logger.info(
                "  %d duplicate handles already gone (nothing to merge): %s",
                len(self.duplicates_already_gone), ", ".join(self.duplicates_already_gone),
            )

        # Auto collections are computed by the storefront: clear their rows.
        for handle in AUTO_HANDLES:
            collection = self.by_handle.get(handle)
            if collection:
                desired[collection["id"]] = set()

        return desired

    # ── Writes ───────────────────────────────────────────────────────────────
    def _snapshot(self, desired: dict[int, set[int]]) -> Path:
        """Dump the pre-run state and return the path actually written."""
        payload = {
            "created_at": datetime.now().isoformat(),
            # Rows exactly as read, before `plan()` annotated anything.
            "collections": self.collections_before,
            "collects": self.collects,
            "products_published_at": [
                {"id": p["id"], "published_at": p.get("published_at")} for p in self.products
            ],
            "planned_membership": {str(k): sorted(v) for k, v in desired.items()},
        }
        # Run-stamped: a second `--execute` must not overwrite the rollback data
        # for the rows the first run deleted (a fixed filename silently lost it).
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        target = SNAPSHOT_FILE.with_name(f"{SNAPSHOT_FILE.stem}-{stamp}.json")
        target.write_text(json.dumps(payload, indent=2))
        logger.info("Snapshot written to %s", target)
        return target

    def backfill_published_at(self) -> int:
        """Set products.published_at = created_at where NULL.

        Without this the storefront's `newest` sort (`published_at DESC`) is a
        no-op and every 'newest' list is in arbitrary order; `created_at` is
        populated for all 463 rows.
        """
        missing = [p for p in self.products if not p.get("published_at") and p.get("created_at")]
        if not missing:
            return 0
        # Group by exact timestamp: the migration wrote batches sharing one
        # created_at, so this is a handful of UPDATEs instead of 463.
        groups: dict[str, list[int]] = {}
        for p in missing:
            groups.setdefault(p["created_at"], []).append(p["id"])
        logger.info(
            "published_at backfill: %d products across %d distinct timestamps",
            len(missing), len(groups),
        )
        if not self.execute:
            return len(missing)
        for created_at, ids in groups.items():
            self.supabase.table("products").update({"published_at": created_at}).in_("id", ids).execute()
        return len(missing)

    def apply_membership(self, desired: dict[int, set[int]]) -> None:
        for handle, collection in sorted(self.by_handle.items(), key=lambda kv: kv[0]):
            cid = collection["id"]
            if cid not in desired:
                continue
            before = self.membership.get(cid, set())
            after = desired[cid]
            if before == after:
                continue
            if not self.execute:
                continue
            response = self.supabase.rpc(
                "set_collection_products",
                {"p_collection_id": cid, "p_product_ids": sorted(after)},
            ).execute()
            inserted = response.data if isinstance(response.data, int) else len(after)
            logger.info("  %-42s %3d -> %3d products", handle, len(before), inserted)

    def delete_duplicates(self) -> tuple[list[str], list[str]]:
        """Delete the MERGES duplicates. Returns ``(deleted, kept)``.

        Deletion is by explicit handle from MERGES — never a pattern or a
        broad match — and only runs after `apply_membership()` has written the
        merged membership into the canonical collection. A handle that is
        already gone is skipped (`kept` is empty for those).
        """
        deleted: list[str] = []
        kept: list[str] = []
        for handle in [h for hs in MERGES.values() for h in hs]:
            collection = self.by_handle.get(handle)
            if not collection:
                continue
            if not self.delete:
                kept.append(handle)
                continue
            self.supabase.table("collections").delete().eq("id", collection["id"]).execute()
            logger.info("  deleted duplicate collection %s (id=%s)", handle, collection["id"])
            deleted.append(handle)
        return deleted, kept

    def unpublish_empty(self, desired: dict[int, set[int]]) -> list[str]:
        if not UNPUBLISH_EMPTY:
            return []
        targets: list[str] = []
        for handle, collection in self.by_handle.items():
            if not collection.get("published") or handle in AUTO_HANDLES:
                continue
            if len(desired.get(collection["id"], set())) == 0:
                targets.append(handle)
        if self.execute:
            for handle in targets:
                self.supabase.table("collections").update({"published": False}).eq(
                    "id", self.by_handle[handle]["id"]
                ).execute()
        return targets

    # ── Report ───────────────────────────────────────────────────────────────
    def report(self, desired: dict[int, set[int]]) -> None:
        duplicate_handles = {h for hs in MERGES.values() for h in hs}
        print("\n" + "=" * 78)
        print("MEMBERSHIP DIFF")
        print("=" * 78)
        changed = 0
        added_total = 0
        removed_total = 0
        removals: list[tuple[str, set[int]]] = []
        for handle, collection in sorted(self.by_handle.items(), key=lambda kv: kv[0]):
            cid = collection["id"]
            if cid not in desired:
                continue
            before = self.membership.get(cid, set())
            after = desired[cid]
            gained = after - before
            lost = before - after
            if not gained and not lost:
                continue
            changed += 1
            # Counts alone hide a swap (one product in, one out), which is
            # exactly how a re-run changes a rule collection.
            print(f"  {handle:<44} {len(before):>4} -> {len(after):>4}   (+{len(gained)} -{len(lost)})")
            if handle not in AUTO_HANDLES and handle not in duplicate_handles:
                added_total += len(gained)
                removed_total += len(lost)
                if lost:
                    removals.append((handle, lost))
        print(
            f"  ({changed} collections change, {added_total} products added, "
            f"{removed_total} removed; auto handles clear their rows by design)"
        )
        if not changed:
            print("  no membership changes — the DB already matches the rules")

        if removals:
            print("\n  REVIEW — these products leave a collection. Rules replace membership,")
            print("  so anything added by hand in the admin, or by an earlier run's merge,")
            print("  is dropped by the next --execute:")
            shown = 0
            for handle, lost in removals:
                for product_id in sorted(lost):
                    if shown >= 15:
                        break
                    title = (self.by_id.get(product_id) or {}).get("title", "")[:52]
                    print(f"    {handle:<42} - {product_id}  {title}")
                    shown += 1
            if removed_total > shown:
                print(f"    ... and {removed_total - shown} more")

        # Products covered by a real (non-auto) collection after this run.
        # Auto handles are excluded on purpose: the storefront computes them,
        # so they would mask every product as "assigned" here.
        auto_ids = {self.by_handle[h]["id"] for h in AUTO_HANDLES if h in self.by_handle}
        covered: set[int] = set()
        for cid, want in desired.items():
            if cid not in auto_ids:
                covered |= want
        holes = [
            p for p in self.products
            if p.get("status") == "active" and p["id"] not in covered
        ]

        print("\n" + "=" * 78)
        print("DUPLICATES TO DELETE (products merged into the canonical collection first)")
        print("=" * 78)
        for canonical, duplicates in MERGES.items():
            present = [h for h in duplicates if h in self.by_handle]
            gone = [h for h in duplicates if h not in self.by_handle]
            print(f"  {canonical:<42} <- {', '.join(present) if present else '(nothing left to merge)'}")
            if gone:
                print(f"  {'':<42}    already deleted: {', '.join(gone)}")

        print("\n" + "=" * 78)
        print("UNPUBLISH (published with 0 products after this run)")
        print("=" * 78)
        targets = sorted(self.unpublish_preview(desired))
        for handle in targets or ["(none)"]:
            print(f"  {handle}")

        print("\n" + "=" * 78)
        print("PRODUCTS IN NO COLLECTION AFTER THIS RUN")
        print("=" * 78)
        print(f"  {len(holes)} of {len(self.products)} products (active only)")
        for product in holes[:15]:
            print(f"    {product['id']}  {product['title'][:60]}")
        if len(holes) > 15:
            print(f"    ... and {len(holes) - 15} more")

        notes = list(self.errors)
        if PINNED_MEMBERS:
            notes.append(
                "pinned members (kept although the rule cannot match them): "
                + "; ".join(f"{handle} <- {sorted(ids)}" for handle, ids in PINNED_MEMBERS.items())
            )
        if self.covers_not_copied:
            notes.append(
                "image_src is never written — a merge does not move the cover, and "
                "the duplicate's cover is deleted with its row: "
                + "; ".join(self.covers_not_copied)
            )
        if self.duplicates_already_gone:
            notes.append(
                f"{len(self.duplicates_already_gone)} duplicate handle(s) already deleted by "
                "an earlier run (nothing to merge, no new deletion)"
            )
        if notes:
            print("\n" + "=" * 78)
            print("NOTES / SKIPPED")
            print("=" * 78)
            for note in notes:
                print(f"  {note}")

    def unpublish_preview(self, desired: dict[int, set[int]]) -> set[str]:
        if not UNPUBLISH_EMPTY:
            return set()
        return {
            handle for handle, collection in self.by_handle.items()
            if collection.get("published")
            and handle not in AUTO_HANDLES
            and len(desired.get(collection["id"], set())) == 0
        }


def main() -> int:
    parser = create_parser("Rebuild storefront collection membership from product data")
    parser.add_argument(
        "--no-delete", action="store_true",
        help="Skip deleting duplicate collections (membership merges still apply)",
    )
    args = parser.parse_args()
    configure_logging(args.verbose)
    execute = resolve_execute(args)

    tidy = CollectionTidy(execute=execute, delete=not args.no_delete)
    tidy.load()
    desired = tidy.plan()

    print(f"\n{'EXECUTE' if execute else 'DRY-RUN'}: "
          f"{len(RULES)} rule collections, {sum(len(v) for v in MERGES.values())} duplicates, "
          f"{len(AUTO_HANDLES)} auto collections")
    tidy.report(desired)

    if not execute:
        print("\n[DRY RUN] No writes made. Pass --execute to apply.")
        if tidy.errors:
            print(f"[DRY RUN] {len(tidy.errors)} problem(s) above need attention.")
            return 1
        return 0

    snapshot = tidy._snapshot(desired)
    backfilled = tidy.backfill_published_at()
    logger.info("Backfilled products.published_at for %d rows", backfilled)
    tidy.apply_membership(desired)
    deleted, kept = tidy.delete_duplicates()
    unpublished = tidy.unpublish_empty(desired)

    print("\n" + "=" * 78)
    print("APPLIED")
    print("=" * 78)
    print(f"  products.published_at backfilled: {backfilled}")
    if kept:
        print(f"  duplicate collections kept:       {len(kept)} (--no-delete: {', '.join(kept)})")
    else:
        print(f"  duplicate collections deleted:    {len(deleted)} ({', '.join(deleted) or 'none'})")
    print(f"  empty collections unpublished:    {len(unpublished)}")
    print(f"  snapshot (pre-run state):         {snapshot}")
    if tidy.errors:
        print(f"\n  {len(tidy.errors)} problem(s) were reported above — review the NOTES section.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
