# Google Merchant Center — YORD India

Account: **5446074412** (yordindia.com product feed + Shopping free listings).

This doc records why the 2026-10 changes were made, the account settings the
site must stay consistent with, and the order of operations for the rollout.
Read the "Rollout order" section before running anything from here.

## What was wrong (Oct 2026)

Merchant Center flagged a critical **Misrepresentation** issue (blocking every
product) plus an **Invalid rectangular logo** (manual check). The on-site
causes found and fixed:

| Trigger | Fix |
| --- | --- |
| Fake support phone `+91 98765 43210` on `/contact` | Removed; contact is email-only (`info@` / `support@`). `frontend/src/features/support/ContactForm.tsx` |
| "10K+ FANS" / "5★ RATING" hardcoded on every artist page | Replaced with real per-artist design count + free shipping + returns. `frontend/src/features/artist/ArtistHero.tsx` |
| "Official Merchandise" / "official artist merchandise" copy on fan-made designs | Removed everywhere (artist tagline fallback, collections metadata, order share text, FAQ answers) + sitewide footer disclaimer: *"Unofficial fan-made designs. Not affiliated with or endorsed by any artist."* |
| GST added only at checkout (₹1,499 → ₹1,769) — Google India requires feed price incl. GST = landing page price | Prices are now **GST-inclusive everywhere** (PDP, cart, checkout, feed, JSON-LD). See below. |
| Thin business identity in JSON-LD | `organizationSchema` now carries email + address; product schema declares `brand: YORD India` (never the artist) + shipping/return policy |

The rectangular logo asset lives at `frontend/public/brand/`:
`yord-logo-1500x750.png` / `.webp` (exactly 2:1, inside Google's required
1000×500–2000×1000 px range, white background). Regenerate with
`scripts/generate_brand_logo.html` (usage in its header comment).

## Pricing model (owner decision, Oct 2026)

- Stored variant prices are the **final amount the customer pays** (GST-inclusive).
- GST is *extracted* for the order record, never added: 5% per piece up to and
  including ₹2,500; 18% above. Logic in `frontend/src/lib/pricing.ts`
  (`computeTotals` takes priced lines; the slab reads the unit price).
- `scripts/reprice_gst_inclusive.py` scaled the historical ex-GST prices so the
  net per piece is unchanged (₹1,499 → ₹1,574; ₹11,000 → ₹12,980). A prior
  snapshot in the cwd blocks `--execute`; re-running scales again — never run
  it twice.
