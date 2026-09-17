import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';
import { MAX_ORDER_LINES, MAX_QTY_PER_LINE } from '@/lib/pricing';
import { validateCartLines, type CartLine } from '@/lib/validate-cart';
import { logDbError, logWarn } from '@/lib/logger';
import { EMAIL_RE } from '@/lib/rate-limit';

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

// Best-effort stock restore for post-payment failures (order/line-item
// writes). Uses a negative qty, which the RPC applies unconditionally.
type CheckoutSupabase = NonNullable<ReturnType<typeof getClients>>['supabase'];

async function restoreStock(
  supabase: CheckoutSupabase,
  cartItems: CartLine[]
) {
  await Promise.all(
    cartItems.map((line) =>
      supabase.rpc('decrement_variant_stock', {
        p_variant_id: line.variantId,
        p_qty: -line.quantity,
      })
    )
  );
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

export async function POST(request: NextRequest) {
  try {
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

    // Idempotency: a replayed/confirmed payment returns the existing order
    // (razorpay payment id is stored in confirmation_number).
    const { data: existing } = await supabase
      .from('orders')
      .select('id, name')
      .eq('confirmation_number', razorpay_payment_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Payment already recorded',
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
        db_order_id: (existing as { id: number }).id,
        order_name: (existing as { id: number; name: string }).name,
      });
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

    // Atomic guarded decrements: one RPC per line, concurrent. Each RPC
    // only returns a row when enough stock exists, so oversell is impossible
    // even under concurrent checkouts. No manual restore loop.
    const decrementResults = await Promise.all(
      orderData.cartItems.map((line) =>
        supabase.rpc('decrement_variant_stock', {
          p_variant_id: line.variantId,
          p_qty: line.quantity,
        })
      )
    );

    const failed = decrementResults.find((r) => r.error || !r.data || r.data.length === 0);
    if (failed) {
      // Best-effort compensation for the lines that did decrement.
      const succeeded = orderData.cartItems.filter(
        (_, i) => !decrementResults[i].error && decrementResults[i].data?.length
      );
      await restoreStock(supabase, succeeded);
      if (failed.error) logDbError('verify-payment:decrement', failed.error);
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
        },
        { status: 409 }
      );
    }

    const orderNumber = Math.floor(Date.now() / 1000);
    const orderName = `YORD-${orderNumber}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        name: orderName,
        order_number: orderNumber,
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
      .select()
      .single();

    if (orderError || !order) {
      // Payment is captured and stock is decremented, so give the stock back
      // before reporting failure. Otherwise a retry starts from lost inventory.
      await restoreStock(supabase, orderData.cartItems);
      if (orderError && (orderError as { code?: string }).code === '23505') {
        // Lost a concurrent verify race for the same payment: the winner's
        // order row exists, so return it instead of a second order.
        const { data: raced } = await supabase
          .from('orders')
          .select('id, name')
          .eq('confirmation_number', razorpay_payment_id)
          .maybeSingle();
        if (raced) {
          return NextResponse.json({
            success: true,
            message: 'Payment already recorded',
            payment_id: razorpay_payment_id,
            order_id: razorpay_order_id,
            db_order_id: (raced as { id: number }).id,
            order_name: (raced as { id: number; name: string }).name,
          });
        }
      }
      logDbError('verify-payment:order-insert', orderError);
      const refunded = await refundCapturedPayment(
        razorpay,
        razorpay_payment_id,
        'order insert failed after capture'
      );
      return NextResponse.json(
        {
          error: refunded
            ? 'Payment confirmed but order save failed. Payment refunded.'
            : 'Payment confirmed but order save failed',
        },
        { status: 500 }
      );
    }

    const lineItems = orderData.cartItems.map((item) => {
      const variant = byId.get(item.variantId)!;
      return {
        order_id: (order as { id: number }).id,
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
      // customer is not left with a charged, unfulfillable order.
      await restoreStock(supabase, orderData.cartItems);
      const { error: cleanupError } = await supabase
        .from('orders')
        .delete()
        .eq('id', (order as { id: number }).id);
      if (cleanupError) logDbError('verify-payment:orphan-cleanup', cleanupError);
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
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and order created successfully',
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      db_order_id: (order as { id: number }).id,
      order_name: orderName,
    });
  } catch (error) {
    logDbError('verify-payment', error);
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  }
}
