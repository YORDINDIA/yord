'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { PackageX } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import BulkActions from '@/components/data/BulkActions';
import FilterBar, { FilterSelect } from '@/components/data/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import { useActionForm, FormError } from '@/components/forms/ActionForm';
import { formatDate } from '@/lib/utils/format';
import { LOW_STOCK_THRESHOLD, PRODUCT_STATUSES, stockTone } from '@/lib/constants';
import { bulkUpdateProductStatusAction } from '@/server/actions/products';
import type { ProductListRow } from '@/lib/data/products';

/**
 * Catalog table.
 *
 * Reads through one `<DataTable>` + `<Pagination>` instead of a hand-rolled
 * `<table className="table">` with its own `PAGE_SIZE`/`from`/`to`/`qs()` copy.
 * The bulk form is its own element rather than a wrapper around the table.
 */
export default function ProductsClient({
  rows,
  count,
  page,
  pageSize,
  params,
}: {
  rows: ProductListRow[];
  count: number;
  page: number;
  pageSize: number;
  params: Record<string, string | undefined>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { state, pending, formAction } = useActionForm(
    bulkUpdateProductStatusAction,
    {
      onResult: (result) => {
        if (result.status === 'success') setSelected(new Set());
      },
    },
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const columns = useMemo<DataTableColumn<ProductListRow>[]>(
    () => [
      {
        key: 'product',
        header: 'Product',
        render: (row) => (
          <>
            <Link href={`/products/${row.id}`}>{row.title}</Link>
            <div className="helper">{row.tags || '—'}</div>
          </>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <StatusBadge value={row.status} />,
        hideOnTablet: true,
      },
      {
        key: 'price',
        header: 'Price',
        align: 'right',
        render: (row) => <span>₹{row.price}</span>,
      },
      {
        key: 'inventory',
        header: 'Inventory',
        align: 'right',
        render: (row) => (
          <StatusBadge value={stockTone(row.inventory)} label={String(row.inventory)} />
        ),
      },
      {
        key: 'updated',
        header: 'Updated',
        hideOnMobile: true,
        render: (row) => formatDate(row.updated_at),
      },
    ],
    [],
  );

  return (
    <>
      <FilterBar>
        <input
          className="input"
          type="search"
          name="q"
          placeholder="Search title, handle, tags"
          defaultValue={params.q ?? ''}
          aria-label="Search products"
        />
        <FilterSelect
          name="status"
          label="Status"
          value={params.status ?? 'all'}
          options={['all', ...PRODUCT_STATUSES]}
        />
        <FilterSelect
          name="stock"
          label="Stock"
          value={params.stock ?? 'all'}
          options={[
            { value: 'all', label: 'All stock' },
            { value: 'low', label: `Low stock (≤ ${LOW_STOCK_THRESHOLD})` },
          ]}
        />
        <FilterSelect
          name="sort"
          label="Sort"
          value={params.sort ?? 'updated_at'}
          options={[
            { value: 'updated_at', label: 'Recently updated' },
            { value: 'title', label: 'Title A–Z' },
          ]}
        />
      </FilterBar>

      <FormError state={state} />

      <DataTable
        caption="Products"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        selectable={{
          id: (row) => row.id,
          label: (row) => `Select ${row.title}`,
        }}
        selected={selected}
        onSelectionChange={setSelected}
        emptyTitle="No products match these filters"
        emptyHint="Clear the search box or change the status and stock filters."
        emptyIcon={<PackageX size={28} />}
      />

      <Pagination
        basePath="/products"
        params={params}
        page={page}
        pageSize={pageSize}
        total={count}
        shown={rows.length}
        label="products"
      />

      <BulkActions
        action={formAction}
        selected={[...selected]}
        onSubmit={clearSelection}
      >
        <select
          className="select"
          name="bulk_status"
          defaultValue="active"
          aria-label="Status to apply to the selected products"
          disabled={pending || selected.size === 0}
        >
          <option value="active">Publish (active)</option>
          <option value="draft">Move to draft</option>
          <option value="archived">Archive</option>
        </select>
        <button
          className="button"
          type="submit"
          disabled={pending || selected.size === 0}
          aria-busy={pending}
        >
          {pending ? 'Applying…' : `Apply to ${selected.size} selected`}
        </button>
      </BulkActions>
    </>
  );
}
