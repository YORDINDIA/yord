import {
  AlertTriangle,
  LayoutDashboard,
  Package,
  PackageCheck,
  Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import ChartCard from '@/components/charts/ChartCard';
import Sparkline from '@/components/charts/Sparkline';
import CountDonut from '@/components/dashboard/CountDonut';
import TrendChart from '@/components/dashboard/TrendChart';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import HeroKpi from '@/components/dashboard/HeroKpi';
import KpiRow from '@/components/dashboard/KpiRow';
import LowStockList from '@/components/dashboard/LowStockList';
import QuickActions from '@/components/dashboard/QuickActions';
import TopProductsList from '@/components/dashboard/TopProductsList';
import AmbientAurora from '@/components/reactbits/AmbientAurora';
import AnimatedContent from '@/components/reactbits/AnimatedContent';
import StarCard from '@/components/reactbits/StarCard';
import Avatar from '@/components/ui/Avatar';
import PageHeader from '@/components/ui/PageHeader';
import ProgressBar from '@/components/ui/ProgressBar';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { percentDelta } from '@/lib/chart-format';
import { getDashboardData, type RecentOrder } from '@/lib/data/analytics';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/format';
import styles from '@/components/dashboard/dashboard.module.css';

export const metadata: Metadata = { title: 'Dashboard · YORD Admin' };

export const dynamic = 'force-dynamic';

/** Sparkline heights: the hero band is taller than the KPI strip. */
const HERO_SPARK_HEIGHT = 44;
const TILE_SPARK_HEIGHT = 26;

/**
 * Palette indices (the `CHART_TONES` order) per financial status.
 * Money captured reads emerald, money pending amber, money returned
 * rose — the same semantics the order status badges use.
 */
const FINANCIAL_TONE: Record<string, number> = {
  pending: 5,
  paid: 2,
  refunded: 4,
  partially_refunded: 4,
  voided: 7,
  failed: 4,
  other: 6,
};

/** `partially_refunded` → `Partially refunded`. */
function labelForStatus(status: string): string {
  const spaced = status.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Storefront origin for the header action, or null when there is
 * nothing to link to.
 *
 * `NEXT_PUBLIC_APP_URL` is the storefront's address. A same-origin
 * value is dropped: in dev both apps serve :3000, and a "View
 * storefront" button that reloads the admin would be a lie.
 */
async function storefrontHref(): Promise<string | null> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return null;

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    return null;
  }

  const host = (await headers()).get('host');
  if (host && url.host === host) return null;
  return url.origin;
}

/**
 * Dashboard — the control room.
 *
 * All reads go through `getDashboardData()`; the money path stays in
 * SQL (`revenue_by_day`, `top_products_by_units`), and a failed read
 * throws into the route error boundary instead of rendering a
 * confident zero. Every figure that can count up does, through the
 * app's own formatters, so nothing animated can disagree with a
 * static rendering elsewhere.
 *
 * The aurora behind it all is a whisper of the brand's own triad at
 * low amplitude — fixed behind the content, non-interactive, paused
 * when the tab hides, and absent entirely under reduced motion.
 */
