import Link from 'next/link';
import type { Metadata } from 'next';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import { countCatalogSize, revenueByDay, topProductsByUnits, REVENUE_CHART_DAYS } from '@/lib/data/analytics';
import { formatCurrency } from '@/lib/utils/format';
import type { TopProduct } from '@/lib/data/analytics';

export const metadata: Metadata = { title: 'Analytics · YORD Admin' };

/**
 * Analytics.
 *
 * Both charts were built from truncated samples: revenue summed `.limit(500)`
 * orders in JS and then bucketed 14 days out of that already-capped set, and
 * "top products" read `.limit(100)` line items and merged rows by
 * `line_item.title`, so two distinct products sharing a title collapsed into one
 * and their revenue landed on whichever id appeared first. Aggregation now runs
 * in Postgres (`revenue_by_day`, `top_products_by_units`) and the product rollup
 * is keyed by `product_id`.
 */
export default async function AnalyticsPage() {
  const [revenue, catalogSize, top] = await Promise.all([
    revenueByDay(REVENUE_CHART_DAYS),
    countCatalogSize(),
    topProductsByUnits(),
  ]);

  // The KPI total and the chart come from the same SQL rollup over the same
  // window, so the label is bound to the constant rather than hardcoded — the
  // card previously read "last 30d" while summing 14 days of data, which
  // overstated the period and hid the mismatch from anyone who didn't open the
  // data layer.
  const revenueTotal = revenue.total;
  const maxDay = Math.max(1, ...revenue.byDay.map((point) => point.total));

  const topColumns: DataTableColumn<TopProduct>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (row) =>
        row.productId ? (
          <Link href={`/products/${row.productId}`}>{row.title}</Link>
        ) : (
          row.title
        ),
    },
    {
      key: 'quantity',
      header: 'Units',
      align: 'right',
      render: (row) => String(row.quantity),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      render: (row) => formatCurrency(row.revenue, 'INR'),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="grid-2">
        <div className="card kpi">
          <span className="kpi-label">Revenue · last {REVENUE_CHART_DAYS}d (INR)</span>
          <span className="kpi-value">{formatCurrency(revenueTotal, 'INR')}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Catalog Size</span>
          <span className="kpi-value">{catalogSize}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Revenue · last {REVENUE_CHART_DAYS} days</div>
            <div className="helper">Supabase orders, INR only, aggregated in SQL.</div>
          </div>
          <Link className="button" href="/orders">
            View orders
          </Link>
        </div>
        <div role="group" aria-label={`Daily revenue for the last ${REVENUE_CHART_DAYS} days`}>
          {revenue.byDay.map((point) => {
            const label = new Date(point.day).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              timeZone: 'UTC',
            });
            return (
              <div key={point.day} className="bar-row">
                <span className="helper">{label}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.round((point.total / maxDay) * 100)}%` }}
                  />
                </div>
                <span>{formatCurrency(point.total, 'INR')}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Top products by units</div>
            <div className="helper">Aggregated over all line items, grouped by product.</div>
          </div>
        </div>
        <DataTable
          caption="Top products"
          columns={topColumns}
          rows={top.rows}
          rowKey={(row) => String(row.productId ?? row.title)}
          emptyTitle="No sales yet"
          emptyHint="Top products appear once orders have line items."
        />
      </div>
    </div>
  );
}
