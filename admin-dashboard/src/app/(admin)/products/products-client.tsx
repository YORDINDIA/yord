'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Package, PackagePlus, PackageX } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import BulkActions from '@/components/data/BulkActions';
import FilterBar, { FilterSelect } from '@/components/data/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import Thumb from '@/components/ui/Thumb';
import EmptyState from '@/components/ui/EmptyState';
import { useActionForm, FormError } from '@/components/forms/ActionForm';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { LOW_STOCK_THRESHOLD, PRODUCT_STATUSES } from '@/lib/constants';
import { bulkUpdateProductStatusAction } from '@/server/actions/products';
import type { ProductListRow } from '@/lib/data/products';
import { stockClass, stockLabel } from '@/components/products/stock-tone';
import styles from '@/components/products/products.module.css';

function splitTags(value: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Catalog table.
 *
 * One `<DataTable>` (dense rows, sticky header, thumbnail lead) + `<Pagination>`
 * instead of a hand-rolled `<table className="table">` with its own
 * `PAGE_SIZE`/`from`/`to`/`qs()` copy. The bulk form is its own element rather
 * than a wrapper around the table.
 *
 * The search box is a plain `name="q"` input inside `FilterBar`, not the
 * `SearchInput` component: `SearchInput` renders its own `<form>`, and a form
 * inside the filter form is invalid markup (the browser drops the inner one).
 * `SearchInput` is for pages without a FilterBar.
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

  const filtersActive =
    Boolean(params.q) ||
    Boolean(params.status && params.status !== 'all') ||
    Boolean(params.stock && params.stock !== 'all');

  const columns = useMemo<DataTableColumn<ProductListRow>[]>(
    () => [
      {
        key: 'product',
        header: 'Product',
        render: (row) => (
          <div className="cell-media-body">
            <div className={clsx('cell-media-title', styles.productTitle)}>
              <Link href={`/products/${row.id}`}>{row.title}</Link>
            </div>
            <div className={clsx('cell-media-sub', 'mono', 'truncate', styles.productMeta)}>
              /{row.handle || '—'}
            </div>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <StatusBadge value={row.status} />,
      },
      {
        key: 'price',
        header: 'Price',
        align: 'right',
        // `nowrap` on the wrapper (not the spans): the break happens between
        // the price and the compare-at price, so wrapping them added a second
        // line and took the row from 39px to 43px.
        render: (row) => (
          <span className="nowrap">
            <span className="num">{formatCurrency(row.price)}</span>
            {row.compareAtPrice !== null && row.compareAtPrice > row.price && (
              <span className={styles.was} title="Compare-at price">
                {formatCurrency(row.compareAtPrice)}
              </span>
            )}
          </span>
        ),
      },
      {
        key: 'inventory',
        header: 'Stock',
        align: 'right',
        render: (row) => (
          <span
            className={clsx(styles.qty, styles[stockClass(row.totalInventory)])}
            title={stockLabel(row.totalInventory)}
          >
            <span className={styles.qtyDot} aria-hidden />
            {row.totalInventory}
            {/* The tint carries "low"/"out" visually; this keeps it in the
                accessibility tree rather than colour-only. */}
            <span className="sr-only">{stockLabel(row.totalInventory)}</span>
          </span>
        ),
      },
      {
        key: 'variants',
        header: 'Variants',
        align: 'right',
        hideOnTablet: true,
        render: (row) => <span className="num">{row.variantCount}</span>,
      },
      {
        key: 'tags',
        header: 'Tags',
        hideOnTablet: true,
        render: (row) => {
          const tags = splitTags(row.tags);
          if (tags.length === 0) return null;
          return (
            <span className="tag-line" title={tags.join(', ')}>
              {tags.join(', ')}
            </span>
          );
        },
      },
      {
        key: 'updated',
        header: 'Updated',
        hideOnMobile: true,
        render: (row) => <span className="num nowrap">{formatDate(row.updated_at)}</span>,
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

      {rows.length === 0 ? (
        <EmptyState
          tone={filtersActive ? 'amber' : 'indigo'}
          icon={filtersActive ? <PackageX size={22} aria-hidden /> : <PackagePlus size={22} aria-hidden />}
          title={filtersActive ? 'No products match these filters' : 'No products yet'}
          hint={
            filtersActive
              ? 'Try a different search term, or clear the status and stock filters.'
              : 'Create your first product to start building the catalog.'
          }
          actionLabel={filtersActive ? 'Clear filters' : 'New product'}
          actionHref={filtersActive ? '/products' : '/products/new'}
        />
      ) : (
        <>
          <DataTable
            caption="Products"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            leading={(row) => (
              <Thumb src={row.imageUrl} alt="" size="sm" fallbackIcon={Package} />
            )}
            selectable={{
              id: (row) => row.id,
              label: (row) => `Select ${row.title}`,
            }}
            selected={selected}
            onSelectionChange={setSelected}
            stickyHeader
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
      )}
    </>
  );
}
