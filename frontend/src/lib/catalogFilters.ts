import { escapeLike } from '@/lib/search';
import { PRODUCT_SELECT } from '@/lib/data/productsByIds';

/**
 * Catalog filters shared by `/products`, the auto collections and
 * `GET /api/products`: one parser for the URL, one builder for the SQL.
 * Pure (no client), so the page, the route and the tests all use the same code.
 */

/** Price bands, keyed for the URL. `min` is inclusive, `below` exclusive. */
export const PRICE_BANDS = [
  { key: 'under-1000', label: 'Under ₹1,000', below: 1000 },
  { key: '1000-1999', label: '₹1,000 to ₹1,999', min: 1000, below: 2000 },
  { key: '2000-2999', label: '₹2,000 to ₹2,999', min: 2000, below: 3000 },
  { key: '3000-plus', label: '₹3,000 and above', min: 3000 },
] as const satisfies readonly { key: string; label: string; min?: number; below?: number }[];

export type PriceBandKey = (typeof PRICE_BANDS)[number]['key'];

const BAND_KEYS: readonly string[] = PRICE_BANDS.map((b) => b.key);

/** Apparel order; anything else (numeric, "Free Size") follows, alphabetical. */
export const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL'];

/**
 * True for a real size label: apparel letters (XS, 2XL) or a numeric size
 * (waist 32). Variant `option1` also carries colours and fits ("Black",
 * "oversize") on a few products; those are not sizes and stay out of the facet.
 */
export function isSizeLabel(value: string): boolean {
  return /^(?:\d?X{0,3}[SML]|X{1,3}S|\dXS|\d{2})$/i.test(value.trim());
}

export function sortSizes(sizes: Iterable<string>): string[] {
  const rank = (s: string) => {
    const i = SIZE_ORDER.indexOf(s.toUpperCase());
    return i === -1 ? SIZE_ORDER.length : i;
  };
  return [...new Set(sizes)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export interface CatalogFilterValues {
  /** Artist collection handle ("coldplay"): products link to an artist through
   *  its collection, not `vendor`, which is "YORD" on nearly every row. */
  artist?: string;
  type?: string;
  size?: string;
  price?: PriceBandKey;
  /** Only products with at least one variant in stock. */
  stock?: boolean;
}

const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Sizes are short labels; anything else in `?size=` is noise and dropped. */
const SIZE_PATTERN = /^[\w .+/-]{1,24}$/;

const text = (v: unknown, max = 200) =>
  typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : undefined;

/** Read filters from search params. Unknown or malformed values are dropped. */
export function parseCatalogFilters(params: Record<string, string | string[] | undefined>): CatalogFilterValues {
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const size = text(one('size'), 24);
  const price = one('price');
  const artist = text(one('artist'), 100);
  return {
    artist: artist && HANDLE_PATTERN.test(artist) ? artist : undefined,
    type: text(one('type')),
    size: size && SIZE_PATTERN.test(size) ? size : undefined,
    price: price && BAND_KEYS.includes(price) ? (price as PriceBandKey) : undefined,
    stock: one('stock') === '1' || undefined,
  };
}

/** Size and stock filter through a second, aliased variants embed. */
const needsAvailability = (f: CatalogFilterValues) => Boolean(f.size || f.stock);

/**
 * The select for a filtered products query. The aliased embeds are inner joins
 * used only to filter: `avail` (size, stock) leaves the regular
 * `product_variants` embed returning every variant, so the card's price and
 * stock stay correct; `artist_c` joins the artist's collection membership.
 */
export function catalogSelect(f: CatalogFilterValues): string {
  let select = PRODUCT_SELECT;
  if (needsAvailability(f)) select += ', avail:product_variants!inner(id)';
  if (f.artist) select += ', artist_c:collects!inner(collections!inner(handle))';
  return select;
}

/** The subset of the PostgREST builder the filters use. */
export interface FilterableQuery<Self> {
  eq(column: string, value: string): Self;
  ilike(column: string, pattern: string): Self;
  gt(column: string, value: number): Self;
  gte(column: string, value: number): Self;
  lt(column: string, value: number): Self;
}

/**
 * Apply catalog filters to a `products` query built with `catalogSelect(f)`.
 *
 * Artist is collection membership. Type is an exact, case-insensitive match:
 * the old `%value%` substring match made "Shirts" also return T-Shirts and
 * Sweatshirts. Price
 * filters on the cached `min_price` (a trigger in migration 001 keeps it fresh).
 */
export function applyCatalogFilters<Q extends FilterableQuery<Q>>(query: Q, f: CatalogFilterValues): Q {
  let q = query;
  if (f.artist) q = q.eq('artist_c.collections.handle', f.artist);
  if (f.type) q = q.ilike('product_type', escapeLike(f.type));
  const band = PRICE_BANDS.find((b) => b.key === f.price);
  if (band && 'min' in band) q = q.gte('min_price', band.min);
  if (band && 'below' in band) q = q.lt('min_price', band.below);
  if (needsAvailability(f)) q = q.gt('avail.inventory_quantity', 0);
  // Case-insensitive: the catalog stores both "xs" and "XS".
  if (f.size) q = q.ilike('avail.option1', escapeLike(f.size));
  return q;
}
