import 'server-only';

import { cache } from 'react';
import type { Customer, CustomerAddress, Order } from '@yord/db-types';
import { PAGE_SIZE } from '@/lib/constants';
import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import { one, reader, rows, runPage, type Paged } from './client';

const ENTITY = 'customers';

/** Paged customer list with server-side name/email search. */
export async function listCustomers(filters: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paged<Customer>> {
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

  const result = await runPage<Customer>(ENTITY, request);
  return { ...result, page, pageSize };
}

export interface CustomerDetail {
  customer: Customer;
  orders: Pick<Order, 'id' | 'name' | 'total_price' | 'currency'>[];
  addresses: CustomerAddress[];
}

/**
 * One customer with orders and addresses, all read in parallel. `null` when the
 * id does not exist (page calls `notFound()`).
 */
export const getCustomer = cache(async (id: number): Promise<CustomerDetail | null> => {
  const supabase = await reader();
  const customer = await one<Customer>(
    ENTITY,
    supabase.from('customers').select('*').eq('id', id).limit(1).maybeSingle(),
  );
  if (!customer) return null;

  const [orders, addresses] = await Promise.all([
    rows<Pick<Order, 'id' | 'name' | 'total_price' | 'currency'>>(
      'orders',
      supabase
        .from('orders')
        .select('id, name, total_price, currency')
        .eq('customer_id', id)
        .order('created_at', { ascending: false }),
    ),
    rows<CustomerAddress>(
      'customer_addresses',
      supabase.from('customer_addresses').select('*').eq('customer_id', id),
    ),
  ]);

  return { customer, orders, addresses };
});
