import 'server-only';

import type { Order } from '@yord/db-types';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { fail, reader, rows, runCount } from './client';

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
          'id, name, total_price, currency, financial_status, fulfillment_status, created_at',
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
