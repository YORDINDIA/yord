import Link from 'next/link';
import type { Metadata } from 'next';
import { FolderKanban } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import { listCollections } from '@/lib/data/collections';
import { firstParam } from '@/lib/pagination';
import { formatDate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Collections · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

type CollectionRow = Awaited<ReturnType<typeof listCollections>>['rows'][number];

/**
 * Collection list.
 *
 * Was `.limit(100)` with no pager, so anything past 100 collections was
 * unreachable; and it skipped `.table-wrap`, so the table overflowed on narrow
 * screens instead of scrolling (the shared `DataTable` always wraps).
 */
export default async function CollectionsPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const params: Record<string, string | undefined> = {
    q: firstParam(resolved?.q)?.trim() || undefined,
  };

  const { rows, count, page, pageSize } = await listCollections({
    q: params.q,
    page: Number(firstParam(resolved?.page)) || 1,
  });

  const columns: DataTableColumn<CollectionRow>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (row) => <Link href={`/collections/${row.id}`}>{row.title}</Link>,
    },
    { key: 'type', header: 'Type', render: (row) => row.collection_type, hideOnTablet: true },
    {
      key: 'products',
      header: 'Products',
      align: 'right',
      render: (row) => String(row.productCount),
    },
    {
      key: 'published',
      header: 'Published',
      render: (row) => (row.published ? 'Yes' : 'No'),
      hideOnMobile: true,
    },
    {
      key: 'updated',
      header: 'Updated',
      hideOnMobile: true,
      render: (row) => formatDate(row.updated_at),
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Collections</div>
          <div className="helper">Custom and smart merchandising groups.</div>
        </div>
        <Link className="button primary" href="/collections/new">
          New Collection
        </Link>
      </div>

      <DataTable
        caption="Collections"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyTitle="No collections yet"
        emptyHint="Create a collection to group products for the storefront."
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
    </div>
  );
}
