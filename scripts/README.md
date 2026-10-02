# YORD India Migration Scripts

Python scripts for migrating Shopify data to Supabase for the YORD India e-commerce platform.

## Prerequisites

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Required environment variables (copy the root `.env.example` to root `.env`):
```
SUPABASE_URL=https://xxx.supabase.co          # or NEXT_PUBLIC_SUPABASE_URL (fallback)
SUPABASE_SECRET_KEY=xxx
SHOPIFY_STORE_NAME=your-store-subdomain
SHOPIFY_ADMIN_API_ACCESS_TOKEN=xxx
# Media steps (migrate_media, optimize_images, upload_local_media, verify_r2)
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=yord-media
R2_PUBLIC_BASE_URL=https://pub-<hash>.r2.dev
```

## Directory Structure

```
scripts/
├── README.md                  # This file
├── utils/                     # Shared utilities module
│   ├── __init__.py
│   ├── config.py              # Centralized configuration (artist lists, etc.)
│   ├── logging_config.py      # Standard logging setup
│   ├── r2_helpers.py          # R2 upload/delete + WebP variant policy
│   ├── shopify.py             # ShopifyClient with retry logic
│   └── supabase_helpers.py    # Supabase helper functions
├── schema.sql                 # Main database schema
├── schema_patches/            # Incremental schema updates
│   └── 001_fix_collects.sql
├── archive/                   # Deprecated scripts (kept for reference)
└── [active scripts]
```

## Core Migration Scripts

### `migrate_via_rest.py`
**Main migration script** - Migrates all core Shopify data to Supabase via REST API.

```bash
# Dry run (preview only)
python migrate_via_rest.py --dry-run

# Execute migration
python migrate_via_rest.py --execute
```

Migrates: Products, Variants, Images, Collections, Collects, Customers, Orders, Line Items

### `migrate_media.py`
Migrates product and collection images from the Shopify CDN to Cloudflare R2.

```bash
python migrate_media.py --execute
```

### `migrate_blogs.py`
Migrates blog posts and articles from Shopify.

```bash
python migrate_blogs.py --execute
```

## Collection Management

### `populate_collections.py`
**Unified collection script** - Populates the `collects` junction table using multiple strategies.

```bash
# Mode 1: Keyword matching (matches vendor name to collection)
python populate_collections.py --mode=keyword --dry-run
python populate_collections.py --mode=keyword --execute

# Mode 2: Shopify API (fetches from Shopify smart collections)
python populate_collections.py --mode=shopify --execute
```

Configuration in `utils/config.py`:
- `ARTIST_COLLECTIONS` - Artist collection handles mapped to their metadata (name, keywords, search terms)
- `HOMEPAGE_ARTISTS` - Homepage featured artists (renamed from `TARGET_ARTISTS`)

### `tidy_collections.py`
**Post-migration cleanup** - Reconciles `collects` with the current catalog. Dry-run by default.

```bash
python3 tidy_collections.py              # diff + delete/unpublish preview, writes nothing
python3 tidy_collections.py --execute    # snapshot, then apply
```

It backfills `products.published_at` from `created_at` (the storefront's "newest"
sort reads it), rebuilds the keyword-driven collections from rule definitions,
merges and deletes duplicate handles in `MERGES`, unpublishes collections that end
up with no products, and leaves every active product in at least one collection.
Curated collections (rule-free handles such as `premium-store`, `tshirts-adt`,
`lollapalooza-india` lineups) only ever gain members. Rules are authoritative for the
handles listed in `RULES`, so a hand-added product in one of those collections is
dropped by the next run unless it is listed in `PINNED_MEMBERS`; the dry run's
REVIEW block names every product a run would drop.

**Rollback:** each `--execute` writes `collection_tidy_snapshot-<timestamp>.json`
(next to the script) holding the pre-run rows, the planned membership and the
`published_at` values. Restoring a deleted collection means re-inserting its row
from the snapshot and re-applying its `collects` list; `collects.id` and
`position` are not preserved. Keep one snapshot per run — earlier runs' files are
never overwritten now, but the first two runs shared the un-stamped filename and
only the later one survives.

