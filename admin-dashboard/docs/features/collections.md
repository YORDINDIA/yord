# Collections

## Goals
- Manage both custom and smart collections.
- Provide rule builder with live preview.

## Data Tables
- `collections`, `collects`, `smart_collection_rules`.

## Custom Collections
- Manual product selection.
- Reorder via drag/drop (uses `collects.position`).
- Publish/unpublish and schedule.

## Smart Collections
- Rule builder based on product fields (title, vendor, product_type, tags, price, status).
- `smart_collection_rules` stores rule rows.
- Live preview list based on rules.

## Publishing and Sorting
- `sort_order` to control storefront ordering.
- `published` and `published_at` for visibility.

## Validation
- Unique `handle` per collection.
- Guard against empty collections unless explicitly allowed.
