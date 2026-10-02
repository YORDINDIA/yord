import {
  BarChart3,
  Eye,
  Heart,
  IndianRupee,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  UserPlus,
  Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import ChartCard from '@/components/charts/ChartCard';
import ChartLegend from '@/components/charts/ChartLegend';
import Sparkline from '@/components/charts/Sparkline';
import BarsChart from '@/components/dashboard/BarsChart';
import CountDonut from '@/components/dashboard/CountDonut';
import InventoryHealthBars from '@/components/dashboard/InventoryHealthBars';
import KpiRow from '@/components/dashboard/KpiRow';
import TopProductsList from '@/components/dashboard/TopProductsList';
import TrendChart from '@/components/dashboard/TrendChart';
import notes from '@/components/dashboard/dashboard.module.css';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs, { type TabItem } from '@/components/ui/Tabs';
import { compactNumber, percentDelta } from '@/lib/chart-format';
import { coversForProducts } from '@/lib/data/covers';
import {
  ANALYTICS_RANGES,
  getInventoryHealth,
  getProductStatusMix,
  getRangeAnalytics,
  parseAnalyticsRange,
  topProductsByUnits,
} from '@/lib/data/analytics';
import { getEngagement } from '@/lib/data/traffic';
import { firstParam } from '@/lib/pagination';
import { formatCurrency } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Analytics · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

/** Plot height, shared by every `ChartCard` and its chart so nothing reflows. */
const CHART_HEIGHT = 240;

/** Products ranked in the chart and the list beside it. */
const TOP_PRODUCTS = 8;

/** Product status slice colours (palette indices). */
const PRODUCT_TONE: Record<string, number> = {
  active: 2,
  draft: 5,
  archived: 7,
  other: 6,
};

/** Route-template buckets → card labels (the collector's vocabulary). */
const TEMPLATE_LABEL: Record<string, string> = {
  home: 'Home',
  product: 'Product',
  collection: 'Collection',
  artist: 'Artist',
  catalog: 'Catalog',
  search: 'Search',
  blog: 'Blog',
  cart: 'Cart',
  checkout: 'Checkout',
  account: 'Account',
  other: 'Other',
};

/** `partially_refunded` → `Partially refunded`. */
function labelForStatus(status: string): string {
  const spaced = status.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Analytics — the deep dive behind the dashboard's KPIs.
 *
 * `?range=7|14|30|90` (default 14) picks the window; anything else — missing,
 * repeated, or out of vocabulary — falls back to the default instead of
 * reaching the queries. Every number on the page is range-scoped and comes from
 * one `revenue_by_day(2 × range)` call plus head counts over the same UTC day
 * windows (`getRangeAnalytics`), so the chart, the deltas, and AOV cannot drift
 * apart.
 *
 * The range's deltas compare against the window immediately before it — the
 * same number of whole UTC days, ending yesterday, which is the only window
 * `revenue_by_day` can bucket.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const range = parseAnalyticsRange(firstParam(resolved?.range));

  // First wave: the top-products rollup, which the cover lookup depends on.
  const top = await topProductsByUnits(TOP_PRODUCTS);
  const topProductIds = top.rows
    .map((row) => row.productId)
    .filter((id): id is number => id !== null);

  const [data, productMix, health, covers, engagement] = await Promise.all([
    getRangeAnalytics(range),
    getProductStatusMix(),
    getInventoryHealth(),
    coversForProducts(topProductIds),
    getEngagement(range),
  ]);

  const tabItems: TabItem[] = ANALYTICS_RANGES.map((days) => ({
    key: String(days),
    label: `${days}d`,
    href: `/analytics?range=${days}`,
  }));

  // Zero-count slices are dropped: a legend of statuses that all read "0"
  // buries the one bucket that matters. An empty mix renders `ChartEmpty`.
  const productMixSlices = productMix
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      label: labelForStatus(entry.status),
      value: entry.count,
      tone: PRODUCT_TONE[entry.status],
    }));
  const productTotal = productMix.reduce((sum, entry) => sum + entry.count, 0);

  const trendData = data.byDay.map((point) => ({ label: point.day, value: point.total }));
  const trendCompare = data.previousByDay.map((point) => ({ label: point.day, value: point.total }));
  const sparkData = data.byDay.map((point) => point.total);

  // `Bars` cycles the chart ramp per row when no tone is given, which is what a
  // ranking wants: distinct colours for distinct products, not one hue.
  const topBars = top.rows.map((row) => ({
    label: row.title,
    value: row.quantity,
    sub: formatCurrency(row.revenue, 'INR'),
  }));

  const windowLabel = `last ${range} days`;
  const compareTitle = `vs previous ${range} days`;

  // ── Shopper behavior (first-party event log) ────────────────────────────
  // Every card below reads the same `getEngagement(range)` result, so the
  // KPI deltas, the day series, and the rankings all describe one window.
  const kpis = engagement.kpis;
  const engagementDelta = (current: number, previous: number) => ({
    ...percentDelta(current, previous),
    title: compareTitle,
  });
  const pageTrend = engagement.byDay.map((point) => ({ label: point.day, value: point.views }));
  const pageTrendCompare = engagement.previousByDay.map((point) => ({
    label: point.day,
    value: point.views,
  }));
  const templateSlices = engagement.templates
    .filter((entry) => entry.views > 0)
    .map((entry, index) => ({
      label: TEMPLATE_LABEL[entry.template] ?? entry.template,
      value: entry.views,
      tone: index % 8,
    }));
  const templateTotal = engagement.templates.reduce((sum, entry) => sum + entry.views, 0);
  const funnelBars = [
    { label: 'Product views', value: kpis.current.productViews, tone: 0 },
    { label: 'Added to bag', value: kpis.current.addToCarts, tone: 0 },
    { label: 'Checkout started', value: kpis.current.checkoutStarted, tone: 0 },
    { label: 'Orders', value: kpis.current.ordersCompleted, tone: 0 },
  ];

  return (
    <>
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        description="Revenue, product performance, shopper behavior, and stock health for a chosen window."
        tabs={<Tabs items={tabItems} active={String(range)} ariaLabel="Analytics window" />}
      />

      <KpiRow>
        <StatCard
          label={`Revenue · ${windowLabel}`}
          value={formatCurrency(data.revenue.current)}
          icon={IndianRupee}
          tone="saffron"
          delta={{ ...percentDelta(data.revenue.current, data.revenue.previous), title: compareTitle }}
          hint={compareTitle}
          spark={<Sparkline data={sparkData} tone={0} ariaLabel={`Daily revenue, ${windowLabel}`} />}
        />
        <StatCard
          label={`Orders · ${windowLabel}`}
          value={String(data.orders.current)}
          icon={ShoppingBag}
          tone="violet"
          delta={{ ...percentDelta(data.orders.current, data.orders.previous), title: compareTitle }}
          hint={compareTitle}
        />
        <StatCard
          label="Average order value"
          value={formatCurrency(data.aov.current)}
          icon={Receipt}
          tone="violet"
          delta={{ ...percentDelta(data.aov.current, data.aov.previous), title: compareTitle }}
          hint={compareTitle}
        />
        <StatCard
          label={`New customers · ${windowLabel}`}
          value={String(data.customers.current)}
          icon={UserPlus}
          tone="violet"
          delta={{ ...percentDelta(data.customers.current, data.customers.previous), title: compareTitle }}
          hint={compareTitle}
        />
      </KpiRow>

      <KpiRow>
        <StatCard
          label={`Page views · ${windowLabel}`}
          value={compactNumber(kpis.current.pageViews)}
          icon={Eye}
          tone="saffron"
          delta={engagementDelta(kpis.current.pageViews, kpis.previous.pageViews)}
          hint={compareTitle}
          spark={
            <Sparkline
              data={engagement.byDay.map((point) => point.views)}
              tone={1}
              ariaLabel={`Daily page views, ${windowLabel}`}
            />
          }
        />
        <StatCard
          label={`Unique visitors · ${windowLabel}`}
          value={compactNumber(kpis.current.uniqueVisitors)}
          icon={Users}
          tone="violet"
          delta={engagementDelta(kpis.current.uniqueVisitors, kpis.previous.uniqueVisitors)}
          hint={compareTitle}
        />
        <StatCard
          label={`Added to bag · ${windowLabel}`}
          value={compactNumber(kpis.current.addToCarts)}
          icon={ShoppingCart}
          tone="violet"
          delta={engagementDelta(kpis.current.addToCarts, kpis.previous.addToCarts)}
          hint={compareTitle}
        />
        <StatCard
          label={`Wishlist adds · ${windowLabel}`}
          value={compactNumber(kpis.current.wishlistAdds)}
          icon={Heart}
          tone="violet"
          delta={engagementDelta(kpis.current.wishlistAdds, kpis.previous.wishlistAdds)}
          hint={compareTitle}
        />
      </KpiRow>

      <div className="dash-grid">
        <div className="col-8">
          <ChartCard
            title={`Revenue · ${windowLabel}`}
            description="Captured payments net of refunds, INR orders only. The dashed line is the same window one period earlier."
            height={CHART_HEIGHT}
            legend={
              <ChartLegend
                items={[
                  {
                    label: `Last ${range} days`,
                    color: 'var(--chart-1)',
                    value: formatCurrency(data.revenue.current),
                  },
                  {
                    label: `Previous ${range} days`,
                    color: 'var(--chart-2)',
                    value: formatCurrency(data.revenue.previous),
                  },
                ]}
              />
            }
            footer="Whole UTC days ending yesterday, so today is never half-counted."
          >
            <TrendChart
              data={trendData}
              compare={trendCompare}
              height={CHART_HEIGHT}
              tone={0}
              valueKind="currency"
              ariaLabel={`Daily revenue for the ${windowLabel} against the previous ${range} days`}
            />
          </ChartCard>
        </div>

        <div className="col-4">
          <ChartCard
            title="Catalog status"
            description="Every product by lifecycle status."
            height={CHART_HEIGHT}
            action={
              <Link className="button small" href="/products">
                Catalog
              </Link>
            }
          >
            <CountDonut
              data={productMixSlices}
              height={CHART_HEIGHT}
              centerLabel={productTotal === 1 ? 'Product' : 'Products'}
              centerValue={String(productTotal)}
              ariaLabel="Products by status"
            />
          </ChartCard>
        </div>

        <div className="col-6">
          <ChartCard
            title="Units sold by product"
            description="Top products by units, ranked across all orders (the rollup has no date filter)."
            height={CHART_HEIGHT}
          >
            <BarsChart
              data={topBars}
              height={CHART_HEIGHT}
              valueKind="count"
              ariaLabel="Top products by units sold, all time"
            />
          </ChartCard>
        </div>

        <div className="col-6">
          <section className="card">
            <div className="card-header">
              <div className="stack-sm">
                <h2 className="section-title">Top products</h2>
                <p className="helper">
                  {top.rows.length} products by units sold, all time, with revenue.
                </p>
              </div>
              <Link className="button small" href="/products">
                Catalog
              </Link>
            </div>
            <TopProductsList rows={top.rows} covers={covers} />
          </section>
        </div>

        <div className="col-4">
          <section className="card">
            <div className="card-header">
              <div className="stack-sm">
                <h2 className="section-title">Inventory health</h2>
                <p className="helper">Variants by stock level, catalog-wide.</p>
              </div>
              <Link className="button small" href="/inventory">
                Adjust
              </Link>
            </div>
            <InventoryHealthBars health={health} />
          </section>
        </div>

        <div className="col-8">
          <section className="card">
            <div className="card-header">
              <div className="stack-sm">
                <h2 className="section-title">How these numbers are computed</h2>
                <p className="helper">
                  Revenue is aggregated in Postgres, not summed in the browser.
                </p>
              </div>
            </div>
            <ul className={notes.notes}>
              <li>
                <strong>Revenue</strong> is the sum of successful sale/capture transactions on INR
                orders, minus completed Razorpay refunds. A refund is subtracted on the day it was
                issued, and orders with no usable transaction row fall back to their total for
                fully captured statuses only. Cancelled, voided, failed, and pending orders never
                contribute.
              </li>
              <li>
                <strong>Windows</strong> are whole UTC days taken from each order&apos;s
                creation timestamp and ending yesterday, because revenue is bucketed by UTC date
                and today is an incomplete bucket. The previous period is the same number of days
                immediately before the current one.
              </li>
              <li>
                <strong>Orders, AOV, and new customers</strong> are counted over those same day
                windows, so the four cards describe one period. AOV is window revenue divided by
                window orders, and reads zero for a window with no orders rather than dividing by
                zero.
              </li>
              <li>
                <strong>Top products</strong> rank by units across every line item ever recorded
                and are grouped by product id, so two products sharing a title stay separate. They
                are not limited to the selected window.
              </li>
              <li>
                <strong>Stock</strong> counts a variant as low at 1–5 units, out at zero or below,
                and unknown when its quantity was never counted (an unset value is treated as low,
                never as healthy). {compactNumber(health.total)} variants tracked.
              </li>
              <li>
                <strong>Shopper behavior</strong> comes from the first-party event log
                (<code>analytics_events</code>): page and product views, searches, and cart and
                wishlist actions captured by the storefront, plus the completed-order event the
                checkout server writes with its own computed total. Engagement windows are the same
                whole UTC days as revenue, and visitor counts use an anonymous per-browser id —
                never an account.
              </li>
            </ul>
          </section>
        </div>
      </div>

      <div className="dash-grid">
        <div className="col-8">
          <ChartCard
            title={`Page views · ${windowLabel}`}
            description="Storefront pageviews by day from the first-party event log. The dashed line is the previous window."
            height={CHART_HEIGHT}
            footer="Whole UTC days ending yesterday; views are counted on query-stripped paths."
          >
            <TrendChart
              data={pageTrend}
              compare={pageTrendCompare}
              height={CHART_HEIGHT}
              tone={1}
              valueKind="count"
              ariaLabel={`Daily page views for the ${windowLabel} against the previous ${range} days`}
            />
          </ChartCard>
        </div>

        <div className="col-4">
          <ChartCard
            title="Views by page type"
            description="Where those pageviews landed, by route kind."
            height={CHART_HEIGHT}
          >
            <CountDonut
              data={templateSlices}
              height={CHART_HEIGHT}
              centerLabel="Views"
              centerValue={compactNumber(templateTotal)}
              ariaLabel="Pageviews by route template"
            />
          </ChartCard>
        </div>

        <div className="col-4">
          <ChartCard
            title="Most viewed products"
            description={`Product pages ranked by views, ${windowLabel}.`}
            height={CHART_HEIGHT}
          >
            <BarsChart
              data={engagement.topViewed.map((row) => ({
                label: row.title,
                value: row.views,
                sub: `${compactNumber(row.uniqueVisitors)} browsers`,
              }))}
              height={CHART_HEIGHT}
              valueKind="count"
              ariaLabel="Most viewed products"
            />
          </ChartCard>
        </div>

        <div className="col-4">
          <ChartCard
            title="Added to bag"
            description={`Top products by add-to-cart events, ${windowLabel}.`}
            height={CHART_HEIGHT}
          >
            <BarsChart
              data={engagement.topCartAdds.map((row) => ({
                label: row.title,
                value: row.adds,
              }))}
              height={CHART_HEIGHT}
              valueKind="count"
              ariaLabel="Products most often added to cart"
            />
          </ChartCard>
        </div>

        <div className="col-4">
          <ChartCard
            title="Most wishlisted"
            description={`Top products by wishlist adds, ${windowLabel}. Wishlists live only in the shopper's browser, so this event stream is the only record of them.`}
            height={CHART_HEIGHT}
          >
            <BarsChart
              data={engagement.topWishlisted.map((row) => ({
                label: row.title,
                value: row.adds,
              }))}
              height={CHART_HEIGHT}
              valueKind="count"
              ariaLabel="Most wishlisted products"
            />
          </ChartCard>
        </div>

        <div className="col-8">
          <ChartCard
            title="Viewed vs sold"
            description={`Window views against all-time units sold. High views with no units flags a listing problem; units without views means traffic never reaches the product.`}
            height={CHART_HEIGHT}
          >
            <BarsChart
              data={engagement.viewToOrder.map((row) => ({
                label: row.title,
                value: row.views,
                sub: `${compactNumber(row.units)} sold`,
              }))}
              height={CHART_HEIGHT}
              valueKind="count"
              ariaLabel="Product views against all-time units sold"
            />
          </ChartCard>
        </div>

        <div className="col-4">
          <ChartCard
            title="Search terms"
            description={`What shoppers searched, ${windowLabel}. The sub-count is zero-result searches: demand the catalog does not carry.`}
            height={CHART_HEIGHT}
          >
            <BarsChart
              data={engagement.searchTerms.map((row) => ({
                label: row.term,
                value: row.searches,
                ...(row.zeroResults > 0 ? { sub: `${row.zeroResults} empty` } : {}),
              }))}
              height={CHART_HEIGHT}
              valueKind="count"
              ariaLabel="Top search terms"
            />
          </ChartCard>
        </div>

        <div className="col-8">
          <ChartCard
            title="Top pages"
            description={`Most-visited paths, ${windowLabel}.`}
            height={CHART_HEIGHT}
          >
            <BarsChart
              data={engagement.topPages.map((row) => ({
                label: row.path,
                value: row.views,
              }))}
              height={CHART_HEIGHT}
              valueKind="count"
              ariaLabel="Most visited pages"
            />
          </ChartCard>
        </div>

        <div className="col-4">
          <ChartCard
            title="Checkout funnel"
            description="Views → add to cart → checkout → completed orders."
            height={CHART_HEIGHT}
            footer={`Order value ${formatCurrency(kpis.current.orderValue)} · ${windowLabel}`}
          >
            <BarsChart
              data={funnelBars}
              height={CHART_HEIGHT}
              valueKind="count"
              ariaLabel="Checkout funnel stages"
            />
          </ChartCard>
        </div>
      </div>
    </>
  );
}
