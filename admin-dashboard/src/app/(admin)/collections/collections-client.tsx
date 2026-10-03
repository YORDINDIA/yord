'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { FolderKanban } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import BulkActions from '@/components/data/BulkActions';
import FilterBar, { FilterSelect } from '@/components/data/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import Thumb from '@/components/ui/Thumb';
import { useActionForm, FormError } from '@/components/forms/ActionForm';
import { formatDate } from '@/lib/utils/format';
import { COLLECTION_TYPES } from '@/lib/constants';
import { bulkUpdateCollectionStatusAction } from '@/server/actions/collections';
import type { CollectionListRow } from '@/lib/data/collections';

/**
 * Collections table.
 *
 * Composes the same shared list UI as products/orders: `FilterBar` (search +
 * published/type/has-products + sort), `DataTable` with selection, `Pagination`
 * and `BulkActions`. Publishing from here refuses empty collections, which is
 * how the nav stopped pointing at empty pages.
 */
export default function CollectionsClient({
  rows,
  count,
  page,
  pageSize,
  params,
}: {
  rows: CollectionListRow[];
  count: number;
  page: number;
  pageSize: number;
  params: Record<string, string | undefined>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { state, pending, formAction } = useActionForm(bulkUpdateCollectionStatusAction, {
    onResult: (result) => {
      if (result.status === 'success') setSelected(new Set());
    },
  });

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const columns = useMemo<DataTableColumn<CollectionListRow>[]>(
    () => [
      {
        key: 'title',
        header: 'Title',
        // `truncate` keeps both lines single-line: `.cell-sub` is the widest
        // content a row carries (handle + auto note), and without it a long
        // handle wrapped the dense 34px row to ~52px.
        render: (row) => (
          <>
            <div className="cell-title truncate">
              <Link href={`/collections/${row.id}`}>{row.title}</Link>
            </div>
            <div className="cell-sub truncate">
              {row.handle ?? '—'}
              {row.isAuto && ' · auto (computed by the storefront)'}
            </div>
          </>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        render: (row) => (
          <>
            <StatusBadge value={row.collection_type} tone={row.collection_type === 'smart' ? 'info' : 'neutral'} />
            {row.isAuto && <StatusBadge value="auto" tone="info" label="Auto" />}
          </>
        ),
        hideOnTablet: true,
      },
      {
        key: 'products',
        header: 'Products',
        align: 'right',
        render: (row) =>
          row.productCount === 0 && !row.isAuto ? (
            <StatusBadge value="empty" tone="warning" label="0" />
          ) : (
            String(row.productCount)
          ),
      },
      {
        key: 'published',
        header: 'Published',
        render: (row) => <StatusBadge value={row.published ? 'published' : 'draft'} />,
        hideOnMobile: true,
      },
      {
        key: 'updated',
        header: 'Updated',
        hideOnMobile: true,
        // `format.ts` has no relative formatter, so the date stays absolute and
        // the full ISO timestamp rides on `title` for hover.
        render: (row) => (
          <span className="num nowrap" title={row.updated_at ?? undefined}>
            {formatDate(row.updated_at)}
          </span>
        ),
      },
      {
        key: 'edit',
        header: '',
        align: 'right',
        // The title link already targets the detail page; this makes the
        // affordance explicit instead of title-colour-only.
        render: (row) => (
          <Link
            className="button small"
            href={`/collections/${row.id}`}
            aria-label={`Edit ${row.title}`}
          >
            Edit
          </Link>
        ),
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
          placeholder="Search title, handle"
          defaultValue={params.q ?? ''}
          aria-label="Search collections"
        />
        <FilterSelect
          name="published"
          label="Published"
          value={params.published ?? 'all'}
          options={[
            { value: 'all', label: 'Any status' },
            { value: 'yes', label: 'Published' },
            { value: 'no', label: 'Unpublished' },
          ]}
        />
        <FilterSelect
          name="type"
          label="Type"
          value={params.type ?? 'all'}
          options={[
            { value: 'all', label: 'Any type' },
            ...COLLECTION_TYPES.map((option) => ({ value: option, label: option })),
          ]}
        />
        <FilterSelect
          name="hasProducts"
          label="Products"
          value={params.hasProducts ?? 'all'}
          options={[
            { value: 'all', label: 'Any count' },
            { value: 'yes', label: 'Has products' },
            { value: 'no', label: 'Empty only' },
          ]}
        />
        <FilterSelect
          name="sort"
          label="Sort"
          value={params.sort ?? 'updated_at'}
          options={[
            { value: 'updated_at', label: 'Recently updated' },
            { value: 'title', label: 'Title A–Z' },
            { value: 'products', label: 'Most products' },
          ]}
        />
      </FilterBar>

      <FormError state={state} />

      <DataTable
        caption="Collections"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        leading={(row) => (
          // Thumb renders the fallback glyph itself when `coverUrl` is null,
          // which is the common case (Shopify-migrated rows without a cover).
          <Thumb src={row.coverUrl} alt={`${row.title} cover`} size="md" fallbackIcon={FolderKanban} />
        )}
        selectable={{
          id: (row) => row.id,
          label: (row) => `Select ${row.title}`,
        }}
        selected={selected}
        onSelectionChange={setSelected}
        emptyTitle="No collections match these filters"
        emptyHint="Clear the search box or change the status, type and product filters."
        emptyIcon={<FolderKanban size={28} />}
      />

      <Pagination
        basePath="/collections"
        params={params}
        page={page}
        pageSize={pageSize}
        total={count}
        shown={rows.length}
        label="collections"
      />

      <BulkActions action={formAction} selected={[...selected]} onSubmit={clearSelection}>
        <select
          className="select"
          name="bulk_status"
          defaultValue="published"
          aria-label="Action to apply to the selected collections"
          disabled={pending || selected.size === 0}
        >
          <option value="published">Publish</option>
          <option value="unpublished">Unpublish</option>
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
