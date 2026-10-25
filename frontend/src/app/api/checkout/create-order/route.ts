import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { MAX_ORDER_LINES, MAX_QTY_PER_LINE } from '@/lib/pricing';
import { validateCartLines, type CartLine } from '@/lib/validate-cart';
import { logDbError, logWarn } from '@/lib/logger';
import { isRateLimited, clientIp, rateLimitResponse } from '@/lib/rate-limit';
import { isValidCodeFormat, normalizeCode } from '@/features/quiz/codes';
import { CODE_REJECTION_MESSAGE, peekCode } from '@/features/quiz/server/codes';

// Server-side pricing: never trust client-supplied amounts.
// Clients are created lazily per request so a missing env var returns
// 500 `Server misconfigured` instead of crashing the cold start at import.

function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!url || !secretKey || !keyId || !keySecret) return null;
  return {
    supabase: createClient(url, secretKey),
    razorpay: new Razorpay({ key_id: keyId, key_secret: keySecret }),
  };
}

export async function POST(request: NextRequest) {
  try {
    if (isRateLimited(`create-order:${clientIp(request)}`, 10, 60 * 1000)) {
      return rateLimitResponse();
    }

    const clients = getClients();
    if (!clients) {
      logWarn('create-order', 'MISCONFIGURED', 'Missing checkout env vars');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const { supabase, razorpay } = clients;

    const body = await request.json();
    const { currency = 'INR', items, code } = body as {
      currency?: string;
      items?: CartLine[];
      code?: string;
    };

    if (currency !== 'INR') {
      return NextResponse.json({ error: 'Unsupported currency' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ORDER_LINES) {
      return NextResponse.json(
        { error: 'Invalid cart items', code: 'UNKNOWN_VARIANT' },
        { status: 400 }
      );
    }

    for (const line of items) {
      if (
        !line ||
        !Number.isInteger(line.variantId) ||
        !Number.isInteger(line.quantity) ||
        line.quantity <= 0 ||
        line.quantity > MAX_QTY_PER_LINE
      ) {
        return NextResponse.json(
          { error: 'Invalid cart items', code: 'UNKNOWN_VARIANT' },
          { status: 400 }
        );
      }
    }

    // Resolve the promo code before pricing, so the Razorpay order is created
    // for the amount the shopper was shown.
    //
    // A code that no longer works is a 409 rather than a silent full-price
    // charge: the shopper applied a code and the price on their screen includes
    // it, so charging more than that without saying so is the one outcome worth
    // blocking. `peek` here is read-only — the code is not reserved until
    // `verify-payment`, because reserving now would let an abandoned Razorpay
    // modal hold the shopper's own code against a stale order id.
    let discountPercent = 0;
    let appliedCode: string | null = null;
    if (typeof code === 'string' && code.trim().length > 0) {
      if (!isValidCodeFormat(code)) {
        return NextResponse.json(
          { error: CODE_REJECTION_MESSAGE.not_found, code: 'CODE_INVALID' },
          { status: 409 }
        );
      }
      const lookup = await peekCode(supabase, normalizeCode(code));
      if (!lookup.ok) {
        logWarn('create-order', `CODE_${lookup.reason.toUpperCase()}`, normalizeCode(code));
        return NextResponse.json(
          { error: CODE_REJECTION_MESSAGE[lookup.reason], code: 'CODE_INVALID' },
          { status: 409 }
        );
      }
      discountPercent = lookup.percent;
      appliedCode = normalizeCode(code);
    }

    // Authoritative price + stock lookup (shared helper; pricing math in lib/pricing).
    const validated = await validateCartLines(supabase, items, discountPercent);
    if (!validated.ok) {
      logWarn('create-order', validated.code, validated.error);
      return NextResponse.json(
        { error: validated.error, code: validated.code },
        { status: validated.status }
      );
    }
    const {
      subtotal,
      discountAmount,
      gstAmount,
      total,
      totalPaise: amountPaise,
    } = validated;

    let order;
    try {
      order = await razorpay.orders.create({
        amount: amountPaise,
        currency,
        receipt: `yord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        // The code rides in the gateway notes so a dispute or a manual
        // reconciliation can see which discount a captured amount included,
        // without reading our database.
        notes: {
          source: 'yord-india-website',
          ...(appliedCode ? { promo_code: appliedCode, discount_percent: String(discountPercent) } : {}),
        },
      });
    } catch (razorpayError) {
      logDbError('create-order:razorpay', razorpayError);
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    return NextResponse.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      subtotal,
      discountAmount,
      discountPercent,
      gstAmount,
      total,
    });
  } catch (error) {
    logDbError('create-order', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
