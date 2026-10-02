import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';
import { MAX_ORDER_LINES, MAX_QTY_PER_LINE } from '@/lib/pricing';
import { validateCartLines, type CartLine } from '@/lib/validate-cart';
import { logDbError, logWarn } from '@/lib/logger';
import { EMAIL_RE, clientIp, isRateLimited, rateLimitResponse } from '@/lib/rate-limit';

function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!url || !serviceKey || !keyId || !keySecret) return null;
  return {
    supabase: createClient(url, serviceKey),
    razorpay: new Razorpay({ key_id: keyId, key_secret: keySecret }),
    keySecret,
  };
}

interface OrderData {
  email: string;
  phone: string;
  shippingAddress: {
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  cartItems: CartLine[];
}

function isValidOrderData(data: unknown): data is OrderData {
  if (!data || typeof data !== 'object') return false;
  const d = data as OrderData;
  if (typeof d.email !== 'string' || !EMAIL_RE.test(d.email) || d.email.length > 254) return false;
  if (typeof d.phone !== 'string' || d.phone.trim().length === 0 || d.phone.length > 20) return false;
  const a = d.shippingAddress;
  if (!a || typeof a !== 'object') return false;
  for (const key of ['firstName', 'lastName', 'address1', 'city', 'state', 'pincode', 'country'] as const) {
    if (typeof a[key] !== 'string' || a[key].trim().length === 0 || a[key].length > 500) return false;
  }
  if (!Array.isArray(d.cartItems) || d.cartItems.length === 0 || d.cartItems.length > MAX_ORDER_LINES) return false;
  return d.cartItems.every(
    (l) =>
      l &&
      Number.isInteger(l.variantId) &&
      Number.isInteger(l.quantity) &&
      l.quantity > 0 &&
      l.quantity <= MAX_QTY_PER_LINE
  );
}

type CheckoutSupabase = NonNullable<ReturnType<typeof getClients>>['supabase'];
type ClaimOrder = { id: number; name: string; total_price: number };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Order identity: epoch seconds keep the human-readable YORD-<epoch>-<hex>
// display, and 2 random bytes keep same-second orders unique for track-order
// lookups by order_number.
//
// BIGINT contract (supabase/migrations/006_orders_order_number_bigint.sql):
// current epochs produce values around 1.15e14 — far above the old INTEGER
// ceiling 2,147,483,647, which failed every paid checkout. The guard below
// rejects anything that is not a safe BIGINT value BEFORE the insert, and the
// insert maps an out-of-range rejection to an explicit ORDER_NUMBER_OVERFLOW
// code, so a database that never got the widening fails loudly instead of
// overflowing silently.
function buildOrderIdentity():
  | { ok: true; orderName: string; uniqueOrderNumber: number }
  | { ok: false; reason: string } {
  const orderNumber = Math.floor(Date.now() / 1000);
  const orderSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  const orderName = `YORD-${orderNumber}-${orderSuffix}`;
  const uniqueOrderNumber = orderNumber * 65536 + parseInt(orderSuffix, 16);
  if (!Number.isSafeInteger(uniqueOrderNumber) || uniqueOrderNumber <= 0) {
    return { ok: false, reason: `unsafe order_number ${uniqueOrderNumber}` };
  }
  return { ok: true, orderName, uniqueOrderNumber };
}

// Stock restore for post-payment failures, inspected per line with
// allSettled: one failed restore must neither throw (which would skip the
// refund) nor pass silently. Returns the failures so the caller can persist
// them; never throws, so the refund path below it always runs.
async function restoreStock(
  supabase: CheckoutSupabase,
  cartItems: CartLine[]
): Promise<{ ok: boolean; failures: { variantId: number; quantity: number; detail: string }[] }> {
  const settled = await Promise.allSettled(
    cartItems.map((line) =>
      supabase.rpc('decrement_variant_stock', {
        p_variant_id: line.variantId,
        p_qty: -line.quantity,
      })
    )
  );
  const failures = settled
    .map((result, i) => {
      if (result.status === 'rejected') {
        return {
          variantId: cartItems[i].variantId,
          quantity: cartItems[i].quantity,
          detail: result.reason instanceof Error ? result.reason.message : String(result.reason),
        };
      }
      const res = result.value as { error?: { message?: string } | null };
      if (res?.error) {
        return {
          variantId: cartItems[i].variantId,
          quantity: cartItems[i].quantity,
          detail: res.error.message ?? 'restore RPC error',
        };
      }
      return null;
    })
    .filter((f): f is { variantId: number; quantity: number; detail: string } => f !== null);
  if (failures.length > 0) {
    logDbError('verify-payment:restore', JSON.stringify(failures).slice(0, 500));
  }
  return { ok: failures.length === 0, failures };
}

// Persist a failed compensation on the order row (orders.note) plus the log
// aggregator, so an incomplete restore is reconcilable instead of silent.
// Best-effort and never throws.
async function persistCompensation(
  supabase: CheckoutSupabase,
  orderId: number | null,
  kind: string,
  detail: string
): Promise<void> {
  try {
    if (orderId !== null) {
      const { data: row } = await supabase
        .from('orders')
        .select('note')
        .eq('id', orderId)
        .maybeSingle();
      const prev = ((row as { note?: string | null } | null)?.note ?? '').slice(-1500);
      const stamp = `[stock-compensation ${new Date().toISOString()} ${kind}] ${detail}`.slice(0, 2000);
      await supabase
        .from('orders')
        .update({ note: prev ? `${prev}\n${stamp}` : stamp })
        .eq('id', orderId);
    }
  } catch {
    // The log line below is the durable record when the note write fails.
  }
  logDbError('verify-payment:compensation', `${kind} order=${orderId} ${detail}`.slice(0, 500));
}

// Refunds a captured payment when checkout cannot complete (oversell, order
// write failure, amount mismatch). Best-effort: failures are logged, never
// thrown, so the original error still reaches the caller.
async function refundCapturedPayment(
  razorpay: Razorpay,
  paymentId: string,
  reason: string
): Promise<boolean> {
  try {
    const refund = (await razorpay.payments.refund(paymentId, {})) as unknown as { id: string };
    logWarn('verify-payment', 'PAYMENT_REFUNDED', `${reason} | razorpay refund ${refund.id}`);
    return true;
  } catch (refundError) {
    logDbError('verify-payment:refund', refundError);
    return false;
  }
}

function successBody(
  razorpay_payment_id: string,
  razorpay_order_id: string,
  order: { id: number; name: string },
  extra?: Record<string, unknown>
) {
  return NextResponse.json({
    success: true,
    message: 'Payment verified and order created successfully',
    payment_id: razorpay_payment_id,
    order_id: razorpay_order_id,
    db_order_id: order.id,
    order_name: order.name,
    ...extra,
  });
}

// Completion-state check: an order row without line items is an in-flight
// claim (winner still writing) or a crashed orphan — NOT a completed payment.
// Poll briefly so a retry that lands mid-write sees the winner's commit
// instead of mistaking the partial row for success.
async function lineItemCount(
  supabase: CheckoutSupabase,
  orderId: number
): Promise<number | null> {
  const { count, error } = await supabase
    .from('line_items')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId);
  if (error) {
    logDbError('verify-payment:completion-check', error);
    return null;
  }
  return count ?? 0;
}

