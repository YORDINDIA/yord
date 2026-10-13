import Link from 'next/link';
import type { Metadata } from 'next';
import clsx from 'clsx';
import {
  BadgeCheck,
  CalendarClock,
  CalendarX,
  SearchX,
  Tags,
  Ticket,
  TicketPlus,
  Users,
  X,
} from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import FilterBar, { FilterSelect } from '@/components/data/FilterBar';
import Pagination from '@/components/data/Pagination';
import { DiscountMark, RedemptionCell } from '@/components/discounts/DiscountCells';
import { formatCount, formatDiscountValue, formatWindow } from '@/components/discounts/format';
import styles from '@/components/discounts/discounts.module.css';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  discountStatus,
  getDiscountStats,
  listDiscounts,
  type DiscountRow,
} from '@/lib/data/discounts';
import { firstParam, pageCount } from '@/lib/pagination';
import { formatDate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Discounts · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

/**
 * Tone for a row's mark tile.
 *
 * The three statuses resolve to `success` / `info` / `danger` inside
 * `StatusBadge`, which is the same emerald / blue / rose set — the tile and the
 * badge beside it cannot disagree.
 */
const STATUS_TONES = { active: 'emerald', scheduled: 'blue', expired: 'rose' } as const;

/**
 * Discount list: stat strip → filters → table → pager.
 *
 * The read (status filter, code search, paging, per-code usage) lives in
 * `src/lib/data/discounts`; this file is column config plus rendering. Status is
 * filtered in SQL rather than on the page so `count` — and therefore the pager —
 * describes the same result set the table shows.
 */
export default async function DiscountsPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const params: Record<string, string | undefined> = {
    q: firstParam(resolved.q)?.trim() || undefined,
    status: firstParam(resolved.status),
  };
  const requestedPage = Number(firstParam(resolved.page)) || 1;

  const [listed, stats] = await Promise.all([
    listDiscounts({ q: params.q, status: params.status, page: requestedPage }),
    getDiscountStats(),
  ]);

  // An out-of-range `?page=` otherwise renders an empty table under a "no
  // discounts" empty state. Clamp to the last available page and re-read.
  const lastPage = pageCount(listed.count, listed.pageSize);
  const { rows, count, page, pageSize } =
    requestedPage > lastPage
      ? await listDiscounts({ q: params.q, status: params.status, page: lastPage })
      : listed;

  const filtered = Boolean(params.q) || Boolean(params.status && params.status !== 'all');

  const columns: DataTableColumn<DiscountRow>[] = [
    {
      key: 'title',
      header: 'Discount',
      render: (row) => (
        <>
          <span className="cell-title">{row.rule.title}</span>
          <div className={clsx('mono', styles.codeLine)}>
            {row.codes.length > 0 ? row.codes.map((code) => code.code).join(' · ') : 'no code'}
          </div>
        </>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      render: (row) => (
        <span className="num">{formatDiscountValue(row.rule.value, row.rule.value_type)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge value={discountStatus(row.rule.starts_at, row.rule.ends_at)} dot />
      ),
    },
    {
      key: 'window',
      header: 'Window',
      hideOnTablet: true,
      render: (row) => (
        <span className="helper">{formatWindow(row.rule.starts_at, row.rule.ends_at)}</span>
      ),
    },
    {
      key: 'redemptions',
      header: 'Redemptions',
      align: 'right',
      hideOnMobile: true,
      render: (row) => <RedemptionCell used={row.redemptions} limit={row.rule.usage_limit} />,
    },
    {
      key: 'created',
      header: 'Created',
      align: 'right',
      hideOnTablet: true,
      render: (row) => <span className="num helper">{formatDate(row.rule.created_at)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        icon={Tags}
        title="Discounts"
        description="Price rules, coupon codes, and redemptions."
        actions={
          <Link className="button primary" href="/discounts/new">
            <TicketPlus size={13} aria-hidden />
            New discount
          </Link>
        }
      />

      <div className="stat-grid">
        <StatCard
          label="Active now"
          value={formatCount(stats.active)}
          icon={BadgeCheck}
          tone="emerald"
          href="/discounts?status=active"
          hint="within the window"
        />
        <StatCard
          label="Scheduled"
          value={formatCount(stats.scheduled)}
          icon={CalendarClock}
          tone="blue"
          href="/discounts?status=scheduled"
          hint="not started yet"
        />
        <StatCard
          label="Expired"
          value={formatCount(stats.expired)}
          icon={CalendarX}
          tone="rose"
          href="/discounts?status=expired"
          hint="past the end date"
        />
        <StatCard
          label="Codes"
          value={formatCount(stats.codes)}
          icon={Ticket}
          tone="cyan"
          hint="coupon codes in total"
        />
        <StatCard
          label="Redemptions"
          value={formatCount(stats.redemptions)}
          icon={Users}
          tone="violet"
          hint="times a code was used"
        />
      </div>

      <div className="card">
        <div className="card-header">
          <span className="helper">
            {count === 0
              ? filtered
                ? 'No discounts match the current filters'
                : 'No discounts yet'
              : `${formatCount(count)} ${count === 1 ? 'discount' : 'discounts'} · page ${page} of ${pageCount(count, pageSize)}`}
          </span>
          {filtered && (
            <Link className="button small" href="/discounts">
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
            placeholder="Search title or code"
            defaultValue={params.q ?? ''}
            aria-label="Search discounts by title or coupon code"
          />
          <FilterSelect
            name="status"
            label="Status"
            value={params.status ?? 'all'}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'expired', label: 'Expired' },
            ]}
          />
        </FilterBar>

        {rows.length === 0 ? (
          filtered ? (
            <EmptyState
              tone="amber"
              icon={<SearchX size={22} aria-hidden />}
              title="No discounts match these filters"
              hint="Search matches a title or a coupon code. Widen the status filter, or clear the search box."
              actionLabel="Clear filters"
              actionHref="/discounts"
              secondaryAction={{ label: 'New discount', href: '/discounts/new' }}
            />
          ) : (
            <EmptyState
              tone="orange"
              icon={<Tags size={22} aria-hidden />}
              title="No discounts yet"
              hint="A discount is a price rule plus the coupon code shoppers type at checkout. Nothing has been created yet."
              actionLabel="Create discount"
              actionHref="/discounts/new"
            />
          )
        ) : (
          <DataTable
            caption="Discounts"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.rule.id}
            leading={(row) => {
              const status = discountStatus(row.rule.starts_at, row.rule.ends_at);
              return <DiscountMark tone={STATUS_TONES[status]} valueType={row.rule.value_type} />;
            }}
          />
        )}

        {count > 0 && (
          <Pagination
            basePath="/discounts"
            params={params}
            page={page}
            pageSize={pageSize}
            total={count}
            shown={rows.length}
            label="discounts"
          />
        )}
      </div>
    </>
  );
}
