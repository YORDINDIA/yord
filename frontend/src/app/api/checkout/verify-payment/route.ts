import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';
import { MAX_ORDER_LINES, MAX_QTY_PER_LINE } from '@/lib/pricing';
import { validateCartLines, type CartLine } from '@/lib/validate-cart';
import { logDbError, logWarn } from '@/lib/logger';
import { EMAIL_RE, clientIp, isRateLimited, rateLimitResponse } from '@/lib/rate-limit';
import { isValidCodeFormat, normalizeCode } from '@/features/quiz/codes';
import { redeemCode, reserveCode } from '@/features/quiz/server/codes';

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
  if (a.address2 !== undefined && (typeof a.address2 !== 'string' || a.address2.length > 500)) {
    return false;
  }
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

type CheckoutLineSnapshot = {
  product_id: number;
  variant_id: number;
  title: string;
  variant_title: string;
  price: number;
  quantity: number;
  requires_shipping: boolean;
  taxable: boolean;
  gift_card: boolean;
};

type CheckoutShippingSnapshot = {
  first_name: string;
  last_name: string;
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string;
};

function cartIdentity(orderData: OrderData) {
  return orderData.cartItems.map((line) => ({
    variant_id: line.variantId,
    quantity: line.quantity,
  }));
}

function shippingSnapshot(orderData: OrderData): CheckoutShippingSnapshot {
  const address = orderData.shippingAddress;
  return {
    first_name: address.firstName,
    last_name: address.lastName,
    address1: address.address1,
    address2: address.address2?.trim() || null,
    city: address.city,
    province: address.state,
    country: address.country,
    zip: address.pincode,
    phone: orderData.phone.trim(),
  };
}

function lineItemSnapshot(
  orderData: OrderData,
  byId: Map<number, {
    product_id: number;
    productTitle: string;
    title: string | null;
    price: number;
  }>
): CheckoutLineSnapshot[] {
  return orderData.cartItems.map((item) => {
    const variant = byId.get(item.variantId)!;
    return {
      product_id: variant.product_id,
      variant_id: item.variantId,
      title: variant.productTitle,
      variant_title: variant.title ?? '',
      price: variant.price,
      quantity: item.quantity,
      requires_shipping: true,
      taxable: true,
      gift_card: false,
    };
  });
}

async function acquireExistingCheckoutClaim(
  supabase: CheckoutSupabase,
  orderId: number,
  ownerToken: string,
  orderData: OrderData
): Promise<{ status: string; lineItems?: CheckoutLineSnapshot[]; shipping?: CheckoutShippingSnapshot }> {
  const { data, error } = await supabase.rpc('acquire_checkout_claim', {
    p_order_id: orderId,
    p_owner_token: ownerToken,
    p_cart_items: cartIdentity(orderData),
    p_shipping: shippingSnapshot(orderData),
    p_lease_seconds: 90,
  });
  if (error) {
    logDbError('verify-payment:claim-acquire', error);
    return { status: 'error' };
  }
  const result = data as {
    status?: unknown;
    line_items?: unknown;
    shipping?: unknown;
  } | null;
  if (!result || typeof result.status !== 'string') return { status: 'error' };
  return {
    status: result.status,
    ...(Array.isArray(result.line_items)
      ? { lineItems: result.line_items as CheckoutLineSnapshot[] }
      : {}),
    ...(result.shipping && typeof result.shipping === 'object'
      ? { shipping: result.shipping as CheckoutShippingSnapshot }
      : {}),
  };
}

// A compensated order is terminal for checkout processing. The cancellation
// marker blocks further stock/order writes even while financial_status remains
// paid because a route-owned refund is pending; replay logic below retries
// only those route-owned refunds.
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

const REFUND_LEASE_MS = 30_000;

