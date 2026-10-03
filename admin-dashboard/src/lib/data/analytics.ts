import 'server-only';

import type { Order } from '@yord/db-types';
import {
  FINANCIAL_STATUSES,
  FULFILLMENT_STATUSES,
  LOW_STOCK_THRESHOLD,
  PRODUCT_STATUSES,
} from '@/lib/constants';
import { fail, reader, rows, runCount } from './client';
import { coversForProducts } from './covers';

/**
 * Dashboard + analytics reads.
 *
 * Both pages used to pull `.limit(500)` order rows and sum them in JS. That
 * under-reported revenue whenever a window held more than 500 orders, and the
 * analytics chart then bucketed 14 days out of that already-truncated set.
 * Aggregation now happens in Postgres via `admin-dashboard/sql/004_atomic_writes.sql`.
 */

/** Days of history the dashboard revenue windows cover. */
export const REVENUE_WINDOW_DAYS = 30;

/** Days charted by the analytics revenue card. */
export const REVENUE_CHART_DAYS = 14;

export interface RevenuePoint {
  /** `YYYY-MM-DD` in UTC. */
  day: string;
  total: number;
}

export interface RevenueSummary {
  total: number;
  /** One point per day in the window, oldest first, zero-filled. */
  byDay: RevenuePoint[];
}

/** Midnight UTC, `days` before now. */
export function revenueWindowStart(days: number): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days);
  return start;
}

/**
 * Sum `orders.total_price` per day, in SQL, over the window.
 *
 * Non-INR orders are excluded, matching the previous JS filter so the numbers
 * stay comparable with what admins saw before.
 *
 * The RPCs are `SECURITY DEFINER` but granted only to `service_role`
 * (004_atomic_writes.sql), so they run through the service client: the
 * cookie-backed session client gets a permission-denied error instead.
 */
export async function revenueByDay(days: number): Promise<RevenueSummary> {
  const supabase = await reader({ service: true });
  const since = revenueWindowStart(days);

  const { data, error } = await supabase.rpc('revenue_by_day', {
    p_since: since.toISOString(),
  });
  if (error) fail('orders', error);

  const totals = new Map<string, number>();
  for (const row of data ?? []) {
    const day = String(row.day ?? '').slice(0, 10);
    totals.set(day, Number(row.total ?? 0));
  }
  // The total is derived from the zero-filled points, not from every SQL row:
  // SQL aggregates everything from `since` (including today), while the chart
  // emits exactly the `days` dates ending yesterday. Summing the raw rows
  // counted a day the chart never showed.
  const byDay = zeroFill(totals, since, days);
  return { total: sumAll(byDay.map((point) => point.total)), byDay };
}

