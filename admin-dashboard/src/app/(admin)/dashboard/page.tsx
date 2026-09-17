import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import StatusBadge from '@/components/ui/StatusBadge';

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const now = new Date();
  const day7 = new Date(now);
  day7.setDate(day7.getDate() - 7);
  const day30 = new Date(now);
  day30.setDate(day30.getDate() - 30);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [products, orders, customers, articles, recentOrders, revenueRows, todayOrders, lowStock, queue] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('articles').select('id', { count: 'exact', head: true }),
    supabase
      .from('orders')
      .select('id, name, total_price, currency, financial_status, fulfillment_status, created_at')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('orders')
      .select('total_price, currency, created_at')
      .gte('created_at', day30.toISOString())
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString()),
    supabase
      .from('product_variants')
      .select('id', { count: 'exact', head: true })
      .lte('inventory_quantity', 5),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('fulfillment_status', 'unfulfilled'),
  ]);

  const inr = (revenueRows.data || []).filter((o) => (o.currency || 'INR') === 'INR');
  const revenue30 = inr.reduce((s, o) => s + (Number(o.total_price) || 0), 0);
  const revenue7 = inr
    .filter((o) => new Date(o.created_at).getTime() >= day7.getTime())
    .reduce((s, o) => s + (Number(o.total_price) || 0), 0);

  const kpis = [
    { label: 'Revenue · 7d', value: formatCurrency(revenue7, 'INR'), href: '/analytics' },
    { label: 'Revenue · 30d', value: formatCurrency(revenue30, 'INR'), href: '/analytics' },
    { label: 'Orders today', value: String(todayOrders.count ?? 0), href: '/orders' },
    { label: 'Fulfillment queue', value: String(queue.count ?? 0), href: '/orders?fulfillment=unfulfilled' },
    { label: 'Low stock variants', value: String(lowStock.count ?? 0), href: '/inventory' },
    { label: 'Products', value: String(products.count ?? 0), href: '/products' },
    { label: 'Orders', value: String(orders.count ?? 0), href: '/orders' },
    { label: 'Customers', value: String(customers.count ?? 0), href: '/customers' },
    { label: 'Articles', value: String(articles.count ?? 0), href: '/blogs' },
  ];

  return (
    <>
      <div className="grid-2">
        {kpis.map((kpi) => (
          <Link key={kpi.label} className="card kpi" href={kpi.href}>
            <span className="kpi-label">{kpi.label}</span>
            <span className="kpi-value">{kpi.value}</span>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Recent Orders</div>
            <div className="helper">Latest activity across storefront orders.</div>
          </div>
          <Link className="button" href="/orders">View all</Link>
        </div>
        <div className="table-wrap">
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
              {(recentOrders.data || []).map((order) => (
                <tr key={order.id}>
                  <td><Link href={`/orders/${order.id}`}>{order.name}</Link></td>
                  <td>{formatCurrency(order.total_price, order.currency || 'INR')}</td>
                  <td><StatusBadge value={order.financial_status} /></td>
                  <td><StatusBadge value={order.fulfillment_status} /></td>
                  <td>{formatDate(order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
