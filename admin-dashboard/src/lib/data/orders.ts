import 'server-only';

import { cache } from 'react';
import type {
  Customer,
  Fulfillment,
  LineItem,
  Order,
  Refund,
  RefundTransaction,
  Transaction,
} from '@yord/db-types';
import {
  FINANCIAL_STATUSES,
  FULFILLMENT_STATUSES,
  PAGE_SIZE,
  isOneOf,
} from '@/lib/constants';
import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import { asBigintId } from '@/lib/validation';
import type { ServerClient } from '@/lib/supabase/server';
import { coversForProducts } from './covers';
import {
  fail,
  one,
  reader,
  rows,
  runCount,
  runPage,
  uniqueIds,
  type DbError,
  type Paged,
} from './client';

const ENTITY = 'orders';

/** `YYYY-MM-DD` → Date, or null when the input is not a usable date. */
function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface OrderListFilters {
  q?: string;
  financial?: string;
  fulfillment?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/**
 * One row of the orders table.
 *
 * `customer_name`, `item_count` and `unit_count` are batch-joined by
 * `listOrders` (two bounded `in()` queries for the whole page, never one query
 * per row); the remaining fields are the order's own columns.
 */
export interface OrderListRow
  extends Pick<
    Order,
    | 'id'
    | 'name'
    | 'email'
    | 'total_price'
    | 'currency'
    | 'financial_status'
    | 'fulfillment_status'
    | 'created_at'
  > {
  customer_id: number | null;
  /** Display name from `customers`, null when the order has no customer row. */
  customer_name: string | null;
  /** Distinct line items on the order. */
  item_count: number;
  /** Sum of those line items' quantities. */
  unit_count: number;
}

/** Order columns selected for a list row (everything `OrderListRow` needs). */
const LIST_COLUMNS =
  'id, name, email, customer_id, total_price, currency, financial_status, fulfillment_status, created_at';

/** The page's order rows, before the two batch joins add their extras. */
type RawOrderListRow = Omit<OrderListRow, 'customer_name' | 'item_count' | 'unit_count'>;

/** Customer display names for the given ids, in one bounded query. */
async function customerNames(ids: number[]): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  if (ids.length === 0) return names;

  const supabase = await reader();
  const data = await rows<{
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }>(
    'customers',
    supabase.from('customers').select('id, first_name, last_name, email').in('id', ids),
  );

  for (const row of data) {
    const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    names.set(row.id, name || row.email || '');
  }
  return names;
}

/** Line-item counts per order, in one bounded query keyed on `order_id`. */
async function lineItemTotals(
  orderIds: number[],
): Promise<Map<number, { items: number; units: number }>> {
  const totals = new Map<number, { items: number; units: number }>();
  if (orderIds.length === 0) return totals;

  const supabase = await reader();
  const data = await rows<{ order_id: number; quantity: number | null }>(
    'line_items',
    supabase.from('line_items').select('order_id, quantity').in('order_id', orderIds),
  );

  for (const row of data) {
    const current = totals.get(row.order_id) ?? { items: 0, units: 0 };
    current.items += 1;
    current.units += Number(row.quantity ?? 0);
    totals.set(row.order_id, current);
  }
  return totals;
}

/**
 * Paged order list with status, date-range, and text filters.
 *
 * Two extra batch reads (customers, line items) hydrate the page's rows after
 * the main query: the table shows a customer name and an item count without an
 * `N+1` per row and without a PostgREST embed (the generated `Relationships`
 * metadata is empty, so every embed would need an unchecked cast).
 */