function sumAll(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

/** One point per day in the window, including days with no orders. */
function zeroFill(totals: Map<string, number>, since: Date, days: number): RevenuePoint[] {
  const points: RevenuePoint[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(since);
    day.setUTCDate(day.getUTCDate() + offset);
    const key = day.toISOString().slice(0, 10);
    points.push({ day: key, total: totals.get(key) ?? 0 });
  }
  return points;
}

export interface TopProduct {
  /** `product_id`, or null for a line item with no catalog product. */
  productId: number | null;
  title: string;
  quantity: number;
  revenue: number;
}

export interface TopProductsResult {
  rows: TopProduct[];
}

/**
 * Top products by units sold.
 *
 * Keyed by `product_id`, not by title string. The old implementation keyed a
 * Map on `line_item.title`, so two distinct products sharing a title merged into
 * one row and their revenue was attributed to whichever id was seen first.
 */
export async function topProductsByUnits(limit = 8): Promise<TopProductsResult> {
  // Service client: granted only to `service_role`, like `revenue_by_day`.
  const supabase = await reader({ service: true });
  const { data, error } = await supabase.rpc('top_products_by_units', { p_limit: limit });
  if (error) fail('line_items', error);

  return {
    rows: (data ?? []).map((row) => ({
      productId: row.product_id === null ? null : Number(row.product_id),
      title: String(row.title ?? ''),
      quantity: Number(row.quantity ?? 0),
      revenue: Number(row.revenue ?? 0),
    })),
  };
}

/** One row of the dashboard recent-orders table. */
export type RecentOrder = Pick<
  Order,
  | 'id'
  | 'name'
  | 'email'
  | 'total_price'
  | 'currency'
  | 'financial_status'
  | 'fulfillment_status'
  | 'created_at'
>;

export interface DashboardSummary {
  counts: {
    products: number;
    orders: number;
    customers: number;
    articles: number;
    ordersToday: number;
    fulfillmentQueue: number;
    lowStockVariants: number;
  };
  revenue: { last7Days: number; last30Days: number };
  recentOrders: RecentOrder[];
}

/**
 * Every dashboard KPI plus the recent-orders table, in one parallel batch.
 *
 * The dashboard and analytics pages each ran their own near-identical count
 * queries and their own revenue loop; they now share this and `revenueByDay`.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await reader();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    products,
    orders,
    customers,
    articles,
    ordersToday,
    fulfillmentQueue,
    lowStockVariants,
    recentOrders,
    revenue,
  ] = await Promise.all([
    runCount('products', supabase.from('products').select('id', { count: 'exact', head: true })),
    runCount('orders', supabase.from('orders').select('id', { count: 'exact', head: true })),
    runCount('customers', supabase.from('customers').select('id', { count: 'exact', head: true })),
    runCount('articles', supabase.from('articles').select('id', { count: 'exact', head: true })),
    runCount(
      'orders',
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString()),
    ),
    runCount(
      'orders',
      // Migrated orders carry NULL instead of 'unfulfilled'; the literal-only
      // predicate dropped them from the queue entirely.
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .or('fulfillment_status.eq.unfulfilled,fulfillment_status.is.null'),
    ),
    runCount(
      'product_variants',
      // NULL means "unknown stock" and the inventory UI renders it as zero;
      // the low-stock product filter counts it too, so the KPI must match.
      supabase
        .from('product_variants')
        .select('id', { count: 'exact', head: true })
        .or(`inventory_quantity.lte.${LOW_STOCK_THRESHOLD},inventory_quantity.is.null`),
    ),
    rows<RecentOrder>(
      'orders',
      supabase
        .from('orders')
        .select(
          'id, name, email, total_price, currency, financial_status, fulfillment_status, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(6),
    ),
    revenueByDay(REVENUE_WINDOW_DAYS),
  ]);

  return {
    counts: {
      products,
      orders,
      customers,
      articles,
      ordersToday,
      fulfillmentQueue,
      lowStockVariants,
    },
    revenue: {
      last7Days: revenue.byDay.slice(-7).reduce((acc, point) => acc + point.total, 0),
      last30Days: revenue.total,
    },
    recentOrders,
  };
}

/** Catalog-size KPI for the analytics page. */
export async function countCatalogSize(): Promise<number> {
  const supabase = await reader();
  return runCount('products', supabase.from('products').select('id', { count: 'exact', head: true }));
}

// ─── Windows, status mixes, and stock health ─────────────────────────────────

/** Range vocabulary the analytics switcher (`?range=`) serves. */
export const ANALYTICS_RANGES = [7, 14, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

/**
 * `?range=` → a served window. Missing, repeated, or out-of-vocabulary values
 * (including `45`, which the page cannot size a comparison for) fall back to
 * the 14-day default rather than reaching the queries.
 */
export function parseAnalyticsRange(value: unknown): AnalyticsRange {
  const raw = Array.isArray(value) ? value[0] : value;
  const days = Number(raw);
  return (ANALYTICS_RANGES as readonly number[]).includes(days)
    ? (days as AnalyticsRange)
    : REVENUE_CHART_DAYS;
}

/** A metric over the current window and the window immediately before it. */
export interface WindowComparison {
  current: number;
  previous: number;
}

/** One status bucket: the DB value (or `other`) and its row count. */
export interface StatusMixEntry {
  status: string;
  count: number;
}

/**
 * Variant stock split. `unknown` is a NULL quantity — "not counted yet", which
 * the inventory UI renders as low, so it is tracked apart from `out` (≤ 0)
 * without ever being folded into `healthy`.
 */
export interface InventoryHealth {
  healthy: number;
  low: number;
  out: number;
  unknown: number;
  total: number;
}

/** One row of the dashboard low-stock list. */
export interface LowStockRow {
  variantId: number;
  productId: number | null;
  /** Product title, falling back to the variant title when the product is gone. */
  title: string;
  variantTitle: string | null;
  /** NULL is unknown stock, not zero. */
  quantity: number | null;
  /** Product cover, when one exists; the UI falls back to a placeholder glyph. */
  imageUrl: string | null;
}

export interface DashboardExtras {
  /** 30 zero-filled points, oldest → newest, ending yesterday. */
  byDay30: RevenuePoint[];
  /** The 30 points before `byDay30`, aligned by index — the dashed
   *  comparison line on the revenue chart. */
  previousByDay30: RevenuePoint[];
  revenue7: WindowComparison;
  revenue30: WindowComparison;
  /** Orders created in the window vs the window before it. */
  orders30: WindowComparison;
  customers30: WindowComparison;
  /** `revenue30.current / orders30.current`, 0 when the window has no orders. */
  aov30: number;
  /** Financial-status counts, zero-filled in vocabulary order (+ `other`). */
  statusMix: StatusMixEntry[];
  inventoryHealth: InventoryHealth;
  /** The six worst variants, unknown (NULL) stock first, with cover images. */
  lowStock: LowStockRow[];
  /** Products with `status = 'active'`. */
  activeProducts: number;
}

/** Rows the dashboard low-stock card has room for. */
const LOW_STOCK_ROWS = 6;

function sumPoints(points: RevenuePoint[]): number {
  let total = 0;
  for (const point of points) total += point.total;
  return total;
}

/**
 * Count rows per value of a status column, zero-filled in vocabulary order.
 *
 * One head count per vocabulary value plus one for the table total, run in
 * parallel: PostgREST has no `group by`, and the alternative — reading the
 * column and tallying in JS — would silently cap at PostgREST's row limit.
 * `other` is the remainder (total − known), which is where migrated NULL
 * statuses land; it is dropped when zero so it never renders as an empty slice.
 */
async function statusMix(
  supabase: Awaited<ReturnType<typeof reader>>,
  column: 'financial_status' | 'fulfillment_status',
  vocabulary: readonly string[],
): Promise<StatusMixEntry[]> {
  const counts = await Promise.all([
    runCount(
      'orders',
      supabase.from('orders').select('id', { count: 'exact', head: true }),
    ),
    ...vocabulary.map((status) =>
      runCount(
        'orders',
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq(column, status),
      ),
    ),
  ]);

  const total = counts[0] ?? 0;
  const entries: StatusMixEntry[] = vocabulary.map((status, index) => ({
    status,
    count: counts[index + 1] ?? 0,
  }));
  const known = entries.reduce((sum, entry) => sum + entry.count, 0);
  const other = Math.max(0, total - known);
  if (other > 0) entries.push({ status: 'other', count: other });
  return entries;
}

/** Financial + fulfillment status counts, for callers that show both. */
export async function getOrderStatusMix(): Promise<{
  financial: StatusMixEntry[];
  fulfillment: StatusMixEntry[];
}> {
  const supabase = await reader();
  // Both mixes count the orders total independently, which costs one extra
  // head count and keeps each mix self-contained (no shared mutable result).
  const [financial, fulfillment] = await Promise.all([
    statusMix(supabase, 'financial_status', FINANCIAL_STATUSES),
    statusMix(supabase, 'fulfillment_status', FULFILLMENT_STATUSES),
  ]);
  return { financial, fulfillment };
}

/**
 * Stock split across every variant.
 *
 * The four buckets are disjoint and cover the table exactly, so `total` is
 * their sum: `low` is 1…`LOW_STOCK_THRESHOLD`, `out` is 0 or negative
 * (oversold), `unknown` is NULL, `healthy` is everything above the threshold.
 * `low + out + unknown` therefore equals the sidebar's low-stock badge, which
 * counts NULL alongside low quantities.
 */
export async function getInventoryHealth(): Promise<InventoryHealth> {
  const supabase = await reader();
  const [healthy, low, out, unknown] = await Promise.all([
    runCount(
      'product_variants',
      supabase
        .from('product_variants')
        .select('id', { count: 'exact', head: true })
        .gt('inventory_quantity', LOW_STOCK_THRESHOLD),
    ),
    runCount(
      'product_variants',
      supabase
        .from('product_variants')
        .select('id', { count: 'exact', head: true })
        .gt('inventory_quantity', 0)
        .lte('inventory_quantity', LOW_STOCK_THRESHOLD),
    ),
    runCount(
      'product_variants',
      supabase
        .from('product_variants')
        .select('id', { count: 'exact', head: true })
        .lte('inventory_quantity', 0),
    ),
    runCount(
      'product_variants',
      supabase
        .from('product_variants')
        .select('id', { count: 'exact', head: true })
        .is('inventory_quantity', null),
    ),
  ]);

  return { healthy, low, out, unknown, total: healthy + low + out + unknown };
}

/** Product counts per lifecycle status, zero-filled in vocabulary order. */
export async function getProductStatusMix(): Promise<StatusMixEntry[]> {
  const supabase = await reader();
  const counts = await Promise.all([
    runCount(
      'products',
      supabase.from('products').select('id', { count: 'exact', head: true }),
    ),
    ...PRODUCT_STATUSES.map((status) =>
      runCount(
        'products',
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', status),
      ),
    ),
  ]);

  const total = counts[0] ?? 0;
  const entries: StatusMixEntry[] = PRODUCT_STATUSES.map((status, index) => ({
    status,
    count: counts[index + 1] ?? 0,
  }));
  const known = entries.reduce((sum, entry) => sum + entry.count, 0);
  const other = Math.max(0, total - known);
  if (other > 0) entries.push({ status: 'other', count: other });
  return entries;
}

/** A `product_variants` row, with the NULL quantity the schema types as number. */
interface LowStockVariantRow {
  id: number;
  product_id: number;
  title: string | null;
  inventory_quantity: number | null;
}

/**
 * The `limit` worst-stocked variants, with product titles and cover images.
 *
 * NULL sorts first: "unknown" is treated as the worst case everywhere else in
 * the admin (the low-stock badge counts it), so the list has to agree. The two
 * follow-up reads are batched and bounded by `limit`, so a cover costs one
 * query for the whole list rather than one per row.
 */
async function lowStockRows(limit: number): Promise<LowStockRow[]> {
  const supabase = await reader();
  const variants = await rows<LowStockVariantRow>(
    'product_variants',
    supabase
      .from('product_variants')
      .select('id, product_id, title, inventory_quantity')
      .or(`inventory_quantity.lte.${LOW_STOCK_THRESHOLD},inventory_quantity.is.null`)
      .order('inventory_quantity', { ascending: true, nullsFirst: true })
      .limit(limit),
  );
  if (variants.length === 0) return [];

  const productIds = [...new Set(variants.map((variant) => variant.product_id))];
  const [products, covers] = await Promise.all([
    rows<{ id: number; title: string }>(
      'products',
      supabase.from('products').select('id, title').in('id', productIds),
    ),
    coversForProducts(productIds),
  ]);
  const titles = new Map(products.map((product) => [product.id, product.title]));

  return variants.map((variant) => ({
    variantId: variant.id,
    productId: variant.product_id ?? null,
    title: titles.get(variant.product_id) ?? variant.title ?? `Variant #${variant.id}`,
    variantTitle: variant.title,
    quantity: variant.inventory_quantity ?? null,
    imageUrl: covers.get(variant.product_id) ?? null,
  }));
}

/**
 * Everything the dashboard shows beyond `getDashboardSummary()`.
 *
 * One `revenueByDay(2 × 30)` call drives the 7- and 30-day revenue windows, so
 * the dashboard never issues a second revenue RPC; the 60 returned points are
 * sliced. Orders and customers are head counts over the *same* UTC day windows
 * (whole days ending yesterday, matching the charted days) instead of rolling
 * `now - Nd` ranges: a rolling window would count a day the chart never shows,
 * so the revenue KPI, the orders KPI, and AOV would each describe a different
 * period.
 */
export async function getDashboardExtras(): Promise<DashboardExtras> {
  const supabase = await reader();

  const currentStart = revenueWindowStart(REVENUE_WINDOW_DAYS);
  const previousStart = revenueWindowStart(REVENUE_WINDOW_DAYS * 2);
  const todayStart = revenueWindowStart(0);

  const [
    revenue,
    ordersCurrent,
    ordersPrevious,
    customersCurrent,
    customersPrevious,
    financialMix,
    inventoryHealth,
    lowStock,
    activeProducts,
  ] = await Promise.all([
    revenueByDay(REVENUE_WINDOW_DAYS * 2),
    runCount(
      'orders',
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', currentStart.toISOString())
        .lt('created_at', todayStart.toISOString()),
    ),
    runCount(
      'orders',
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', previousStart.toISOString())
        .lt('created_at', currentStart.toISOString()),
    ),
    runCount(
      'customers',
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', currentStart.toISOString())
        .lt('created_at', todayStart.toISOString()),
    ),
    runCount(
      'customers',
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', previousStart.toISOString())
        .lt('created_at', currentStart.toISOString()),
    ),
    statusMix(supabase, 'financial_status', FINANCIAL_STATUSES),
    getInventoryHealth(),
    lowStockRows(LOW_STOCK_ROWS),
    runCount(
      'products',
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
    ),
  ]);

  // 60 points, oldest → newest. The last 30 are the current window, the 30
  // before those the previous one.
  const all = revenue.byDay;
  const byDay30 = all.slice(-REVENUE_WINDOW_DAYS);
  const previous30 = all.slice(0, all.length - REVENUE_WINDOW_DAYS);
  const revenue30: WindowComparison = {
    current: sumPoints(byDay30),
    previous: sumPoints(previous30),
  };
  const orders30: WindowComparison = { current: ordersCurrent, previous: ordersPrevious };

  return {
    byDay30,
    previousByDay30: previous30,
    // 7 days out of the 30-point array: same days, no second RPC.
    revenue7: {
      current: sumPoints(byDay30.slice(-7)),
      previous: sumPoints(byDay30.slice(-14, -7)),
    },
    revenue30,
    orders30,
    customers30: { current: customersCurrent, previous: customersPrevious },
    aov30: orders30.current > 0 ? revenue30.current / orders30.current : 0,
    statusMix: financialMix,
    inventoryHealth,
    lowStock,
    activeProducts,
  };
}

/**
 * Everything the dashboard renders, in one parallel batch.
 *
 * The page is presentation only: recent orders, the head counts
 * the KPI strip reads, the windowed extras, and the top-products
 * rollup with its covers resolved in one query. `lowStockCount`
 * folds `unknown` (NULL quantity) in with `low` and `out` — the
 * same set the sidebar's low-stock badge counts.
 */
export interface DashboardData {
  /** The six most recent orders, newest first. */
  orders: RecentOrder[];
  /** Head counts the strip reads (products, orders, customers, queue). */
  counts: DashboardSummary['counts'];
  /** Customer counters for the strip tile and the customers card. */
  customers: { stats: { new: number; total: number } };
  extras: DashboardExtras & {
    /** Top products by units sold, covers resolved. */
    topProducts: { rows: TopProduct[]; covers: Map<number, string> };
    /** Variants at or below the reorder point, unknown stock included. */
    lowStockCount: number;
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const [summary, extras, topProducts] = await Promise.all([
    getDashboardSummary(),
    getDashboardExtras(),
    topProductsByUnits(8),
  ]);

  const productIds = [
    ...new Set(
      topProducts.rows
        .map((row) => row.productId)
        .filter((id): id is number => id !== null),
    ),
  ];
  // PostgREST rejects an empty `in ()`, so an empty rollup skips the read.
  const covers =
    productIds.length > 0
      ? await coversForProducts(productIds)
      : new Map<number, string>();

  const { low, out, unknown } = extras.inventoryHealth;

  return {
    orders: summary.recentOrders,
    counts: summary.counts,
    customers: {
      stats: {
        new: extras.customers30.current,
        total: summary.counts.customers,
      },
    },
    extras: {
      ...extras,
      topProducts: { rows: topProducts.rows, covers },
      lowStockCount: low + out + unknown,
    },
  };
}

export interface RangeAnalytics {
  /** Window length in days. */
  days: number;
  /** Current window, one point per day, oldest → newest. */
  byDay: RevenuePoint[];
  /** The window immediately before `byDay`, same length, aligned by index. */
  previousByDay: RevenuePoint[];
  revenue: WindowComparison;
  orders: WindowComparison;
  customers: WindowComparison;
  /** Average order value per window, 0 for a window with no orders. */
  aov: WindowComparison;
}

/**
 * Every range-scoped number the analytics page shows: one `revenue_by_day` call
 * over `2 × days` plus four head counts, in parallel.
 *
 * The current window is the last `days` points of the RPC result and the
 * previous window the `days` before that, so the chart, the KPI deltas, and AOV
 * all describe exactly the same UTC days (whole days ending yesterday).
 *
 * Units sold is deliberately not here. `top_products_by_units` has no time
 * filter, and summing `line_items.quantity` in JS for a window would fetch an
 * unbounded row set that PostgREST silently caps — the same truncation bug the
 * old JS revenue loop had. A ranged units RPC is what makes the metric honest.
 */
export async function getRangeAnalytics(days: number): Promise<RangeAnalytics> {
  const supabase = await reader();
  // Any positive window works; a non-finite one falls back to the default
  // rather than building an `Invalid Date` window start.
  const windowDays = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : REVENUE_CHART_DAYS;

  const currentStart = revenueWindowStart(windowDays);
  const previousStart = revenueWindowStart(windowDays * 2);
  const todayStart = revenueWindowStart(0);

  const [revenue, ordersCurrent, ordersPrevious, customersCurrent, customersPrevious] =
    await Promise.all([
      revenueByDay(windowDays * 2),
      runCount(
        'orders',
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', currentStart.toISOString())
          .lt('created_at', todayStart.toISOString()),
      ),
      runCount(
        'orders',
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', previousStart.toISOString())
          .lt('created_at', currentStart.toISOString()),
      ),
      runCount(
        'customers',
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', currentStart.toISOString())
          .lt('created_at', todayStart.toISOString()),
      ),
      runCount(
        'customers',
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', previousStart.toISOString())
          .lt('created_at', currentStart.toISOString()),
      ),
    ]);

  const all = revenue.byDay;
  const byDay = all.slice(-windowDays);
  const previousByDay = all.slice(0, all.length - windowDays);
  const revenueWindow: WindowComparison = {
    current: sumPoints(byDay),
    previous: sumPoints(previousByDay),
  };
  const orders: WindowComparison = { current: ordersCurrent, previous: ordersPrevious };

  return {
    days: windowDays,
    byDay,
    previousByDay,
    revenue: revenueWindow,
    orders,
    customers: { current: customersCurrent, previous: customersPrevious },
    aov: {
      current: orders.current > 0 ? revenueWindow.current / orders.current : 0,
      previous: orders.previous > 0 ? revenueWindow.previous / orders.previous : 0,
    },
  };
}
