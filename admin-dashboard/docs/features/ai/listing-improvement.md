# AI: Improve Listing

## Scope
Enhance product listing content and merchandising.

## Inputs
- Product data (title, body_html, tags, vendor, product_type).
- Related images from `product_images`.

## Outputs
- Improved title and description (body_html).
- Updated tags and suggested collections.
- Suggested cross-sell or bundle ideas.

## Image Enhancement
- Generate improved images using original image as reference.
- Store drafts in Storage under an AI staging path.
- Show side-by-side preview and require approval.

## Approval
- Approve per field (title, description, tags, collections, images).
- Apply changes with audit log.
