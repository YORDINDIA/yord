# Media Library

## Goals
- Centralize all product and blog imagery.

## Data Sources
- Supabase Storage bucket (default: `products`).
- References from `product_images` and `articles`.

## Capabilities
- Upload, rename, replace, and retire assets.
- Auto-generate alt text suggestions (optional AI).
- Track usage (which products/articles reference an asset).

## Safety
- Prevent deletion if asset is referenced.
- Offer replace-in-place flow to avoid broken links.