- Dry run (2026-10-16, live catalog): 3,315 variants; ₹1,499 → ₹1,574 ×628,
  ₹900 → ₹945 ×772, ₹2,000 → ₹2,100 ×176, ₹11,000 → ₹12,980 ×15; 12 variants
  landed on the ₹2,500 slab cap; net change across all variants −₹778 (the
  cap's rounding cost).

## Product feed

- URL: `https://yordindia.com/feed/google-merchant.xml` (scheduled fetch; daily).
- Built by `frontend/src/lib/feed/google-merchant.ts` (pure, unit-tested) from
  the route `frontend/src/app/feed/google-merchant.xml/route.ts`. One item per
  size variant, `item_group_id` groups a product, price straight from the DB
  (cannot drift from the site), images from `media.yordindia.com`, brand
  `YORD India`, `identifier_exists: no` (catalog has no GTINs).
- The route **fails with 500 rather than serving a partial document** — GMC
  reads missing items as deletions. The skipped-product count is logged
  (`merchant-feed SKIPPED`); products without an image or a priced variant are
  omitted.
- Not under `/api/` on purpose: `robots.ts` disallows `/api/` for crawlers.

## Merchant Center settings to enter (must match the site)

- **Business identity**: YORD India; Gurgaon, Haryana 122001, India (add the
  street address here once it is public — the site and GMC must agree);
  website `https://yordindia.com`; customer service email
  `support@yordindia.com`. No phone (owner decision — email only).
  - **Open item (needs owner confirmation):** Terms of Service §9 names
    "courts in Mumbai, Maharashtra" as the jurisdiction while the identity
    block says Gurgaon, Haryana. Decide which is correct and align the other —
    a jurisdiction that contradicts the stated address is exactly the kind of
    inconsistency the Misrepresentation review looks for.
- **Branding → rectangular logo**: upload `frontend/public/brand/yord-logo-1500x750.png`.
- **Shipping**: India; free shipping on every order; handling 1–2 business
  days; transit 3–7 business days (metro 3–5).
- **Returns**: 14 days from delivery, by mail (prepaid label), refund in 5–7
  business days; policy URL `https://yordindia.com/returns`.
- **Data source**: Products → Data sources → Scheduled fetch →
  `https://yordindia.com/feed/google-merchant.xml`, fetch daily.

## Rollout order (do not reorder)

1. Deploy the frontend changes (inclusive pricing, claims cleanup, feed, logo).
2. Verify on the live site:
   - a product page shows "Inclusive of all taxes" and one price,
   - a test checkout charges exactly that price (no GST added),
   - `https://yordindia.com/feed/google-merchant.xml` returns `<item>` elements.
3. Run the reprice (only now): `cd scripts && source venv/bin/activate`,
   `python reprice_gst_inclusive.py` (dry run — read the transition table),
   then `python reprice_gst_inclusive.py --execute`. Running it before step 1
   deploys would charge new_price + 18% at the old checkout.
4. In Merchant Center: upload the logo, fill business info, shipping, returns,
   add the feed.
5. Only after 1–4 are done, request the account review for the Misrepresentation
   issue. Reviews take ~7 business days.
6. Work through item-level diagnostics if any appear after ingestion
   (typically images or shipping), then re-request if needed.

## Ongoing checks

- Monthly: Merchant Center → Products → Needs attention (item disapprovals);
  confirm the feed fetch succeeded and the item count is close to the number of
  active variants (~3,300 at the time of writing).
- When adding a product in the admin: it is picked up automatically by the next
  feed fetch (1 h CDN cache, daily GMC fetch). New products need an image and a
  variant price to enter the feed.
- If product images are ever regenerated by AI tooling, keep the IPTC
  `DigitalSourceType` metadata: GMC requires AI-generated images to carry it.
  (Open follow-up: spot-check the WebP conversions for the tag — sampling on
  2026-10-16 found no XMP/IPTC blocks at all, so assume the tag is absent until
  a regeneration adds it.)
- Optional reputation step Google recommends: Google Customer Reviews opt-in on
  the order-confirmation page (env-gated merchant id) — only genuine reviews,
  never a fabricated rating widget.

## Known image gap (fix before 2027-01-31)

Google's image-size minimum becomes **500×500 px on January 31, 2027** (today's
floor is lower). A 2026-10-16 audit of all 3,303 main feed images found **104
under 500 px on one side, belonging to 9 products** (103 at 400×500, one at
480×853):

```
coldplay-tour-glow-in-dark-oversized-t-shirt-copy
coldplay-wristband-set-blue-with-white-print-pack-of-2
premium-coldplay-oversized-concert-t-shirt-french-terry-cotton-240-gsm
premium-oversize-coldplay-concert-t-shirt-french-terry-cotton-240-gsm
premium-oversize-coldplay-french-terry-cotton-t-shirt-240-gsm
premium-oversize-coldplay-french-terry-cotton-t-shirt-luxury-concert-wear-240-gsm
premium-oversized-coldplay-concert-t-shirt-french-terry-cotton-240-gsm
premium-oversized-french-terry-cotton-coldplay-concert-t-shirt-luxury-240-gsm-fabric
yoyo-honey-singh-desi-kalakar-limited-edition-premium-concert-t-shirt
```

Re-generate/upscale those images (the source files are low-res, so a real
re-shoot/render beats an upscale) and re-upload via the media pipeline. The
other 3,188 main images are 1200–2000 px.

Debug note: `media.yordindia.com` (Cloudflare) blocks `Python-urllib` with a
403 — use curl or a browser-like UA for scripted media checks. Googlebot and
Googlebot-Image both get 200 (verified 2026-10-16), including on ranged GETs.

## Snapshots

`scripts/reprice_gst_inclusive_snapshot-*.json` — pre-reprice price and
compare_at_price for every variant, written to the cwd of the `--execute` run.
Manual rollback: re-apply each `price` / `compare_at_price` with a per-row
update, or feed the file back through the same update loop.