function hasRouteRefundMarker(note: string): boolean {
  return note.includes('[checkout-refund pending]') ||
    note.includes('[checkout-refund failed]') ||
    note.includes('[checkout-refund in-flight ') ||
    note.includes(' refund-failed]');
}

// A replay of a compensated payment. Only a route-owned refund marker may
// trigger a refund retry; an admin cancellation is never retried here.
async function answerCompensatedReplay(
  supabase: CheckoutSupabase,
  razorpay: Razorpay,
  orderId: number,
  paymentId: string
): Promise<NextResponse> {
  const { data } = await supabase.from('orders').select('note').eq('id', orderId).maybeSingle();
  const note = (data as { note?: string | null } | null)?.note ?? '';
  if (note.includes('[checkout-refund completed]')) return compensatedReplayResponse();
  const routeOwnedRefund = hasRouteRefundMarker(note);
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    if (payment.status !== 'captured') return compensatedReplayResponse();
    if (!routeOwnedRefund) {
      return NextResponse.json(
        { error: 'This order was cancelled; contact support before retrying payment.', code: 'ORDER_CANCELLED' },
        { status: 409 }
      );
    }
  } catch (fetchError) {
    logDbError('verify-payment:razorpay-fetch', fetchError);
    return NextResponse.json({ error: 'Could not confirm payment' }, { status: 502 });
  }
  const lease = await claimRefundLease(supabase, orderId, note, 'refund retried on replay');
  if (!lease) {
    return NextResponse.json(
      { error: 'Your refund is still being processed. Please try again shortly.', code: 'REFUND_FAILED' },
      { status: 500 }
    );
  }
  if (await refundCapturedPayment(razorpay, paymentId, 'refund retried on replay')) {
    await persistRefundOutcome(supabase, orderId, lease.note, true);
    return compensatedReplayResponse();
  }
  await persistRefundOutcome(supabase, orderId, lease.note, false);
  return NextResponse.json(
    { error: 'Your refund is still being processed. Please contact support.', code: 'REFUND_FAILED' },
    { status: 500 }
  );
}

async function claimRefundLease(
  supabase: CheckoutSupabase,
  orderId: number,
  currentNote: string,
  reason: string
): Promise<{ note: string } | null> {
  const inFlight = [...currentNote.matchAll(/\[checkout-refund in-flight ([^\]]+)\]/g)].at(-1);
  const leaseTimestamp = inFlight ? Date.parse(inFlight[1].trim().split(/\s+/)[0]) : NaN;
  const inFlightIndex = inFlight?.index ?? -1;
  const lastFailureIndex = Math.max(
    currentNote.lastIndexOf('[checkout-refund failed]'),
    currentNote.lastIndexOf(' refund-failed]')
  );
  // A historical failure permits a new retry, but it must not bypass a newer
  // in-flight lease. Outcomes are appended after their lease marker, so only a
  // failure later in the note releases the most recent lease immediately.
  const latestLeaseFailed = lastFailureIndex > inFlightIndex;
  if (
    !latestLeaseFailed &&
    Number.isFinite(leaseTimestamp) &&
    Date.now() - leaseTimestamp < REFUND_LEASE_MS
  ) {
    return null;
  }
  const token = crypto.randomUUID();
  const leaseNote = `${currentNote}\n[checkout-refund in-flight ${new Date().toISOString()} ${token}]`;
  const { data, error } = await supabase
    .from('orders')
    .update({ note: `${leaseNote}\n[checkout-refund reason] ${reason}` })
    .eq('id', orderId)
    .eq('note', currentNote)
    .select('id')
    .maybeSingle();
  if (error || !data) return null;
  return { note: `${leaseNote}\n[checkout-refund reason] ${reason}` };
}

