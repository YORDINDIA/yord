import Link from 'next/link';
import type { Metadata } from 'next';
import { Tags } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import StatusBadge from '@/components/ui/StatusBadge';
import { listDiscounts } from '@/lib/data/discounts';
import { firstParam, pageCount } from '@/lib/pagination';
import { formatDate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Discounts · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

type DiscountRow = Awaited<ReturnType<typeof listDiscounts>>['rows'][number];

/** Scheduled / expired / active, derived from the rule window. */
function discountStatus(startsAt: string | null, endsAt: string | null): string {
  const now = Date.now();
  const start = startsAt ? new Date(startsAt).getTime() : null;
  const end = endsAt ? new Date(endsAt).getTime() : null;
  if (start !== null && Number.isFinite(start) && start > now) return 'scheduled';
  if (end !== null && Number.isFinite(end) && end < now) return 'expired';
  return 'active';
}

/**
 * Discount list. Was `.limit(100)` with no pager.
 */
export default async function DiscountsPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const requestedPage = Number(firstParam(resolved?.page)) || 1;
  const first = await listDiscounts({ page: requestedPage });
  // An out-of-range `?page=` otherwise renders an empty table under a "no
  // discounts" empty state. Clamp to the last available page and re-read.
  const lastPage = pageCount(first.count, first.pageSize);
  const { rows, count, page, pageSize } =
    requestedPage > lastPage ? await listDiscounts({ page: lastPage }) : first;

  const columns: DataTableColumn<DiscountRow>[] = [
    { key: 'title', header: 'Title', render: (row) => row.rule.title },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      render: (row) => `${row.rule.value} ${row.rule.value_type}`,
    },
    {
      key: 'code',
      header: 'Code',
      render: (row) => (row.codes.length > 0 ? row.codes.join(', ') : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge value={discountStatus(row.rule.starts_at, row.rule.ends_at)} />
      ),
      hideOnMobile: true,
    },
    {
      key: 'window',
      header: 'Window',
      hideOnTablet: true,
      render: (row) => (
        <span className="helper">
          {formatDate(row.rule.starts_at)} → {row.rule.ends_at ? formatDate(row.rule.ends_at) : 'open'}
        </span>
      ),
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Discounts</div>
          <div className="helper">Price rules and coupon codes.</div>
        </div>
        <Link className="button primary" href="/discounts/new">
          New Discount
        </Link>
      </div>

      <DataTable
        caption="Discounts"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.rule.id}
        emptyTitle="No discounts yet"
        emptyHint="Create a price rule to start a promotion."
        emptyIcon={<Tags size={28} />}
      />

      <Pagination
        basePath="/discounts"
        params={{}}
        page={page}
        pageSize={pageSize}
        total={count}
        shown={rows.length}
        label="discounts"
      />
    </div>
  );
}
