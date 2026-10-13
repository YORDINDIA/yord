import type { Metadata } from 'next';
import Link from 'next/link';
import { Receipt, RotateCcw, ShoppingCart, Truck, Wallet, X } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import FilterBar, { FilterSelect } from '@/components/data/FilterBar';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { itemCountLabel, formatCount, formatDateTime, relativeTime } from '@/components/orders/format';
import { listOrders, orderSummary, type OrderListRow } from '@/lib/data/orders';
import { firstParam, pageCount } from '@/lib/pagination';
import { formatCurrency } from '@/lib/utils/format';
import { FINANCIAL_STATUSES, FULFILLMENT_STATUSES } from '@/lib/constants';

export const metadata: Metadata = { title: 'Orders · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

const FILTERED_KEYS = ['q', 'financial_status', 'fulfillment_status', 'from', 'to'] as const;

/**
 * Order list.
 *
 * Search, date-range, status, and pagination all live in `src/lib/data/orders`;
 * this file is config plus rendering.
 *
 * Filter keys are `financial_status` / `fulfillment_status` because that is what
 * the dashboard's "awaiting fulfillment" link targets; the short forms
 * (`financial`, `fulfillment`) are still read so existing links and bookmarks
 * keep filtering.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const resolved = await searchParams;
  const params: Record<string, string | undefined> = {
    q: firstParam(resolved.q)?.trim() || undefined,
    financial_status: firstParam(resolved.financial_status) ?? firstParam(resolved.financial),
    fulfillment_status:
      firstParam(resolved.fulfillment_status) ?? firstParam(resolved.fulfillment),
    from: firstParam(resolved.from),
    to: firstParam(resolved.to),
  };

  const [{ rows, count, page, pageSize }, summary] = await Promise.all([
    listOrders({
      q: params.q,
      financial: params.financial_status,
      fulfillment: params.fulfillment_status,
      from: params.from,
      to: params.to,
      page: Number(firstParam(resolved.page)) || 1,
    }),
    orderSummary(),
  ]);

  const filtered = FILTERED_KEYS.some((key) => {
    const value = params[key];
    return Boolean(value) && value !== 'all';
  });

  const columns: DataTableColumn<OrderListRow>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (row) => (
        <>
          <Link className="cell-title" href={`/orders/${row.id}`}>
            {row.name ?? `#${row.id}`}
          </Link>
          <div className="cell-sub">{itemCountLabel(row.item_count, row.unit_count)}</div>
        </>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      hideOnTablet: true,
      render: (row) => {
        // `row.name` is the *order* name (`#1001`), not a person — a missing
        // customer row reads as a guest checkout instead.
        const name = row.customer_name || 'Guest checkout';
        return (
          <>
            <span className="cell-title">{name}</span>
            <div className="cell-sub">{row.email || 'no email on file'}</div>
          </>
        );
      },
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (row) => (
        <span className="table-num">{formatCurrency(row.total_price, row.currency || 'INR')}</span>
      ),
    },
    {
      key: 'financial',
      header: 'Financial',
      hideOnMobile: true,
      render: (row) => <StatusBadge value={row.financial_status} dot />,
    },
    {
      key: 'fulfillment',
      header: 'Fulfillment',
      render: (row) => <StatusBadge value={row.fulfillment_status} dot />,
    },
    {
      key: 'placed',
      header: 'Placed',
      align: 'right',
      hideOnMobile: true,
      render: (row) => (
        <span className="table-num helper" title={formatDateTime(row.created_at)}>
          {relativeTime(row.created_at)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        icon={ShoppingCart}
        tone="blue"
        title="Orders"
        description="Payment, fulfillment, and refunds."
      />

      <div className="stat-grid">
        <StatCard
          label="Orders"
          value={formatCount(summary.total)}
          icon={ShoppingCart}
          tone="blue"
          hint="all time"
        />
        <StatCard
          label="Unfulfilled"
          value={formatCount(summary.unfulfilled)}
          icon={Truck}
          tone="blue"
          href="/orders?fulfillment_status=unfulfilled"
          hint="awaiting shipment"
        />
        <StatCard
          label="Paid"
          value={formatCount(summary.paid)}
          icon={Wallet}
          tone="emerald"
          href="/orders?financial_status=paid"
          hint="fully captured"
        />
        <StatCard
          label="Refunded"
          value={formatCount(summary.refunded)}
          icon={RotateCcw}
          tone="rose"
          hint="partial or full"
        />
        <StatCard
          label="Revenue"
          value={formatCurrency(summary.revenue, 'INR')}
          icon={Receipt}
          tone="saffron"
          hint="net of refunds"
          valueSm
        />
      </div>

      <div className="card">
        <div className="card-header">
          <span className="helper">
            {count === 0
              ? filtered
                ? 'No orders match the current filters'
                : 'No orders yet'
              : `${formatCount(count)} ${count === 1 ? 'order' : 'orders'} · page ${page} of ${pageCount(count, pageSize)}`}
          </span>
          {filtered && (
            <Link className="button small" href="/orders">
              <X size={12} aria-hidden />
              Clear filters
            </Link>
          )}
        </div>

        <FilterBar>
          <input
            className="input"
            type="search"
            name="q"
            placeholder="Search name or email"
            defaultValue={params.q ?? ''}
            aria-label="Search orders"
          />
          <FilterSelect
            name="financial_status"
            label="Financial status"
            value={params.financial_status ?? 'all'}
            options={['all', ...FINANCIAL_STATUSES]}
          />
          <FilterSelect
            name="fulfillment_status"
            label="Fulfillment status"
            value={params.fulfillment_status ?? 'all'}
            options={['all', ...FULFILLMENT_STATUSES]}
          />
          <input
            className="input"
            type="date"
            name="from"
            defaultValue={params.from ?? ''}
            aria-label="From date"
          />
          <input
            className="input"
            type="date"
            name="to"
            defaultValue={params.to ?? ''}
            aria-label="To date"
          />
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState
            tone="blue"
            icon={<ShoppingCart size={22} aria-hidden />}
            title={filtered ? 'No orders match these filters' : 'No orders yet'}
            hint={
              filtered
                ? 'Widen the date range, or clear a status filter. Search only matches order names and customer emails.'
                : 'Orders appear here the moment a customer checks out. Nothing has been placed yet.'
            }
            actionLabel={filtered ? 'Clear filters' : 'View products'}
            actionHref={filtered ? '/orders' : '/products'}
            secondaryAction={filtered ? { label: 'View products', href: '/products' } : undefined}
          />
        ) : (
          <DataTable
            caption="Orders"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            leading={(row) => <Avatar size="sm" name={row.customer_name} email={row.email} />}
          />
        )}

        {count > 0 && (
          <Pagination
            basePath="/orders"
            params={params}
            page={page}
            pageSize={pageSize}
            total={count}
            shown={rows.length}
            label="orders"
          />
        )}
      </div>
    </>
  );
}
