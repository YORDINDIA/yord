import Link from 'next/link';
import type { Metadata } from 'next';
import { Megaphone, Repeat2, SearchX, UserCheck, UserPlus, Users } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import FilterBar, { FilterSelect } from '@/components/data/FilterBar';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Avatar from '@/components/ui/Avatar';
import type { TrendDirection } from '@/components/ui/TrendPill';
import CustomersExportButton from '@/components/customers/CustomersExportButton';
import { customerName, formatRelative, formatTimestamp } from '@/components/customers/display';
import { getCustomerStats, listCustomers, type CustomerListRow } from '@/lib/data/customers';
import { firstParam, pageCount } from '@/lib/pagination';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Customers · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

/** Counts read better grouped in this admin's base type. */
const countFormat = new Intl.NumberFormat('en-IN');

/**
 * Delta for the "new customers" card, from the two counts the stats read
 * already returns. Pre-formatted: `TrendPill` never formats numbers.
 */
function trendFor(current: number, previous: number): { direction: TrendDirection; value: string } {
  if (previous === 0) {
    return current === 0
      ? { direction: 'flat', value: 'No signups' }
      : { direction: 'up', value: `+${current}` };
  }
  if (current === previous) return { direction: 'flat', value: 'No change' };
  const percent = Math.round((Math.abs(current - previous) / previous) * 100);
  return current > previous
    ? { direction: 'up', value: `+${percent}%` }
    : { direction: 'down', value: `-${percent}%` };
}

