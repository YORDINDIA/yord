import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { ShoppingCart } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';

const PAGE_SIZE = 25;
const FINANCIAL = ['all', 'pending', 'paid', 'refunded', 'partially_refunded', 'voided', 'failed'] as const;
const FULFILLMENT = ['all', 'unfulfilled', 'fulfilled', 'partial', 'restocked'] as const;

type Search = { q?: string; financial?: string; fulfillment?: string; from?: string; to?: string; page?: string };

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const supabase = await createServerClient();
  const resolved = await searchParams;
  const q = resolved?.q?.trim() || '';
  const financial = (FINANCIAL as readonly string[]).includes(resolved?.financial || '') ? resolved.financial! : 'all';
  const fulfillment = (FULFILLMENT as readonly string[]).includes(resolved?.fulfillment || '') ? resolved.fulfillment! : 'all';
  const fromDate = resolved?.from || '';
  const toDate = resolved?.to || '';
  const page = Math.max(1, Number(resolved?.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let request = supabase
    .from('orders')
    .select('id, name, email, total_price, currency, financial_status, fulfillment_status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (financial !== 'all') request = request.eq('financial_status', financial);
  if (fulfillment !== 'all') request = request.eq('fulfillment_status', fulfillment);
  const fromParsed = parseDate(fromDate);
  if (fromParsed) request = request.gte('created_at', fromParsed.toISOString());
  const toParsed = parseDate(toDate);
  if (toParsed) {
    const end = new Date(toParsed);
    end.setDate(end.getDate() + 1);
    request = request.lt('created_at', end.toISOString());
  }
  if (q) {
    const safe = q.replace(/[%(),"]/g, '').trim().slice(0, 100);
    if (safe) request = request.or(`name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }

  const { data: orders, count } = await request;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  function qs(next: Partial<Record<keyof Search, string | number>>): string {
    const params = new URLSearchParams({
      q, financial, fulfillment, from: fromDate, to: toDate, page: String(page),
      ...Object.fromEntries(Object.entries(next).map(([k, v]) => [k, String(v)])),
    });
    return `/orders?${params.toString()}`;
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Orders</div>
          <div className="helper">{count ?? 0} orders · page {page} of {totalPages}</div>
        </div>
      </div>

      <form className="toolbar" style={{ marginBottom: 16 }}>
        <input className="input" name="q" placeholder="Search name or email" defaultValue={q} />
        <select className="select" name="financial" defaultValue={financial}>
          {FINANCIAL.map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All financial' : s}</option>
          ))}
        </select>
        <select className="select" name="fulfillment" defaultValue={fulfillment}>
          {FULFILLMENT.map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All fulfillment' : s}</option>
          ))}
        </select>
        <input className="input" type="date" name="from" defaultValue={fromDate} aria-label="From date" />
        <input className="input" type="date" name="to" defaultValue={toDate} aria-label="To date" />
        <button className="button" type="submit">Apply</button>
      </form>

      {(orders || []).length === 0 ? (
        <EmptyState
          title="No orders match these filters"
          hint="Try widening the date range or clearing search."
          icon={<ShoppingCart size={28} />}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Total</th>
                <th>Financial</th>
                <th>Fulfillment</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(orders || []).map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/orders/${order.id}`}>{order.name}</Link>
                    <div className="helper">{order.email || '-'}</div>
                  </td>
                  <td>{formatCurrency(order.total_price, order.currency || 'INR')}</td>
                  <td><StatusBadge value={order.financial_status} /></td>
                  <td><StatusBadge value={order.fulfillment_status} /></td>
                  <td>{formatDate(order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pagination">
        <span className="helper">Showing {(orders || []).length} of {count ?? 0}</span>
        <div className="toolbar">
          {page > 1 && <Link className="button" href={qs({ page: page - 1 })}>Previous</Link>}
          {page < totalPages && <Link className="button" href={qs({ page: page + 1 })}>Next</Link>}
        </div>
      </div>
    </div>
  );
}