export async function listOrders(filters: OrderListFilters): Promise<Paged<OrderListRow>> {
  const supabase = await reader();
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = clampPage(filters.page);
  const { from, to } = pageRange(page, pageSize);
  const search = sanitizeSearch(filters.q);

  let request = supabase
    .from('orders')
    .select(LIST_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (isOneOf(FINANCIAL_STATUSES, filters.financial)) {
    request = request.eq('financial_status', filters.financial);
  }
  if (isOneOf(FULFILLMENT_STATUSES, filters.fulfillment)) {
    if (filters.fulfillment === 'unfulfilled') {
      // Migrated orders carry NULL instead of 'unfulfilled'. The sidebar badge
      // and the dashboard KPI count both arms (`fulfillment_status.is.null`),
      // so filtering on the literal alone returned fewer rows than the number
      // the admin clicked through from.
      request = request.or('fulfillment_status.eq.unfulfilled,fulfillment_status.is.null');
    } else {
      request = request.eq('fulfillment_status', filters.fulfillment);
    }
  }

  const fromDate = parseDate(filters.from);
  if (fromDate) request = request.gte('created_at', fromDate.toISOString());
  const toDate = parseDate(filters.to);
  if (toDate) {
    // Inclusive of the whole `to` day.
    const end = new Date(toDate);
    end.setDate(end.getDate() + 1);
    request = request.lt('created_at', end.toISOString());
  }
  if (search) {
    request = request.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const result = await runPage<RawOrderListRow>(ENTITY, request);

  const [names, totals] = await Promise.all([
    customerNames(uniqueIds(result.rows.map((row) => row.customer_id))),
    lineItemTotals(result.rows.map((row) => row.id)),
  ]);

  const hydrated: OrderListRow[] = result.rows.map((row) => {
    const counts = totals.get(row.id);
    return {
      ...row,
      customer_name: row.customer_id === null ? null : names.get(row.customer_id) ?? null,
      item_count: counts?.items ?? 0,
      unit_count: counts?.units ?? 0,
    };
  });

  return { rows: hydrated, count: result.count, page, pageSize };
}

/** Everything the orders-list summary row shows, in one payload. */
export interface OrderSummary {
  total: number;
  /** `unfulfilled` plus migrated NULLs — the same queue the sidebar badge counts. */
  unfulfilled: number;
  /** Fully captured money (`paid`), refunds aside. */
  paid: number;
  /** `refunded` or `partially_refunded`. */
  refunded: number;
  /** All-time INR revenue, net of gateway refunds. */
  revenue: number;
}

/**
 * Counts for the orders-list summary row, plus revenue.
 *
 * Four head-only counts and one SQL rollup, all in parallel — the tiles read one
 * payload instead of one query each. `revenue_by_day` is the same
 * net-of-refunds aggregate the dashboard charts use
 * (admin-dashboard/sql/004_atomic_writes.sql); summing `total_price` in JS
 * instead would count refunded money as revenue and drift from the dashboard.
 */
export async function orderSummary(): Promise<OrderSummary> {
  const supabase = await reader();

  const [total, unfulfilled, paid, refunded, revenue] = await Promise.all([
    runCount('orders', supabase.from('orders').select('id', { count: 'exact', head: true })),
    runCount(
      'orders',
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .or('fulfillment_status.eq.unfulfilled,fulfillment_status.is.null'),
    ),
    runCount(
      'orders',
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('financial_status', 'paid'),
    ),
    runCount(
      'orders',
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('financial_status', ['refunded', 'partially_refunded']),
    ),
    netRevenue(),
  ]);

  return { total, unfulfilled, paid, refunded, revenue };
}

/**
 * All-time INR revenue, net of completed gateway refunds.
 *
 * The RPC is granted to `service_role` only (like `reserve_refund`), so this
 * read uses the service client; the cookie-backed session client gets a
 * permission-denied error instead.
 */
async function netRevenue(): Promise<number> {
  const supabase = await reader({ service: true });
  const { data, error } = await supabase.rpc('revenue_by_day', {
    p_since: new Date(0).toISOString(),
  });
  if (error) fail(ENTITY, error);

  let total = 0;
  for (const row of data ?? []) total += Number(row.total ?? 0);
  return total;
}

/** Columns `select('*')` returns that the generated `Order` type omits. */
export interface OrderExtras {
  note: string | null;
  tags: string | null;
  /** Shopify's `source_name` — the channel the order came through. */
  source_name: string | null;
  confirmation_number: string | null;
}

/** A line item plus its product's cover image. */
export interface OrderLineItem extends LineItem {
  /** Cover URL for `product_id`; null when the product has no image or is gone. */
  imageUrl: string | null;
}

/** One line item carried by a fulfillment (`fulfillment_line_items`). */
export interface FulfillmentItem {
  lineItemId: number;
  title: string;
  sku: string | null;
  quantity: number;
}

/** A fulfillment plus the line items it carries, when the join rows exist. */
export interface OrderFulfillment extends Fulfillment {
  items: FulfillmentItem[];
}

/** Refund state for one transaction. */
export interface TransactionRefundState {
  /** Recorded refunds against this transaction, in paise (Razorpay's unit). */
  refundedPaise: number;
  /** Refund rows linked to this transaction. */
  count: number;
  /**
   * A pre-migration refund with no `amount`. `reserve_refund()` treats the
   * transaction as fully refunded in that case, so the panel must not offer a
   * refund the route will reject.
   */
  unknownAmount: boolean;
}

/** The order's shipping or billing snapshot (`order_*_addresses`). */
export interface OrderAddress {
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  province_code: string | null;
  country: string | null;
  country_code: string | null;
  zip: string | null;
  phone: string | null;
}

export interface OrderDetail {
  order: Order & OrderExtras;
  /** The customer row behind `order.customer_id`, when it still exists. */
  customer: Customer | null;
  lineItems: OrderLineItem[];
  transactions: Transaction[];
  fulfillments: OrderFulfillment[];
  /** Refund rows for this order, newest first. */
  refunds: Refund[];
  /** Per-transaction refund tally, keyed by transaction id as a decimal string. */
  refundState: Record<string, TransactionRefundState>;
  shipping: OrderAddress | null;
  billing: OrderAddress | null;
}

const ADDRESS_COLUMNS =
  'first_name, last_name, company, address1, address2, city, province, province_code, country, country_code, zip, phone';

/**
 * Raw builders for the three tables `@yord/db-types` does not model yet
 * (`order_shipping_addresses`, `order_billing_addresses`,
 * `fulfillment_line_items` — all in `scripts/schema.sql`).
 *
 * One cast, in one place, instead of `any` at every call site. Dropping it needs
 * those tables added to the generated types, which is a `packages/db-types`
 * change and outside this module's scope.
 */
interface UntypedTable {
  select(columns: string): {
    eq(
      column: string,
      value: string | number,
    ): { limit(count: number): { maybeSingle(): PromiseLike<{ data: unknown; error: DbError | null }> } };
    in(column: string, values: (string | number)[]): PromiseLike<{ data: unknown; error: DbError | null }>;
  };
}

function untyped(client: ServerClient): { from(table: string): UntypedTable } {
  return client as unknown as { from(table: string): UntypedTable };
}

/**
 * One order's address snapshot.
 *
 * A missing table, column, or row degrades to `null` (and a log) rather than
 * throwing: an order page that already read its order, line items, and payments
 * must not blank itself because an optional address row is unavailable. A failed
 * `orders` read still throws, which is the difference the error model draws.
 */
async function addressFor(
  client: ServerClient,
  table: 'order_shipping_addresses' | 'order_billing_addresses',
  orderId: string,
): Promise<OrderAddress | null> {
  const { data, error } = await untyped(client)
    .from(table)
    .select(ADDRESS_COLUMNS)
    .eq('order_id', asBigintId(orderId))
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`[orders] ${table} read failed`, error.message);
    return null;
  }
  return (data as OrderAddress | null) ?? null;
}

