/**
 * Media loader for `next/image`.
 *
 * The bucket stores one web-optimized variant per image (WebP, max 1600px — see
 * `scripts/utils/r2_helpers.py`). Product images
 * (`products/<handle>/<name>.webp`) additionally get pre-generated 320/640/960/
 * 1280 px siblings (`<name>-<width>.webp`) from
 * `scripts/generate_image_variants.py`; this loader maps the `width` Next asks
 * for onto the matching sibling, so a phone fetches a 320/640 px file instead of
 * the 1600 px original. Everything else — artist tiles, concert art, collection
 * covers, Shopify CDN, legacy Supabase, local files — is returned unchanged.
 *
 * It also owns the move from Cloudflare's development URL to a custom domain:
 * when `NEXT_PUBLIC_MEDIA_BASE_URL` is set, any stored `*.r2.dev` URL is
 * rewritten to that origin, keeping the path and query. That makes the switch a
 * one-line environment change instead of a database rewrite.
 *
 * Dependency: the variant rewrite is only safe once
 * `python scripts/generate_image_variants.py --execute` has uploaded the
 * siblings. Deploying this loader before the backfill makes every product image
 * request 404 — ship the two together, backfill first.
 *
 * Next bundles this file on its own and expects a default export, so it
 * deliberately imports nothing (see `images.loaderFile` in `next.config.ts`).
 */

export type MediaLoaderArgs = {
  src: string;
  width: number;
  quality?: number;
};

/** Sibling widths `scripts/generate_image_variants.py` writes per product image. */
const PRODUCT_VARIANT_WIDTHS = [320, 640, 960, 1280] as const;

/** Width of the stored product image itself; larger requests use that file. */
const PRODUCT_ORIGINAL_WIDTH = 1600;

/** Product images live at `/products/<handle>/<name>.webp` in the bucket. */
const PRODUCT_IMAGE_PATH = /^\/products\/[^/]+\/[^/]+\.webp$/;

/** A trailing width already applied by a previous pass, e.g. `01-640`. */
const VARIANT_SUFFIX = /-(?:320|640|960|1280)$/;

/** True for a URL served by Cloudflare's r2.dev development subdomain. */
export function isR2DevUrl(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && url.hostname.toLowerCase().endsWith('.r2.dev');
  } catch {
    return false;
  }
}

/** Trimmed override, or `undefined` when unset/insecure/malformed. */
function normaliseBase(mediaBaseUrl: string | undefined): string | undefined {
  const override = mediaBaseUrl?.trim().replace(/\/+$/, '');
  if (!override || !override.startsWith('https://')) return undefined;
  return override;
}

/**
 * Sibling width to serve for a requested width: the nearest of
 * 320/640/960/1280, with a tie rounding up (a 480px slot gets 640, not 320),
 * and anything above 1280 keeping the 1600px original.
 */
export function productVariantWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return PRODUCT_VARIANT_WIDTHS[0];
  const largest = PRODUCT_VARIANT_WIDTHS[PRODUCT_VARIANT_WIDTHS.length - 1];
  if (width > largest) return PRODUCT_ORIGINAL_WIDTH;

  let best: number = PRODUCT_VARIANT_WIDTHS[0];
  for (const candidate of PRODUCT_VARIANT_WIDTHS) {
    // `<=` lets the later (larger) candidate win a tie.
    if (Math.abs(candidate - width) <= Math.abs(best - width)) best = candidate;
  }
  return best;
}

/**
 * `src` rewritten to the matching product-image sibling, or `null` when `src`
 * is not a product image served by our bucket (r2.dev, or already on the
 * configured media domain). Keeps the origin, query, and encoded segments.
 */
function productVariantUrl(src: string, width: number, mediaBaseUrl: string | undefined): string | null {
  const override = normaliseBase(mediaBaseUrl);
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null; // root-relative paths are never bucket product images
  }

  const onR2Dev = isR2DevUrl(src);
  const onMediaDomain = Boolean(override) && src.startsWith(`${override}/`);
  if (!onR2Dev && !onMediaDomain) return null;
  if (!PRODUCT_IMAGE_PATH.test(url.pathname)) return null;

  const stem = url.pathname.slice(0, -'.webp'.length);
  const name = stem.slice(stem.lastIndexOf('/') + 1);
  if (VARIANT_SUFFIX.test(name)) return null; // already a variant; leave it

  const variantWidth = productVariantWidth(width);
  const pathname =
    variantWidth === PRODUCT_ORIGINAL_WIDTH ? url.pathname : `${stem}-${variantWidth}.webp`;
  const origin = onR2Dev && override ? override : url.origin;
  return `${origin}${pathname}${url.search}`;
}

/**
 * Delivery URL for one `srcset` entry.
 *
 * `quality` is accepted because Next passes it, and ignored because the stored
 * variant already carries its own compression.
 */
export function mediaLoader(
  { src, width }: MediaLoaderArgs,
  mediaBaseUrl: string | undefined = process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
): string {
  const variant = productVariantUrl(src, width, mediaBaseUrl);
  if (variant) return variant;

  const override = normaliseBase(mediaBaseUrl);
  if (!override || !isR2DevUrl(src)) {
    return src;
  }
  const { pathname, search } = new URL(src);
  return `${override}${pathname}${search}`;
}

export default mediaLoader;
