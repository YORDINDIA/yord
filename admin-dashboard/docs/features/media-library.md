# Media Library

## Goals
- Centralize all product and blog imagery.

## Data Sources
- Cloudflare R2 (uploads go through `uploadMediaAction` with the server-only
  `R2_*` variables; images are stored as one web-optimized WebP variant, max
  1600px wide, built in the browser before upload).
- AI-generated images (`/api/ai/image`) are the exception: Agnes AI returns PNG
  and the server has no image encoder, so they are stored as PNG under
  `ai/<timestamp>.png`.
- References from `product_images` and `articles`.

## Capabilities
- Upload, rename, replace, and retire assets.
- Auto-generate alt text suggestions (optional AI).
- Track usage (which products/articles reference an asset).

## Safety
- Prevent deletion if asset is referenced.
- Offer replace-in-place flow to avoid broken links.