export default async function DashboardPage() {
  const { orders, counts, customers, extras } = await getDashboardData();
  const storefrontUrl = await storefrontHref();

  const spark7 = extras.byDay30.slice(-7).map((point) => point.total);
  const spark30 = extras.byDay30.map((point) => point.total);
  const trend30 = extras.byDay30.map((point) => ({ label: point.day, value: point.total }));
  const trend30Previous = extras.previousByDay30.map((point) => ({
    label: point.day,
    value: point.total,
  }));

  // Zero-count statuses are dropped: a legend of six statuses that
  // all read "0" buries the one bucket that has orders. An all-zero
  // mix renders the donut's own empty state.
  const statusMix = extras.statusMix
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      label: labelForStatus(entry.status),
      value: entry.count,
      tone: FINANCIAL_TONE[entry.status] ?? 6,
    }));

  const { healthy, total: variantTotal } = extras.inventoryHealth;
  const coverage = variantTotal > 0 ? Math.round((healthy / variantTotal) * 100) : 0;

  const recentColumns: DataTableColumn<RecentOrder>[] = [
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
      render: (order) => (
        <span className="table-num">
          {formatCurrency(order.total_price, order.currency || 'INR')}
        </span>
      ),
    },
    {
      key: 'payment',
      header: 'Payment',
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
      {/* Atmosphere: a whisper of the brand's own triad behind the
          content — fixed, non-interactive, paused when the tab
          hides, and gone entirely under reduced motion. */}
      <AmbientAurora className="aurora-layer" />

      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description="Storefront health at a glance: revenue, orders, fulfillment, and stock."
        actions={
          <>
            {storefrontUrl ? (
              <a className="button" href={storefrontUrl} target="_blank" rel="noreferrer">
                View storefront
              </a>
            ) : null}
            <Link className="button" href="/analytics">
              Go to analytics
            </Link>
          </>
        }
      />

      {/* The headline band: a thin frame of the section accent with
          two slowly orbiting beams, and the week's revenue counting
          up as the page lands. */}
      <StarCard innerClassName="hero-kpi" thickness={2} radius={12}>
        <HeroKpi
          label="Revenue · last 7 days"
          value={formatCurrency(extras.revenue7.current)}
          valueRaw={extras.revenue7.current}
          windowLabel="Whole UTC days, ending yesterday"
          delta={{
            ...percentDelta(extras.revenue7.current, extras.revenue7.previous),
            title: 'vs previous 7 days',
          }}
          spark={
            <Sparkline
              data={spark7}
              tone={0}
              height={HERO_SPARK_HEIGHT}
              ariaLabel="Daily revenue, last 7 days"
            />
          }
        />
      </StarCard>

      <AnimatedContent distance={18} duration={0.55} delay={0.06} threshold={0.1}>
        {/* The week's headline lives in the framed band above, so the
            strip opens with the month instead of repeating it. */}
        <KpiRow>
          <StatCard
            label="Revenue · 30d"
            value={formatCurrency(extras.revenue30.current)}
            valueRaw={extras.revenue30.current}
            animateKind="currency"
            delta={{
              ...percentDelta(extras.revenue30.current, extras.revenue30.previous),
              title: 'vs previous 30 days',
            }}
            hint="vs previous 30 days"
            spark={
              <Sparkline
                data={spark30}
                tone={0}
                height={TILE_SPARK_HEIGHT}
                ariaLabel="Daily revenue, last 30 days"
              />
            }
            href="/analytics"
          />
          <StatCard
            label="Orders · 30d"
            value={formatNumber(extras.orders30.current)}
            valueRaw={extras.orders30.current}
            delta={{
              ...percentDelta(extras.orders30.current, extras.orders30.previous),
              title: 'vs previous 30 days',
            }}
            hint="vs previous 30 days"
            href="/orders"
          />
          <StatCard
            label="New customers · 30d"
            value={formatNumber(customers.stats.new)}
            valueRaw={customers.stats.new}
            icon={Users}
            tone="violet"
            href="/customers"
          />
          <StatCard
            label="Average order value"
            value={formatCurrency(extras.aov30)}
            valueRaw={extras.aov30}
            animateKind="currency"
            tone="amber"
            href="/analytics"
          />
          <StatCard
            label="Fulfillment queue"
            value={formatNumber(counts.fulfillmentQueue)}
            valueRaw={counts.fulfillmentQueue}
            icon={PackageCheck}
            tone="cyan"
            hint="not yet fulfilled"
            href="/orders"
          />
          <StatCard
            label="Low stock"
            value={formatNumber(extras.lowStockCount)}
            valueRaw={extras.lowStockCount}
            icon={AlertTriangle}
            tone="rose"
            hint="at or below reorder point"
            href="/inventory"
          />
          <StatCard
            label="Active products"
            value={formatNumber(extras.activeProducts)}
            valueRaw={extras.activeProducts}
            icon={Package}
            tone="emerald"
            hint={`${formatNumber(counts.products)} in the catalog`}
            href="/products?status=active"
          />
        </KpiRow>
      </AnimatedContent>

      <AnimatedContent distance={18} duration={0.55} delay={0.12} threshold={0.1}>
        <div className="dash-grid">
          {/* The chart the page is about gets the cursor wash; the
              donut beside it keeps the plain card. */}
          <ChartCard
            glow
            className="col-8"
            title="Revenue trend · 30 days"
            description="Daily revenue, whole UTC days. The dashed line is the 30 days before."
            height={220}
          >
            <TrendChart
              data={trend30}
              compare={trend30Previous}
              height={220}
              tone={0}
              valueKind="currency"
              ariaLabel="Daily revenue for the last 30 days, compared with the previous 30"
            />
          </ChartCard>

          <ChartCard
            className="col-4"
            title="Order status"
            description="Every order by financial status."
            height={220}
          >
            <CountDonut
              data={statusMix}
              height={220}
              centerLabel="Orders"
              centerValue={formatNumber(counts.orders)}
              ariaLabel="Orders by financial status"
            />
          </ChartCard>
        </div>
      </AnimatedContent>

      <AnimatedContent distance={18} duration={0.55} delay={0.18} threshold={0.1}>
        <div className="dash-grid">
          <section className="card col-6">
            <header className="card-header">
              <div className="stack-sm">
                <h2 className="card-title">Recent orders</h2>
                <p className="helper">Latest storefront activity.</p>
              </div>
              <Link className="button small" href="/orders">
                All orders
              </Link>
            </header>
            <DataTable
              caption="Recent orders"
              columns={recentColumns}
              rows={orders}
              rowKey={(order) => order.id}
              leading={(order) => <Avatar email={order.email} size="sm" />}
              emptyTitle="No orders yet"
              emptyHint="Orders appear here as soon as the storefront takes one."
            />
          </section>

          <section className="card col-3">
            <header className="card-header">
              <div className="stack-sm">
                <h2 className="card-title">Low stock</h2>
                <p className="helper">Worst variants first; unknown stock counts as low.</p>
              </div>
              <Link className="button small" href="/inventory">
                Inventory
              </Link>
            </header>
            <LowStockList rows={extras.lowStock} />
          </section>

          <section className="card col-3">
            <header className="card-header">
              <div className="stack-sm">
                <h2 className="card-title">Top products</h2>
                <p className="helper">By units sold.</p>
              </div>
              <Link className="button small" href="/products">
                Catalog
              </Link>
            </header>
            <TopProductsList rows={extras.topProducts.rows} covers={extras.topProducts.covers} />
          </section>
        </div>
      </AnimatedContent>

      <AnimatedContent distance={18} duration={0.55} delay={0.24} threshold={0.1}>
        <div className="dash-grid">
          {/* Every direct child of a `.dash-grid` must carry a
              `col-*` span (or wrap one that does) — the grid is 12
              fixed columns, and an unspanned child collapses to a
              single column. */}
          <div className="col-4">
            <QuickActions />
          </div>

          <div className="col-4">
            <section className="card">
              <header className="card-header">
                <div className="stack-sm">
                  <h2 className="card-title">Inventory health</h2>
                  <p className="helper">{coverage}% of variants fully stocked.</p>
                </div>
              </header>
              <div className="stack">
                <ProgressBar
                  value={coverage}
                  tone={coverage >= 80 ? 'emerald' : coverage >= 60 ? 'amber' : 'rose'}
                  label="Stock coverage"
                />
                <p className="helper" style={{ margin: 0 }}>
                  {formatNumber(extras.activeProducts)} active products ·{' '}
                  {formatNumber(extras.lowStockCount)} variants at or below the reorder
                  point.
                </p>
              </div>
            </section>
          </div>

          <div className="col-4">
            <section className="card">
              <header className="card-header">
                <div className="stack-sm">
                  <h2 className="card-title">Customers</h2>
                  <p className="helper">New this period vs the one before.</p>
                </div>
              </header>
              <div className="stack">
                <div className="stat-value">{formatNumber(customers.stats.total)}</div>
                <p className="helper" style={{ margin: 0 }}>
                  {formatNumber(customers.stats.new)} joined in the last 30 days ·{' '}
                  {formatNumber(extras.customers30.previous)} in the 30 before.
                </p>
              </div>
            </section>
          </div>
        </div>
      </AnimatedContent>

      {/* How the numbers are computed, in plain language. */}
      <section className="card">
        <header className="card-header">
          <h2 className="card-title">How these numbers are computed</h2>
        </header>
        <ul className={styles.notes}>
          <li>
            <strong>Revenue</strong> counts captured order value in whole UTC days
            ending yesterday; the 7-day and 30-day windows share one SQL rollup.
          </li>
          <li>
            <strong>Fulfillment queue</strong> counts orders that are still unfulfilled
            or carry a NULL status (migrated rows) — the same set the sidebar badge
            counts.
          </li>
          <li>
            <strong>Low stock</strong> flags active variants at or below the reorder
            point, and counts unknown (untracked) stock as low, matching the inventory
            page.
          </li>
        </ul>
      </section>
    </>
  );
}
