import { createClient } from '@/lib/supabase/client';
import { throwDbError } from '@/lib/result';

export interface AccountOrder {
  id: number;
  order_number: number | null;
  created_at: string;
  financial_status: string | null;
  fulfillment_status: string | null;
  total_price: number;
  currency: string | null;
}

const ORDER_COLUMNS =
  'id, order_number, created_at, financial_status, fulfillment_status, total_price, currency';

/**
 * Orders belonging to the signed-in email, newest first.
 *
 * The email filter is the ownership check (RLS is the backstop, and the order
 * detail page repeats the same `.eq('email', …)`). Shared by the order list and
 * the overview's recent-orders block so the two cannot drift on columns or
 * ordering — the overview used to render a hardcoded "No orders yet" that was
 * shown to shoppers who *did* have orders.
 *
 * Throws a logged `DatabaseError` on a failed read, so callers can tell a
 * failure apart from "this shopper has no orders" and render `ErrorState`
 * instead of the empty state.
 */
export async function fetchAccountOrders(email: string, limit: number): Promise<AccountOrder[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throwDbError('account:orders', 'orders', error);
  return (data ?? []) as AccountOrder[];
}

/** Shopify `financial_status` → the copy and tone the account pages show. */
export function financialStatusLabel(status: string | null): {
  label: string;
  tone: 'success' | 'danger' | 'muted';
} {
  switch ((status ?? 'pending').toLowerCase()) {
    case 'paid':
      return { label: 'Paid', tone: 'success' };
    case 'refunded':
    case 'voided':
      return { label: 'Refunded', tone: 'danger' };
    case 'partially_refunded':
      return { label: 'Partially refunded', tone: 'danger' };
    default:
      return { label: 'Pending', tone: 'muted' };
  }
}

/** `fulfilled` means the parcel left the warehouse — not that it arrived. */
export function fulfillmentStatusLabel(status: string | null): string {
  switch ((status ?? '').toLowerCase()) {
    case 'fulfilled':
      return 'Shipped';
    case 'partial':
      return 'Partially shipped';
    default:
      return 'Processing';
  }
}
