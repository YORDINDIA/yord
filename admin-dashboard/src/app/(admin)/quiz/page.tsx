import Link from 'next/link';
import type { Metadata } from 'next';
import { Gift, SearchX, Ticket, TicketCheck, TicketX, Users } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import FilterBar, { FilterSelect } from '@/components/data/FilterBar';
import Pagination from '@/components/data/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  getQuizCodeStats,
  listQuizCodes,
  type QuizCodeRow,
} from '@/lib/data/quizCodes';
import { QUIZ_CODE_STATUSES, type QuizCodeStatus } from '@/lib/quiz-codes';
import { formatCount } from '@/components/discounts/format';
import { firstParam, pageCount } from '@/lib/pagination';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Aura quiz · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

/**
 * Status → badge, spelled out rather than left to `toneForStatus`.
 *
 * The shared map happens to give `expired` the right colour, but it has no
 * entry for `available` or `held` and would render both as neutral — and
 * "available" and "held" are the two states a reader most needs to tell apart.
 * The labels are the shopper-facing meaning, not the column value.
 */
const STATUS_BADGE: Record<QuizCodeStatus, { tone: 'success' | 'info' | 'neutral' | 'danger'; label: string }> = {
  available: { tone: 'neutral', label: 'Unused' },
  held: { tone: 'info', label: 'In a payment' },
  redeemed: { tone: 'success', label: 'Redeemed' },
  expired: { tone: 'danger', label: 'Expired' },
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...QUIZ_CODE_STATUSES.map((status) => ({ value: status, label: STATUS_BADGE[status].label })),
];

/**
 * The Aura quiz codes: stat strip → filters → table → pager.
 *
 * Read-only by design — see `lib/data/quizCodes.ts` for why no action here
 * mints, voids or edits a code. The page exists so three questions have an
 * answer: how many people played, how many rewards were actually spent, and how
 * much the campaign gave away.
 *
 * Status and tier are filtered in SQL rather than on the page, so `count` — and
 * therefore the pager — describes the same result set the table shows.
 */
