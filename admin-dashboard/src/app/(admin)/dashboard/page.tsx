import { createServerClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export default async function DashboardPage() {
  const supabase = await createServerClient();

  const [products, orders, customers, articles] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('articles').select('id', { count: 'exact', head: true }),
  ]);

  const { data: recentOrders } = await supabase
    .from('orders')
    .select('id, name, total_price, currency, financial_status, fulfillment_status, created_at')
    .order('created_at', { ascending: false })
    .limit(6);

  return (
    <>
      <div className="grid-2">
        <div className="card kpi">
          <span className="kpi-label">Products</span>
          <span className="kpi-value">{products.count ?? 0}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Orders</span>
          <span className="kpi-value">{orders.count ?? 0}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Customers</span>
          <span className="kpi-value">{customers.count ?? 0}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Articles</span>
          <span className="kpi-value">{articles.count ?? 0}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Recent Orders</div>
            <div className="helper">Latest activity across storefront orders.</div>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Total</th>
              <th>Status</th>
              <th>Fulfillment</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {(recentOrders || []).map((order) => (
              <tr key={order.id}>
                <td>{order.name}</td>
                <td>{formatCurrency(order.total_price, order.currency || 'INR')}</td>
                <td>{order.financial_status || '-'}</td>
                <td>{order.fulfillment_status || '-'}</td>
                <td>{formatDate(order.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
