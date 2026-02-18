# Data Model Overview (Supabase)

## Core Tables (from schema)
Catalog and media
- `products`, `product_variants`, `product_images`, `product_image_variants`, `product_options`
- `inventory_items`, `inventory_levels`, `locations`
- `metafields`

Collections
- `collections` (custom + smart), `collects` (product mapping)
- `smart_collection_rules`

Orders and fulfillment
- `orders`, `line_items`, `shipping_lines`
- `transactions`, `transaction_payment_details`
- `fulfillments`, `fulfillment_line_items`
- `refunds`, `refund_line_items`, `refund_transactions`
- `order_*` tables: billing, shipping, tax, discounts, note attributes

Customers
- `customers`, `customer_addresses`, `customer_marketing_consent`

Discounts
- `price_rules`, `discount_codes`, `discount_applications`, `order_discount_codes`

Content
- `blogs`, `articles`

Operations
- `migration_log`

## Key Relationships
- `products` -> `product_variants`, `product_images`, `product_options`
- `product_variants` -> `inventory_items` (via `inventory_item_id`)
- `collections` <-> `products` via `collects`
- `orders` -> `line_items`, `transactions`, `fulfillments`, `refunds`
- `customers` -> `orders`, `customer_addresses`
- `blogs` -> `articles`

## Field Semantics to Preserve
- `products.tags`, `collections.tags`, `articles.tags` are stored as comma-separated text.
- `published`/`published_at` define visibility; `status` for products (active/draft/archived).
- `product_images.supabase_url` is the preferred image URL (Storage), `src` is original.

## Known Data Issues (from migration audit)
- `collects` migration failed without BIGINT schema fix.
- Customer PII missing if Shopify token lacked permissions.

See: `admin-dashboard/docs/appendices/data-issues.md`.
