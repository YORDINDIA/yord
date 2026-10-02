import type { Metadata } from 'next';
import { ShoppingCart } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import FilterBar, { FilterSelect } from '@/components/data/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import { listOrders, type OrderListRow } from '@/lib/data/orders';
import { firstParam, pageCount } from '@/lib/pagination';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { FINANCIAL_STATUSES, FULFILLMENT_STATUSES } from '@/lib/constants';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Orders · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

/**
 * Order list.
 *
 * Search, date-range, status, and pagination all live in `src/lib/data/orders`;
 * this file is config plus rendering. It previously carried its own copy of
 * `qs()`, its own `parseDate`, and its own `q.replace(/[%(),"]/g, '')` search
 * sanitizer — the third such copy.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const resolved = await searchParams;
  const params: Record<string, string | undefined> = {
    q: firstParam(resolved.q)?.trim() || undefined,
    financial: firstParam(resolved.financial),
    fulfillment: firstParam(resolved.fulfillment),
    from: firstParam(resolved.from),
    to: firstParam(resolved.to),
  };

  const { rows, count, page, pageSize } = await listOrders({
    q: params.q,
    financial: params.financial,
    fulfillment: params.fulfillment,
    from: params.from,
    to: params.to,
    page: Number(firstParam(resolved.page)) || 1,
  });

  const columns: DataTableColumn<OrderListRow>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (row) => (
        <>
          <Link href={`/orders/${row.id}`}>{row.name ?? `#${row.id}`}</Link>
          <div className="helper">{row.email || '—'}</div>
        </>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (row) => formatCurrency(row.total_price, row.currency || 'INR'),
    },
    {
      key: 'financial',
      header: 'Financial',
      render: (row) => <StatusBadge value={row.financial_status} />,
      hideOnTablet: true,
    },
    {
      key: 'fulfillment',
      header: 'Fulfillment',
      render: (row) => <StatusBadge value={row.fulfillment_status} />,
      hideOnTablet: true,
    },
    {
      key: 'created',
      header: 'Created',
      hideOnMobile: true,
      render: (row) => formatDate(row.created_at),
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Orders</div>
          <div className="helper">
            {count} orders · page {page} of {pageCount(count, pageSize)}
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
          aria-label="Search orders"
        />
        <FilterSelect
          name="financial"
          label="Financial status"
          value={params.financial ?? 'all'}
          options={['all', ...FINANCIAL_STATUSES]}
        />
        <FilterSelect
          name="fulfillment"
          label="Fulfillment status"
          value={params.fulfillment ?? 'all'}
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

      <DataTable
        caption="Orders"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyTitle="No orders match these filters"
        emptyHint="Try widening the date range or clearing the search box."
        emptyIcon={<ShoppingCart size={28} />}
      />

      <Pagination
        basePath="/orders"
        params={params}
        page={page}
        pageSize={pageSize}
        total={count}
        shown={rows.length}
        label="orders"
      />
    </div>
  );
}
