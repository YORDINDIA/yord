import Link from 'next/link';
import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import { listCustomers } from '@/lib/data/customers';
import { firstParam, pageCount } from '@/lib/pagination';
import { formatCurrency } from '@/lib/utils/format';
import type { Customer } from '@yord/db-types';

export const metadata: Metadata = { title: 'Customers · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

/**
 * Customer list.
 *
 * The pager used to be hand-rolled (`?q=${encodeURIComponent(q)}&page=${n}`),
 * which dropped every other filter the moment one was added. It now goes through
 * the shared `Pagination`, which rebuilds the full query string.
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const resolved = await searchParams;
  const params: Record<string, string | undefined> = {
    q: firstParam(resolved.q)?.trim() || undefined,
  };

  const { rows, count, page, pageSize } = await listCustomers({
    q: params.q,
    page: Number(firstParam(resolved.page)) || 1,
  });

  const columns: DataTableColumn<Customer>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <Link href={`/customers/${row.id}`}>
          {row.first_name} {row.last_name}
        </Link>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => row.email || '—',
      hideOnTablet: true,
    },
    {
      key: 'orders',
      header: 'Orders',
      align: 'right',
      render: (row) => String(row.orders_count ?? 0),
    },
    {
      key: 'spent',
      header: 'Total Spent',
      align: 'right',
      render: (row) => formatCurrency(row.total_spent, 'INR'),
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Customers</div>
          <div className="helper">
            {count} customers · page {page} of {pageCount(count, pageSize)}
          </div>
        </div>
        <form className="toolbar" role="search" action="/customers" method="get">
          <input
            className="input"
            type="search"
            name="q"
            placeholder="Search name or email"
            defaultValue={params.q ?? ''}
            aria-label="Search customers"
          />
          <button className="button" type="submit">
            Search
          </button>
        </form>
      </div>

      <DataTable
        caption="Customers"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyTitle="No customers match this search"
        emptyHint="Try a different name or email."
        emptyIcon={<Users size={28} />}
      />

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
  );
}