export default async function QuizPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const params: Record<string, string | undefined> = {
    q: firstParam(resolved.q)?.trim() || undefined,
    status: firstParam(resolved.status),
    percent: firstParam(resolved.percent),
  };
  const requestedPage = Number(firstParam(resolved.page)) || 1;

  const [listed, stats] = await Promise.all([
    listQuizCodes({
      q: params.q,
      status: params.status,
      percent: params.percent,
      page: requestedPage,
    }),
    getQuizCodeStats(),
  ]);

  // An out-of-range `?page=` would otherwise render an empty table under a
  // "no codes" empty state. Clamp to the last available page and re-read.
  const lastPage = pageCount(listed.count, listed.pageSize);
  const { rows, count, page, pageSize } =
    requestedPage > lastPage
      ? await listQuizCodes({
          q: params.q,
          status: params.status,
          percent: params.percent,
          page: lastPage,
        })
      : listed;

  const filtered =
    Boolean(params.q) ||
    Boolean(params.status && params.status !== 'all') ||
    Boolean(params.percent && params.percent !== 'all');

  const columns: DataTableColumn<QuizCodeRow>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => (
        <>
          <span className="mono cell-title">{row.code}</span>
          <div className="helper">{row.percent}% off</div>
        </>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      align: 'right',
      render: (row) => (
        <span className="num">
          {formatNumber(row.correct)}/{formatNumber(row.total)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge
          value={row.status}
          label={STATUS_BADGE[row.status].label}
          tone={STATUS_BADGE[row.status].tone}
          dot
        />
      ),
    },
    {
      key: 'redeemed',
      header: 'Redeemed',
      hideOnTablet: true,
      render: (row) =>
        row.redeemed_at ? (
          <>
            <span className="num">{formatDate(row.redeemed_at)}</span>
            {row.redeemed_email ? <div className="helper">{row.redeemed_email}</div> : null}
          </>
        ) : null,
    },
    {
      key: 'order',
      header: 'Order',
      align: 'right',
      hideOnMobile: true,
      render: (row) =>
        row.order_id !== null ? (
          <Link className="mono" href={`/orders/${row.order_id}`}>
            #{row.order_id}
          </Link>
        ) : null,
    },
    {
      key: 'created',
      header: 'Issued',
      align: 'right',
      hideOnTablet: true,
      render: (row) => <span className="num helper">{formatDate(row.created_at)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        icon={Gift}
        title="Aura quiz"
        description="Single-use codes minted by the Diljit Aura quiz. Read-only: a code is promised at a percentage and spent by the checkout."
      />

      <div className="stat-grid">
        <StatCard
          label="Codes issued"
          value={formatCount(stats.minted)}
          icon={Ticket}
          tone="violet"
          hint="every code the quiz minted"
        />
        <StatCard
          label="Redeemed"
          value={formatCount(stats.redeemed)}
          icon={TicketCheck}
          tone="emerald"
          href="/quiz?status=redeemed"
          hint="reached a completed order"
        />
        <StatCard
          label="Outstanding"
          value={formatCount(stats.outstanding)}
          icon={Users}
          tone="cyan"
          hint="issued, not yet spent"
        />
        <StatCard
          label="Discount given"
          value={formatCurrency(stats.discountGiven)}
          icon={TicketX}
          tone="amber"
          hint="on redeemed codes"
        />
        <StatCard
          label="40% codes spent"
          value={formatCount(stats.byTier['40'] ?? 0)}
          icon={Gift}
          tone="fuchsia"
          href="/quiz?percent=40"
          hint={`10%: ${formatCount(stats.byTier['10'] ?? 0)} · 20%: ${formatCount(stats.byTier['20'] ?? 0)}`}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <span className="helper">
            {count === 0
              ? filtered
                ? 'No codes match the current filters'
                : 'No codes issued yet'
              : `${formatCount(count)} ${count === 1 ? 'code' : 'codes'} · page ${page} of ${pageCount(count, pageSize)}`}
          </span>
          {filtered && (
            <Link className="button small" href="/quiz">
              Clear filters
            </Link>
          )}
        </div>

        <FilterBar>
          <input
            className="input"
            type="search"
            name="q"
            placeholder="Search code or email"
            defaultValue={params.q ?? ''}
            aria-label="Search quiz codes by code or the email they were redeemed with"
          />
          <FilterSelect
            name="status"
            label="Status"
            value={params.status ?? 'all'}
            options={STATUS_OPTIONS}
          />
          <FilterSelect
            name="percent"
            label="Tier"
            value={params.percent ?? 'all'}
            options={[
              { value: 'all', label: 'All tiers' },
              { value: '10', label: '10% off' },
              { value: '20', label: '20% off' },
              { value: '40', label: '40% off' },
            ]}
          />
        </FilterBar>

        {rows.length === 0 ? (
          filtered ? (
            <EmptyState
              tone="amber"
              icon={<SearchX size={22} aria-hidden />}
              title="No codes match these filters"
              hint="Search matches a code or the email it was redeemed with. Widen the status or tier filter, or clear the search box."
              actionLabel="Clear filters"
              actionHref="/quiz"
            />
          ) : (
            <EmptyState
              tone="orange"
              icon={<Gift size={22} aria-hidden />}
              title="No quiz codes yet"
              hint="Codes appear here the moment a visitor finishes the Diljit Aura quiz pop-up on the storefront. Nothing to configure — the tiers live in the storefront's quiz config."
            />
          )
        ) : (
          <DataTable
            caption="Aura quiz codes"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
          />
        )}

        {count > 0 && (
          <Pagination
            basePath="/quiz"
            params={params}
            page={page}
            pageSize={pageSize}
            total={count}
            shown={rows.length}
            label="codes"
          />
        )}
      </div>
    </>
  );
}
