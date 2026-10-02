import 'server-only';

import { fail, reader, rows, uniqueIds, type DbError } from './client';
import { revenueWindowStart } from './analytics';
import { coversForProducts } from './covers';

/**
 * Behavioral (traffic & engagement) reads for the analytics page.
 *
 * Windows mirror `analytics.ts` exactly — `revenueWindowStart`, whole UTC days
 * ending yesterday — so a revenue KPI and an engagement KPI for the same
 * `?range=` describe the same days. Rollups run in Postgres via the RPCs in
 * `supabase/migrations/010_analytics_events.sql`; the browser-side collector
 * is `frontend/src/lib/analytics/`.
 *
 * The 010 RPCs are not yet in the generated `@yord/db-types` Functions map
 * (that file regenerates from a live project), so the service client is cast
 * to a structural RPC view. Every field coming back is coerced through
 * `num()`/`String()` regardless — the cast widens the call, never the trust.
 */

const ENTITY = 'analytics_events';

/** Top-N sizes: products per ranking, pages and search terms per list. */
export const TOP_PRODUCTS = 8;
export const TOP_PAGES = 8;
export const TOP_SEARCH_TERMS = 10;

interface RpcClient {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: DbError | null }>;
}

/** PostgREST numbers arrive as strings or numbers depending on the type. */
function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Engagement totals over one window, exactly as `analytics_kpis` returns them. */
export interface EngagementKpis {
  pageViews: number;
  uniqueVisitors: number;
  productViews: number;
  addToCarts: number;
  wishlistAdds: number;
  searches: number;
  checkoutStarted: number;
  ordersCompleted: number;
  orderValue: number;
}

/** The window and the one before it, for the KPI delta cards. */
export interface WindowEngagement {
  current: EngagementKpis;
  previous: EngagementKpis;
}

/** One zero-filled day of traffic. */
export interface PageViewPoint {
  /** `YYYY-MM-DD` in UTC. */
  day: string;
  views: number;
  uniqueVisitors: number;
}

export interface TemplateViews {
  template: string;
  views: number;
}

export interface PagePathViews {
  path: string;
  views: number;
}

/** A ranked product row with title/cover resolved by this module. */
export interface ProductEngagement {
  productId: number;
  title: string;
  imageUrl: string | null;
}

export interface ProductViews extends ProductEngagement {
  views: number;
  uniqueVisitors: number;
}

export interface ProductAdds extends ProductEngagement {
  adds: number;
}

export interface ViewOrderRow extends ProductEngagement {
  /** Window views vs all-time units sold (`line_items` has no ranged rollup). */
  views: number;
  units: number;
}

export interface SearchTermRow {
  term: string;
  searches: number;
  zeroResults: number;
}

export interface EngagementData {
  /** Window length in days (the sanitized `?range=` value). */
  days: number;
  /** Current window, one point per day, oldest → newest, zero-filled. */
  byDay: PageViewPoint[];
  /** The window immediately before `byDay`, same length, aligned by index. */
  previousByDay: PageViewPoint[];
  kpis: WindowEngagement;
  templates: TemplateViews[];
  topPages: PagePathViews[];
  topViewed: ProductViews[];
  topCartAdds: ProductAdds[];
  topWishlisted: ProductAdds[];
  searchTerms: SearchTermRow[];
  viewToOrder: ViewOrderRow[];
}

function mapKpis(data: unknown): EngagementKpis {
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    pageViews: num(row.page_views),
    uniqueVisitors: num(row.unique_sids),
    productViews: num(row.product_views),
    addToCarts: num(row.add_to_carts),
    wishlistAdds: num(row.wishlist_adds),
    searches: num(row.searches),
    checkoutStarted: num(row.checkout_started),
    ordersCompleted: num(row.order_completed),
    orderValue: num(row.order_value),
  };
}

/** Days with no traffic still chart, same convention as `revenue_by_day`. */
function zeroFillDays(
  totals: Map<string, { views: number; uniqueVisitors: number }>,
  since: Date,
  days: number,
): PageViewPoint[] {
  const points: PageViewPoint[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(since);
    day.setUTCDate(day.getUTCDate() + offset);
    const key = day.toISOString().slice(0, 10);
    const hit = totals.get(key);
    points.push({
      day: key,
      views: hit?.views ?? 0,
      uniqueVisitors: hit?.uniqueVisitors ?? 0,
    });
  }
  return points;
}

/** Product titles for a bounded id set, in one query. */
async function productTitles(
  client: Awaited<ReturnType<typeof reader>>,
  ids: number[],
): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const products = await rows<{ id: number; title: string }>(
    'products',
    client.from('products').select('id, title').in('id', ids),
  );
  return new Map(products.map((product) => [product.id, product.title]));
}

/**
 * Everything the analytics page's engagement section shows, in one parallel
 * batch: two KPI windows, the day series over `2 × days` (current + previous
 * sliced from one RPC call, the `getRangeAnalytics` pattern), the per-window
 * top-N rankings, and one shared title/cover lookup for every product named
 * in those rankings.
 */