async function persistRefundOutcome(
  supabase: CheckoutSupabase,
  orderId: number,
  leaseNote: string,
  refunded: boolean
): Promise<void> {
  const outcome = refunded ? 'completed' : 'failed';
  const statusNote = `${leaseNote}\n[checkout-refund ${outcome}]`;
  const { error } = await supabase
    .from('orders')
    .update({
      note: statusNote,
      ...(refunded ? { financial_status: 'refunded' } : {}),
    })
    .eq('id', orderId)
    .eq('note', leaseNote);
  if (error) logDbError('verify-payment:refund-stamp', error);
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
  const { data } = await supabase.from('orders').select('note').eq('id', orderId).maybeSingle();
  const note = (data as { note?: string | null } | null)?.note ?? '';
  const lease = await claimRefundLease(supabase, orderId, note, reason);
  if (!lease) return false;
  const refunded = await refundCapturedPayment(razorpay, paymentId, reason);
  await persistRefundOutcome(supabase, orderId, lease.note, refunded);
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
  const { data: existing, error: readError } = await supabase
    .from('order_shipping_addresses')
    .select('order_id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (readError) logDbError('verify-payment:shipping-backfill-read', readError);
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
  if ((error as { code?: string } | null)?.code === '23505') {
    const { data: racedAddress, error: racedReadError } = await supabase
      .from('order_shipping_addresses')
      .select('order_id')
      .eq('order_id', orderId)
      .maybeSingle();
    if (racedReadError) logDbError('verify-payment:shipping-backfill-read', racedReadError);
    return Boolean(racedAddress);
  }
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
  razorpay: Razorpay,
  state: 'complete' | 'no_address' | 'incomplete' | 'terminal',
  order: ClaimOrder,
  paymentId: string,
  razorpayOrderId: string,
  orderData: OrderData | null,
  incompleteError: string
): Promise<NextResponse> {
  if (state === 'terminal') {
    return answerCompensatedReplay(supabase, razorpay, order.id, paymentId);
  }
  if (state === 'complete') {
    return successBody(paymentId, razorpayOrderId, order, {
      message: 'Payment already recorded',
    });
  }
  if (
    state === 'no_address' &&
    orderData &&
    (await backfillShippingAddress(supabase, order.id, orderData))
  ) {
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    const analyticsSid =
      typeof body.analyticsSid === 'string' && ANALYTICS_SID_SHAPE.test(body.analyticsSid)
        ? body.analyticsSid
        : null;
    // A promo code is only ever a hint here: the discount this attempt charges
    // comes from the reservation below, and a code that is spent, expired or
    // unknown simply means the undiscounted total is recomputed and the
    // captured amount no longer matches — which refunds, as it must.
    const requestedCode =
      typeof body.code === 'string' && isValidCodeFormat(body.code) ? normalizeCode(body.code) : null;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 });
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

    // Idempotency with completion state, BEFORE the cart and amount checks: a
    // replay of a recorded payment is answered from its order row, never
    // re-validated against today's stock and prices (the first attempt took
    // the last units, or a price changed since — either would refund money
    // for an order that stands). The payment id is stored in
    // confirmation_number; a row counts only once its line items commit (a
    // bare row is an in-flight claim), and a compensated row is terminal.
    const { data: preExisting } = await supabase
      .from('orders')
      .select('id, name, total_price, financial_status, cancelled_at')
      .eq('confirmation_number', razorpay_payment_id)
      .maybeSingle();
    const found = (preExisting as ClaimOrder | null) ?? null;
    const validOrderData: OrderData | null = isValidOrderData(body.orderData) ? body.orderData : null;
    if (found) {
      if (isCompensatedOrder(found)) {
        return answerCompensatedReplay(supabase, razorpay, found.id, razorpay_payment_id);
      }
      const state = await waitForCompletion(supabase, found.id);
      if (state !== 'incomplete') {
        return answerPolledState(
          supabase,
          razorpay,
          state,
          found,
          razorpay_payment_id,
          razorpay_order_id,
          validOrderData,
          'A previous attempt left this payment incomplete. Please wait a moment and try again.'
        );
      }
    }

    // Confirm capture before cart validation: cart state may have changed
    // after the gateway captured money, and every validation rejection must
    // refund that capture before it can be called settled by the client.
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

    const ownerToken = crypto.randomUUID();
    let order: ClaimOrder | null = null;
    let persistedLineItems: CheckoutLineSnapshot[] | null = null;
    let persistedShipping: CheckoutShippingSnapshot | null = null;
    // Promo state for THIS attempt. Only a brand-new claim sets these: a
    // recovered claim keeps its stored `total_price`, which already carries the
    // discount the first attempt applied, so re-deriving it here would either
    // double-apply or fight the snapshot.
    let reservedCode: string | null = null;
    let discountAmount = 0;
    let discountPercent = 0;

    if (found) {
      // Existing claims use their immutable server snapshot. Do not validate
      // today's catalog or let a changed client payload trigger a refund
      // against a live owner's captured payment.
      if (!validOrderData) {
        return NextResponse.json(
          { error: 'This payment is still being processed.', code: 'ORDER_INCOMPLETE' },
          { status: 409 }
        );
      }
      const claim = await acquireExistingCheckoutClaim(supabase, found.id, ownerToken, validOrderData);
      if (claim.status === 'completed') {
        return successBody(razorpay_payment_id, razorpay_order_id, found, {
          message: 'Payment already recorded',
        });
      }
      if (claim.status === 'compensated') {
        return answerCompensatedReplay(supabase, razorpay, found.id, razorpay_payment_id);
      }
      if (
        claim.status !== 'owned' ||
        !claim.lineItems ||
        !claim.shipping
      ) {
        return NextResponse.json(
          {
            error: 'A previous attempt is still processing this payment. Please retry shortly.',
            code: 'ORDER_INCOMPLETE',
          },
          { status: 409 }
        );
      }
      order = found;
      persistedLineItems = claim.lineItems;
      persistedShipping = claim.shipping;

      if (
        paymentCurrency !== 'INR' ||
        paymentAmount !== Math.round(Number(found.total_price) * 100)
      ) {
        const { data: compensation, error: compensationError } = await supabase.rpc(
          'compensate_checkout_order',
          {
            p_order_id: found.id,
            p_owner_token: ownerToken,
            p_reason: 'captured payment does not match the stored order total',
          }
        );
        const compensationStatus = (compensation as { status?: string } | null)?.status;
        if (compensationError || compensationStatus !== 'compensated') {
          logDbError('verify-payment:claim-compensation', compensationError ?? compensation);
          return NextResponse.json(
            { error: 'This payment is still being processed.', code: 'ORDER_INCOMPLETE' },
            { status: 409 }
          );
        }
        const refunded = await refundAndRecord(
          supabase,
          razorpay,
          found.id,
          razorpay_payment_id,
          'stored order amount mismatch after capture'
        );
        return NextResponse.json(
          {
            error: refunded
              ? 'Paid amount does not match order total. Payment refunded.'
              : 'Paid amount does not match order total',
            code: refunded ? 'AMOUNT_MISMATCH' : 'REFUND_FAILED',
          },
          { status: refunded ? 402 : 500 }
        );
      }
    }

    if (!validOrderData) {
      const refunded = await refundCapturedPayment(
        razorpay,
        razorpay_payment_id,
        'invalid order data after capture'
      );
      return NextResponse.json(
        {
          error: refunded ? 'Invalid order data. Payment refunded.' : 'Invalid order data',
          code: refunded ? 'UNKNOWN_VARIANT' : 'REFUND_FAILED',
        },
        { status: refunded ? 400 : 500 }
      );
    }
    const orderData = validOrderData;

    if (!order) {
      // Reserve the promo code BEFORE pricing, because the reservation is what
      // decides whether this attempt may charge the discounted amount at all.
      // `reserve_quiz_code` is a compare-and-swap: it succeeds for a free code
      // and for one this same Razorpay order already holds (so a retry is
      // idempotent) and fails for a code someone else has spent or is spending.
      //
      // A failure is not an error response. The code is dropped, the cart is
      // priced at full price, and the amount comparison below sees the
      // discounted capture and refunds it — the shopper is told the code could
      // not be used instead of being charged less than the order records.
      if (requestedCode) {
        const reservation = await reserveCode(supabase, requestedCode, razorpay_order_id);
        if (reservation.ok) {
          reservedCode = requestedCode;
          discountPercent = reservation.percent;
        } else {
          logWarn(
            'verify-payment',
            'CODE_NOT_RESERVED',
            `code=${requestedCode} reason=${reservation.reason}`
          );
        }
      }

      // New claims validate against current catalog data. Recovered claims
      // instead use their immutable database snapshots above; current stock
      // has already been decremented for any ledger entries marked applied.
      // Authoritative pricing comes from the DB, never the client payload.
      const validated = await validateCartLines(supabase, orderData.cartItems, discountPercent);
      if (!validated.ok) {
        logWarn('verify-payment', validated.code, validated.error);
        const reason = `cart validation failed after capture: ${validated.code}`;
        const refunded = await refundCapturedPayment(razorpay, razorpay_payment_id, reason);
        return NextResponse.json(
          {
            error: refunded ? `${validated.error}. Payment refunded.` : validated.error,
            code: refunded ? validated.code : 'REFUND_FAILED',
          },
          { status: refunded ? validated.status : 500 }
        );
      }
      const { subtotal, discountAmount: appliedDiscount, gstAmount, total, totalPaise, byId } =
        validated;
      discountAmount = appliedDiscount;

      // The captured amount must equal what this attempt just priced. When a
      // code failed to reserve, this is where the discounted capture is caught:
      // the message names the code so the shopper knows what went wrong rather
      // than reading a bare amount mismatch.
      if (paymentCurrency !== 'INR' || paymentAmount !== totalPaise) {
        const reason = requestedCode
          ? `amount mismatch after code ${requestedCode} could not be applied: paid ${paymentAmount} ${paymentCurrency}, expected ${totalPaise} INR`
          : `amount mismatch: paid ${paymentAmount} ${paymentCurrency}, expected ${totalPaise} INR`;
        const refunded = await refundCapturedPayment(razorpay, razorpay_payment_id, reason);
        return NextResponse.json(
          {
            error: refunded
              ? requestedCode
                ? 'That code could not be applied, so the price changed. Payment refunded — please try again.'
                : 'Paid amount does not match order total. Payment refunded.'
              : 'Paid amount does not match order total',
            code: refunded ? 'AMOUNT_MISMATCH' : 'REFUND_FAILED',
          },
          { status: refunded ? 402 : 500 }
        );
      }

      const currentLineItems = lineItemSnapshot(orderData, byId);
      const currentShipping = shippingSnapshot(orderData);
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
            code: refunded ? 'ORDER_NUMBER_OVERFLOW' : 'REFUND_FAILED',
          },
          { status: 500 }
        );
      }

      const { data: createdId, error: createError } = await supabase.rpc(
        'create_checkout_claim',
        {
          p_name: identity.orderName,
          p_order_number: identity.uniqueOrderNumber,
          p_email: orderData.email.toLowerCase().trim(),
          p_phone: orderData.phone.trim(),
          p_currency: 'INR',
          p_total: total,
          p_subtotal: subtotal,
          p_tax: gstAmount,
          p_confirmation_number: razorpay_payment_id,
          p_payment_order_id: razorpay_order_id,
          p_owner_token: ownerToken,
          p_line_items: currentLineItems,
          p_shipping: currentShipping,
          p_lease_seconds: 90,
        }
      );
      if (createError) {
        logDbError('verify-payment:order-claim', createError);
        // A failed HTTP/RPC response is ambiguous: PostgreSQL may have
        // committed the claim before the connection dropped. Preserve the
        // payment for a replay instead of refunding a possibly live owner.
        return NextResponse.json(
          {
            error: 'This payment is still being processed. Please retry shortly.',
            code: 'ORDER_INCOMPLETE',
          },
          { status: 409 }
        );
      }

      if (createdId !== null) {
        order = {
          id: Number(createdId),
          name: identity.orderName,
          total_price: total,
          financial_status: 'paid',
          cancelled_at: null,
        };
        persistedLineItems = currentLineItems;
        persistedShipping = currentShipping;
      } else {
        const { data: racedOrder, error: racedOrderError } = await supabase
          .from('orders')
          .select('id, name, total_price, financial_status, cancelled_at')
          .eq('confirmation_number', razorpay_payment_id)
          .maybeSingle();
        if (racedOrderError) {
          logDbError('verify-payment:order-claim-read', racedOrderError);
          return NextResponse.json(
            { error: 'This payment is still being processed.', code: 'ORDER_INCOMPLETE' },
            { status: 409 }
          );
        }
        const winner = (racedOrder as ClaimOrder | null) ?? null;
        if (!winner) {
          return NextResponse.json(
            { error: 'This payment is still being processed.', code: 'ORDER_INCOMPLETE' },
            { status: 409 }
          );
        }
        if (isCompensatedOrder(winner)) {
          return answerCompensatedReplay(supabase, razorpay, winner.id, razorpay_payment_id);
        }
        const claim = await acquireExistingCheckoutClaim(
          supabase,
          winner.id,
          ownerToken,
          orderData
        );
        if (claim.status === 'completed') {
          return successBody(razorpay_payment_id, razorpay_order_id, winner, {
            message: 'Payment already recorded',
          });
        }
        if (claim.status === 'compensated') {
          return answerCompensatedReplay(supabase, razorpay, winner.id, razorpay_payment_id);
        }
        if (claim.status !== 'owned' || !claim.lineItems || !claim.shipping) {
          return NextResponse.json(
            { error: 'A previous attempt is still processing this payment.', code: 'ORDER_INCOMPLETE' },
            { status: 409 }
          );
        }
        if (
          paymentCurrency !== 'INR' ||
          paymentAmount !== Math.round(Number(winner.total_price) * 100)
        ) {
          return NextResponse.json(
            { error: 'A previous attempt is still processing this payment.', code: 'ORDER_INCOMPLETE' },
            { status: 409 }
          );
        }
        order = winner;
        persistedLineItems = claim.lineItems;
        persistedShipping = claim.shipping;
      }
    }

    if (!order || !persistedLineItems || !persistedShipping) {
      logDbError('verify-payment:order-claim', 'claim resolved without its durable snapshots');
      return NextResponse.json(
        { error: 'This payment is still being processed.', code: 'ORDER_INCOMPLETE' },
        { status: 409 }
      );
    }
    const orderId = order.id;
    const orderTotal = Number(order.total_price);

    // The database ledger makes every line operation idempotent by order and
    // cart position. Lease loss or an ambiguous transport result is unresolved:
    // preserve the captured payment for retry rather than refunding a live owner.
    const stockResults = await Promise.allSettled(
      persistedLineItems.map((_, lineNumber) =>
        supabase.rpc('apply_checkout_stock', {
          p_order_id: orderId,
          p_owner_token: ownerToken,
          p_line_number: lineNumber,
          p_lease_seconds: 90,
        })
      )
    );
    const stockStates = stockResults.map((result) =>
      result.status === 'fulfilled' && !result.value.error
        ? String(result.value.data)
        : 'unknown'
    );

    if (stockStates.includes('not_owner') || stockStates.includes('unknown')) {
      const firstFailure = stockResults.find(
        (result) => result.status === 'rejected' || (result.status === 'fulfilled' && result.value.error)
      );
      if (firstFailure?.status === 'rejected') {
        logDbError('verify-payment:stock-apply', firstFailure.reason);
      } else if (firstFailure?.status === 'fulfilled') {
        logDbError('verify-payment:stock-apply', firstFailure.value.error);
      }
      return NextResponse.json(
        { error: 'This payment is still being processed. Please retry shortly.', code: 'ORDER_INCOMPLETE' },
        { status: 409 }
      );
    }

    if (stockStates.includes('unavailable')) {
      const { data: compensation, error: compensationError } = await supabase.rpc(
        'compensate_checkout_order',
        {
          p_order_id: orderId,
          p_owner_token: ownerToken,
          p_reason: 'insufficient stock after capture',
        }
      );
      const compensationResult = compensation as {
        status?: string;
        restore_ok?: boolean;
        missing_lines?: number;
      } | null;
      if (compensationError || compensationResult?.status !== 'compensated') {
        logDbError('verify-payment:stock-compensation', compensationError ?? compensation);
        return NextResponse.json(
          { error: 'This payment is still being processed. Please retry shortly.', code: 'ORDER_INCOMPLETE' },
          { status: 409 }
        );
      }
      if (compensationResult.restore_ok === false) {
        logDbError(
          'verify-payment:stock-restore',
          `order=${orderId} missing_lines=${compensationResult.missing_lines ?? 'unknown'}`
        );
      }
      const refunded = await refundAndRecord(
        supabase,
        razorpay,
        orderId,
        razorpay_payment_id,
        'insufficient stock after capture'
      );
      return NextResponse.json(
        {
          error: refunded
            ? 'Insufficient stock for one or more items. Payment refunded.'
            : 'Insufficient stock for one or more items',
          code: refunded ? 'OUT_OF_STOCK' : 'REFUND_FAILED',
          ...(compensationResult.restore_ok === false ? { stock_restore_failed: true } : {}),
        },
        { status: refunded ? 409 : 500 }
      );
    }

    const { data: completion, error: completionError } = await supabase.rpc(
      'complete_checkout_order',
      {
        p_order_id: orderId,
        p_owner_token: ownerToken,
        p_line_items: persistedLineItems,
        p_shipping: persistedShipping,
      }
    );
    if (completionError) {
      logDbError('verify-payment:checkout-complete', completionError);
      return NextResponse.json(
        { error: 'This payment is still being processed. Please retry shortly.', code: 'ORDER_INCOMPLETE' },
        { status: 409 }
      );
    }
    const completionStatus = String(completion);
    if (completionStatus === 'write_failed') {
      const { data: compensation, error: compensationError } = await supabase.rpc(
        'compensate_checkout_order',
        {
          p_order_id: orderId,
          p_owner_token: ownerToken,
          p_reason: 'transactional order finalization failed',
        }
      );
      const compensationResult = compensation as {
        status?: string;
        restore_ok?: boolean;
        missing_lines?: number;
      } | null;
      if (compensationError || compensationResult?.status !== 'compensated') {
        logDbError('verify-payment:finalize-compensation', compensationError ?? compensation);
        return NextResponse.json(
          { error: 'This payment is still being processed. Please retry shortly.', code: 'ORDER_INCOMPLETE' },
          { status: 409 }
        );
      }
      const refunded = await refundAndRecord(
        supabase,
        razorpay,
        orderId,
        razorpay_payment_id,
        'transactional order finalization failed'
      );
      return NextResponse.json(
        {
          error: refunded
            ? 'Payment confirmed but order save failed. Payment refunded.'
            : 'Payment confirmed but order save failed',
          code: refunded ? 'ORDER_REFUNDED' : 'REFUND_FAILED',
          ...(compensationResult.restore_ok === false ? { stock_restore_failed: true } : {}),
        },
        { status: 500 }
      );
    }
    if (completionStatus !== 'completed' && completionStatus !== 'already_completed') {
      return NextResponse.json(
        { error: 'This payment is still being processed. Please retry shortly.', code: 'ORDER_INCOMPLETE' },
        { status: 409 }
      );
    }

    // Record the promo discount on the order, then spend the code.
    //
    // Every step here is best-effort on purpose: the order is committed and the
    // money is taken, so failing the response would cost the shopper a
    // confirmation screen to fix a bookkeeping row. The three writes are
    // independent — a failed `order_discount_codes` insert must not stop the
    // code from being marked spent, or a redeemed code would look unused and
    // could be spent a second time.
    //
    // Gated on `reservedCode`, which only the new-claim path sets, so an
    // idempotent replay (which returns earlier anyway) can never write a second
    // discount row for the same order.
    if (completionStatus === 'completed' && reservedCode && discountAmount > 0) {
      // The order summary in the admin reads `total_discounts`. The claim RPC
      // does not write it, so without this the row shows a subtotal, zero
      // discounts and a smaller total — arithmetic that does not add up for
      // whoever reconciles it. Derived from the same server-computed amount the
      // discount-code row below carries, so the two can never disagree.
      const { error: orderDiscountError } = await supabase
        .from('orders')
        .update({ total_discounts: discountAmount })
        .eq('id', orderId);
      if (orderDiscountError) {
        logDbError('verify-payment:order-discount', orderDiscountError);
      }

      const { error: codeRowError } = await supabase.from('order_discount_codes').insert({
        order_id: orderId,
        code: reservedCode,
        type: 'percentage',
        amount: discountAmount,
      });
      if (codeRowError) {
        logDbError('verify-payment:discount-code-row', codeRowError);
      }

      const { error: applicationError } = await supabase.from('discount_applications').insert({
        order_id: orderId,
        index: 0,
        type: 'discount_code',
        code: reservedCode,
        title: 'Aura quiz reward',
        description: `${discountPercent}% off from the Diljit Aura quiz`,
        // Shopify's shape: `value` is a string and `value_type` says how to read
        // it, so a percentage code and a fixed-amount code share one column set.
        value: String(discountPercent),
        value_type: 'percentage',
        allocation_method: 'across',
        target_selection: 'all',
        target_type: 'line_item',
      });
      if (applicationError) {
        logDbError('verify-payment:discount-application', applicationError);
      }

      const redeemed = await redeemCode(
        supabase,
        reservedCode,
        razorpay_order_id,
        orderId,
        orderData.email
      );
      if (!redeemed) {
        // The order stands; the code stays reserved rather than spent. Logged
        // loudly because the shopper has had the discount without the code
        // being consumed, so a second use is possible until it is reconciled.
        logWarn(
          'verify-payment',
          'CODE_NOT_REDEEMED',
          `code=${reservedCode} order=${orderId} payment=${razorpay_payment_id}`
        );
      }
    }

    // Behavioral analytics: the revenue end of the checkout funnel, recorded
    // server-side so the value is the server-computed total and the event is
    // authoritative. Placed after every post-payment failure path, so only a
    // checkout that actually completed inserts one; the idempotent replay
    // paths above return early and never reach this, so a reconcile retry
    // cannot double-count. Best-effort: a failure here logs and moves on.
    if (completionStatus === 'completed') {
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
          value: orderTotal,
          items: orderData.cartItems.reduce(
            (sum: number, line: CartLine) => sum + line.quantity,
            0
          ),
          // Absent rather than 0 on an order with no code: a zero here would
          // read as "a promo was applied and it was worth nothing".
          ...(discountAmount > 0 ? { discount: discountAmount } : {}),
        },
        });
        if (analyticsError) {
          logWarn('verify-payment:analytics', 'INSERT_FAILED', String(analyticsError.message).slice(0, 200));
        }
      } catch (analyticsThrown) {
        logWarn('verify-payment:analytics', 'INSERT_THREW', String(analyticsThrown).slice(0, 200));
      }
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
