import 'server-only';

import { cache } from 'react';
import type { DiscountCode, PriceRule } from '@yord/db-types';
import { PAGE_SIZE, isOneOf } from '@/lib/constants';
import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import type { ServerClient } from '@/lib/supabase/server';
import { groupBy, reader, rows, runCount, runPage, uniqueIds, type Paged } from './client';

const ENTITY = 'price_rules';

/**
 * Upper bound on discount codes resolved for a text search before the result is
 * turned into an `in (...)` filter. Same shape as the inventory search: a bounded
 * id list keeps a one-letter query from building a thousand-id filter, and an
 * empty match falls back to the title half alone (PostgREST rejects `in ()`).
 */
const MAX_CODE_SEARCH_IDS = 500;

/** Rows per response when summing redemptions; PostgREST caps one at 1,000. */
const REDEMPTION_WINDOW = 1000;

/** Hard stop on the redemption sum, mirroring `inventoryValue()`. */
const MAX_REDEMPTION_ROWS = 20_000;

/** The price-rule columns a list row reads. */
type RuleSeed = Pick<
  PriceRule,
  'id' | 'title' | 'value' | 'value_type' | 'starts_at' | 'ends_at' | 'usage_limit' | 'created_at'
>;

const RULE_COLUMNS = 'id, title, value, value_type, starts_at, ends_at, usage_limit, created_at';

/** One coupon code plus its own redemption tally. */
export interface DiscountCodeRow {
  code: string;
  /** Redemptions recorded against this code; NULL in the column reads as 0. */
  usage_count: number;
}

export interface DiscountRow {
  rule: RuleSeed;
  codes: DiscountCodeRow[];
  /** Σ `usage_count` across the rule's codes — what the table's usage cell shows. */
  redemptions: number;
}

/** The three buckets a rule's window can be in. */
export const DISCOUNT_STATUSES = ['active', 'scheduled', 'expired'] as const;
export type DiscountStatus = (typeof DISCOUNT_STATUSES)[number];

/**
 * Which bucket a rule's window falls in.
 *
 * A start in the future wins over a past end: a rule scheduled for next month
 * that also carries a past end date is malformed data, not "expired". This is
 * the only definition of the three buckets for rendering; `countByStatus()` and
 * `listDiscounts()` apply the same branch order in SQL, because PostgREST cannot
 * call this function.
 */
export function discountStatus(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now: number = Date.now(),
): DiscountStatus {
  const start = startsAt ? new Date(startsAt).getTime() : null;
  const end = endsAt ? new Date(endsAt).getTime() : null;
  if (start !== null && Number.isFinite(start) && start > now) return 'scheduled';
  if (end !== null && Number.isFinite(end) && end < now) return 'expired';
  return 'active';
}

