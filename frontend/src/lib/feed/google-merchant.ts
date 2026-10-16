/**
 * Google Merchant Center product feed builder (RSS 2.0, `g:` namespace).
 *
 * Pure and dependency-light so the XML can be unit-tested; the route
 * (`app/feed/google-merchant.xml/route.ts`) owns the DB read. One `<item>`
 * per SIZE VARIANT, grouped with `g:item_group_id`, because availability and
 * price live on the variant in this schema and GMC wants per-variant items
 * for apparel.
 *
 * Rules the builder enforces, each for a concrete failure:
 * - Prices are taken as-is (they are GST-inclusive; see `lib/pricing.ts`).
 *   Google India requires the feed price to include GST and to match the
 *   landing page, which reads the same stored price.
 * - `brand` is YORD India, never the artist: these are fan-made designs and
 *   the feed must not imply artist affiliation.
 * - No GTINs exist in the catalog (migration left `barcode` empty), so
 *   `g:identifier_exists` is `no`; a real barcode, if one ever appears, wins.
 * - Products without an image or without a priced variant are skipped —
 *   GMC would disapprove them anyway, and a bad item costs the whole feed a
 *   diagnostics cycle. The route logs the skipped count.
 * - No `sale_price`: the stored price IS the price the site shows. Compare-at
 *   anchoring belongs to the storefront, not the feed.
 */
import { stripHtml } from '@yord/ui';
import { isR2DevUrl } from '@/lib/media-loader';

export const FEED_BASE_URL = 'https://yordindia.com';
export const FEED_BRAND = 'YORD India';

const TITLE_MAX = 150;
const DESCRIPTION_MAX = 5000;
const MAX_IMAGES = 10; // image_link + up to 10 additional (GMC's cap)

export interface MerchantFeedVariant {
  id: number;
  title: string | null;
  option1: string | null;
  // DECIMAL columns arrive as strings at runtime (see product-helpers tests).
  price: number | string | null;
  sku: string | null;
  barcode: string | null;
  inventory_quantity: number | null;
}

export interface MerchantFeedImage {
  src: string | null;
  storage_url: string | null;
  position: number | null;
}

export interface MerchantFeedProduct {
  id: number;
  handle: string | null;
  title: string | null;
  body_html: string | null;
  meta_description: string | null;
  product_type: string | null;
  vendor: string | null;
  product_variants: MerchantFeedVariant[] | null;
  product_images: MerchantFeedImage[] | null;
}

export interface MerchantFeedOptions {
  baseUrl?: string;
  /** Mirrors `lib/media-loader.ts`: an r2.dev origin is rewritten to this. */
  mediaBaseUrl?: string;
}

export interface MerchantFeedResult {
  xml: string;
  /** Items written. */
  itemCount: number;
  /** Products omitted (no image, or no variant with a usable price). */
  skipped: number;
}

/**
 * product_type → Google product category (full taxonomy paths are accepted;
 * numeric ids are not used so a wrong id can't silently re-categorise).
 * Values are the actual distinct `products.product_type` values in the DB.
 */
const CATEGORY_BY_PRODUCT_TYPE: Record<string, string> = {
  't-shirts': 'Apparel & Accessories > Clothing > Shirts & Tops',
  'sweatshirts': 'Apparel & Accessories > Clothing > Shirts & Tops',
  'hoodies': 'Apparel & Accessories > Clothing > Shirts & Tops',
  'denim': 'Apparel & Accessories > Clothing > Pants',
  'coats & jackets': 'Apparel & Accessories > Clothing > Outerwear > Coats & Jackets',
  'apparel': 'Apparel & Accessories > Clothing',
  'bracelets': 'Apparel & Accessories > Jewelry > Bracelets',
  'wristbands': 'Apparel & Accessories',
  'refrigerator magnets': 'Home & Garden > Decor',
  'collectibles': 'Arts & Entertainment > Hobbies & Creative Arts > Collectibles',
};

const DEFAULT_CATEGORY = 'Apparel & Accessories > Clothing';

export function feedCategory(productType: string | null | undefined): string {
  const key = (productType ?? '').trim().toLowerCase();
  return CATEGORY_BY_PRODUCT_TYPE[key] ?? DEFAULT_CATEGORY;
}

/** `1234.5` → `"1234.50 INR"`; anything non-numeric or negative → `null`. */
export function feedPriceText(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return `${amount.toFixed(2)} INR`;
}

/**
 * Absolute, crawlable image URL. Root-relative paths resolve against the
 * store's own domain; an r2.dev origin is rewritten to the configured media
 * domain exactly like `lib/media-loader.ts` does for `next/image`.
 */
