import 'server-only';

import { cache } from 'react';
import type { Customer, CustomerAddress, Order } from '@yord/db-types';
import { PAGE_SIZE } from '@/lib/constants';
import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import type { ServerClient } from '@/lib/supabase/server';
import { one, reader, rows, runCount, runPage, uniqueIds, type Paged } from './client';

const ENTITY = 'customers';

/**
 * The order shape both customer screens render: id/name for the link, amount
 * and currency for the money column, both statuses for the badges, and
 * `created_at` for the placed date and the spend sparkline.
 */
export type CustomerOrderRow = Pick<
  Order,
  | 'id'
  | 'name'
  | 'total_price'
  | 'currency'
  | 'financial_status'
  | 'fulfillment_status'
  | 'created_at'
>;

/**
 * A list row: the `customers` row plus the one aggregate the table does not
 * store. `orders_count`/`total_spent` are denormalized on `customers`, but the
 * last order *date* is not — `last_order_name` exists without its timestamp.
 */
export type CustomerListRow = Customer & {
  /** Most recent order's `created_at`; null when the customer has never ordered. */
  lastOrderAt: string | null;
};

export interface CustomerListFilters {
  q?: string;
  /** `yes` = accepts marketing, `no` = does not; `all`/undefined = everyone. */
  marketing?: 'all' | 'yes' | 'no';
  page?: number;
  pageSize?: number;
}

/**
 * `customer_id → created_at` of each customer's most recent order, for the
 * customers on one page.
 *
 * One bounded `IN (…)` over at most `pageSize` ids instead of a query per row.
 * Ordered newest-first, so the first row seen for a customer is their last
 * order. An empty id list returns early: PostgREST rejects `in ()`.
 */
async function lastOrderDatesFor(
  supabase: ServerClient,
  ids: number[],
): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();

  const orderRows = await rows<Pick<Order, 'customer_id' | 'created_at'>>(
    'orders',
    supabase
      .from('orders')
      .select('customer_id, created_at')
      .in('customer_id', ids)
      .order('created_at', { ascending: false, nullsFirst: false }),
  );

  const latest = new Map<number, string>();
  for (const order of orderRows) {
    if (order.customer_id === null || !order.created_at) continue;
    if (!latest.has(order.customer_id)) latest.set(order.customer_id, order.created_at);
  }
  return latest;
}

/** Paged customer list with server-side name/email search and marketing filter. */
export async function listCustomers(filters: CustomerListFilters): Promise<Paged<CustomerListRow>> {
  const supabase = await reader();
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = clampPage(filters.page);
  const { from, to } = pageRange(page, pageSize);
  const search = sanitizeSearch(filters.q);

  let request = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (search) {
    request = request.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
    );
  }
  if (filters.marketing === 'yes') request = request.eq('accepts_marketing', true);
  else if (filters.marketing === 'no') request = request.eq('accepts_marketing', false);

  const result = await runPage<Customer>(ENTITY, request);
  const lastOrders = await lastOrderDatesFor(
    supabase,
    uniqueIds(result.rows.map((row) => row.id)),
  );

  return {
    rows: result.rows.map((row) => ({ ...row, lastOrderAt: lastOrders.get(row.id) ?? null })),
    count: result.count,
    page,
    pageSize,
  };
}

/**
 * Head-only counts behind the list page's stat strip.
 *
 * `total` is the whole table, not the page, so the strip keeps telling the
 * truth once the list is filtered. `topSpend` is one bounded row (the highest
 * lifetime spend) — it is what the detail page's meter measures against, since
 * PostgREST cannot compute an average without an RPC and a "vs the store's top
 * spender" bar is more actionable than an average anyway.
 */
export interface CustomerStats {
  /** Every customer row. */
  total: number;
  /** Customers with at least one order. */
  withOrders: number;
  /** Customers who accept marketing email. */
  marketingOptIn: number;
  /** Repeat buyers — two or more orders. */
  repeatCustomers: number;
  /** Customers created in the last 30 days. */
  newLast30Days: number;
  /** Customers created in the 30 days before that (the delta's base). */
  previous30Days: number;
  /** Highest `total_spent` in the store; 0 when there are no customers. */
  topSpend: number;
  /** `repeatCustomers / withOrders`, 0 when nobody has ordered yet. */
  repeatRate: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const getCustomerStats = cache(async (): Promise<CustomerStats> => {
  const supabase = await reader();
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY_MS).toISOString();
  const since60 = new Date(now - 60 * DAY_MS).toISOString();

  const [total, withOrders, marketingOptIn, repeatCustomers, newLast30Days, previous30Days, top] =
    await Promise.all([
      runCount(
        ENTITY,
        supabase.from('customers').select('id', { count: 'exact', head: true }),
      ),
      runCount(
        ENTITY,
        supabase.from('customers').select('id', { count: 'exact', head: true }).gt('orders_count', 0),
      ),
      runCount(
        ENTITY,
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('accepts_marketing', true),
      ),
      runCount(
        ENTITY,
        supabase.from('customers').select('id', { count: 'exact', head: true }).gte('orders_count', 2),
      ),
      runCount(
        ENTITY,
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', since30),
      ),
      runCount(
        ENTITY,
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', since60)
          .lt('created_at', since30),
      ),
      one<Pick<Customer, 'total_spent'>>(
        ENTITY,
        supabase
          .from('customers')
          .select('total_spent')
          // `nullsFirst: false` or Postgres puts NULL spends at the top of a
          // DESC order, and the "top spender" unmeters to zero.
          .order('total_spent', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle(),
      ),
    ]);

  const topSpend = Number(top?.total_spent ?? 0);

  return {
    total,
    withOrders,
    marketingOptIn,
    repeatCustomers,
    newLast30Days,
    previous30Days,
    topSpend: Number.isFinite(topSpend) ? topSpend : 0,
    repeatRate: withOrders > 0 ? repeatCustomers / withOrders : 0,
  };
});

export interface CustomerDetail {
  customer: Customer;
  orders: CustomerOrderRow[];
  addresses: CustomerAddress[];
}

/**
 * One customer with orders and addresses, all read in parallel. `null` when the
 * id does not exist (page calls `notFound()`).
 *
 * Orders carry their statuses and `created_at` so the detail page can render
 * badges, the placed date, and the spend sparkline from this one read.
 */
export const getCustomer = cache(async (id: number): Promise<CustomerDetail | null> => {
  const supabase = await reader();
  const customer = await one<Customer>(
    ENTITY,
    supabase.from('customers').select('*').eq('id', id).limit(1).maybeSingle(),
  );
  if (!customer) return null;

  const [orders, addresses] = await Promise.all([
    rows<CustomerOrderRow>(
      'orders',
      supabase
        .from('orders')
        .select('id, name, total_price, currency, financial_status, fulfillment_status, created_at')
        .eq('customer_id', id)
        .order('created_at', { ascending: false, nullsFirst: false }),
    ),
    rows<CustomerAddress>(
      'customer_addresses',
      supabase.from('customer_addresses').select('*').eq('customer_id', id),
    ),
  ]);

  return { customer, orders, addresses };
});
