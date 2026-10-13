'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Package, PackageCheck, PackagePlus, PackageSearch } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import BulkActions from '@/components/data/BulkActions';
import FilterBar, { FilterSelect } from '@/components/data/FilterBar';
import EmptyState from '@/components/ui/EmptyState';
import Thumb from '@/components/ui/Thumb';
import { FormError, useActionForm } from '@/components/forms/ActionForm';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { bulkAdjustInventoryAction } from '@/server/actions/inventory';
import type { InventoryRow } from '@/lib/data/inventory';
import QuantityStepper from './QuantityStepper';
import StockCell from './StockCell';
import styles from './inventory.module.css';

/**
 * Variant table + filters + bulk bar.
 *
 * A client component because selection and the inline steppers are interactive.
 * The read stays on the server: every row arrives as a prop from
 * `listInventory()`, and the only write reachable from here is the audited
 * `bulkAdjustInventoryAction` / `updateInventoryAction`.
 *
 * Search keeps the documented two-query shape (variant title, OR the product
 * ids matching by product title) because PostgREST cannot filter an embedded
 * resource without dropping the variant filter. The stock filter is preserved
 * through a search by a hidden input: `FilterBar` rebuilds the query string
 * from its own fields, so a filter it cannot see would be dropped on submit.
 */
export default function InventoryTable({
  rows,
  count,
  page,
  pageSize,
  params,
}: {
  rows: InventoryRow[];
  count: number;
  page: number;
  pageSize: number;
  params: Record<string, string | undefined>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { state, pending, formAction, errorFor } = useActionForm(bulkAdjustInventoryAction, {
    onResult: (result) => {
      // Clear only on success: a failed bulk write should keep the selection so
      // the admin can fix the quantity and retry without re-ticking rows.
      if (result.status === 'success') setSelected(new Set());
    },
  });
  const quantityError = errorFor('inventory_quantity');

  // Selection is page-scoped, and the hidden `ids` inputs come from it: leaving
  // it in place across a page or filter change would let the bulk bar write to
  // variants that are no longer on screen. Adjusting state during render, keyed
  // on the row set, clears it the moment the page changes.
  const rowKey = rows.map((row) => row.variant.id).join(',');
  const [lastRowKey, setLastRowKey] = useState(rowKey);
  if (rowKey !== lastRowKey) {
    setLastRowKey(rowKey);
    if (selected.size > 0) setSelected(new Set());
  }

  const columns = useMemo<DataTableColumn<InventoryRow>[]>(
    () => [
      {
        key: 'product',
        header: 'Product',
        render: (row) =>
          row.product ? (
            <div className={`cell-media-body ${styles.product}`}>
              <div className="cell-media-title">
                <Link href={`/products/${row.product.id}`} title={row.product.title}>
                  {row.product.title}
                </Link>
              </div>
              <div className="cell-media-sub mono truncate">/{row.product.handle || '—'}</div>
            </div>
          ) : (
            <span className="helper">Product deleted</span>
          ),
      },
      {
        key: 'variant',
        header: 'Variant',
        hideOnMobile: true,
        render: (row) => (
          <span className={`truncate ${styles.variant}`} title={row.variant.title ?? undefined}>
            {row.variant.title || 'Default'}
          </span>
        ),
      },
      {
        key: 'sku',
        header: 'SKU',
        hideOnTablet: true,
        render: (row) =>
          row.variant.sku ? (
            <span className={`mono truncate ${styles.sku}`} title={row.variant.sku}>
              {row.variant.sku}
            </span>
          ) : null,
      },
      {
        key: 'price',
        header: 'Price',
        align: 'right',
        hideOnMobile: true,
        render: (row) => <span className="num">{formatCurrency(row.variant.price)}</span>,
      },
      {
        key: 'stock',
        header: 'Stock',
        render: (row) => <StockCell quantity={row.variant.inventory_quantity} />,
      },
      {
        key: 'quantity',
        header: 'Quantity',
        align: 'right',
        render: (row) => (
          <QuantityStepper
            variantId={row.variant.id}
            initial={row.variant.inventory_quantity ?? 0}
            label={`${row.product?.title ?? 'deleted product'} — ${row.variant.title || 'Default'}`}
          />
        ),
      },
      {
        key: 'updated',
        header: 'Updated',
        hideOnTablet: true,
        render: (row) => <span className="num">{formatDate(row.variant.updated_at)}</span>,
      },
    ],
    [],
  );

  // Product grouping: a stronger hairline on the first row of each product run,
  // so consecutive variants of one product read as a block. Derived from the
  // rendered order, so it stays honest under any sort (rows of one product are
  // only grouped when they are actually adjacent).
  const groupStarts = useMemo(() => {
    const starts = new Set<number>();
    rows.forEach((row, index) => {
      const previous = rows[index - 1];
      if (!previous) return;
      if ((previous.product?.id ?? null) !== (row.product?.id ?? null)) {
        starts.add(row.variant.id);
      }
    });
    return starts;
  }, [rows]);

  const stock = params.stock;
  const search = params.q;

  return (
    <>
      <div className="card-header">
        <div className="stack-sm">
          <h2 className="section-title">Variant stock</h2>
          <p className="helper">
            {count} variant(s) · adjust one inline, or tick rows to set a quantity across
            several.
          </p>
        </div>
      </div>

      <FilterBar>
        {/* FilterBar rebuilds the query from its own fields; without this the
            active stock filter would be dropped by a search. */}
        {stock && <input type="hidden" name="stock" value={stock} />}
        <input
          className="input"
          type="search"
          name="q"
          placeholder="Search product or variant"
          defaultValue={search ?? ''}
          aria-label="Search variants by product or variant title"
        />
        <FilterSelect
          name="sort"
          label="Sort variants"
          value={params.sort ?? 'quantity'}
          options={[
            { value: 'quantity', label: 'Lowest stock first' },
            { value: 'quantity-desc', label: 'Highest stock first' },
            { value: 'price-desc', label: 'Unit price: high to low' },
            { value: 'updated', label: 'Recently updated' },
          ]}
        />
      </FilterBar>

      <FormError state={state} />

      {rows.length === 0 ? (
        <EmptyState {...emptyState(stock, search)} />
      ) : (
        <>
          <DataTable
            caption="Inventory variants"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.variant.id}
            leading={(row) => (
              <Thumb src={row.imageUrl} alt="" size="sm" fallbackIcon={Package} />
            )}
            selectable={{
              id: (row) => row.variant.id,
              label: (row) =>
                `Select ${row.product?.title ?? 'variant'} — ${row.variant.title || 'Default'}`,
            }}
            selected={selected}
            onSelectionChange={setSelected}
            rowClassName={(row) =>
              groupStarts.has(row.variant.id) ? styles.groupStart : undefined
            }
            stickyHeader
            emptyTitle="No variants match this filter"
            emptyHint="Clear the search box or switch the stock tab."
          />

          <Pagination
            basePath="/inventory"
            params={params}
            page={page}
            pageSize={pageSize}
            total={count}
            shown={rows.length}
            label="variants"
          />

          <BulkActions action={formAction} selected={[...selected]} label="Set quantity:">
            <input
              className="input"
              // Inline width: `.toolbar .input` is `min-width: 140px`, which is
              // the width of a search box, not of a 2–3 digit quantity.
              style={{ width: 88, minWidth: 88 }}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              name="inventory_quantity"
              placeholder="Qty"
              defaultValue=""
              required
              aria-label="Quantity to set on the selected variants"
              disabled={pending || selected.size === 0}
            />
            <button
              className="button primary"
              type="submit"
              disabled={pending || selected.size === 0}
              aria-busy={pending}
            >
              {pending ? 'Saving…' : 'Apply'}
            </button>
            {/* The bar's only field, so its message belongs beside it: a
                field-level rejection carries no `formError`, and the shared
                hook only toasts the form-level kind. */}
            {quantityError && (
              <span className="field-error" role="alert">
                {quantityError}
              </span>
            )}
          </BulkActions>
        </>
      )}
    </>
  );
}

