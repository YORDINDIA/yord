import { NextRequest, NextResponse } from 'next/server';
import { CAMPAIGN } from '@/features/quiz/config';
import { createStaticClient } from '@/lib/supabase/server';
import { isSupabaseUnconfigured } from '@/lib/result';
import { logDbError } from '@/lib/logger';
import { clientIp, isRateLimited, rateLimitResponse } from '@/lib/rate-limit';

/**
 * Which products a quiz code may discount.
 *
 * `GET /api/quiz/eligible-products`
 *   200  { handle, productIds }  — ids of the campaign collection's members
 *   503  unconfigured backend
 *   500  failed read
 *
 * Display-only: the cart drawer and the checkout rail use this set to show the
 * same discount the server will charge, but it is never trusted anywhere on
 * the money path — `validateCartLines` re-reads `collects` itself on the
 * service client. A shopper without a code never pays this fetch; the hook
 * only asks once one is applied.
 *
 * No `published` gate, deliberately: the authoritative read in
 * `validateCartLines` looks the collection up by handle without one, and the
 * display must agree with the charge, not with the catalog's public state.
 */
export async function GET(request: NextRequest) {
  if (isRateLimited(`quiz-eligible:${clientIp(request)}`, 60, 60_000)) {
    return rateLimitResponse();
  }

  if (isSupabaseUnconfigured()) {
    return NextResponse.json({ error: 'Promo scope unavailable' }, { status: 503 });
  }

  try {
    // Public catalog read through the static client (RLS applies) — the same
    // reads the collection pages make, so no new policy is needed.
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('collections')
      .select('id, collects ( product_id )')
      .eq('handle', CAMPAIGN.discountCollectionHandle)
      .maybeSingle();

    if (error) throw error;

    const rows = ((data?.collects ?? null) as { product_id: number | null }[] | null) ?? [];
    const productIds = rows
      .map((row) => row.product_id)
      .filter((id): id is number => typeof id === 'number');

    return NextResponse.json(
      { handle: CAMPAIGN.discountCollectionHandle, productIds },
      {
        headers: {
          // Membership moves rarely; a few minutes of browser cache keeps the
          // cart from re-asking on every open without hiding a new drop for
          // long.
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    logDbError('api:quiz-eligible-products', error);
    return NextResponse.json({ error: 'Failed to load promo scope' }, { status: 500 });
  }
}