export async function getEngagement(days: number): Promise<EngagementData> {
  const windowDays = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : 14;
  const client = await reader({ service: true });
  const rpc = (fn: string, args?: Record<string, unknown>) =>
    (client as unknown as RpcClient).rpc(fn, args);
  const currentStart = revenueWindowStart(windowDays).toISOString();
  const doubleStart = revenueWindowStart(windowDays * 2).toISOString();

  const [kpiCurrent, kpiPrevious, byDay, templates, pages, viewed, cartAdds, wishlisted, terms, viewOrder] =
    await Promise.all([
      rpc('analytics_kpis', { p_since: currentStart }),
      rpc('analytics_kpis', { p_since: doubleStart }),
      rpc('page_views_by_day', { p_since: doubleStart }),
      rpc('page_views_by_template', { p_since: currentStart }),
      rpc('top_pages', { p_since: currentStart, p_limit: TOP_PAGES }),
      rpc('top_viewed_products', { p_since: currentStart, p_limit: TOP_PRODUCTS }),
      rpc('top_cart_adds', { p_since: currentStart, p_limit: TOP_PRODUCTS }),
      rpc('top_wishlisted', { p_since: currentStart, p_limit: TOP_PRODUCTS }),
      rpc('top_search_terms', { p_since: currentStart, p_limit: TOP_SEARCH_TERMS }),
      rpc('product_view_to_order', { p_since: currentStart, p_limit: TOP_PRODUCTS }),
    ]);

  // One failure fails the section; the error boundary renders it. Skipping
  // the failed rollup and charting zeros would be the "empty vs failed"
  // mistake the data layer exists to prevent.
  for (const result of [kpiCurrent, kpiPrevious, byDay, templates, pages, viewed, cartAdds, wishlisted, terms, viewOrder]) {
    if (result.error) fail(ENTITY, result.error);
  }

  const dayTotals = new Map<string, { views: number; uniqueVisitors: number }>();
  for (const row of (byDay.data ?? []) as Record<string, unknown>[]) {
    dayTotals.set(String(row.day ?? '').slice(0, 10), {
      views: num(row.views),
      uniqueVisitors: num(row.unique_sids),
    });
  }

  // Raw ranking rows, enriched with title/cover once both lookups land.
  const topViewedRows = ((viewed.data ?? []) as Record<string, unknown>[]).map((row) => ({
    productId: num(row.product_id),
    views: num(row.views),
    uniqueVisitors: num(row.unique_sids),
  }));
  const topCartAddsRows = ((cartAdds.data ?? []) as Record<string, unknown>[]).map((row) => ({
    productId: num(row.product_id),
    adds: num(row.adds),
  }));
  const topWishlistedRows = ((wishlisted.data ?? []) as Record<string, unknown>[]).map((row) => ({
    productId: num(row.product_id),
    adds: num(row.adds),
  }));
  const viewToOrderRows = ((viewOrder.data ?? []) as Record<string, unknown>[]).map((row) => ({
    productId: num(row.product_id),
    views: num(row.views),
    units: num(row.units),
  }));

  // Titles and covers for every product the rankings name, in one batch of
  // two queries — the low-stock list pattern, never one lookup per row.
  const productIds = uniqueIds([
    ...topViewedRows.map((row) => row.productId),
    ...topCartAddsRows.map((row) => row.productId),
    ...topWishlistedRows.map((row) => row.productId),
    ...viewToOrderRows.map((row) => row.productId),
  ]);
  const [titles, covers] = await Promise.all([
    productTitles(client, productIds),
    coversForProducts(productIds),
  ]);

  const withProduct = <T extends { productId: number }>(row: T) => ({
    ...row,
    title: titles.get(row.productId) ?? `Product #${row.productId}`,
    imageUrl: covers.get(row.productId) ?? null,
  });

  return {
    days: windowDays,
    byDay: zeroFillDays(dayTotals, revenueWindowStart(windowDays), windowDays),
    previousByDay: zeroFillDays(dayTotals, revenueWindowStart(windowDays * 2), windowDays),
    kpis: { current: mapKpis(kpiCurrent.data), previous: mapKpis(kpiPrevious.data) },
    templates: ((templates.data ?? []) as Record<string, unknown>[]).map((row) => ({
      template: String(row.template ?? 'other'),
      views: num(row.views),
    })),
    topPages: ((pages.data ?? []) as Record<string, unknown>[]).map((row) => ({
      path: String(row.path ?? '/'),
      views: num(row.views),
    })),
    topViewed: topViewedRows.map(withProduct),
    topCartAdds: topCartAddsRows.map(withProduct),
    topWishlisted: topWishlistedRows.map(withProduct),
    searchTerms: ((terms.data ?? []) as Record<string, unknown>[]).map((row) => ({
      term: String(row.term ?? ''),
      searches: num(row.searches),
      zeroResults: num(row.zero_results),
    })),
    viewToOrder: viewToOrderRows.map(withProduct),
  };
}
