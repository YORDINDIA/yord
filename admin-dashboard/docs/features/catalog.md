# Catalog (Products and Variants)

## Goals
- Full product CRUD with Shopify-equivalent fields.
- Variant management with pricing, inventory, and options.
- Image management with ordering and alt text.

## Data Tables
- `products`, `product_variants`, `product_options`, `product_images`, `product_image_variants`, `metafields`.

## List View
- Search by title, handle, tags, vendor, product_type.
- Filters: status, published, vendor, product_type, tag.
- Bulk actions: publish, unpublish, archive, tag add/remove.

## Product Detail
- Core fields: title, handle, body_html, vendor, product_type, tags.
- Status: draft/active/archived.
- Publishing: published_at + visibility scope.
- SEO: optional metafields (title, description, canonical).
- Handles are editable after publish with a confirmation and audit log entry.
- Phase 1: no additional YORD-specific metafields required.

## Variants
- Grid editor for variants: price, compare_at_price, SKU, inventory_quantity, weight.
- Options: size/color fields via `product_options`.
- Image associations via `product_image_variants`.

## Media
- Product images are URL-based: the catalog form takes a public image URL,
  validation requires `https://` (or a site-relative path), and the action
  stores it in both `product_images` columns (`src` and `storage_url`).
  Reordering, cover selection, and alt text are edited on the product's image
  grid.
- Media-library uploads (`uploadMediaAction`) go straight to Cloudflare R2 and
  are tracked only through the audit log — they are *not* attached to
  `product_images`. To use one on a product, copy its public URL into the
  catalog form's image field.
- Legacy Supabase Storage URLs (in `src`) remain valid.

## Validation Rules
- Unique `handle` per product.
- At least one variant required.
- Price numeric and >= 0.
