import 'server-only';

import type { QuizCode } from '@yord/db-types';
import { PAGE_SIZE } from '@/lib/constants';
import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import type { ServerClient } from '@/lib/supabase/server';
import { reader, rows, runCount, runPage, type Paged } from './client';
import {
  QUIZ_CODE_STATUSES,
  RESERVATION_LEASE_MS,
  campaignIsOver,
  quizCodeStatus,
  type QuizCodeStatus,
} from '@/lib/quiz-codes';

const ENTITY = 'quiz_codes';

/**
 * Read-only view of the codes the Diljit Aura quiz minted
 * (`supabase/migrations/018_quiz_codes.sql`).
 *
 * Read-only is the whole design. The table exists so a code can be spent
 * exactly once, and there is no action here that mints, extends, voids or edits
 * one: a code a shopper already holds was promised a percentage against a price
 * the storefront has since charged, so editing a row by hand would make the
 * database disagree with a receipt. The one write that matters — `redeemed_at`
 * — happens on the money path in `verify-payment`.
 *
 * The status derivation and the campaign window live in `lib/quiz-codes.ts`
 * (pure, and unit-tested without a database); this module only reads rows and
 * turns filters into SQL.
 */

/** A row plus the state derived from it, so the page never re-reads the clock. */
export interface QuizCodeRow extends QuizCode {
  status: QuizCodeStatus;
}

/** The columns a row reads. `sid` is deliberately absent: it is a browser id. */
const CODE_COLUMNS =
  'id, code, percent, correct, total, reserved_for, reserved_at, redeemed_at, order_id, redeemed_email, created_at';

export interface QuizCodeFilters {
  /** Code, or the email a code was redeemed with. Case-insensitive partial. */
  q?: string;
  /** A `QuizCodeStatus`. Anything else means no filter. */
  status?: string;
  /** `10` | `20` | `40`. Anything else means no filter. */
  percent?: string;
  page?: number;
  pageSize?: number;
}

export async function listQuizCodes(filters: QuizCodeFilters): Promise<Paged<QuizCodeRow>> {
  const supabase = await reader();
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = clampPage(filters.page);
  const { from, to } = pageRange(page, pageSize);
  const search = sanitizeSearch(filters.q);
  const percent = Number(filters.percent);
  const now = Date.now();
  const over = campaignIsOver(now);

  // The window is one instant for the whole campaign, so "expired" and
  // "available"/"held" are mutually exclusive by the clock rather than by any
  // column: when the campaign is over every unredeemed row is expired and the
  // other two statuses can only return an empty page. Answering that here is
  // both correct and cheaper than a query whose filter would have to express
  // "the campaign is over" against rows that cannot know it.
  const status = isOneOfStatus(filters.status) ? filters.status : null;
  if (status === 'expired' && !over) return emptyPage(page, pageSize);
  if ((status === 'available' || status === 'held') && over) return emptyPage(page, pageSize);

  let request = supabase
    .from('quiz_codes')
    .select(CODE_COLUMNS, { count: 'exact' })
    // Newest first, `id` as the tiebreak: without a second key PostgREST may
    // return equal `created_at` rows in a different order per request, and a row
    // can then repeat or vanish across pages.
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, to);

  if (status === 'redeemed') {
    request = request.not('redeemed_at', 'is', null);
  } else if (status === 'held') {
    request = request
      .is('redeemed_at', null)
      .gte('reserved_at', new Date(now - RESERVATION_LEASE_MS).toISOString());
  } else if (status === 'available') {
    request = request
      .is('redeemed_at', null)
      .or(`reserved_at.is.null,reserved_at.lt.${new Date(now - RESERVATION_LEASE_MS).toISOString()}`);
  } else if (status === 'expired') {
    request = request.is('redeemed_at', null);
  }

  if (percent === 10 || percent === 20 || percent === 40) {
    request = request.eq('percent', percent);
  }

  if (search) {
    // One filter, two columns, OR'd. A code match and an email match are both
    // prefix-shaped for the same query, so PostgREST can express this without
    // the two-query shape the inventory search needs.
    request = request.or(`code.ilike.%${search}%,redeemed_email.ilike.%${search}%`);
  }

  const { rows: raw, count } = await runPage<QuizCode>(ENTITY, request);
  return {
    rows: raw.map((row) => ({ ...row, status: quizCodeStatus(row, now) })),
    count,
    page,
    pageSize,
  };
}

