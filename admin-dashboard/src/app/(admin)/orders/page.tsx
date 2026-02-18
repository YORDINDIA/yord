import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export default async function OrdersPage() {
  const supabase = await createServerClient();
  const { data: orders } = await supabase
    .from('orders')
    .select('id, name, total_price, currency, financial_status, fulfillment_status, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Orders</div>
          <div className="helper">Manage fulfillment and refunds.</div>
        </div>
      </div>
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
              <td><Link href={`/orders/${order.id}`}>{order.name}</Link></td>
              <td>{formatCurrency(order.total_price, order.currency || 'INR')}</td>
              <td>{order.financial_status || '-'}</td>
              <td>{order.fulfillment_status || '-'}</td>
              <td>{formatDate(order.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