/** Line items per fulfillment, in one bounded query. Same degrade rule as above. */
async function fulfillmentItems(
  client: ServerClient,
  fulfillmentIds: number[],
): Promise<Map<number, { line_item_id: number; quantity: number | null }[]>> {
  const items = new Map<number, { line_item_id: number; quantity: number | null }[]>();
  if (fulfillmentIds.length === 0) return items;

  const { data, error } = await untyped(client)
    .from('fulfillment_line_items')
    .select('fulfillment_id, line_item_id, quantity')
    .in('fulfillment_id', fulfillmentIds);
  if (error) {
    console.error('[orders] fulfillment_line_items read failed', error.message);
    return items;
  }

  for (const row of (data ?? []) as { fulfillment_id: number; line_item_id: number; quantity: number | null }[]) {
    const bucket = items.get(row.fulfillment_id);
    const entry = { line_item_id: row.line_item_id, quantity: row.quantity };
    if (bucket) bucket.push(entry);
    else items.set(row.fulfillment_id, [entry]);
  }
  return items;
}

/**
 * Refund links for the order's transactions.
 *
 * The service client is required, not preferred: `refund_transactions` is
 * default-deny under RLS (`admin-dashboard/sql/003_admin_rls.sql`), so a session
 * read returns `[]` silently. A refundable balance computed from an empty tally
 * would offer a refund the route then rejects with `EXCEEDS_REMAINING`.
 */
async function refundLinksFor(transactionIds: number[]): Promise<RefundTransaction[]> {
  if (transactionIds.length === 0) return [];
  const service = await reader({ service: true });
  return rows<RefundTransaction>(
    'refund_transactions',
    // No `created_at`: the column exists in the migration's `create table if
    // not exists`, but not in databases where `refund_transactions` predated it
    // (scripts/schema.sql declares only the two keys). Selecting it 400s there.
    service
      .from('refund_transactions')
      .select('refund_id, transaction_id')
      .in('transaction_id', transactionIds),
  );
}

