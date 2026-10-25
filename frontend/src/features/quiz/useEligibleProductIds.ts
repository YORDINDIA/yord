'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePromoStore } from '@/lib/stores/promoStore';
import type { PricedLine } from '@/lib/pricing';
import type { CartItem } from '@yord/db-types';

/**
 * The products a quiz code may discount, as the cart display needs them.
 *
 * The set is *display-only*: checkout re-derives eligibility server-side from
 * `collects`, so this fetch exists purely so the cart drawer and the checkout
 * rail show the same discount the server will charge. While it is loading (or
 * failed) the answer is `null`, and every consumer must treat a `null` as
 * "nothing is eligible" — the totals then show full price, which can only
 * overstate what the gateway will ask for, never understate it. The wrong
 * direction is the refund loop.
 *
 * The query is enabled only while a code is actually applied, so the fetch is
 * never paid for a shopper who has nothing to discount.
 */
async function fetchEligibleProductIds(): Promise<number[]> {
  const response = await fetch('/api/quiz/eligible-products');
  if (!response.ok) throw new Error(`Promo scope request failed (${response.status})`);
  const data = (await response.json()) as { productIds?: unknown };
  // Validated, not trusted: this drives money-adjacent display, and a body
  // that is not a list of integers is the server's problem, not the cart's.
  if (!Array.isArray(data.productIds)) throw new Error('Promo scope response malformed');
  return data.productIds.filter((id): id is number => Number.isInteger(id));
}

export function useEligibleProductIds(): Set<number> | null {
  const hasCode = usePromoStore((state) => state.code !== null);

  const query = useQuery({
    queryKey: ['promo-eligible'],
    queryFn: fetchEligibleProductIds,
    enabled: hasCode,
    // The route answers with browser-cache headers; this is the in-memory
    // half, so a returning tab does not re-ask on every cart open.
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return useMemo(() => {
    if (!query.isSuccess) return null;
    return new Set(query.data);
  }, [query.isSuccess, query.data]);
}

/**
 * Cart items as `computeTotals` needs them under a promo code: priced lines
 * with the discount marked onto the lines the code may touch.
 *
 * The `?? false` is the load-bearing half: while the scope is unknown (loading
 * or failed) *no* line is eligible, so the display shows full price — the
 * server can then only charge less than the screen said, which is a pleasant
 * surprise, never a refund loop.
 */
export function promoLines(items: CartItem[], eligibleIds: Set<number> | null): PricedLine[] {
  return items.map((item) => ({
    price: item.price,
    quantity: item.quantity,
    eligible: eligibleIds !== null && eligibleIds.has(item.productId),
  }));
}
