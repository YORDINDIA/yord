'use server';

import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { EMAIL_RE, clientIp, isRateLimited } from '@/lib/rate-limit';
import { sanitizeOrPattern } from '@/lib/search';
import { isYordOrderName, orderNameEpochSeconds } from '@/features/checkout/order';

/**
 * Order lookup for the public "track order" page.
 *
 * Server-side on purpose. The page used to run the query in the browser with
 * the publishable key, which makes the anon key a read handle on `orders`:
 * the page's own `select` was narrow, but the table is only as protected as
 * its RLS policy, and this repo defines none for `orders` (009 covers the
 * catalog only). A service-role lookup that matches on email + order number
 * keeps that access off the client entirely.
 *
 * The response is deliberately minimal — status, date and total. No address,
 * no phone, no line items, no email echo.
 */

export interface TrackedOrder {
  name: string | null;
  orderNumber: number | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  totalPrice: number;
  createdAt: string;
  processedAt: string | null;
}

export type TrackOrderResult =
  | { ok: true; order: TrackedOrder }
  | { ok: false; message: string };

// One message for a malformed input and for a real miss: distinguishing them
// would tell a prober which half of the pair they got right.
const NOT_FOUND = 'Order not found. Please check your order number and email address.';
const FAILED = 'Could not look up your order right now. Please try again.';
const THROTTLED = 'Too many attempts. Please wait a minute and try again.';

export async function trackOrderAction(input: {
  email: string;
  orderNumber: string;
}): Promise<TrackOrderResult> {
  const email = input.email.trim().toLowerCase();
  // Uppercased before matching: the mint only ever emits `YORD-…` names, and
  // the shared regex is uppercase-only, so a hand-typed lowercase name must
  // still resolve (both the packed-number parse and the `name.eq` predicate).
  const rawNumber = input.orderNumber.trim().toUpperCase().slice(0, 50);

  if (!EMAIL_RE.test(email) || rawNumber.length === 0) {
    return { ok: false, message: NOT_FOUND };
  }

  // Best-effort throttle: an unauthenticated lookup that pairs a guessable
  // order number with an email is a guessing oracle. Keyed on the same
  // clientIp the API routes use — Netlify's unspoofable header wins, XFF-LAST
  // is the fallback — not the client-controlled first XFF entry.
  const headerList = await headers();
  const ip = clientIp({ headers: headerList });
  if (isRateLimited(`track-order:${ip}`, 10, 60_000)) {
    return { ok: false, message: THROTTLED };
  }

  // Orders are named YORD-<epochSeconds>-<hexSuffix> (shape checked by the
  // shared checkout helpers, the same contract the confirmation page enforces)
  // and order_number packs both halves — epoch * 65536 + suffix — so accept
  // either the full name or the bare numeric order_number.
  const epoch = isYordOrderName(rawNumber) ? orderNameEpochSeconds(rawNumber) : null;
  const numeric =
    epoch !== null
      ? epoch * 65536 + parseInt(rawNumber.slice(rawNumber.lastIndexOf('-') + 1), 16)
      : parseInt(rawNumber.replace(/^YORD-/i, ''), 10);

  // Quote the name predicate so input chars cannot break out of the filter
  const safeName = sanitizeOrPattern(rawNumber);

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('orders')
      .select(
        'name, order_number, financial_status, fulfillment_status, total_price, created_at, processed_at',
      )
      .eq('email', email)
      .or(`name.eq."${safeName}",order_number.eq.${Number.isFinite(numeric) ? numeric : 0}`)
      // `maybeSingle` rather than `single`: a miss is an expected outcome, not
      // a PostgREST error to be interpreted.
      .maybeSingle();

    if (error) return { ok: false, message: FAILED };
    if (!data) return { ok: false, message: NOT_FOUND };

    return {
      ok: true,
      order: {
        name: data.name,
        orderNumber: data.order_number,
        financialStatus: data.financial_status,
        fulfillmentStatus: data.fulfillment_status,
        totalPrice: data.total_price,
        createdAt: data.created_at,
        processedAt: data.processed_at,
      },
    };
  } catch {
    // A failed read must not read as "no such order".
    return { ok: false, message: FAILED };
  }
}