/**
 * Empty-state copy per filter, so "nothing here" always says which nothing and
 * offers the way out.
 *
 * The three stock filters end in a clean state rather than a failure: no
 * low-stock variants and nothing out of stock are both good news, so they get
 * the emerald icon and a one-click route back to the whole list. A search that
 * matched nothing is neither — it gets the amber "no matches" state. Precedence
 * is search first: a term that matches nothing is a dead end whatever the stock
 * filter says.
 */
function emptyState(stock: string | undefined, search: string | undefined) {
  if (search) {
    return {
      tone: 'amber' as const,
      icon: <PackageSearch size={22} aria-hidden />,
      title: 'No variants match this search',
      hint: 'Try a different product or variant title, or clear the search box.',
      actionLabel: 'Clear search',
      actionHref: stock ? `/inventory?stock=${stock}` : '/inventory',
    };
  }

  if (stock === 'low') {
    return {
      tone: 'emerald' as const,
      icon: <PackageCheck size={22} aria-hidden />,
      title: 'Nothing is low on stock',
      hint: `No variant is at or below the reorder threshold of ${LOW_STOCK_THRESHOLD}.`,
      actionLabel: 'View all variants',
      actionHref: '/inventory',
    };
  }

  if (stock === 'out') {
    return {
      tone: 'emerald' as const,
      icon: <PackageCheck size={22} aria-hidden />,
      title: 'Nothing is out of stock',
      hint: 'Every tracked variant has stock left.',
      actionLabel: 'View all variants',
      actionHref: '/inventory',
    };
  }

  if (stock === 'untracked') {
    return {
      tone: 'slate' as const,
      icon: <PackageSearch size={22} aria-hidden />,
      title: 'No untracked variants',
      hint: 'Every variant has a quantity on record.',
      actionLabel: 'View all variants',
      actionHref: '/inventory',
    };
  }

  return {
    tone: 'slate' as const,
    icon: <PackagePlus size={22} aria-hidden />,
    title: 'No variants yet',
    hint: 'Variants appear here as soon as a product with variants exists.',
    actionLabel: 'Go to products',
    actionHref: '/products',
  };
}