export interface DiscountListFilters {
  /** Title, or a coupon code, case-insensitive partial match. */
  q?: string;
  /** `active` | `scheduled` | `expired`. Anything else (including `all`) means no filter. */
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function listDiscounts(filters: DiscountListFilters): Promise<Paged<DiscountRow>> {
  const supabase = await reader();
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = clampPage(filters.page);
  const { from, to } = pageRange(page, pageSize);
  const search = sanitizeSearch(filters.q);
  const nowIso = new Date().toISOString();

  let request = supabase
    .from('price_rules')
    .select(RULE_COLUMNS, { count: 'exact' })
    .order('starts_at', { ascending: false })
    // Tiebreak: without a second key, PostgREST may return equal `starts_at` rows
    // in a different order per request, and a row can repeat or vanish across
    // pages.
    .order('id', { ascending: true })
    .range(from, to);

  // Status is filtered in SQL, not on the page: the list is paged, so skipping
  // rows in JS would leave `count` (and therefore the pager) describing a
  // different result set than the table shows.
  if (isOneOf(DISCOUNT_STATUSES, filters.status)) {
    if (filters.status === 'scheduled') {
      request = request.gt('starts_at', nowIso);
    } else if (filters.status === 'expired') {
      // `starts_at <= now` mirrors `discountStatus()`, where a future start is
      // classified before a past end.
      request = request.lt('ends_at', nowIso).lte('starts_at', nowIso);
    } else {
      request = request.lte('starts_at', nowIso).or(`ends_at.is.null,ends_at.gte.${nowIso}`);
    }
  }

  if (search) {
    // A code match is a second, bounded query rather than an embed: PostgREST
    // cannot filter a parent table on a child's column without embedding the
    // child, and an embed would drop the `price_rules` filter (inner join).
    // Same shape as the inventory product-name search (lib/data/inventory.ts).
    const matched = await rows<Pick<DiscountCode, 'price_rule_id'>>(
      'discount_codes',
      supabase
        .from('discount_codes')
        .select('price_rule_id')
        .ilike('code', `%${search}%`)
        .limit(MAX_CODE_SEARCH_IDS),
    );
    const matchedIds = uniqueIds(matched.map((row) => row.price_rule_id));

    if (matchedIds.length === 0) {
      request = request.ilike('title', `%${search}%`);
    } else {
      request = request.or(`title.ilike.%${search}%,id.in.(${matchedIds.join(',')})`);
    }
  }

  const result = await runPage<RuleSeed>(ENTITY, request);

  const ruleIds = result.rows.map((rule) => rule.id);
  const codes = ruleIds.length
    ? await rows<Pick<DiscountCode, 'price_rule_id' | 'code' | 'usage_count'>>(
        'discount_codes',
        supabase
          .from('discount_codes')
          .select('price_rule_id, code, usage_count')
          .in('price_rule_id', ruleIds)
          .order('code', { ascending: true }),
      )
    : [];
  const codesByRule = groupBy(codes, (code) => code.price_rule_id);

  return {
    ...result,
    rows: result.rows.map((rule) => {
      const ruleCodes: DiscountCodeRow[] = (codesByRule.get(rule.id) ?? []).map((code) => ({
        code: code.code,
        usage_count: Number(code.usage_count ?? 0),
      }));
      return {
        rule,
        codes: ruleCodes,
        redemptions: ruleCodes.reduce((total, code) => total + code.usage_count, 0),
      };
    }),
    page,
    pageSize,
  };
}

/** Everything the discounts stat strip shows, in one payload. */
export interface DiscountStats {
  active: number;
  scheduled: number;
  expired: number;
  /** Every coupon code row. */
  codes: number;
  /** Σ `usage_count` across all codes. */
  redemptions: number;
}

/**
 * Counts for the discounts strip: three status buckets, the code count, and the
 * redemption total, all in parallel — the tiles read one payload instead of one
 * query each.
 *
 * The three buckets are disjoint and cover the table exactly, so
 * `total = active + scheduled + expired`.
 */
export const getDiscountStats = cache(async (): Promise<DiscountStats> => {
  const supabase = await reader();
  const nowIso = new Date().toISOString();

  const [active, scheduled, expired, codes, redemptions] = await Promise.all([
    countByStatus(supabase, 'active', nowIso),
    countByStatus(supabase, 'scheduled', nowIso),
    countByStatus(supabase, 'expired', nowIso),
    runCount(
      'discount_codes',
      supabase.from('discount_codes').select('id', { count: 'exact', head: true }),
    ),
    redemptionTotal(supabase),
  ]);

  return { active, scheduled, expired, codes, redemptions };
});

/**
 * Head-only count of rules in one status bucket.
 *
 * The predicates are the same branch order `discountStatus()` uses; they are
 * written out again here because a head count and a paged select are different
 * builders. Keep the two in step — the strip and the table's status badges read
 * from them together.
 */
async function countByStatus(
  supabase: ServerClient,
  status: DiscountStatus,
  nowIso: string,
): Promise<number> {
  const base = supabase.from('price_rules').select('id', { count: 'exact', head: true });

  if (status === 'scheduled') return runCount(ENTITY, base.gt('starts_at', nowIso));
  if (status === 'expired') {
    return runCount(ENTITY, base.lt('ends_at', nowIso).lte('starts_at', nowIso));
  }
  return runCount(ENTITY, base.lte('starts_at', nowIso).or(`ends_at.is.null,ends_at.gte.${nowIso}`));
}

/**
 * Σ `usage_count` over every coupon code.
 *
 * PostgREST cannot SUM, so the column is read in 1,000-row windows in a stable
 * `id` order and added in JS: a single request would be truncated at the
 * response cap and quietly under-report the total. A NULL count is zero (the
 * column is unset on most migrated rows), and a negative one is ignored rather
 * than subtracting from the total.
 */
async function redemptionTotal(supabase: ServerClient): Promise<number> {
  let total = 0;

  for (let from = 0; from < MAX_REDEMPTION_ROWS; from += REDEMPTION_WINDOW) {
    const page = await rows<Pick<DiscountCode, 'usage_count'>>(
      'discount_codes',
      supabase
        .from('discount_codes')
        .select('usage_count')
        .order('id', { ascending: true })
        .range(from, from + REDEMPTION_WINDOW - 1),
    );

    for (const row of page) {
      const count = Number(row.usage_count ?? 0);
      if (Number.isFinite(count) && count > 0) total += count;
    }

    if (page.length < REDEMPTION_WINDOW) break;
  }

  return total;
}
