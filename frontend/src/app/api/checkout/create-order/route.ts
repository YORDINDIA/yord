import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { MAX_ORDER_LINES, MAX_QTY_PER_LINE } from '@/lib/pricing';
import { validateCartLines, type CartLine } from '@/lib/validate-cart';
import { logDbError, logWarn } from '@/lib/logger';
import { isRateLimited, clientIp, rateLimitResponse } from '@/lib/rate-limit';

// Server-side pricing: never trust client-supplied amounts.
// Clients are created lazily per request so a missing env var returns
// 500 `Server misconfigured` instead of crashing the cold start at import.

function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!url || !serviceKey || !keyId || !keySecret) return null;
  return {
    supabase: createClient(url, serviceKey),
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
    const { currency = 'INR', items } = body as { currency?: string; items?: CartLine[] };

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

    // Authoritative price + stock lookup (shared helper; pricing math in lib/pricing).
    const validated = await validateCartLines(supabase, items);
    if (!validated.ok) {
      logWarn('create-order', validated.code, validated.error);
      return NextResponse.json(
        { error: validated.error, code: validated.code },
        { status: validated.status }
      );
    }
    const { subtotal, gstAmount, total, totalPaise: amountPaise } = validated;

    let order;
    try {
      order = await razorpay.orders.create({
        amount: amountPaise,
        currency,
        receipt: `yord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        notes: { source: 'yord-india-website' },
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
      gstAmount,
      total,
    });
  } catch (error) {
    logDbError('create-order', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