function emptyPage(page: number, pageSize: number): Paged<QuizCodeRow> {
  return { rows: [], count: 0, page, pageSize };
}

/** Narrow a `?status=` value to a real status. */
function isOneOfStatus(value: unknown): value is QuizCodeStatus {
  return typeof value === 'string' && (QUIZ_CODE_STATUSES as readonly string[]).includes(value);
}

export interface QuizCodeStats {
  /** Every code ever minted. */
  minted: number;
  /** Codes that reached a completed order. */
  redeemed: number;
  /** Codes not yet spent — the discount still outstanding. */
  outstanding: number;
  /** Rupees actually given away, from the orders the codes were spent on. */
  discountGiven: number;
  /** Redeemed codes per tier, keyed by the percentage as a string. */
  byTier: Record<string, number>;
}

/** Rows summed when totalling the discount; PostgREST caps one response at 1,000. */
const DISCOUNT_WINDOW = 1000;

/**
 * The campaign's totals.
 *
 * `discountGiven` is read from `orders.total_discounts` on the orders the codes
 * were spent on, rather than recomputed as a percentage of the order total: the
 * order total is already net of the discount, so recomputing would round its way
 * to a slightly different number than the receipt shows.
 */
export async function getQuizCodeStats(): Promise<QuizCodeStats> {
  const supabase = await reader();

  const [minted, redeemed, ten, twenty, forty] = await Promise.all([
    runCount(
      ENTITY,
      supabase.from('quiz_codes').select('id', { count: 'exact', head: true }),
    ),
    runCount(
      ENTITY,
      supabase
        .from('quiz_codes')
        .select('id', { count: 'exact', head: true })
        .not('redeemed_at', 'is', null),
    ),
    ...[10, 20, 40].map((percent) =>
      runCount(
        ENTITY,
        supabase
          .from('quiz_codes')
          .select('id', { count: 'exact', head: true })
          .eq('percent', percent)
          .not('redeemed_at', 'is', null),
      ),
    ),
  ]);

  const discountGiven = await sumOrderDiscounts(supabase, await redeemedOrderIds(supabase));

  return {
    minted,
    redeemed,
    outstanding: Math.max(minted - redeemed, 0),
    discountGiven,
    byTier: { '10': ten, '20': twenty, '40': forty },
  };
}

/** The order ids redeemed codes point at, bounded to one PostgREST response. */
async function redeemedOrderIds(supabase: ServerClient): Promise<number[]> {
  const claimed = await rows<Pick<QuizCode, 'order_id'>>(
    ENTITY,
    supabase
      .from('quiz_codes')
      .select('order_id')
      .not('order_id', 'is', null)
      .not('redeemed_at', 'is', null)
      .order('id', { ascending: false })
      .limit(DISCOUNT_WINDOW),
  );
  return [...new Set(claimed.map((row) => row.order_id).filter((id): id is number => id !== null))];
}

/**
 * Σ `orders.total_discounts` over the orders a code was spent on.
 *
 * An empty id list returns 0 without a query: PostgREST rejects `in ()`, the
 * same trap the inventory search documents.
 */
async function sumOrderDiscounts(supabase: ServerClient, orderIds: number[]): Promise<number> {
  if (orderIds.length === 0) return 0;
  const found = await rows<{ total_discounts: number | null }>(
    'orders',
    supabase.from('orders').select('total_discounts').in('id', orderIds),
  );
  return found.reduce((sum, order) => sum + Number(order.total_discounts ?? 0), 0);
}
