import 'server-only';

import type { DiscountCode, PriceRule } from '@yord/db-types';
import { PAGE_SIZE } from '@/lib/constants';
import { clampPage, pageRange } from '@/lib/pagination';
import { groupBy, reader, rows, runPage, type Paged } from './client';

const ENTITY = 'price_rules';

export interface DiscountRow {
  rule: Pick<
    PriceRule,
    'id' | 'title' | 'value' | 'value_type' | 'starts_at' | 'ends_at'
  >;
  codes: string[];
}

/**
 * Paged discount list. Was `.limit(100)` with no pager.
 * Codes come from one grouped `discount_codes` query for the page's rules.
 */
export async function listDiscounts(filters: {
  page?: number;
  pageSize?: number;
}): Promise<Paged<DiscountRow>> {
  const supabase = await reader();
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = clampPage(filters.page);
  const { from, to } = pageRange(page, pageSize);

  const request = supabase
    .from('price_rules')
    .select('id, title, value, value_type, starts_at, ends_at', { count: 'exact' })
    .order('starts_at', { ascending: false })
    .range(from, to);

  const result = await runPage<
    Pick<
      PriceRule,
      'id' | 'title' | 'value' | 'value_type' | 'starts_at' | 'ends_at'
    >
  >(ENTITY, request);

  const ruleIds = result.rows.map((row) => row.id);
  const codes = ruleIds.length
    ? await rows<Pick<DiscountCode, 'price_rule_id' | 'code'>>(
        'discount_codes',
        supabase
          .from('discount_codes')
          .select('price_rule_id, code')
          .in('price_rule_id', ruleIds),
      )
    : [];
  const byRule = groupBy(codes, (code) => code.price_rule_id);

  return {
    ...result,
    rows: result.rows.map((rule) => ({
      rule,
      codes: (byRule.get(rule.id) ?? []).map((code) => code.code),
    })),
    page,
    pageSize,
  };
}