/**
 * Customer list.
 *
 * The page reads two things in parallel: one page of customers (each row
 * carrying its last order date, joined in a single bounded query) and the
 * head-only counts behind the stat strip. Everything else — filtering,
 * pagination, search sanitizing — stays in `src/lib/data/customers` and the
 * shared components; this file is config plus rendering.
 *
 * Filters and the pager share one `params` object, so paging keeps the search
 * and the marketing filter, and switching either drops the now-meaningless
 * `page` (both controls live in one `FilterBar` form, which is what makes the
 * two fields travel together).
 */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const resolved = await searchParams;
  const marketingRaw = firstParam(resolved.marketing);
  const marketing: 'all' | 'yes' | 'no' =
    marketingRaw === 'yes' || marketingRaw === 'no' ? marketingRaw : 'all';

  const params: Record<string, string | undefined> = {
    q: firstParam(resolved.q)?.trim() || undefined,
    marketing: marketing === 'all' ? undefined : marketing,
  };

  const [{ rows, count, page, pageSize }, stats] = await Promise.all([
    listCustomers({
      q: params.q,
      marketing,
      page: Number(firstParam(resolved.page)) || 1,
    }),
    getCustomerStats(),
  ]);

  const columns: DataTableColumn<CustomerListRow>[] = [
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <>
          <Link href={`/customers/${row.id}`}>{customerName(row)}</Link>
          <div className="cell-sub truncate" title={row.email ?? undefined}>
            {row.email || 'No email on file'}
          </div>
        </>
      ),
    },
    {
      key: 'orders',
      header: 'Orders',
      align: 'right',
      hideOnMobile: true,
      render: (row) => <span className="table-num">{row.orders_count ?? 0}</span>,
    },
    {
      key: 'spent',
      header: 'Total spent',
      align: 'right',
      render: (row) => <span className="table-num">{formatCurrency(row.total_spent, 'INR')}</span>,
    },
    {
      key: 'lastOrder',
      header: 'Last order',
      hideOnMobile: true,
      render: (row) =>
        row.lastOrderAt ? (
          <span className="nowrap" title={formatTimestamp(row.lastOrderAt)}>
            {formatRelative(row.lastOrderAt)}
          </span>
        ) : null,
    },
    {
      key: 'marketing',
      header: 'Marketing',
      hideOnTablet: true,
      render: (row) =>
        row.accepts_marketing ? <span className="chip tone tone-cyan">Opted in</span> : null,
    },
    {
      key: 'since',
      header: 'Customer since',
      hideOnTablet: true,
      render: (row) => (
        <span className="nowrap" title={formatTimestamp(row.created_at)}>
          {formatDate(row.created_at)}
        </span>
      ),
    },
  ];

  const shareOfTotal = (part: number) =>
    stats.total > 0 ? Math.round((part / stats.total) * 100) : 0;

  const exportRows = rows.map((row) => ({
    id: row.id,
    name: customerName(row),
    email: row.email ?? '',
    orders: row.orders_count ?? 0,
    total_spent: Number(row.total_spent ?? 0),
    last_order: row.lastOrderAt ?? '',
    marketing: row.accepts_marketing ? 'yes' : 'no',
    customer_since: row.created_at,
  }));

  return (
    <>
      <PageHeader
        icon={Users}
        title="Customers"
        description="Buyers, spend, and contact history."
        tone="cyan"
        actions={<CustomersExportButton rows={exportRows} />}
      />

      <div className="stat-grid">
        <StatCard
          label="Customers"
          value={countFormat.format(stats.total)}
          icon={Users}
          tone="cyan"
          hint="All time"
        />
        <StatCard
          label="With orders"
          value={countFormat.format(stats.withOrders)}
          icon={UserCheck}
          tone="blue"
          hint={`${shareOfTotal(stats.withOrders)}% of customers`}
        />
        <StatCard
          label="Repeat buyers"
          value={`${Math.round(stats.repeatRate * 100)}%`}
          icon={Repeat2}
          tone="emerald"
          hint={
            stats.withOrders > 0
              ? `${stats.repeatCustomers} of ${stats.withOrders} ordered twice`
              : 'No orders yet'
          }
        />
        <StatCard
          label="Marketing opt-ins"
          value={countFormat.format(stats.marketingOptIn)}
          icon={Megaphone}
          tone="violet"
          hint={`${shareOfTotal(stats.marketingOptIn)}% of customers`}
        />
        <StatCard
          label="New in 30 days"
          value={countFormat.format(stats.newLast30Days)}
          icon={UserPlus}
          tone="cyan"
          delta={trendFor(stats.newLast30Days, stats.previous30Days)}
          hint="vs previous 30 days"
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">All customers</div>
            <div className="helper">
              {count} {count === 1 ? 'customer' : 'customers'} · page {page} of{' '}
              {pageCount(count, pageSize)}
            </div>
          </div>
        </div>

        <FilterBar>
          <input
            className="input"
            type="search"
            name="q"
            placeholder="Search name or email"
            defaultValue={params.q ?? ''}
            aria-label="Search customers"
          />
          <FilterSelect
            name="marketing"
            label="Marketing"
            value={marketing}
            options={[
              { value: 'all', label: 'All customers' },
              { value: 'yes', label: 'Opted in to marketing' },
              { value: 'no', label: 'Not opted in' },
            ]}
          />
        </FilterBar>

        {rows.length > 0 ? (
          <DataTable
            caption="Customers"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            leading={(row) => <Avatar size="sm" name={customerName(row)} email={row.email} />}
            dense
            stickyHeader
          />
        ) : stats.total === 0 ? (
          // An empty table and an empty store read differently: one is "narrow
          // your search", the other is "there is nothing here yet".
          <EmptyState
            icon={<Users size={28} />}
            title="No customers yet"
            hint="Customers are created by the storefront, not by hand — the first checkout appears here with its buyer details."
            secondaryAction={{ label: 'View orders', href: '/orders' }}
          />
        ) : (
          <EmptyState
            icon={<SearchX size={28} />}
            title="No customers match these filters"
            hint="Try a different name or email, or switch the marketing filter back to all customers."
            actionLabel="Clear filters"
            actionHref="/customers"
          />
        )}

        <Pagination
          basePath="/customers"
          params={params}
          page={page}
          pageSize={pageSize}
          total={count}
          shown={rows.length}
          label="customers"
        />
      </div>
    </>
  );
}