export function feedImageUrl(
  src: string | null | undefined,
  mediaBaseUrl?: string,
  baseUrl: string = FEED_BASE_URL
): string | null {
  const raw = src?.trim();
  if (!raw) return null;

  let absolute: string;
  if (raw.startsWith('https://') || raw.startsWith('http://')) {
    absolute = raw;
  } else if (raw.startsWith('/')) {
    absolute = `${baseUrl}${raw}`;
  } else {
    return null;
  }

  const override = mediaBaseUrl?.trim().replace(/\/+$/, '');
  if (override && override.startsWith('https://') && isR2DevUrl(absolute)) {
    const { pathname, search } = new URL(absolute);
    return `${override}${pathname}${search}`;
  }
  return absolute;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** The variant's size label, or `null` for a single-variant "Default Title". */
function variantSize(variant: MerchantFeedVariant): string | null {
  const candidate = (variant.option1 || variant.title || '').trim();
  if (!candidate || /^default( title)?$/i.test(candidate)) return null;
  return candidate;
}

function itemTitle(base: string, size: string | null): string {
  const suffix = size ? ` - ${size}` : '';
  const room = TITLE_MAX - suffix.length;
  const trimmed = base.length > room ? base.slice(0, room).trimEnd() : base;
  return `${trimmed}${suffix}`;
}

function itemDescription(product: MerchantFeedProduct, baseUrl: string): string {
  const meta = product.meta_description?.trim();
  const body = product.body_html
    ? stripHtml(product.body_html).replace(/\s+/g, ' ').trim()
    : '';
  const text =
    meta ||
    body ||
    `Shop ${product.title ?? 'this design'} from YORD India — premium fan-made concert merchandise. Free shipping across India, 14-day returns. ${baseUrl}`;
  return text.length > DESCRIPTION_MAX ? text.slice(0, DESCRIPTION_MAX).trimEnd() : text;
}

/** Image candidates in gallery order: storage_url (mirrored) wins over src. */
function productImageUrls(
  product: MerchantFeedProduct,
  mediaBaseUrl: string | undefined,
  baseUrl: string
): string[] {
  const images = (product.product_images ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const urls: string[] = [];
  for (const image of images) {
    const url = feedImageUrl(image.storage_url || image.src, mediaBaseUrl, baseUrl);
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls.slice(0, MAX_IMAGES + 1);
}

function itemXml(
  product: MerchantFeedProduct,
  variant: MerchantFeedVariant,
  images: string[],
  options: Required<MerchantFeedOptions>
): string {
  const handle = product.handle as string;
  const price = feedPriceText(variant.price) as string;
  const size = variantSize(variant);
  const category = feedCategory(product.product_type);
  const isApparel = category.startsWith('Apparel & Accessories');
  const inStock = (variant.inventory_quantity ?? 0) > 0;

  const lines: string[] = [];
  const el = (name: string, value: string) =>
    lines.push(`      <g:${name}>${escapeXml(value)}</g:${name}>`);

  el('id', `${product.id}-${variant.id}`);
  el('item_group_id', `${product.id}`);
  el('title', itemTitle(product.title as string, size));
  el('description', itemDescription(product, options.baseUrl));
  el('link', `${options.baseUrl}/product/${handle}`);
  el('image_link', images[0]);
  for (const extra of images.slice(1)) el('additional_image_link', extra);
  el('availability', inStock ? 'in_stock' : 'out_of_stock');
  el('price', price);
  el('condition', 'new');
  el('brand', FEED_BRAND);
  el('google_product_category', category);
  if (product.product_type?.trim()) el('product_type', product.product_type.trim());
  if (size) el('size', size);
  if (isApparel) {
    el('gender', 'unisex');
    el('age_group', 'adult');
  }
  // A real barcode wins; the migrated catalog has none, in which case GMC
  // requires the explicit `no` so the item isn't disapproved for a missing
  // unique identifier.
  const barcode = variant.barcode?.trim();
  if (barcode) {
    el('gtin', barcode);
  } else {
    el('identifier_exists', 'no');
  }
  const sku = variant.sku?.trim();
  if (sku) el('mpn', sku);

  return `    <item>\n${lines.join('\n')}\n    </item>`;
}

/**
 * The full RSS document. Products without a handle/title, without any usable
 * image, or without a single priced variant are omitted (and counted).
 */
export function buildMerchantFeed(
  products: MerchantFeedProduct[],
  options: MerchantFeedOptions = {}
): MerchantFeedResult {
  const resolved: Required<MerchantFeedOptions> = {
    baseUrl: (options.baseUrl ?? FEED_BASE_URL).replace(/\/+$/, ''),
    mediaBaseUrl: options.mediaBaseUrl ?? '',
  };

  const items: string[] = [];
  let skipped = 0;

  for (const product of products) {
    if (!product.handle?.trim() || !product.title?.trim()) {
      skipped += 1;
      continue;
    }
    const images = productImageUrls(product, resolved.mediaBaseUrl, resolved.baseUrl);
    if (images.length === 0) {
      skipped += 1;
      continue;
    }
    const priced = (product.product_variants ?? []).filter(
      (variant) => feedPriceText(variant.price) !== null
    );
    if (priced.length === 0) {
      skipped += 1;
      continue;
    }
    for (const variant of priced) {
      items.push(itemXml(product, variant, images, resolved));
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n` +
    `  <channel>\n` +
    `    <title>YORD India</title>\n` +
    `    <link>${escapeXml(resolved.baseUrl)}</link>\n` +
    `    <description>YORD India — premium concert merchandise product feed for Google Merchant Center.</description>\n` +
    `${items.join('\n')}\n` +
    `  </channel>\n` +
    `</rss>\n`;

  return { xml, itemCount: items.length, skipped };
}
