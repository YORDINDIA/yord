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
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!url || !secretKey || !keyId || !keySecret) return null;
  return {
    supabase: createClient(url, secretKey),
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
type ClaimOrder = {
  id: number;
  name: string;
  total_price: number;
  financial_status: string | null;
  cancelled_at: string | null;
};

// A compensated order is terminal for its payment id: the payment was
// refunded, so no later verify may adopt the row, re-decrement the stock the
// compensation restored, or answer success. Post-capture failures stamp the
// row (refunded + cancelled) instead of deleting it precisely so this check
// has something to find — a deleted row let the client's own retry re-claim
// the payment (nothing left to lose a 23505 race against), re-decrement the
// just-restored stock, and mint a second 'paid' order for money that had
// already been refunded.
function isCompensatedOrder(
  order: Pick<ClaimOrder, 'financial_status' | 'cancelled_at'>
): boolean {
  return order.cancelled_at !== null || (order.financial_status ?? '') !== 'paid';
}

// The answer for a replay of a compensated payment. 409 is what the client
// treats as definitive (it stops reconciling instead of retrying), and the
// copy names the state of the money instead of inviting another attempt.
function compensatedReplayResponse() {
  return NextResponse.json(
    {
      error: 'This payment was refunded and cannot be reused. Please start a new checkout.',
      code: 'ORDER_REFUNDED',
    },
    { status: 409 }
  );
}

// The behavioral analytics session id is optional client input, so it is
// accepted only when uuid-shaped (the route is the boundary; the client is
// untrusted). Anything else degrades to a synthetic sid below.
const ANALYTICS_SID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      const res = result.value as { error?: { message?: string } | null; data?: unknown[] };
      if (res?.error) {
        return {
          variantId: cartItems[i].variantId,
          quantity: cartItems[i].quantity,
          detail: res.error.message ?? 'restore RPC error',
        };
      }
      // The restore RPC updates unconditionally for a negative qty, so it
      // returns a row whenever the variant still exists — empty data means the
      // variant row is gone and this stock did NOT go back. A failure worth a
      // note, never a silent success.
      if (!Array.isArray(res?.data) || res.data.length === 0) {
        return {
          variantId: cartItems[i].variantId,
          quantity: cartItems[i].quantity,
          detail: 'restore matched no variant row',
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
// `terminal` also stamps the row refunded + cancelled: that stamp is the
// marker a replay of the same payment id must find (see isCompensatedOrder),
// and callers write it before the slow work (stock restore, refund call) so
// the window in which a concurrent retry can still adopt the row is one write
// wide. Best-effort and never throws.
async function persistCompensation(
  supabase: CheckoutSupabase,
  orderId: number | null,
  kind: string,
  detail: string,
  terminal = false
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
        .update({
          note: prev ? `${prev}\n${stamp}` : stamp,
          ...(terminal
            ? { financial_status: 'refunded', cancelled_at: new Date().toISOString() }
            : {}),
        })
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

// Refund the captured payment and make a failed refund durable on the order
// note. A refund that did not go through leaves captured money against a
// cancelled order — exactly what an admin has to reconcile by hand, and the
// reason the order row survives compensation instead of being deleted.
async function refundAndRecord(
  supabase: CheckoutSupabase,
  razorpay: Razorpay,
  orderId: number,
  paymentId: string,
  reason: string
): Promise<boolean> {
  const refunded = await refundCapturedPayment(razorpay, paymentId, reason);
  if (!refunded) {
    await persistCompensation(
      supabase,
      orderId,
      'refund-failed',
      `${reason}; payment still captured`
    );
  }
  return refunded;
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

// Line items committed for an order, or null when the count could not be
// read (treated as "not complete" by readOrderCompletion, so an unreadable
// count never turns into a success answer).
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

// Completion-state check: an order row without line items is an in-flight
// claim (winner still writing) or a crashed orphan — NOT a completed payment.
// Four outcomes, because "has line items" alone is not enough:
//   'complete'   — the winner committed line items and the shipping address;
//                  this is a real order.
//   'no_address' — line items committed but the address row is missing: the
//                  winner crashed between the two inserts. The one recoverable
//                  state (see backfillShippingAddress).
//   'terminal'   — the row was compensated (refunded/cancelled); no number of
//                  line items makes it a real order.
//   'incomplete' — the caller decides whether to adopt it.
async function readOrderCompletion(
  supabase: CheckoutSupabase,
  orderId: number
): Promise<'complete' | 'no_address' | 'incomplete' | 'terminal'> {
  const { data, error } = await supabase
    .from('orders')
    .select('financial_status, cancelled_at')
    .eq('id', orderId)
    .maybeSingle();
  if (error) {
    logDbError('verify-payment:completion-check', error);
    return 'incomplete';
  }
  if (
    data &&
    isCompensatedOrder(data as { financial_status: string | null; cancelled_at: string | null })
  ) {
    return 'terminal';
  }
  const count = await lineItemCount(supabase, orderId);
  if (count === null || count === 0) return 'incomplete';
  const { count: addressCount, error: addressError } = await supabase
    .from('order_shipping_addresses')
    .select('order_id', { count: 'exact', head: true })
    .eq('order_id', orderId);
  if (addressError) {
    // An unreadable address count must never read as 'complete'; the caller
    // answers 'no_address' with an idempotent backfill, so a false missing
    // costs one guarded insert, not a wrong success.
    logDbError('verify-payment:completion-check', addressError);
    return 'no_address';
  }
  return (addressCount ?? 0) > 0 ? 'complete' : 'no_address';
}

// Poll briefly so a retry that lands mid-write sees the winner's commit
// instead of mistaking the partial row for success. The terminal check is
// inside the poll, not only before it, because a concurrent verify can stamp
// the row mid-poll: a check that only counted line items would report success
// for a payment whose money is already going back.
async function waitForCompletion(
  supabase: CheckoutSupabase,
  orderId: number,
  tries = 5,
  delayMs = 400
): Promise<'complete' | 'no_address' | 'incomplete' | 'terminal'> {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const state = await readOrderCompletion(supabase, orderId);
    if (state !== 'incomplete') return state;
    if (attempt < tries - 1) await sleep(delayMs);
  }
  return readOrderCompletion(supabase, orderId);
}

// Finish a recovered order whose line items committed but whose shipping
// address insert never did. Check-then-insert like persistCompensation, with
// the address table's primary key as the tiebreaker: a row that lands between
// the check and the insert surfaces as 23505, which means the address exists
// and a concurrent replay won — not an error worth compensating over.
async function backfillShippingAddress(
  supabase: CheckoutSupabase,
  orderId: number,
  orderData: OrderData
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('order_shipping_addresses')
    .select('order_id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (existing) return true;
  const shipping = orderData.shippingAddress;
  const { error } = await supabase.from('order_shipping_addresses').insert({
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
  if (!error) return true;
  if ((error as { code?: string } | null)?.code === '23505') return true;
  logDbError('verify-payment:shipping-backfill', error);
  return false;
}

// Answer an attempt that did not claim the order row, from the completion
// state it polled: the replay vocabulary (success, refunded, incomplete) plus
// the one recoverable state — line items committed, address missing — whose
// recovery is the address row alone. The stock decrement, the line-item
// insert and the compensation stamp never run here: the adopt CAS refuses
// every state that reaches this function except a finished order.
async function answerPolledState(
  supabase: CheckoutSupabase,
  state: 'complete' | 'no_address' | 'incomplete' | 'terminal',
  order: ClaimOrder,
  paymentId: string,
  razorpayOrderId: string,
  orderData: OrderData,
  incompleteError: string
): Promise<NextResponse> {
  if (state === 'terminal') return compensatedReplayResponse();
  if (state === 'complete') {
    return successBody(paymentId, razorpayOrderId, order, {
      message: 'Payment already recorded',
    });
  }
  if (state === 'no_address' && (await backfillShippingAddress(supabase, order.id, orderData))) {
    return successBody(paymentId, razorpayOrderId, order, {
      message: 'Payment already recorded',
    });
  }
  return NextResponse.json({ error: incompleteError, code: 'ORDER_INCOMPLETE' }, { status: 409 });
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
    const analyticsSid =
      typeof body.analyticsSid === 'string' && ANALYTICS_SID_SHAPE.test(body.analyticsSid)
        ? body.analyticsSid
        : null;

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
    // claim, not a completed payment. A compensated row is neither: the money
    // went back, so it is terminal and this attempt must fail too.
    const { data: preExisting } = await supabase
      .from('orders')
      .select('id, name, total_price, financial_status, cancelled_at')
      .eq('confirmation_number', razorpay_payment_id)
      .maybeSingle();

    let order: ClaimOrder | null = null;
    if (preExisting) {
      const found = preExisting as ClaimOrder;
      if (isCompensatedOrder(found)) return compensatedReplayResponse();
      const state = await waitForCompletion(supabase, found.id);
      if (state !== 'incomplete') {
        return answerPolledState(
          supabase,
          state,
          found,
          razorpay_payment_id,
          razorpay_order_id,
          orderData,
          'A previous attempt left this payment incomplete. Please wait a moment and try again.'
        );
      }
      // Incomplete claim from a crashed attempt with the same totals: adopt it
      // through the CAS RPC rather than minting a second order for one
      // payment. The RPC flips claim_adopted_at only for a still-'paid',
      // uncancelled, line-less row whose total matches, so the re-decrement
      // below happens exactly once per claim — a concurrent attempt that
      // adopted first, or a compensation that ran in between, makes the CAS
      // return false and this attempt answers from the resulting state without
      // writing anything (no decrement, no line items, no stamp).
      if (Number(found.total_price) === total) {
        const { data: adopted, error: adoptError } = await supabase.rpc('adopt_order_claim', {
          p_order_id: found.id,
          p_total: total,
        });
        if (adoptError) logDbError('verify-payment:adopt-claim', adoptError);
        if (adopted === true) {
          order = found;
        } else {
          return answerPolledState(
            supabase,
            await waitForCompletion(supabase, found.id),
            found,
            razorpay_payment_id,
            razorpay_order_id,
            orderData,
            'A previous attempt left this payment incomplete. Please wait a moment and try again.'
          );
        }
      } else {
        // A claim whose total no longer matches any recomputation can never be
        // adopted by anyone. Non-terminal: the money decision belongs to the
        // attempt that holds the payment; this only marks the row for
        // reconciliation.
        await persistCompensation(
          supabase,
          found.id,
          'claim-total-mismatch',
          `claim total ${found.total_price} does not match this attempt's ${total}`,
          false
        );
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
        .select('id, name, total_price, financial_status, cancelled_at')
        .single();

      if (claimError || !claimed) {
        const code = (claimError as { code?: string } | null)?.code;
        if (code === '23505') {
          // Lost the race: the winner owns this payment. Return the winner's
          // order once its line items commit — no stock moves, no refund —
          // unless the winner compensated it, in which case the payment is
          // terminal and this attempt fails with it.
          const { data: raced } = await supabase
            .from('orders')
            .select('id, name, total_price, financial_status, cancelled_at')
            .eq('confirmation_number', razorpay_payment_id)
            .maybeSingle();
          const winner = (raced as ClaimOrder | null) ?? null;
          if (winner && isCompensatedOrder(winner)) return compensatedReplayResponse();
          const state = winner ? await waitForCompletion(supabase, winner.id) : 'incomplete';
          if (winner && state !== 'incomplete') {
            return answerPolledState(
              supabase,
              state,
              winner,
              razorpay_payment_id,
              razorpay_order_id,
              orderData,
              'This payment is being processed. Please wait a moment and try again.'
            );
          }
          if (winner && Number(winner.total_price) === total) {
            const { data: adopted, error: adoptError } = await supabase.rpc('adopt_order_claim', {
              p_order_id: winner.id,
              p_total: total,
            });
            if (adoptError) logDbError('verify-payment:adopt-claim', adoptError);
            if (adopted === true) {
              order = winner;
            } else {
              // Lost the CAS (another attempt adopted or finished it) or the
              // RPC failed: answer from the resulting state and write nothing.
              return answerPolledState(
                supabase,
                await waitForCompletion(supabase, winner.id),
                winner,
                razorpay_payment_id,
                razorpay_order_id,
                orderData,
                'This payment is being processed. Please wait a moment and try again.'
              );
            }
          } else {
            if (winner) {
              await persistCompensation(
                supabase,
                winner.id,
                'claim-total-mismatch',
                `claim total ${winner.total_price} does not match this attempt's ${total}`,
                false
              );
            }
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
      // Compensate only the lines that did decrement, then refund. The refund
      // runs even when restores or the terminal stamp fail.
      const succeeded = orderData.cartItems.filter((_, i) => decrementOk[i]);
      let stockRestoreFailed: unknown = null;
      // Terminal first, then the slow compensation. The stamp is what a
      // concurrent retry for the same payment id has to find, and restoring
      // stock before it left a window in which that retry could adopt the
      // still-'paid' row and re-decrement the stock this path is putting back.
      await persistCompensation(
        supabase,
        orderId,
        'out-of-stock',
        'guarded decrement refused after capture',
        true
      );
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
      const refunded = await refundAndRecord(
        supabase,
        razorpay,
        orderId,
        razorpay_payment_id,
        'insufficient stock after capture'
      );
      // The code is the client's money signal: OUT_OF_STOCK means the payment
      // went back and a fresh checkout is safe, so a failed refund must be
      // named REFUND_FAILED instead — captured money an admin has to
      // reconcile, never a settled answer.
      return NextResponse.json(
        {
          error: refunded
            ? 'Insufficient stock for one or more items. Payment refunded.'
            : 'Insufficient stock for one or more items',
          code: refunded ? 'OUT_OF_STOCK' : 'REFUND_FAILED',
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
      // The row is stamped compensated, never deleted: it is the only
      // server-side record that this payment was refunded, and deleting it let
      // a retry re-claim the payment and mint a second 'paid' order for the
      // same money. The stamp lands before the stock restore so a concurrent
      // retry finds a terminal row, not an item-less one it could adopt. The
      // refund is guaranteed: compensation failures are persisted, never
      // thrown.
      let stockRestoreFailed = false;
      await persistCompensation(
        supabase,
        orderId,
        'line-items-failed',
        'line item insert failed after capture',
        true
      );
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
      } catch (compError) {
        logDbError('verify-payment:compensation', compError);
      }
      const refunded = await refundAndRecord(
        supabase,
        razorpay,
        orderId,
        razorpay_payment_id,
        'line items insert failed after capture'
      );
      return NextResponse.json(
        {
          error: refunded
            ? 'Payment confirmed but order save failed. Payment refunded.'
            : 'Payment confirmed but order save failed',
          // REFUND_FAILED: the row is stamped compensated but the money is
          // still captured — the client must keep the verify body for
          // reconciliation instead of treating this as a finished refund.
          ...(refunded ? {} : { code: 'REFUND_FAILED' }),
          ...(stockRestoreFailed ? { stock_restore_failed: true } : {}),
        },
        { status: 500 }
      );
    }

    // Shipping address: fulfillment has no destination without it. Its insert
    // is a post-payment failure path like line items — a failure restores
    // stock, stamps the undeliverable order compensated (kept, so a replay of
    // the same payment id cannot re-claim it), and refunds.
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
      await persistCompensation(
        supabase,
        orderId,
        'shipping-address-failed',
        'shipping address insert failed after capture',
        true
      );
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
      } catch (compError) {
        logDbError('verify-payment:compensation', compError);
      }
      const refunded = await refundAndRecord(
        supabase,
        razorpay,
        orderId,
        razorpay_payment_id,
        'shipping address insert failed after capture'
      );
      return NextResponse.json(
        {
          error: refunded
            ? 'Payment confirmed but order save failed. Payment refunded.'
            : 'Payment confirmed but order save failed',
          // REFUND_FAILED: the row is stamped compensated but the money is
          // still captured — the client must keep the verify body for
          // reconciliation instead of treating this as a finished refund.
          ...(refunded ? {} : { code: 'REFUND_FAILED' }),
          ...(stockRestoreFailed ? { stock_restore_failed: true } : {}),
        },
        { status: 500 }
      );
    }

    // Behavioral analytics: the revenue end of the checkout funnel, recorded
    // server-side so the value is the server-computed total and the event is
    // authoritative. Placed after every post-payment failure path, so only a
    // checkout that actually completed inserts one; the idempotent replay
    // paths above return early and never reach this, so a reconcile retry
    // cannot double-count. Best-effort: a failure here logs and moves on.
    try {
      const { error: analyticsError } = await supabase.from('analytics_events').insert({
        type: 'order_completed',
        sid: analyticsSid ?? crypto.randomUUID(),
        path: '/checkout',
        props: {
          // The Razorpay payment id (the order row's confirmation_number),
          // named for what it is — no rollup reads this prop today, but the
          // old `order_id` name invited a join against orders.id, which this
          // value is not.
          payment_id: razorpay_payment_id,
          value: total,
          items: orderData.cartItems.reduce(
            (sum: number, line: CartLine) => sum + line.quantity,
            0
          ),
        },
      });
      if (analyticsError) {
        logWarn('verify-payment:analytics', 'INSERT_FAILED', String(analyticsError.message).slice(0, 200));
      }
    } catch (analyticsThrown) {
      logWarn('verify-payment:analytics', 'INSERT_THREW', String(analyticsThrown).slice(0, 200));
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
