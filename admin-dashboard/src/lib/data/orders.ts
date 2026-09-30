import 'server-only';

import { cache } from 'react';
import type {
  Fulfillment,
  LineItem,
  Order,
  Transaction,
} from '@yord/db-types';
import {
  FINANCIAL_STATUSES,
  FULFILLMENT_STATUSES,
  PAGE_SIZE,
  isOneOf,
} from '@/lib/constants';
import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import { one, reader, rows, runPage, type Paged } from './client';

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

export type OrderListRow = Pick<
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

/** Paged order list with status, date-range, and text filters. */
export async function listOrders(filters: OrderListFilters): Promise<Paged<OrderListRow>> {
  const supabase = await reader();
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = clampPage(filters.page);
  const { from, to } = pageRange(page, pageSize);
  const search = sanitizeSearch(filters.q);

  let request = supabase
    .from('orders')
    .select(
      'id, name, email, total_price, currency, financial_status, fulfillment_status, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (isOneOf(FINANCIAL_STATUSES, filters.financial)) {
    request = request.eq('financial_status', filters.financial);
  }
  if (isOneOf(FULFILLMENT_STATUSES, filters.fulfillment)) {
    request = request.eq('fulfillment_status', filters.fulfillment);
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

  const result = await runPage<OrderListRow>(ENTITY, request);
  return { ...result, page, pageSize };
}

export interface OrderDetail {
  order: Order;
  lineItems: LineItem[];
  transactions: Transaction[];
  fulfillments: Fulfillment[];
}

/**
 * One order plus its children.
 *
 * The four child reads run in parallel: the page previously awaited six
 * sequential queries, so wall-clock latency was the sum of every round trip.
 * `null` when the order does not exist (page calls `notFound()`).
 */
export const getOrder = cache(async (id: number): Promise<OrderDetail | null> => {
  const supabase = await reader();
  const order = await one<Order>(
    ENTITY,
    supabase.from('orders').select('*').eq('id', id).limit(1).maybeSingle(),
  );
  if (!order) return null;

  const [lineItems, transactions, fulfillments] = await Promise.all([
    rows<LineItem>('line_items', supabase.from('line_items').select('*').eq('order_id', id)),
    rows<Transaction>(
      'transactions',
      supabase.from('transactions').select('*').eq('order_id', id),
    ),
    rows<Fulfillment>(
      'fulfillments',
      supabase
        .from('fulfillments')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: false }),
    ),
  ]);

  return { order, lineItems, transactions, fulfillments };
});