**`new-arrivals` and `all`:** the storefront computes both from `products`
(`frontend/src/lib/data/autoCollections.ts`), so their `collects` rows are not
required and this script clears them on every `--execute`. Interim rows (48 newest
/ all 463 active) were seeded by hand on 2026-10-02 solely because the deployed
build still read `collects`; treat them as disposable and re-seed only if a
rollback puts an older build back in front.

### `generate_collection_covers.py`

Regenerates collection covers with Agnes AI when `collections.image_src` is dead
or missing (a 2026-10 sweep found 29 rows pointing at decommissioned Shopify CDN
URLs). Dry run by default; `--execute` uploads to R2 (`collections/<handle>.webp`)
and PATCHes each collection's `storage_image_url` + `image_alt`
(`"<Title> — YORD India"`) while NULLing `image_src` in one write. Options:
`--only <handle>`, `--force` (regenerate even covered collections, bypassing the
checkpoint's 200-URL short-circuit), `--qa-only --qa-dir <dir>` to
re-run the contrast gate on delivered files without generating anything, and
`--allow-low-contrast` (emergency only; never needed for the 39 shipped covers).

Every image must pass the numeric gate in the script (p75, p99, %-pixels over
120, centre-region stddev) before it is uploaded; a dark subject is fixed by
adding a pale/ivory anchor object to its prompt, not by loosening the gate. The
run keeps `collection_covers_checkpoint.json` (resumable) and reports per-handle
metrics. **Covers are subject-first (2026-10-03 owner direction):** the artist,
cricketer and character collections depict their figure through
`REFERENCE_IMAGES` — reference photos uploaded to R2 `collections/refs/` (from
the local artist hero portraits, Wikimedia press photos for the cricketers/DJs,
and R2 product prints for merch-art subjects). A handle with references is
generated through Agnes's image-edit mode (`extra_body.image`) with an identity
clause: the face must match the reference photograph. The text ban is repeated
per object because AI lettering migrates to the nearest prop (amps, bat faces,
wristbands, cap fronts); removing the prop from the scene is more reliable than
banning the text on it. Flat-cartoon subjects use the theme's `raw_prompt`
escape hatch (the templates' studio-light language drags the model into
photoreal 3D). Never put a bare celebrity name in a prompt — the reference
carries the identity.

## Archive Recovery Pipeline (data/clean/)

Wayback-captured data (`data/*.json`) is normalized offline before ingest.
Raw files are never modified; every step writes `data/clean/` and is
dry-run by default.

```bash
python clean_data.py --execute        # dedupe images, strip blog bylines -> data/clean/
python reorg_media.py --execute       # copy local_media into per-handle folders + alt text
python merge_enrichment.py --execute  # merge subagent SEO with guardrail checks
python blog_media.py --execute        # map blogs to substitute OG or placeholder plan
python ingest_clean.py --execute      # offline ingest rehearsal, writes ingest_rehearsal.json
```

The live ingest itself is not implemented here. `docs/deploy.md` records the
database order, the R2 key conventions and the decisions for
loading `data/clean/` (products live as `active`, article bodies cleaned and
converted to HTML, generated images for articles whose originals were lost).
`clean_data.py` reads the flat `data/*.json` inputs, which are now held as
`data/rows/` (see below) — run `python split_rows.py --restore --execute`
first if that stage must be re-derived.

### `upload_local_media.py`
Publishes the local media archive (`data/local_media/`, the only copy of the
Wayback-recovered product and article images) to R2 and writes the URL map that
ingest needs. Every image lands as one web-optimized WebP variant (max 1600px),
so a single object serves every breakpoint.

```bash
python upload_local_media.py                      # dry run: plan + sizes
python upload_local_media.py --execute            # upload everything
python upload_local_media.py --execute --resume   # continue after a stop
python upload_local_media.py --execute --only products --limit 100
```

Outputs: `data/r2_upload_checkpoint.json` (resume state, safe to delete),
`data/r2_media_manifest.json` (ingest-facing map), and
`data/r2_upload_errors.json` (only on failure).

Enrichment is fanned out to worker subagents (6 product batches + 3 blog
batches, one file each under `data/clean/enriched/`); the merge gate
rejects any batch whose handles/titles differ or whose SEO lengths fail,
and emits `review_queue.json` for human spot-check.

### Row layout (`split_rows.py`)

The entity records live as one file per row, keyed by `handle` — the only
unique key every entity has (`product_group_id` is absent on 31 products, and
`slug` mirrors `handle` for every blog):

```bash
python split_rows.py            # dry-run: counts, collisions, stale files
python split_rows.py --execute  # write data/rows/<kind>/<handle>.json
python split_rows.py --verify   # check the tree against the manifest
python split_rows.py --restore --execute   # rebuild data/<kind>.json
```

`data/rows/_index.json` records the per-kind row order (a folder of files
loses array order) plus a SHA-256 per row, so `--verify` checks the tree with
or without the flat sources and still compares every field against them while
they exist. The flat `data/products.json`, `blogs.json`, `collections.json`,
`concerts.json`, `artists.json`, `pages.json` and `policies.json` were removed
once the tree verified clean — `--restore` rebuilds them byte-for-byte, which
is the step `clean_data.py` needs if the clean stage is ever re-derived.
Handles are checked before anything is written: filename-safe and unique per
kind even on a case-insensitive filesystem. Stale row files (handle gone from
the source) are reported; `--prune` deletes them. `--source clean` splits
`data/clean/` the same way, preferring the enriched copies — pass `--out` to
keep the trees apart.

## Verification & Audit

Runbook: [`MIGRATION_AUDIT_REPORT.md`](./MIGRATION_AUDIT_REPORT.md) — full
pre/post-migration audit checklist. Start there before running verify.

### `verify_r2.py`
Checks that the `R2_*` configuration is complete, then (with `--execute`)
uploads a probe to `verify/<timestamp>.webp`, fetches it through
`R2_PUBLIC_BASE_URL` and deletes it again. Run it before an ingest or a deploy:
it catches a wrong key, a missing bucket or a non-public bucket up front.

```bash
python verify_r2.py             # configuration only (dry run)
python verify_r2.py --execute   # put + fetch + delete
```

### `verify_migration.py`
Post-migration verification - checks data integrity and counts.

```bash
# Quick verification
python verify_migration.py --quick

# Full verification with details
python verify_migration.py --full
```

### `audit_shopify.py`
Pre-migration audit - inventories Shopify data before migration.

```bash
python audit_shopify.py
```

Outputs: `audit_results.json`

### `comprehensive_audit.py`
Full database audit with relationship validation.

```bash
python comprehensive_audit.py
```

Outputs: `comprehensive_audit_results.json`

## Image Optimization

### `download_media_local.py`
Downloads product images to local disk for processing.

```bash
python download_media_local.py
```

### `compress_media_local.py`
Compresses images locally before upload.

```bash
python compress_media_local.py
```

### `optimize_images.py`
Re-runs the variant policy over stored media: images that are not yet a
web-optimized WebP (max 1600px wide) are re-encoded and re-uploaded to R2, and
the superseded object is removed only after the new one lands. Images that
already match are skipped.

```bash
python optimize_images.py
```

## Customer Data

### `import_customers_from_csv.py`
Imports customer data from Shopify CSV export.

```bash
python import_customers_from_csv.py customers.csv
```

## Database Schema

### `schema.sql`
Main database schema file. Apply via Supabase SQL editor or:

```bash
# Using Supabase CLI
supabase db push
```

### `schema_patches/`
Incremental schema updates. Apply in order:
```bash
# 001_fix_collects.sql - Fixes collects table constraints
```

## Utility Scripts

### `list_collections.py`
Lists all collections in Supabase.

```bash
python list_collections.py
```

## Archived Scripts

Scripts in `archive/` are deprecated but kept for reference:
- `fix_artist_collections.py` - Superseded by `populate_collections.py`
- `populate_collects.py` - Superseded by `populate_collections.py`
- `populate_smart_collection_collects.py` - Superseded by `populate_collections.py`
- `final_verification.py` - Merged into `verify_migration.py`
- `verify_images.py` - Merged into `verify_migration.py`
- `verify_order_addresses.py` - Merged into `comprehensive_audit.py`
- Debug scripts (check_*, debug_*)
- Legacy schema scripts (apply_schema_*, setup_supabase.sql)

## Shared Utilities (`utils/`)

### `shopify.py`
```python
from utils.shopify import ShopifyClient

client = ShopifyClient()
products = client.get_all('products')  # Auto-pagination with retry
```

### `supabase_helpers.py`
```python
from utils.supabase_helpers import get_supabase_client, batch_upsert

supabase = get_supabase_client()
batch_upsert(supabase, 'products', records, batch_size=100)
```

### `config.py`
```python
from utils.config import ARTIST_COLLECTIONS, HOMEPAGE_ARTISTS

# ARTIST_COLLECTIONS = {'coldplay': {...}, 'taylor-swift': {...}, ...}  # handle -> metadata
# HOMEPAGE_ARTISTS = ['karan-aujla', 'diljit-dosanjh', 'honey-singh', 'coldplay']
```

### `logging_config.py`
```python
from utils.logging_config import setup_logging

logger = setup_logging(__name__)
logger.info('Migration started')
```

## Checkpoint Files

Scripts create checkpoint files to allow resume on failure:
- `optimization_checkpoint.json`
- `migration_checkpoint.json`

These can be safely deleted to restart from scratch.

## Error Logs

Error details are written to JSON files:
- `media_migration_errors.json`
- `optimization_errors.json`
- `upload_errors.json`

## Ops Runbook

1. 429 storm: wait it out -- `utils/retry.py` honors `Retry-After` with backoff+jitter; rerun same command.
2. Resume: rerun with `--resume` (or `--checkpoint-file X`); delete `*_checkpoint.json` for clean restart.
3. Error schema: `[{"table": str, "id": value, "error": str, "ts": iso-UTC}]` per file above.
4. Counts: `None`/`ERROR` means query failed (retry creds/network), not zero rows.
5. Logs rotate at 5MB x3 (`migration.log`, `media_migration.log`); attach latest + error JSON when reporting.

## Migration Order

For a fresh migration, run in this order:

1. Apply schema: `schema.sql`, then `supabase/migrations/` 001-005 in order
   (005 adds blogs/articles tables + product SEO columns)
0b. For archive-recovered data: run the Archive Recovery Pipeline above first,
    then rehearse with `ingest_clean.py --execute` (validation only — it
    writes `ingest_rehearsal.json`, it does not upload). No command ingests
    `*.enriched.json` into Supabase yet; `migrate_via_rest.py` always
    fetches from Shopify.
2. Migrate core data: `migrate_via_rest.py --execute`
3. Migrate media: `migrate_media.py --execute`
4. Migrate blogs: `migrate_blogs.py --execute`
5. Populate collections: `populate_collections.py --mode=keyword --execute`
6. Verify: `verify_migration.py --full`
7. Optimize images: `optimize_images.py` (no `--execute` flag; it runs on invoke)

Or drive the same order through the `yord` runner (plans, streams logs
to `.yord/runs/<timestamp>/`, writes `ledger.json`):

```bash
python yord.py migrate --dry-run    # plan + env check, no writes
python yord.py migrate --execute    # full pipeline
python yord.py migrate --execute --from blogs   # resume at step
python yord.py verify               # verify_migration.py
```