/** Fold refund rows + links into the per-transaction tally the panel reads. */
function refundStateFor(
  refunds: Refund[],
  links: RefundTransaction[],
): Record<string, TransactionRefundState> {
  const byId = new Map(refunds.map((refund) => [Number(refund.id), refund]));
  const state: Record<string, TransactionRefundState> = {};

  for (const link of links) {
    const refund = byId.get(Number(link.refund_id));
    if (!refund) continue; // A link outside this order (cannot happen; ignored defensively).
    const key = String(link.transaction_id);
    const current = state[key] ?? { refundedPaise: 0, count: 0, unknownAmount: false };
    current.count += 1;
    const paise = Number(refund.amount);
    if (refund.amount === null || refund.amount === undefined || !Number.isFinite(paise)) {
      current.unknownAmount = true;
    } else {
      current.refundedPaise += paise;
    }
    state[key] = current;
  }
  return state;
}

/**
 * One order plus its children.
 *
 * Three waves, each parallel: the order, its line items / transactions /
 * fulfillments, then everything that depends on those (covers, refunds, refund
 * links, addresses, fulfillment items). The page previously awaited six
 * sequential queries, so wall-clock latency was the sum of every round trip.
 * `null` when the order does not exist (page calls `notFound()`).
 */
export const getOrder = cache(async (id: string): Promise<OrderDetail | null> => {
  const supabase = await reader();
  const order = await one<Order & OrderExtras>(
    ENTITY,
    supabase.from('orders').select('*').eq('id', asBigintId(id)).limit(1).maybeSingle(),
  );
  if (!order) return null;
  // `id` arrives from PostgREST as a JSON number, and JavaScript rounds
  // BIGINTs above Number.MAX_SAFE_INTEGER while parsing. The lookup used the
  // exact decimal string from the route, so the row IS that order — re-stamp
  // the id with the lossless string so mutation forms never submit a rounded
  // id at a neighboring order.
  order.id = id as unknown as number;

  const [lineItems, transactions, fulfillments] = await Promise.all([
    rows<LineItem>('line_items', supabase.from('line_items').select('*').eq('order_id', asBigintId(id))),
    rows<Transaction>(
      'transactions',
      supabase.from('transactions').select('*').eq('order_id', asBigintId(id)),
    ),
    rows<Fulfillment>(
      'fulfillments',
      supabase
        .from('fulfillments')
        .select('*')
        .eq('order_id', asBigintId(id))
        .order('created_at', { ascending: false }),
    ),
  ]);

  const productIds = uniqueIds(lineItems.map((item) => item.product_id));
  const transactionIds = uniqueIds(transactions.map((transaction) => transaction.id));
  const fulfillmentIds = uniqueIds(fulfillments.map((fulfillment) => fulfillment.id));

  const [covers, refunds, refundLinks, fulfillmentLinks, shipping, billing, customer] =
    await Promise.all([
      coversForProducts(productIds),
      rows<Refund>(
        'refunds',
        supabase
          .from('refunds')
          .select('*')
          .eq('order_id', asBigintId(id))
          .order('created_at', { ascending: false }),
      ),
      refundLinksFor(transactionIds),
      fulfillmentItems(supabase, fulfillmentIds),
      addressFor(supabase, 'order_shipping_addresses', id),
      addressFor(supabase, 'order_billing_addresses', id),
      order.customer_id === null || !Number.isSafeInteger(order.customer_id)
        ? Promise.resolve(null)
        : one<Customer>(
            'customers',
            supabase
              .from('customers')
              .select('*')
              .eq('id', order.customer_id)
              .limit(1)
              .maybeSingle(),
          ),
    ]);

  const titleById = new Map(lineItems.map((item) => [Number(item.id), item]));
  const hydratedFulfillments: OrderFulfillment[] = fulfillments.map((fulfillment) => ({
    ...fulfillment,
    items: (fulfillmentLinks.get(Number(fulfillment.id)) ?? []).map((link) => {
      const line = titleById.get(Number(link.line_item_id));
      return {
        lineItemId: link.line_item_id,
        title: line?.title ?? `Line item ${link.line_item_id}`,
        sku: line?.sku ?? null,
        quantity: Number(link.quantity ?? 0),
      };
    }),
  }));

  return {
    order,
    customer,
    lineItems: lineItems.map((item) => ({
      ...item,
      imageUrl: item.product_id === null ? null : covers.get(item.product_id) ?? null,
    })),
    transactions,
    fulfillments: hydratedFulfillments,
    refunds,
    refundState: refundStateFor(refunds, refundLinks),
    shipping,
    billing,
  };
});