async function waitForCompletion(
  supabase: CheckoutSupabase,
  orderId: number,
  tries = 5,
  delayMs = 400
): Promise<boolean> {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const count = await lineItemCount(supabase, orderId);
    if (count !== null && count > 0) return true;
    if (attempt < tries - 1) await sleep(delayMs);
  }
  const count = await lineItemCount(supabase, orderId);
  return count !== null && count > 0;
}

export async function POST(request: NextRequest) {
  try {
    // Rate-limit the money-moving endpoint (create-order is limited too;
    // verify must not be the unthrottled back door).
    if (isRateLimited(`verify-payment:${clientIp(request)}`, 30, 60 * 1000)) {
      return rateLimitResponse();
    }

    const clients = getClients();
    if (!clients) {
      logWarn('verify-payment', 'MISCONFIGURED', 'Missing checkout env vars');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const { supabase, razorpay, keySecret } = clients;
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderData } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 });
    }

    if (!isValidOrderData(orderData)) {
      return NextResponse.json(
        { error: 'Invalid order data', code: 'UNKNOWN_VARIANT' },
        { status: 400 }
      );
    }

    // Constant-time HMAC comparison
    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(String(razorpay_signature), 'utf8');
    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    // Authoritative pricing from DB variants via the shared helper
    // (client prices ignored; money math lives in lib/pricing).
    const validated = await validateCartLines(supabase, orderData.cartItems);
    if (!validated.ok) {
      logWarn('verify-payment', validated.code, validated.error);
      return NextResponse.json(
        { error: validated.error, code: validated.code },
        { status: validated.status }
      );
    }
    const { subtotal, gstAmount, total, totalPaise, byId } = validated;

    // Confirm the captured payment covers the server-computed total
    let paymentAmount = 0;
    let paymentCurrency = '';
    try {
      const payment = await razorpay.payments.fetch(razorpay_payment_id);
      paymentAmount = Number(payment.amount);
      paymentCurrency = payment.currency;
      if (payment.order_id !== razorpay_order_id || payment.status !== 'captured') {
        return NextResponse.json({ error: 'Payment not captured' }, { status: 402 });
      }
    } catch (fetchError) {
      logDbError('verify-payment:razorpay-fetch', fetchError);
      return NextResponse.json({ error: 'Could not confirm payment' }, { status: 502 });
    }

    if (paymentCurrency !== 'INR' || paymentAmount !== totalPaise) {
      // Card already captured, but the server-computed total moved (e.g. price
      // edited mid-checkout) or the currency is wrong: refund rather than keep
      // money for an order we will not create.
      const refunded = await refundCapturedPayment(
        razorpay,
        razorpay_payment_id,
        `amount mismatch: paid ${paymentAmount} ${paymentCurrency}, expected ${totalPaise} INR`
      );
      return NextResponse.json(
        {
          error: refunded
            ? 'Paid amount does not match order total. Payment refunded.'
            : 'Paid amount does not match order total',
          code: 'AMOUNT_MISMATCH',
        },
        { status: 402 }
      );
    }

    const identity = buildOrderIdentity();
    if (!identity.ok) {
      logDbError('verify-payment:order-number', identity.reason);
      const refunded = await refundCapturedPayment(
        razorpay,
        razorpay_payment_id,
        `order number unsafe: ${identity.reason}`
      );
      return NextResponse.json(
        {
          error: refunded
            ? 'Payment confirmed but order save failed. Payment refunded.'
            : 'Payment confirmed but order save failed',
          code: 'ORDER_NUMBER_OVERFLOW',
        },
        { status: 500 }
      );
    }
    const { orderName, uniqueOrderNumber } = identity;

    // Idempotency with completion state: a replayed/confirmed payment returns
    // the existing order (payment id is stored in confirmation_number) — but
    // only when its line items have committed. A bare row is an in-flight
    // claim, not a completed payment.
    const { data: preExisting } = await supabase
      .from('orders')
      .select('id, name, total_price')
      .eq('confirmation_number', razorpay_payment_id)
      .maybeSingle();

    let order: ClaimOrder | null = null;
    if (preExisting) {
      const found = preExisting as ClaimOrder;
      if (await waitForCompletion(supabase, found.id)) {
        return successBody(razorpay_payment_id, razorpay_order_id, found, {
          message: 'Payment already recorded',
        });
      }
      // Incomplete claim from a crashed attempt with the same totals: adopt
      // it (re-decrement below is fail-safe — understated stock, never
      // oversell) rather than minting a second order for one payment.
      if (Number(found.total_price) === total) {
        await persistCompensation(
          supabase,
          found.id,
          'adopt-claim',
          'adopted incomplete claim; stock re-decremented'
        );
        order = found;
      } else {
        return NextResponse.json(
          {
            error: 'A previous attempt left this payment incomplete. Please wait a moment and try again.',
            code: 'ORDER_INCOMPLETE',
          },
          { status: 409 }
        );
      }
    }

    if (!order) {
      // Claim-before-decrement: the order row (unique on confirmation_number,
      // migration 004) serializes concurrent verifies for the same payment.
      // The loser fails here with 23505 BEFORE touching stock, so it can no
      // longer refund the payment out from under the winner.
      const { data: claimed, error: claimError } = await supabase
        .from('orders')
        .insert({
          name: orderName,
          order_number: uniqueOrderNumber,
          email: orderData.email.toLowerCase().trim(),
          phone: orderData.phone.trim(),
          financial_status: 'paid',
          fulfillment_status: 'unfulfilled',
          currency: 'INR',
          total_price: total,
          subtotal_price: subtotal,
          total_tax: gstAmount,
          total_shipping_price: 0,
          confirmation_number: razorpay_payment_id,
          token: razorpay_order_id,
          processed_at: new Date().toISOString(),
        })
        .select('id, name, total_price')
        .single();

      if (claimError || !claimed) {
        const code = (claimError as { code?: string } | null)?.code;
        if (code === '23505') {
          // Lost the race: the winner owns this payment. Return the winner's
          // order once its line items commit — no stock moves, no refund.
          const { data: raced } = await supabase
            .from('orders')
            .select('id, name, total_price')
            .eq('confirmation_number', razorpay_payment_id)
            .maybeSingle();
          if (raced && (await waitForCompletion(supabase, (raced as ClaimOrder).id))) {
            const winner = raced as ClaimOrder;
            return successBody(razorpay_payment_id, razorpay_order_id, winner, {
              message: 'Payment already recorded',
            });
          }
          if (raced && Number((raced as ClaimOrder).total_price) === total) {
            await persistCompensation(
              supabase,
              (raced as ClaimOrder).id,
              'adopt-claim',
              'adopted race claim; stock re-decremented'
            );
            order = raced as ClaimOrder;
          } else {
            return NextResponse.json(
              {
                error: 'This payment is being processed. Please wait a moment and try again.',
                code: 'ORDER_INCOMPLETE',
              },
              { status: 409 }
            );
          }
        } else {
          // Explicit BIGINT contract: an INTEGER-range rejection names the
          // missing widening migration instead of a generic save failure.
          const msg = String(
            (claimError as { message?: string } | null)?.message ?? claimError
          );
          const overflow =
            code === '22003' || /out of range|integer/i.test(msg);
          logDbError('verify-payment:order-claim', claimError);
          const refunded = await refundCapturedPayment(
            razorpay,
            razorpay_payment_id,
            overflow ? 'order_number overflow (missing BIGINT widening)' : 'order claim failed after capture'
          );
          return NextResponse.json(
            {
              error: refunded
                ? 'Payment confirmed but order save failed. Payment refunded.'
                : 'Payment confirmed but order save failed',
              code: overflow ? 'ORDER_NUMBER_OVERFLOW' : undefined,
            },
            { status: 500 }
          );
        }
      } else {
        order = claimed as ClaimOrder;
      }
    }

    if (!order) {
      logDbError('verify-payment:order-claim', 'claim resolved to no order');
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
    }
    const orderId = order.id;

    // Atomic guarded decrements: one RPC per line. Each RPC only returns a
    // row when enough stock exists, so oversell is impossible even under
    // concurrent checkouts. Settled (not Promise.all) so one transport
    // failure cannot skip the compensation + refund below.
    const decrementSettled = await Promise.allSettled(
      orderData.cartItems.map((line) =>
        supabase.rpc('decrement_variant_stock', {
          p_variant_id: line.variantId,
          p_qty: line.quantity,
        })
      )
    );
    const decrementOk = decrementSettled.map((result) => {
      if (result.status === 'rejected') return false;
      const res = result.value as { error?: unknown; data?: unknown[] };
      return !res?.error && Array.isArray(res?.data) && res.data.length > 0;
    });

    if (decrementOk.includes(false)) {
      // Compensate only the lines that did decrement, then refund. The
      // refund runs even when restores or the claim cleanup fail.
      const succeeded = orderData.cartItems.filter((_, i) => decrementOk[i]);
      let stockRestoreFailed: unknown = null;
      try {
        const restored = await restoreStock(supabase, succeeded);
        if (!restored.ok) {
          stockRestoreFailed = restored.failures;
          await persistCompensation(
            supabase,
            orderId,
            'restore-failed',
            JSON.stringify(restored.failures).slice(0, 500)
          );
        }
        const { error: cleanupError } = await supabase.from('orders').delete().eq('id', orderId);
        if (cleanupError) {
          logDbError('verify-payment:claim-cleanup', cleanupError);
          await persistCompensation(supabase, orderId, 'claim-cleanup-failed', 'orphan claim may remain');
        }
      } catch (compError) {
        logDbError('verify-payment:compensation', compError);
      }
      const firstFailure = decrementSettled.find(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && ((r.value as { error?: unknown })?.error || !((r.value as { data?: unknown[] })?.data ?? []).length))
      );
      if (firstFailure?.status === 'fulfilled') {
        logDbError('verify-payment:decrement', (firstFailure.value as { error?: unknown })?.error);
      } else if (firstFailure?.status === 'rejected') {
        logDbError('verify-payment:decrement', firstFailure.reason);
      }
      const refunded = await refundCapturedPayment(
        razorpay,
        razorpay_payment_id,
        'insufficient stock after capture'
      );
      return NextResponse.json(
        {
          error: refunded
            ? 'Insufficient stock for one or more items. Payment refunded.'
            : 'Insufficient stock for one or more items',
          code: 'OUT_OF_STOCK',
          ...(stockRestoreFailed ? { stock_restore_failed: true } : {}),
        },
        { status: 409 }
      );
    }

    const lineItems = orderData.cartItems.map((item) => {
      const variant = byId.get(item.variantId)!;
      return {
        order_id: orderId,
        product_id: variant.product_id,
        variant_id: item.variantId,
        title: variant.productTitle,
        variant_title: variant.title,
        price: variant.price,
        quantity: item.quantity,
        requires_shipping: true,
        taxable: true,
        gift_card: false,
      };
    });

    const { error: lineItemsError } = await supabase.from('line_items').insert(lineItems);

    if (lineItemsError) {
      logDbError('verify-payment:line-items', lineItemsError);
      // Undo the stock decrement and remove the item-less order so the
      // customer is not left with a charged, unfulfillable order. The refund
      // is guaranteed: compensation failures are persisted, never thrown.
      let stockRestoreFailed = false;
      try {
        const restored = await restoreStock(supabase, orderData.cartItems);
        if (!restored.ok) {
          stockRestoreFailed = true;
          await persistCompensation(
            supabase,
            orderId,
            'restore-failed',
            JSON.stringify(restored.failures).slice(0, 500)
          );
        }
        const { error: cleanupError } = await supabase.from('orders').delete().eq('id', orderId);
        if (cleanupError) {
          logDbError('verify-payment:orphan-cleanup', cleanupError);
          await persistCompensation(supabase, orderId, 'orphan-cleanup-failed', 'item-less order may remain');
        }
      } catch (compError) {
        logDbError('verify-payment:compensation', compError);
      }
      const refunded = await refundCapturedPayment(
        razorpay,
        razorpay_payment_id,
        'line items insert failed after capture'
      );
      return NextResponse.json(
        {
          error: refunded
            ? 'Payment confirmed but order save failed. Payment refunded.'
            : 'Payment confirmed but order save failed',
          ...(stockRestoreFailed ? { stock_restore_failed: true } : {}),
        },
        { status: 500 }
      );
    }

    // Shipping address: fulfillment has no destination without it. Its insert
    // is a post-payment failure path like line items — a failure restores
    // stock, removes the undeliverable order, and refunds.
    const shipping = orderData.shippingAddress;
    const { error: shippingError } = await supabase.from('order_shipping_addresses').insert({
      order_id: orderId,
      first_name: shipping.firstName,
      last_name: shipping.lastName,
      address1: shipping.address1,
      address2: shipping.address2 ?? null,
      city: shipping.city,
      province: shipping.state,
      country: shipping.country,
      zip: shipping.pincode,
      phone: orderData.phone.trim(),
    });

    if (shippingError) {
      logDbError('verify-payment:shipping-address', shippingError);
      let stockRestoreFailed = false;
      try {
        const restored = await restoreStock(supabase, orderData.cartItems);
        if (!restored.ok) {
          stockRestoreFailed = true;
          await persistCompensation(
            supabase,
            orderId,
            'restore-failed',
            JSON.stringify(restored.failures).slice(0, 500)
          );
        }
        // Cascades to line_items and the shipping row (if partially written).
        const { error: cleanupError } = await supabase.from('orders').delete().eq('id', orderId);
        if (cleanupError) {
          logDbError('verify-payment:orphan-cleanup', cleanupError);
          await persistCompensation(
            supabase,
            orderId,
            'orphan-cleanup-failed',
            'address-less order may remain'
          );
        }
      } catch (compError) {
        logDbError('verify-payment:compensation', compError);
      }
      const refunded = await refundCapturedPayment(
        razorpay,
        razorpay_payment_id,
        'shipping address insert failed after capture'
      );
      return NextResponse.json(
        {
          error: refunded
            ? 'Payment confirmed but order save failed. Payment refunded.'
            : 'Payment confirmed but order save failed',
          ...(stockRestoreFailed ? { stock_restore_failed: true } : {}),
        },
        { status: 500 }
      );
    }

    return successBody(razorpay_payment_id, razorpay_order_id, {
      id: orderId,
      name: order.name,
    });
  } catch (error) {
    logDbError('verify-payment', error);
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  }
}
