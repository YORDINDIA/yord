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

Required environment variables (create `.env` in project root):
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
SHOPIFY_STORE=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=xxx
```

## Directory Structure

```
scripts/
├── README.md                  # This file
├── utils/                     # Shared utilities module
│   ├── __init__.py
│   ├── config.py              # Centralized configuration (artist lists, etc.)
│   ├── logging_config.py      # Standard logging setup
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
Migrates product images from Shopify CDN to Supabase Storage.

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
- `ARTIST_COLLECTIONS` - List of artist collection handles
- `TARGET_ARTISTS` - Homepage featured artists

## Verification & Audit

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
Optimizes images in Supabase Storage (resize, compress, WebP conversion).

```bash
python optimize_images.py --execute
```

### `upload_compressed_to_supabase.py`
Uploads compressed images to Supabase Storage.

```bash
python upload_compressed_to_supabase.py
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
from utils.config import ARTIST_COLLECTIONS, TARGET_ARTISTS

# ARTIST_COLLECTIONS = ['coldplay', 'taylor-swift', 'diljit-dosanjh', ...]
# TARGET_ARTISTS = ['coldplay', 'taylor-swift', 'diljit-dosanjh', 'linkin-park']
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

## Migration Order

For a fresh migration, run in this order:

1. Apply schema: `schema.sql`
2. Migrate core data: `migrate_via_rest.py --execute`
3. Migrate media: `migrate_media.py --execute`
4. Migrate blogs: `migrate_blogs.py --execute`
5. Populate collections: `populate_collections.py --mode=keyword --execute`
6. Verify: `verify_migration.py --full`
7. Optimize images: `optimize_images.py --execute`
