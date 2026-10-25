import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clientIp, isRateLimited, rateLimitResponse } from '@/lib/rate-limit';
import { logWarn } from '@/lib/logger';
import { isValidCodeFormat, normalizeCode } from '@/features/quiz/codes';
import { CODE_REJECTION_MESSAGE, peekCode } from '@/features/quiz/server/codes';

/**
 * Check a promo code before the shopper reaches the payment step.
 *
 * `POST /api/quiz/code`
 *   body  { code: string }
 *   200   { ok: true, percent } or { ok: false, reason, message }
 *   413   body larger than 1 KB
 *   429   rate limited
 *
 * A rejected code answers 200 with `ok: false`, not 4xx: "this code is spent"
 * is a normal answer to a normal question, and the promo field renders the
 * message either way. Only a malformed request is a 400. `reason` carries the
 * machine token (`not_found` | `redeemed` | `expired` | `held` |
 * `unavailable`) so a caller can tell a definitive rejection from a transient
 * one without parsing the copy.
 *
 * The body is size-capped before parsing: the only field this route reads is a
 * ≤64-char code, so anything past a kilobyte is not a shopper, and parsing it
 * would only spend worker time on it.
 *
 * The limit is per IP and exists to stop enumeration. Codes are six characters
 * from a 32-symbol alphabet (32^6 ≈ 1.07e9), so a blind guess is hopeless, but
 * 20 a minute keeps it hopeless rather than merely unlikely. The limit is
 * shared by every shopper behind one NAT, which is why it is not tighter: this
 * route has to stay usable from a campus or office network on the day of a
 * concert.
 */

/** Requests larger than this are refused before the body is parsed. */
const MAX_BODY_BYTES = 1024;

export async function POST(request: NextRequest) {
  if (isRateLimited(`quiz-code:${clientIp(request)}`, 20, 60 * 1000)) {
    return rateLimitResponse();
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 413 });
  }

  const text = await request.text().catch(() => '');
  if (text.length > MAX_BODY_BYTES) {
    // Chunked bodies carry no content-length; the read above is the backstop.
    return NextResponse.json({ error: 'Invalid code' }, { status: 413 });
  }
  const body = (() => {
    try {
      return JSON.parse(text) as { code?: unknown } | null;
    } catch {
      return null;
    }
  })();

  const raw = typeof body?.code === 'string' ? body.code : '';
  if (raw.length === 0 || raw.length > 64) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  if (!isValidCodeFormat(raw)) {
    return NextResponse.json({ ok: false, reason: 'not_found', message: CODE_REJECTION_MESSAGE.not_found });
  }

  const supabase = (() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secretKey) return null;
    return createClient(url, secretKey);
  })();

  if (!supabase) {
    logWarn('quiz-code', 'MISCONFIGURED', 'Missing Supabase env vars');
    return NextResponse.json({
      ok: false,
      reason: 'unavailable',
      message: CODE_REJECTION_MESSAGE.unavailable,
    });
  }

  const lookup = await peekCode(supabase, normalizeCode(raw));
  if (!lookup.ok) {
    return NextResponse.json({
      ok: false,
      reason: lookup.reason,
      message: CODE_REJECTION_MESSAGE[lookup.reason],
    });
  }

  return NextResponse.json({ ok: true, percent: lookup.percent });
}
