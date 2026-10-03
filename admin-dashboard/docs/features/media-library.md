# Media Library

## Goals
- Centralize all product and blog imagery.

## Data Sources
- Cloudflare R2 (uploads go through `uploadMediaAction` with the server-only
  `R2_*` variables). Browser conversion to the stored WebP variant is
  conditional, not guaranteed: an existing WebP file is uploaded as-is (even
  wider than 1600px), and a file the browser cannot decode or encode falls
  back to the original JPEG/PNG bytes. When conversion succeeds the variant is
  capped at 1600px wide.
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
