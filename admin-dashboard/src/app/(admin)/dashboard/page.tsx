import Link from 'next/link';
import type { Metadata } from 'next';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { getDashboardSummary, type RecentOrder } from '@/lib/data/analytics';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Dashboard · YORD Admin' };

/**
 * Dashboard.
 *
 * Two things were wrong with the previous version. It summed revenue in JS from
 * `.limit(500)` order rows, so any 30-day window holding more than 500 orders
 * under-reported; revenue is now aggregated in SQL. And every KPI was
 * `count ?? 0` — a failed count read rendered as a confident `0`, so a broken
 * query looked like a healthy business. Failed reads now throw `DatabaseError`
 * and land on the route error boundary.
 */
export default async function DashboardPage() {
  const { counts, revenue, recentOrders } = await getDashboardSummary();

  const kpis = [
    { label: 'Revenue · 7d', value: formatCurrency(revenue.last7Days, 'INR'), href: '/analytics' },
    { label: 'Revenue · 30d', value: formatCurrency(revenue.last30Days, 'INR'), href: '/analytics' },
    { label: 'Orders today', value: String(counts.ordersToday), href: '/orders' },
    {
      label: 'Fulfillment queue',
      value: String(counts.fulfillmentQueue),
      href: '/orders?fulfillment=unfulfilled',
    },
    { label: 'Low stock variants', value: String(counts.lowStockVariants), href: '/inventory' },
    { label: 'Products', value: String(counts.products), href: '/products' },
    { label: 'Orders', value: String(counts.orders), href: '/orders' },
    { label: 'Customers', value: String(counts.customers), href: '/customers' },
    { label: 'Articles', value: String(counts.articles), href: '/blogs' },
  ];

  const columns: DataTableColumn<RecentOrder>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (order) => (
        <Link href={`/orders/${order.id}`}>{order.name || `#${order.id}`}</Link>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (order) => formatCurrency(order.total_price, order.currency || 'INR'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => <StatusBadge value={order.financial_status} />,
      hideOnTablet: true,
    },
    {
      key: 'fulfillment',
      header: 'Fulfillment',
      render: (order) => <StatusBadge value={order.fulfillment_status} />,
      hideOnTablet: true,
    },
    {
      key: 'created',
      header: 'Created',
      render: (order) => formatDate(order.created_at),
      hideOnMobile: true,
    },
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
          <Link className="button" href="/orders">
            View all
          </Link>
        </div>
        <DataTable
          caption="Recent orders"
          columns={columns}
          rows={recentOrders}
          rowKey={(order) => order.id}
          emptyTitle="No orders yet"
          emptyHint="Orders appear here as soon as the storefront takes one."
        />
      </div>
    </>
  );
}
