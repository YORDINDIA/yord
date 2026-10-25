// Money-path regression tests for the post-capture compensation path in
// `app/api/checkout/verify-payment/route.ts`.
//
// The route module is imported for real. Only its network collaborators are
// faked: `razorpay` (a captured payment that can be refunded) and
// `@supabase/supabase-js` (an in-memory orders / line_items / stock store that
// enforces the unique `confirmation_number` index the route relies on for
// idempotency). `validateCartLines` is stubbed as a collaborator: the cart
// rules have their own suite and are being changed independently, and the
// subject here is what happens *after* the money is captured.
//
// The bug these pin down: every post-capture failure used to refund the
// payment and then delete the order row. The client retries the identical
// body (same razorpay_payment_id) after a timeout, so a retry landing after
// the compensation found no row, re-claimed the payment (no 23505 left to
// lose), re-decremented the just-restored stock, and answered 200 — leaving
// the money refunded AND a 'paid' order in the database.

import crypto from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/checkout/verify-payment/route';

type Row = Record<string, unknown>;

const h = vi.hoisted(() => {
  interface Variant {
    id: number;
    price: number;
    inventory_quantity: number;
  }
  interface Payment {
    status: string;
    amount: number;
    currency: string;
    order_id: string;
  }

  const state = {
    orders: [] as Row[],
    lineItems: [] as Row[],
    shipping: [] as Row[],
    analytics: [] as Row[],
    refunds: [] as string[],
    claims: new Map<number, Row>(),
    stockOperations: new Map<string, Row>(),
    variants: new Map<number, Variant>(),
    payments: new Map<string, Payment>(),
    raceStock: new Set<number>(),
    /**
     * `quiz_codes` rows, keyed by code. The reservation rules live in the
     * `reserve_quiz_code` fake below, mirroring the compare-and-swap in
     * migration 018: free or held-by-this-same-payment reserves, anything else
     * does not.
     */
    quizCodes: new Map<string, Row>(),
    orderDiscountCodes: [] as Row[],
    discountApplications: [] as Row[],
    /** Every `reserve_quiz_code` call, so the tests can pin the arguments. */
    reservations: [] as Row[],
    nextOrderId: 1,
    hideNextLookup: false,
    races: 0,
    refundCalls: 0,
    refundGate: null as null | {
      started: () => void;
      startedPromise: Promise<void>;
      release: () => void;
      wait: Promise<void>;
    },
    fail: {
      lineItems: false,
      shipping: false,
      shippingRace: false,
      restore: false,
      restoreEmpty: false,
      refund: false,
    },
  };

  // PostgREST projects the selected columns and returns SQL NULL for a column
  // the insert never set — `undefined` would make every fresh 'paid' row look
  // compensated (cancelled_at !== null).
  function pick(row: Row, cols: string): Row {
    const out: Row = {};
    for (const col of cols.split(',').map((c) => c.trim())) out[col] = row[col] ?? null;
    return out;
  }

  function selectResult(table: string, cols: string, filters: [string, unknown][]) {
    if (table === 'orders') {
      // `hideNextLookup` simulates the winner inserting its row between this
      // attempt's idempotency lookup and its own insert: the lookup misses,
      // the insert loses the unique-index race.
      if (filters.some(([col]) => col === 'confirmation_number') && state.hideNextLookup) {
        state.hideNextLookup = false;
        return { data: null, error: null };
      }
      const row = state.orders.find((o) => filters.every(([col, value]) => o[col] === value));
      return { data: row ? pick(row, cols) : null, error: null };
    }
    if (table === 'line_items') {
      const count = state.lineItems.filter((li) => li.order_id === filters[0]?.[1]).length;
      return { count, error: null };
    }
    if (table === 'order_shipping_addresses') {
      // Serves both readers: the completion check destructures `count`, the
      // address backfill's existence probe destructures `data` via
      // maybeSingle.
      const rows = state.shipping.filter((s) => s.order_id === filters[0]?.[1]);
      return { count: rows.length, data: rows[0] ? pick(rows[0], cols) : null, error: null };
    }
    throw new Error(`unexpected select on ${table}`);
  }

  function insertResult(table: string, rows: Row | Row[]) {
    const list = Array.isArray(rows) ? rows : [rows];
    if (table === 'orders') {
      const row = list[0];
      if (state.orders.some((o) => o.confirmation_number === row.confirmation_number)) {
        state.races += 1;
        return {
          data: null,
          error: {
            code: '23505',
            message: 'duplicate key value violates unique constraint "orders_confirmation_number_uidx"',
          },
        };
      }
      const created: Row = { id: state.nextOrderId++, ...row };
      state.orders.push(created);
      return { data: created, error: null };
    }
    if (table === 'line_items') {
      if (state.fail.lineItems) {
        return { data: null, error: { code: '23503', message: 'line item insert failed' } };
      }
      state.lineItems.push(...list);
      return { data: null, error: null };
    }
    if (table === 'order_shipping_addresses') {
      if (state.fail.shippingRace) {
        state.fail.shippingRace = false;
        state.shipping.push({ order_id: list[0].order_id });
        return {
          data: null,
          error: { code: '23505', message: 'duplicate shipping address' },
        };
      }
      if (state.fail.shipping) {
        return { data: null, error: { code: '23503', message: 'shipping address insert failed' } };
      }
      state.shipping.push(...list);
      return { data: null, error: null };
    }
    if (table === 'analytics_events') {
      state.analytics.push(...list);
      return { data: null, error: null };
    }
    if (table === 'order_discount_codes') {
      state.orderDiscountCodes.push(...list);
      return { data: null, error: null };
    }
    if (table === 'discount_applications') {
      state.discountApplications.push(...list);
      return { data: null, error: null };
    }
    throw new Error(`unexpected insert on ${table}`);
  }

  const chain = {
    from(table: string) {
      return {
        select: (cols: string) => ({
          eq: (col: string, value: unknown) => {
            const result = selectResult(table, cols, [[col, value]]);
            const run = () => Promise.resolve(result);
            return {
              then: (onFulfilled?: (v: unknown) => unknown) => run().then(onFulfilled),
              maybeSingle: run,
              single: run,
            };
          },
        }),
        insert: (rows: Row | Row[]) => {
          const outcome = insertResult(table, rows) as { data: Row | null; error: unknown };
          const run = () => Promise.resolve(outcome);
          const projected = (cols: string) =>
            outcome.error || !outcome.data ? run() : Promise.resolve({ data: pick(outcome.data, cols), error: null });
          return {
            then: (onFulfilled?: (v: unknown) => unknown) => run().then(onFulfilled),
            select: (cols: string) => ({ single: () => projected(cols), maybeSingle: () => projected(cols) }),
          };
        },
        update: (patch: Row) => {
          if (table !== 'orders' && table !== 'quiz_codes') {
            throw new Error(`unexpected update on ${table}`);
          }
          const filters: [string, unknown][] = [];
          // `redeemCode` ends in `.select('id')` and reads an array; the route's
          // `orders` update awaits the builder directly and reads an object.
          let projected = false;
          const run = () => {
            const row =
              table === 'quiz_codes'
                ? state.quizCodes.get(String(filters.find(([column]) => column === 'code')?.[1] ?? ''))
                : state.orders.find((candidate) =>
                    filters.every(([column, value]) => candidate[column] === value)
                  );
            // A miss is SQL NULL in every shape. Returning `[]` for a projected
            // miss would be a *truthy* empty array, and `claimRefundLease` reads
            // falsiness to mean "another attempt took the lease" — so the fake
            // would hand two concurrent replays the same lease.
            if (!row) return Promise.resolve({ data: null, error: null });
            const matches = filters.every(([column, value]) => (row[column] ?? null) === value);
            if (!matches) return Promise.resolve({ data: null, error: null });
            Object.assign(row, patch);
            return Promise.resolve({
              data: projected ? [{ id: row.id }] : { id: row.id },
              error: null,
            });
          };
          const builder = {
            eq: (col: string, value: unknown) => {
              filters.push([col, value]);
              return builder;
            },
            is: (col: string, value: unknown) => {
              filters.push([col, value]);
              return builder;
            },
            select: () => {
              projected = true;
              return builder;
            },
            maybeSingle: run,
            then: (onFulfilled?: (v: unknown) => unknown) => run().then(onFulfilled),
          };
          return builder;
        },
      };
    },
    rpc(name: string, args: Record<string, unknown>) {
      if (name === 'create_checkout_claim') {
        const confirmation = args.p_confirmation_number;
        if (state.orders.some((order) => order.confirmation_number === confirmation)) {
          state.races += 1;
          return Promise.resolve({ data: null, error: null });
        }
        const id = state.nextOrderId++;
        const created: Row = {
          id,
          name: args.p_name,
          total_price: args.p_total,
          financial_status: 'paid',
          cancelled_at: null,
          confirmation_number: confirmation,
          note: '',
        };
        state.orders.push(created);
        state.claims.set(id, {
          status: 'active',
          owner_token: args.p_owner_token,
          expires_at: Date.now() + Number(args.p_lease_seconds) * 1000,
          total: args.p_total,
          lines: args.p_line_items,
          shipping: args.p_shipping,
        });
        const lines = args.p_line_items as Row[];
        lines.forEach((line, line_number) => {
          state.stockOperations.set(`${id}:${line_number}`, {
            decrement_state: 'pending',
            restore_state: 'pending',
            variant_id: line.variant_id,
            quantity: line.quantity,
          });
        });
        return Promise.resolve({ data: id, error: null });
      }
      if (name === 'acquire_checkout_claim') {
        const orderId = Number(args.p_order_id);
        const row = state.orders.find((order) => order.id === orderId);
        if (!row) return Promise.resolve({ data: { status: 'missing' }, error: null });
        let claim = state.claims.get(orderId);
        if (!claim) {
          claim = { status: 'legacy_blocked' };
          state.claims.set(orderId, claim);
        }
        if (claim.status !== 'active') {
          return Promise.resolve({ data: { status: claim.status }, error: null });
        }
        if (Number(claim.total) !== Number(row.total_price)) {
          return Promise.resolve({ data: { status: 'payload_mismatch' }, error: null });
        }
        const lines = claim.lines as Row[];
        const cartIdentity = lines.map((line) => ({
          variant_id: line.variant_id,
          quantity: line.quantity,
        }));
        if (
          JSON.stringify(cartIdentity) !== JSON.stringify(args.p_cart_items) ||
          JSON.stringify(claim.shipping) !== JSON.stringify(args.p_shipping)
        ) {
          return Promise.resolve({ data: { status: 'payload_mismatch' }, error: null });
        }
        if (
          Number(claim.expires_at) > Date.now() &&
          claim.owner_token !== args.p_owner_token
        ) {
          return Promise.resolve({ data: { status: 'busy' }, error: null });
        }
        claim.owner_token = args.p_owner_token;
        claim.expires_at = Date.now() + Number(args.p_lease_seconds) * 1000;
        return Promise.resolve({
          data: { status: 'owned', line_items: claim.lines, shipping: claim.shipping },
          error: null,
        });
      }
      if (name === 'apply_checkout_stock') {
        const orderId = Number(args.p_order_id);
        const claim = state.claims.get(orderId);
        if (
          !claim ||
          claim.status !== 'active' ||
          claim.owner_token !== args.p_owner_token ||
          Number(claim.expires_at) <= Date.now()
        ) {
          return Promise.resolve({ data: 'not_owner', error: null });
        }
        const key = `${orderId}:${Number(args.p_line_number)}`;
        const operation = state.stockOperations.get(key);
        if (!operation) return Promise.resolve({ data: 'invalid_line', error: null });
        if (operation.decrement_state === 'applied') {
          claim.expires_at = Date.now() + 90_000;
          return Promise.resolve({ data: 'applied', error: null });
        }
        if (operation.decrement_state === 'unavailable') {
          return Promise.resolve({ data: 'unavailable', error: null });
        }
        const variant = state.variants.get(Number(operation.variant_id));
        if (
          !variant ||
          state.raceStock.has(variant.id) ||
          variant.inventory_quantity < Number(operation.quantity)
        ) {
          operation.decrement_state = 'unavailable';
          return Promise.resolve({ data: 'unavailable', error: null });
        }
        variant.inventory_quantity -= Number(operation.quantity);
        operation.decrement_state = 'applied';
        claim.expires_at = Date.now() + 90_000;
        return Promise.resolve({ data: 'applied', error: null });
      }
      if (name === 'compensate_checkout_order') {
        const orderId = Number(args.p_order_id);
        const claim = state.claims.get(orderId);
        const order = state.orders.find((candidate) => candidate.id === orderId);
        if (!claim || !order) return Promise.resolve({ data: { status: 'missing' }, error: null });
        if (claim.status === 'compensated') {
          return Promise.resolve({ data: { status: 'compensated', restore_ok: true }, error: null });
        }
        if (
          claim.status !== 'active' ||
          claim.owner_token !== args.p_owner_token ||
          Number(claim.expires_at) <= Date.now()
        ) {
          return Promise.resolve({ data: { status: 'not_owner' }, error: null });
        }
        let missing = 0;
        for (const [key, operation] of state.stockOperations) {
          if (!key.startsWith(`${orderId}:`) || operation.decrement_state !== 'applied' || operation.restore_state !== 'pending') continue;
          const variant = state.variants.get(Number(operation.variant_id));
          if (!variant || state.fail.restore || state.fail.restoreEmpty) {
            operation.restore_state = 'missing';
            missing += 1;
          } else {
            variant.inventory_quantity += Number(operation.quantity);
            operation.restore_state = 'restored';
          }
        }
        claim.status = 'compensated';
        claim.owner_token = null;
        claim.expires_at = null;
        order.cancelled_at = new Date().toISOString();
        order.note = `${String(order.note ?? '')}\n[stock-compensation checkout-compensated] ${
          missing ? 'restore-failed: missing stock row' : 'stock restored'
        }\n[checkout-refund pending]`;
        return Promise.resolve({
          data: { status: 'compensated', restore_ok: missing === 0, missing_lines: missing },
          error: null,
        });
      }
      if (name === 'complete_checkout_order') {
        const orderId = Number(args.p_order_id);
        const claim = state.claims.get(orderId);
        const order = state.orders.find((candidate) => candidate.id === orderId);
        if (!claim || !order) return Promise.resolve({ data: 'missing', error: null });
        if (claim.status === 'completed') return Promise.resolve({ data: 'already_completed', error: null });
        if (
          claim.status !== 'active' ||
          claim.owner_token !== args.p_owner_token ||
          Number(claim.expires_at) <= Date.now()
        ) {
          return Promise.resolve({ data: 'not_owner', error: null });
        }
        if (state.fail.lineItems || state.fail.shipping) {
          return Promise.resolve({ data: 'write_failed', error: null });
        }
        state.lineItems.push(
          ...(args.p_line_items as Row[]).map((line) => ({ order_id: orderId, ...line }))
        );
        if (state.fail.shippingRace) {
          state.fail.shippingRace = false;
          state.shipping.push({ order_id: orderId, ...(args.p_shipping as Row) });
        } else if (!state.shipping.some((address) => address.order_id === orderId)) {
          state.shipping.push({ order_id: orderId, ...(args.p_shipping as Row) });
        }
        claim.status = 'completed';
        claim.owner_token = null;
        claim.expires_at = null;
        order.financial_status = 'paid';
        return Promise.resolve({ data: 'completed', error: null });
      }
      if (name === 'adopt_order_claim') {
        return Promise.resolve({ data: false, error: null });
      }
      if (name === 'decrement_variant_stock') {
        return Promise.resolve({ data: [], error: null });
      }
      if (name === 'reserve_quiz_code') {
        // Mirrors the compare-and-swap in `018_quiz_codes.sql`: the write lands
        // only while the row is still spendable at the instant of the write.
        // `reserved_for = p_reservation` is the arm that lets a retry re-take
        // its own hold, which is what makes a verify replay idempotent.
        const code = String(args.p_code);
        const reservation = String(args.p_reservation);
        state.reservations.push({ code, reservation, endsAt: args.p_ends_at });
        const row = state.quizCodes.get(code);
        if (!row) return Promise.resolve({ data: { ok: false, reason: 'not_found' }, error: null });
        if (row.redeemed_at) {
          return Promise.resolve({ data: { ok: false, reason: 'redeemed' }, error: null });
        }
        if (row.reserved_for && row.reserved_for !== reservation) {
          return Promise.resolve({ data: { ok: false, reason: 'held' }, error: null });
        }
        row.reserved_for = reservation;
        row.reserved_at = new Date().toISOString();
        return Promise.resolve({
          data: { ok: true, percent: row.percent, correct: row.correct, total: row.total },
          error: null,
        });
      }
      throw new Error(`unexpected rpc ${name}`);
    },
  };

  const razorpay = {
    payments: {
      fetch: (id: string) => {
        const payment = state.payments.get(id);
        if (!payment) return Promise.reject(new Error('payment not found'));
        return Promise.resolve({ ...payment });
      },
      refund: (id: string) => {
        state.refundCalls += 1;
        const gate = state.refundGate;
        if (gate) {
          state.refundGate = null;
          gate.started();
          return gate.wait.then(() => {
            if (state.fail.refund) throw new Error('refund rejected by gateway');
            state.refunds.push(id);
            return { id: `rfnd_${state.refunds.length}` };
          });
        }
        if (state.fail.refund) return Promise.reject(new Error('refund rejected by gateway'));
        state.refunds.push(id);
        return Promise.resolve({ id: `rfnd_${state.refunds.length}` });
      },
    },
  };

  return { state, chain, razorpay };
});

vi.mock('razorpay', () => ({
  default: class {
    payments = h.razorpay.payments;
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: h.chain.from, rpc: h.chain.rpc }),
}));

vi.mock('@/lib/validate-cart', async () => {
  const { computeTotals } = await import('@/lib/pricing');
  return {
    // Contract-compatible stub: the fields the route consumes, computed with
    // the real money math. Cart-rule behaviour lives in checkout-gates.test.ts.
    // `discountPercent` is the value the route resolved from the promo code, so
    // it is passed straight through — the discount arithmetic itself is
    // `computeTotals`, and its own suite pins the rounding.
    validateCartLines: async (
      _supabase: unknown,
      items: { variantId: number; quantity: number }[],
      discountPercent = 0
    ) => {
      const variantFor = (id: number) => h.state.variants.get(id);
      if (items.some((line) => !variantFor(line.variantId))) {
        return { ok: false, code: 'UNKNOWN_VARIANT', error: 'Invalid cart items', status: 400 };
      }
      const requested = new Map<number, number>();
      for (const line of items) requested.set(line.variantId, (requested.get(line.variantId) ?? 0) + line.quantity);
      for (const [id, quantity] of requested) {
        const variant = variantFor(id)!;
        if (!Number.isFinite(variant.price) || variant.price < 0) {
          return { ok: false, code: 'BAD_AMOUNT', error: 'Invalid cart items', status: 400 };
        }
        if (variant.inventory_quantity < quantity) {
          return { ok: false, code: 'OUT_OF_STOCK', error: 'Insufficient stock', status: 409 };
        }
      }
      const priced = items.map((line) => ({
        price: variantFor(line.variantId)!.price,
        quantity: line.quantity,
      }));
      const { subtotal, discountAmount, gstAmount, total, totalPaise } = computeTotals(
        priced,
        discountPercent
      );
      if (subtotal <= 0) {
        return { ok: false, code: 'BAD_AMOUNT', error: 'Invalid cart items', status: 400 };
      }
      const byId = new Map(
        items.map((line) => {
          const variant = variantFor(line.variantId)!;
          return [
            line.variantId,
            {
              id: variant.id,
              price: variant.price,
              inventory_quantity: variant.inventory_quantity,
              title: 'M',
              product_id: 7,
              productTitle: 'Tee',
            },
          ];
        })
      );
      return { ok: true, subtotal, discountAmount, gstAmount, total, totalPaise, byId };
    },
  };
});

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SECRET_KEY = 'test-secret-key';
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'test-key-secret';

const PAYMENT_ID = 'pay_TEST0001';
const RAZORPAY_ORDER_ID = 'order_TEST0001';
const VARIANT_ID = 11;
// 2 x 1000 = 2000, GST-inclusive: 2000 - 2000/1.05 = 95.24 -> 95, total 2000 = 200000 paise.
const PAID_PAISE = 200000;

const ORDER_DATA = {
  email: 'buyer@example.in',
  phone: '9876543210',
  shippingAddress: {
    firstName: 'A',
    lastName: 'B',
    address1: '1 Road',
    city: 'Mumbai',
    state: 'MH',
    pincode: '400001',
    country: 'India',
  },
  cartItems: [{ variantId: VARIANT_ID, quantity: 2 }],
};

function signedBody(overrides: Row = {}): string {
  const signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${RAZORPAY_ORDER_ID}|${PAYMENT_ID}`)
    .digest('hex');
  return JSON.stringify({
    razorpay_order_id: RAZORPAY_ORDER_ID,
    razorpay_payment_id: PAYMENT_ID,
    razorpay_signature: signature,
    orderData: ORDER_DATA,
    ...overrides,
  });
}

let ipCounter = 0;

async function post(body: string): Promise<{ status: number; body: Row }> {
  const request = new NextRequest('http://localhost/api/checkout/verify-payment', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // A distinct client per request: the route rate-limits per IP and the
      // limiter is process-wide.
      'x-nf-client-connection-ip': `10.1.0.${++ipCounter}`,
    },
    body,
  });
  const response = await POST(request);
  return { status: response.status, body: (await response.json()) as Row };
}

beforeAll(() => {
  // The failure paths log loudly by design; keep the test output readable.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

beforeEach(() => {
  h.state.orders.length = 0;
  h.state.lineItems.length = 0;
  h.state.shipping.length = 0;
  h.state.analytics.length = 0;
  h.state.refunds.length = 0;
  h.state.orderDiscountCodes.length = 0;
  h.state.discountApplications.length = 0;
  h.state.reservations.length = 0;
  h.state.quizCodes.clear();
  h.state.claims.clear();
  h.state.stockOperations.clear();
  h.state.raceStock.clear();
  h.state.nextOrderId = 1;
  h.state.hideNextLookup = false;
  h.state.races = 0;
  h.state.refundCalls = 0;
  h.state.refundGate = null;
  h.state.fail = {
    lineItems: false,
    shipping: false,
    shippingRace: false,
    restore: false,
    restoreEmpty: false,
    refund: false,
  };
  h.state.variants.clear();
  h.state.variants.set(VARIANT_ID, { id: VARIANT_ID, price: 1000, inventory_quantity: 5 });
  h.state.payments.clear();
  h.state.payments.set(PAYMENT_ID, {
    status: 'captured',
    amount: PAID_PAISE,
    currency: 'INR',
    order_id: RAZORPAY_ORDER_ID,
  });
});

describe('verify-payment: happy path', () => {
  it('writes one paid order and records the funnel event', async () => {
    const first = await post(signedBody());
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ success: true, payment_id: PAYMENT_ID });
    expect(String(first.body.order_name)).toMatch(/^YORD-\d+-[0-9A-F]+$/);

    expect(h.state.orders).toHaveLength(1);
    expect(h.state.orders[0]).toMatchObject({
      financial_status: 'paid',
      confirmation_number: PAYMENT_ID,
      total_price: 2000,
    });
    expect(h.state.lineItems).toHaveLength(1);
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(3);
    expect(h.state.refunds).toEqual([]);
    expect(h.state.analytics).toHaveLength(1);
    expect(h.state.analytics[0]).toMatchObject({ type: 'order_completed' });
  });

  it('answers a replay of the same payment with the existing order, without moving stock', async () => {
    await post(signedBody());
    const stockAfterFirst = h.state.variants.get(VARIANT_ID)!.inventory_quantity;

    const replay = await post(signedBody());
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ success: true, message: 'Payment already recorded' });
    expect(h.state.orders).toHaveLength(1);
    expect(h.state.lineItems).toHaveLength(1);
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(stockAfterFirst);
    expect(h.state.refunds).toEqual([]);
  });

  it('allows only one concurrent verifier to finalize and decrement', async () => {
    const results = await Promise.all([post(signedBody()), post(signedBody())]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(h.state.orders).toHaveLength(1);
    expect(h.state.lineItems).toHaveLength(1);
    expect(h.state.shipping).toHaveLength(1);
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(3);
    expect(h.state.refunds).toEqual([]);
    expect(h.state.analytics).toHaveLength(1);
  });
});

describe('verify-payment: post-capture cart validation', () => {
  it.each([
    {
      name: 'unknown variant',
      code: 'UNKNOWN_VARIANT',
      status: 400,
      configure: () => signedBody({
        orderData: { ...ORDER_DATA, cartItems: [{ variantId: 999, quantity: 2 }] },
      }),
    },
    {
      name: 'bad amount',
      code: 'BAD_AMOUNT',
      status: 400,
      configure: () => {
        h.state.variants.get(VARIANT_ID)!.price = -1;
        return signedBody();
      },
    },
    {
      name: 'out of stock before decrement',
      code: 'OUT_OF_STOCK',
      status: 409,
      configure: () => {
        h.state.variants.get(VARIANT_ID)!.inventory_quantity = 1;
        return signedBody();
      },
    },
  ])('refunds captured payment for $name', async ({ code, status, configure }) => {
    const result = await post(configure());
    expect(result.status).toBe(status);
    expect(result.body.code).toBe(code);
    expect(h.state.refunds).toEqual([PAYMENT_ID]);
    expect(h.state.orders).toHaveLength(0);
  });

  it('returns REFUND_FAILED rather than a settled validation code when refund fails', async () => {
    h.state.variants.get(VARIANT_ID)!.inventory_quantity = 1;
    h.state.fail.refund = true;
    const result = await post(signedBody());
    expect(result.status).toBe(500);
    expect(result.body.code).toBe('REFUND_FAILED');
    expect(h.state.refunds).toEqual([]);
  });

  it('does not return UNKNOWN_VARIANT for malformed order data until refund succeeds', async () => {
    h.state.fail.refund = true;
    const result = await post(signedBody({ orderData: {} }));
    expect(result.status).toBe(500);
    expect(result.body.code).toBe('REFUND_FAILED');
    expect(h.state.refunds).toEqual([]);
  });
});

describe('verify-payment: post-capture compensation is terminal', () => {
  const modes = [
    {
      name: 'guarded decrement refused (oversell after capture)',
      status: 409,
      code: 'OUT_OF_STOCK',
      arm: () => h.state.raceStock.add(VARIANT_ID),
      lineItems: 0,
    },
    {
      name: 'line items insert failed',
      status: 500,
      code: undefined,
      arm: () => (h.state.fail.lineItems = true),
      lineItems: 0,
    },
    {
      name: 'shipping address insert failed',
      status: 500,
      code: undefined,
      arm: () => (h.state.fail.shipping = true),
      lineItems: 1,
    },
  ];

  for (const mode of modes) {
    it(`keeps the failed order row refunded and refuses the replay: ${mode.name}`, async () => {
      mode.arm();

      const first = await post(signedBody());
      expect(first.status).toBe(mode.status);
      if (mode.code) expect(first.body.code).toBe(mode.code);
      expect(h.state.refunds).toEqual([PAYMENT_ID]);

      // The row survives, stamped terminal, and says why. Before the fix it
      // was deleted here, which is what let the retry below succeed.
      expect(h.state.orders).toHaveLength(1);
      const row = h.state.orders[0];
      expect(row.financial_status).toBe('refunded');
      expect(typeof row.cancelled_at).toBe('string');
      expect(String(row.note)).toContain('[stock-compensation');
      expect(row.note).not.toBe('');
      // The stock the failed attempt took is back.
      expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(5);
      // Nothing completed, so no revenue event.
      expect(h.state.analytics).toEqual([]);

      // The client's own retry: byte-identical body, same payment id.
      const lineItemsAfterFirst = h.state.lineItems.length;
      const second = await post(signedBody());
      expect(second.status).toBe(409);
      expect(second.body.code).toBe('ORDER_REFUNDED');
      expect(second.body.success).toBeUndefined();

      // No second order, no second decrement, no second refund, no new line
      // items — and the money is not counted as revenue.
      expect(h.state.orders).toHaveLength(1);
      expect(h.state.orders[0].financial_status).toBe('refunded');
      expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(5);
      expect(h.state.refunds).toEqual([PAYMENT_ID]);
      expect(h.state.lineItems).toHaveLength(lineItemsAfterFirst);
      expect(h.state.analytics).toEqual([]);
    });
  }

  it('records a failed stock restore on the surviving row', async () => {
    // Two lines so there is something to restore: line 11 decrements, line 12
    // is refused, and the restore of line 11 fails — the case the note exists
    // for. 2 x 1000 + 1 x 500 = 2500, GST-inclusive -> 250000 paise.
    h.state.variants.set(12, { id: 12, price: 500, inventory_quantity: 5 });
    h.state.raceStock.add(12);
    h.state.fail.restore = true;
    h.state.payments.set(PAYMENT_ID, {
      status: 'captured',
      amount: 250000,
      currency: 'INR',
      order_id: RAZORPAY_ORDER_ID,
    });
    const body = signedBody({
      orderData: {
        ...ORDER_DATA,
        cartItems: [
          { variantId: VARIANT_ID, quantity: 2 },
          { variantId: 12, quantity: 1 },
        ],
      },
    });

    const first = await post(body);
    expect(first.status).toBe(409);
    expect(first.body).toMatchObject({ code: 'OUT_OF_STOCK', stock_restore_failed: true });

    expect(h.state.orders).toHaveLength(1);
    expect(String(h.state.orders[0].note)).toContain('restore-failed');
    // Line 11's stock was taken and could not be put back; line 12's was never
    // taken, so the compensation must not have touched it.
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(3);
    expect(h.state.variants.get(12)!.inventory_quantity).toBe(5);

    // Still terminal: an unrestored line must not become adoptable.
    const second = await post(body);
    expect(second.body.code).toBe('ORDER_REFUNDED');
    expect(h.state.orders).toHaveLength(1);
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(3);
  });

  it('records a failed refund on the surviving row', async () => {
    h.state.variants.set(12, { id: 12, price: 500, inventory_quantity: 5 });
    h.state.raceStock.add(12);
    h.state.payments.get(PAYMENT_ID)!.amount = 250000;
    h.state.fail.refund = true;

    const body = signedBody({
      orderData: {
        ...ORDER_DATA,
        cartItems: [
          { variantId: VARIANT_ID, quantity: 2 },
          { variantId: 12, quantity: 1 },
        ],
      },
    });
    const first = await post(body);
    expect(first.status).toBe(500);
    expect(String(first.body.error)).toBe('Insufficient stock for one or more items');
    expect(h.state.refunds).toEqual([]);
    expect(first.body.code).toBe('REFUND_FAILED');
    expect(String(h.state.orders[0].note)).toContain('[checkout-refund failed]');
    // A replay retries the refund, never re-claims: while the gateway keeps
    // refusing, the answer stays REFUND_FAILED so the client keeps the body.
    const second = await post(body);
    expect(second.body.code).toBe('REFUND_FAILED');
    expect(h.state.refunds).toEqual([]);
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(5);
    expect(h.state.stockOperations.get('1:0')?.restore_state).toBe('restored');
    // Once the refund lands, the payment settles as refunded.
    h.state.fail.refund = false;
    const third = await post(body);
    expect(third.body.code).toBe('ORDER_REFUNDED');
    expect(h.state.refunds).toEqual([PAYMENT_ID]);
    expect(h.state.orders).toHaveLength(1);
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(5);
    expect(h.state.variants.get(12)!.inventory_quantity).toBe(5);
    expect(h.state.stockOperations.get('1:0')?.restore_state).toBe('restored');
  });

  it('does not let a previous failed refund bypass a newer in-flight lease', async () => {
    h.state.variants.set(12, { id: 12, price: 500, inventory_quantity: 5 });
    h.state.raceStock.add(12);
    h.state.payments.get(PAYMENT_ID)!.amount = 250000;
    h.state.fail.refund = true;
    const body = signedBody({
      orderData: {
        ...ORDER_DATA,
        cartItems: [
          { variantId: VARIANT_ID, quantity: 2 },
          { variantId: 12, quantity: 1 },
        ],
      },
    });
    expect((await post(body)).body.code).toBe('REFUND_FAILED');

    h.state.fail.refund = false;
    h.state.refundCalls = 0;
    let started!: () => void;
    let release!: () => void;
    const startedPromise = new Promise<void>((resolve) => { started = resolve; });
    const wait = new Promise<void>((resolve) => { release = resolve; });
    h.state.refundGate = { started, startedPromise, release, wait };

    const retry = post(body);
    await startedPromise;
    const concurrentReplay = await post(body);
    expect(concurrentReplay.status).toBe(500);
    expect(concurrentReplay.body.code).toBe('REFUND_FAILED');
    expect(h.state.refundCalls).toBe(1);

    release();
    const retryResponse = await retry;
    expect(retryResponse.body.code).toBe('ORDER_REFUNDED');
    expect(h.state.refundCalls).toBe(1);
    expect(h.state.refunds).toEqual([PAYMENT_ID]);
  });

  it('recovers a route-owned refund pending after the process stopped before refunding', async () => {
    h.state.orders.push({
      id: 1,
      name: 'YORD-1759600000-AAAA',
      total_price: 2000,
      financial_status: 'paid',
      cancelled_at: new Date().toISOString(),
      confirmation_number: PAYMENT_ID,
      note: '[stock-compensation 2026-01-01T00:00:00.000Z line-items-failed] failed\n[checkout-refund pending]',
    });
    const replay = await post(signedBody());
    expect(replay.status).toBe(409);
    expect(replay.body.code).toBe('ORDER_REFUNDED');
    expect(h.state.refunds).toEqual([PAYMENT_ID]);
    expect(h.state.orders[0].financial_status).toBe('refunded');
  });

  it('recovers an expired refund lease and claims concurrent replays only once', async () => {
    const expired = new Date(Date.now() - 60_000).toISOString();
    h.state.orders.push({
      id: 1,
      name: 'YORD-1759600000-AAAA',
      total_price: 2000,
      financial_status: 'paid',
      cancelled_at: new Date().toISOString(),
      confirmation_number: PAYMENT_ID,
      note: `[checkout-refund in-flight ${expired} abandoned-token]`,
    });
    const [first, second] = await Promise.all([post(signedBody()), post(signedBody())]);
    expect([first.body.code, second.body.code].sort()).toEqual(['ORDER_REFUNDED', 'REFUND_FAILED']);
    expect(h.state.refunds).toEqual([PAYMENT_ID]);
    expect(h.state.orders[0].financial_status).toBe('refunded');
  });

  it('does not retry an admin cancellation or claim captured money is settled', async () => {
    h.state.orders.push({
      id: 1,
      name: 'YORD-1759600000-AAAA',
      total_price: 2000,
      financial_status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      confirmation_number: PAYMENT_ID,
      note: 'cancelled by admin',
    });
    const replay = await post(signedBody());
    expect(replay.status).toBe(409);
    expect(replay.body.code).toBe('ORDER_CANCELLED');
    expect(h.state.refunds).toEqual([]);
  });

  it('answers REFUND_FAILED, not a settled code, when an amount-mismatch refund fails', async () => {
    h.state.payments.get(PAYMENT_ID)!.amount = PAID_PAISE - 100;
    h.state.fail.refund = true;
    const first = await post(signedBody());
    expect(first.status).toBe(500);
    expect(first.body.code).toBe('REFUND_FAILED');
    h.state.fail.refund = false;
    const second = await post(signedBody());
    expect(second.status).toBe(402);
    expect(second.body.code).toBe('AMOUNT_MISMATCH');
    expect(h.state.refunds).toEqual([PAYMENT_ID]);
  });

  it('answers a replay from the order row, not from today\'s stock or price', async () => {
    h.state.variants.get(VARIANT_ID)!.inventory_quantity = 2;
    expect((await post(signedBody())).status).toBe(200);
    // The first purchase took the last units, then the price changed.
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(0);
    h.state.variants.get(VARIANT_ID)!.price = 1200;

    const replay = await post(signedBody());
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ success: true, message: 'Payment already recorded' });
    expect(h.state.refunds).toEqual([]);
    expect(h.state.orders[0].financial_status).toBe('paid');
  });

  it('refuses the payment when the claim race is lost to a compensated row', async () => {
    h.state.raceStock.add(VARIANT_ID);
    const first = await post(signedBody());
    expect(first.body.code).toBe('OUT_OF_STOCK');
    expect(h.state.orders).toHaveLength(1);

    // The idempotency lookup misses, so this attempt walks into the unique
    // index and loses with 23505 — the branch a retry takes when the winner
    // has claimed the payment. It must read the winner's terminal row and
    // refuse, not re-decrement or answer success.
    h.state.hideNextLookup = true;
    const second = await post(signedBody());
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('ORDER_REFUNDED');
    // Proves this went through the 23505 branch rather than the idempotency
    // lookup that the test hid.
    expect(h.state.races).toBe(1);
    expect(h.state.orders).toHaveLength(1);
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(5);
    expect(h.state.refunds).toEqual([PAYMENT_ID]);
  });

  it('still refuses the payment once the gateway reports it refunded', async () => {
    h.state.raceStock.add(VARIANT_ID);
    await post(signedBody());
    // Steady state after the compensation: the row stamp answers before the
    // gateway status is ever read.
    h.state.payments.get(PAYMENT_ID)!.status = 'refunded';

    const replay = await post(signedBody());
    expect(replay.status).toBe(409);
    expect(replay.body.code).toBe('ORDER_REFUNDED');
    expect(h.state.orders).toHaveLength(1);
    expect(h.state.lineItems).toHaveLength(0);
  });
});

describe('verify-payment: lease-backed claim recovery', () => {
  const CLAIM_ID = 500;

  function seedIncompleteClaim(
    orderOverrides: Row = {},
    leaseOverrides: { expiresAt?: number; lineState?: 'pending' | 'applied'; owner?: string } = {}
  ) {
    h.state.orders.push({
      id: CLAIM_ID,
      name: 'YORD-1759600000-AAAA',
      order_number: 1759600000 * 65536 + 43690,
      email: 'buyer@example.in',
      phone: '9876543210',
      financial_status: 'paid',
      cancelled_at: null,
      currency: 'INR',
      total_price: 2000,
      confirmation_number: PAYMENT_ID,
      note: '',
      ...orderOverrides,
    });
    const lines = [{
      product_id: 7,
      variant_id: VARIANT_ID,
      title: 'Tee',
      variant_title: 'M',
      price: 1000,
      quantity: 2,
      requires_shipping: true,
      taxable: true,
      gift_card: false,
    }];
    const shipping = {
      first_name: 'A',
      last_name: 'B',
      address1: '1 Road',
      address2: null,
      city: 'Mumbai',
      province: 'MH',
      country: 'India',
      zip: '400001',
      phone: '9876543210',
    };
    h.state.claims.set(CLAIM_ID, {
      status: 'active',
      owner_token: leaseOverrides.owner ?? 'crashed-owner',
      expires_at: leaseOverrides.expiresAt ?? Date.now() - 1_000,
      total: 2000,
      lines,
      shipping,
    });
    h.state.stockOperations.set(`${CLAIM_ID}:0`, {
      decrement_state: leaseOverrides.lineState ?? 'pending',
      restore_state: 'pending',
      variant_id: VARIANT_ID,
      quantity: 2,
    });
    if (leaseOverrides.lineState === 'applied') {
      // The first decrement took the last two units; recovery must trust the
      // ledger rather than revalidate this now-zero stock.
      h.state.variants.get(VARIANT_ID)!.inventory_quantity = 0;
    }
  }

  it('recovers an expired owner before any decrement without duplicating work', async () => {
    seedIncompleteClaim();

    const attempt = await post(signedBody());
    expect(attempt.status).toBe(200);
    expect(attempt.body).toMatchObject({ success: true, db_order_id: CLAIM_ID });

    expect(h.state.claims.get(CLAIM_ID)?.status).toBe('completed');
    expect(h.state.stockOperations.get(`${CLAIM_ID}:0`)?.decrement_state).toBe('applied');
    expect(h.state.orders[0].financial_status).toBe('paid');
    expect(h.state.lineItems).toHaveLength(1);
    expect(h.state.shipping).toHaveLength(1);
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(3);
    expect(h.state.refunds).toEqual([]);
  }, 15000);

  it('does not steal a live lease after the short completion poll', async () => {
    seedIncompleteClaim({}, { expiresAt: Date.now() + 60_000, owner: 'live-owner' });

    const attempt = await post(signedBody());
    expect(attempt.status).toBe(409);
    expect(attempt.body.code).toBe('ORDER_INCOMPLETE');
    expect(h.state.claims.get(CLAIM_ID)?.owner_token).toBe('live-owner');
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(5);
    expect(h.state.lineItems).toHaveLength(0);
    expect(h.state.shipping).toHaveLength(0);
    expect(h.state.refunds).toEqual([]);
    expect(h.state.analytics).toEqual([]);
  }, 15000);

  it('recovers after the old owner already decremented stock', async () => {
    seedIncompleteClaim({}, { lineState: 'applied' });
    const attempt = await post(signedBody());
    expect(attempt.status).toBe(200);
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(0);
    expect(h.state.lineItems).toHaveLength(1);
    expect(h.state.shipping).toHaveLength(1);
    expect(h.state.stockOperations.get(`${CLAIM_ID}:0`)?.decrement_state).toBe('applied');
  });

  it('blocks pre-migration claims whose stock history is unknown', async () => {
    h.state.orders.push({
      id: CLAIM_ID,
      name: 'YORD-1759600000-AAAA',
      total_price: 2000,
      financial_status: 'paid',
      cancelled_at: null,
      confirmation_number: PAYMENT_ID,
      note: '',
    });

    const attempt = await post(signedBody());
    expect(attempt.status).toBe(409);
    expect(attempt.body.code).toBe('ORDER_INCOMPLETE');
    expect(h.state.claims.get(CLAIM_ID)?.status).toBe('legacy_blocked');
    expect(h.state.orders[0].financial_status).toBe('paid');
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(5);
    expect(h.state.refunds).toEqual([]);
  }, 15000);

  it('fails closed when a stored claim total disagrees with its order', async () => {
    seedIncompleteClaim({ total_price: 999 });
    const attempt = await post(signedBody());
    expect(attempt.status).toBe(409);
    expect(attempt.body.code).toBe('ORDER_INCOMPLETE');
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(5);
    expect(h.state.refunds).toEqual([]);
  });

  it('keeps the old adoption and stock RPCs fail-closed', async () => {
    seedIncompleteClaim();
    const oldAdopt = await h.chain.rpc('adopt_order_claim', {
      p_order_id: CLAIM_ID,
      p_total: 2000,
    });
    const oldDecrement = await h.chain.rpc('decrement_variant_stock', {
      p_variant_id: VARIANT_ID,
      p_qty: 2,
    });
    expect(oldAdopt.data).toBe(false);
    expect(oldDecrement.data).toEqual([]);
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(5);
  });
});

describe('verify-payment: address-only recovery', () => {
  const CLAIM_ID = 500;

  it('finishes a crashed order by inserting only the shipping address', async () => {
    // The winner committed its line items and crashed before the address
    // insert: the recovery is the missing row alone — no decrement, no
    // adoption, no refund.
    h.state.orders.push({
      id: CLAIM_ID,
      name: 'YORD-1759600000-BBBB',
      order_number: 1759600000 * 65536 + 43690,
      financial_status: 'paid',
      cancelled_at: null,
      total_price: 2000,
      confirmation_number: PAYMENT_ID,
      claim_adopted_at: null,
      note: '',
    });
    h.state.lineItems.push({ order_id: CLAIM_ID, variant_id: VARIANT_ID, quantity: 2 });

    const attempt = await post(signedBody());
    expect(attempt.status).toBe(200);
    expect(attempt.body).toMatchObject({ success: true, message: 'Payment already recorded' });

    expect(h.state.shipping).toHaveLength(1);
    expect(h.state.shipping[0]).toMatchObject({ order_id: CLAIM_ID, zip: '400001', city: 'Mumbai' });
    expect(h.state.lineItems).toHaveLength(1);
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(5);
    expect(h.state.refunds).toEqual([]);
    // A replay path: the revenue event was already counted (or was never
    // written) — recovery must not re-count it.
    expect(h.state.analytics).toEqual([]);
    expect(h.state.orders[0].claim_adopted_at).toBeNull();

    // The next replay finds a complete order and answers read-only.
    const replay = await post(signedBody());
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ success: true, message: 'Payment already recorded' });
    expect(h.state.shipping).toHaveLength(1);
  });

  it('treats a duplicate address insert as success when recovery already inserted it', async () => {
    h.state.fail.shippingRace = true;
    const attempt = await post(signedBody());
    expect(attempt.status).toBe(200);
    expect(attempt.body.success).toBe(true);
    expect(h.state.shipping).toHaveLength(1);
    expect(h.state.refunds).toEqual([]);
    expect(h.state.orders[0].financial_status).toBe('paid');
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(3);
  });
});

describe('verify-payment: restore integrity', () => {
  it('records a restore that matched no variant row and still refunds', async () => {
    h.state.variants.set(12, { id: 12, price: 500, inventory_quantity: 5 });
    h.state.raceStock.add(12);
    // Line 11 decrements; its restore comes back empty (the variant row is
    // gone), which used to count as a silent success.
    h.state.fail.restoreEmpty = true;
    h.state.payments.set(PAYMENT_ID, {
      status: 'captured',
      amount: 250000,
      currency: 'INR',
      order_id: RAZORPAY_ORDER_ID,
    });
    const body = signedBody({
      orderData: {
        ...ORDER_DATA,
        cartItems: [
          { variantId: VARIANT_ID, quantity: 2 },
          { variantId: 12, quantity: 1 },
        ],
      },
    });

    const first = await post(body);
    expect(first.status).toBe(409);
    expect(first.body).toMatchObject({ code: 'OUT_OF_STOCK', stock_restore_failed: true });

    // The restore matched nothing, so line 11's stock stays down and the
    // note names the variant for reconciliation.
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(3);
    expect(String(h.state.orders[0].note)).toContain('restore-failed');
    expect(String(h.state.orders[0].note)).toContain('missing stock row');
    // The money path is unchanged: the refund ran regardless.
    expect(h.state.refunds).toEqual([PAYMENT_ID]);
    const beforeRetry = h.state.variants.get(VARIANT_ID)!.inventory_quantity;
    await h.chain.rpc('compensate_checkout_order', {
      p_order_id: 1,
      p_owner_token: 'stale-owner',
      p_reason: 'replayed compensation',
    });
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(beforeRetry);
  });
});

// The promo-code half of the money path. Everything here turns on one rule: the
// discount this attempt charges comes from the *reservation*, never from the
// code the client sent. A code the client claims but cannot reserve means the
// cart is priced at full price, and a capture that was taken at the discounted
// amount then fails the amount check and refunds — the shopper is told the code
// could not be used rather than being charged less than the order records.
describe('verify-payment: promo codes', () => {
  const CODE = 'AURA-ABCDEF';
  // 2 x 1000 = 2000, 40% off = 800 off, so 1200 charged = 120000 paise.
  const DISCOUNTED_PAISE = 120000;

  function seedCode(overrides: Row = {}) {
    h.state.quizCodes.set(CODE, {
      id: 1,
      code: CODE,
      percent: 40,
      correct: 9,
      total: 10,
      reserved_for: null,
      reserved_at: null,
      redeemed_at: null,
      order_id: null,
      redeemed_email: null,
      ...overrides,
    });
  }

  function payDiscounted() {
    h.state.payments.set(PAYMENT_ID, {
      status: 'captured',
      amount: DISCOUNTED_PAISE,
      currency: 'INR',
      order_id: RAZORPAY_ORDER_ID,
    });
  }

  it('charges the discounted amount and spends the code', async () => {
    seedCode();
    payDiscounted();

    const result = await post(signedBody({ code: CODE }));
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true });

    // The order records the money that actually moved, and the discount that
    // explains the gap between the line items and the total.
    expect(h.state.orders).toHaveLength(1);
    expect(h.state.orders[0]).toMatchObject({ total_price: 1200, total_discounts: 800 });
    expect(h.state.refunds).toEqual([]);

    // The Shopify-shaped rows the admin reads.
    expect(h.state.orderDiscountCodes).toHaveLength(1);
    expect(h.state.orderDiscountCodes[0]).toMatchObject({
      order_id: 1,
      code: CODE,
      amount: 800,
    });
    expect(h.state.discountApplications).toHaveLength(1);
    expect(h.state.discountApplications[0]).toMatchObject({ code: CODE, value: '40' });

    // Spent, against this order and this email.
    const row = h.state.quizCodes.get(CODE)!;
    expect(row.redeemed_at).toBeTruthy();
    expect(row.order_id).toBe(1);
    expect(row.redeemed_email).toBe('buyer@example.in');

    // The funnel event carries the discount, so the campaign's revenue is
    // readable without joining anything.
    expect(h.state.analytics[0]).toMatchObject({ type: 'order_completed', props: { discount: 800 } });
  });

  it('reserves against the Razorpay order id, which is what makes a retry idempotent', async () => {
    seedCode();
    payDiscounted();

    await post(signedBody({ code: CODE }));

    expect(h.state.reservations).toHaveLength(1);
    expect(h.state.reservations[0]).toMatchObject({
      code: CODE,
      reservation: RAZORPAY_ORDER_ID,
    });
    // The window is passed in, so the campaign's end date lives in one
    // TypeScript constant rather than in the database.
    expect(String(h.state.reservations[0].endsAt)).toMatch(/^2026-11-30/);
  });

  it.each(['redeemed', 'held', 'not_found'] as const)(
    'refunds a discounted capture when the code cannot be reserved (%s)',
    async (reason) => {
      if (reason === 'redeemed') seedCode({ redeemed_at: new Date().toISOString() });
      else if (reason === 'held') seedCode({ reserved_for: 'order_OTHER', reserved_at: new Date().toISOString() });
      payDiscounted();

      const result = await post(signedBody({ code: CODE }));

      // 402: the shopper's money came back, so the message names the code
      // rather than reading as a bare amount mismatch.
      expect(result.status).toBe(402);
      expect(result.body).toMatchObject({ code: 'AMOUNT_MISMATCH' });
      expect(String(result.body.error)).toContain('code');
      expect(h.state.refunds).toEqual([PAYMENT_ID]);
      // Nothing was written: the reservation precedes the order claim, so a
      // code that could not be held never gets an order row.
      expect(h.state.orders).toHaveLength(0);
      expect(h.state.orderDiscountCodes).toHaveLength(0);
    }
  );

  it('sells at full price when the code fails but full price is what was captured', async () => {
    // The degraded path, and the only one where a failed code is not a refund:
    // the shopper was charged the undiscounted amount (a create-order that
    // priced without the code, say), so the order stands at full price with no
    // discount recorded.
    seedCode({ redeemed_at: new Date().toISOString() });

    const result = await post(signedBody({ code: CODE }));
    expect(result.status).toBe(200);
    expect(h.state.orders[0]).toMatchObject({ total_price: 2000 });
    // Never written, rather than written as zero: the order row has no discount
    // column value at all, which is what the admin reads as "no discount".
    expect(h.state.orders[0].total_discounts).toBeUndefined();
    expect(h.state.orderDiscountCodes).toHaveLength(0);
    expect(h.state.discountApplications).toHaveLength(0);
    expect(h.state.refunds).toEqual([]);
    // And the code stays spent for whoever already had it.
    expect(h.state.quizCodes.get(CODE)!.order_id).toBeNull();
  });

  it('ignores a code that is not even the right shape', async () => {
    // Shape is checked before any lookup: a malformed code never reaches the
    // database, so the promo field's own validator and the route agree.
    seedCode();
    payDiscounted();

    const result = await post(signedBody({ code: 'nope' }));

    expect(h.state.reservations).toHaveLength(0);
    // Full price was recomputed, so the discounted capture mismatched and the
    // shopper was refunded — the same outcome as an unreservable code.
    expect(result.status).toBe(402);
    expect(h.state.refunds).toEqual([PAYMENT_ID]);
  });

  it('leaves a no-code order completely untouched', async () => {
    seedCode();
    const result = await post(signedBody());
    expect(result.status).toBe(200);
    expect(h.state.orders[0]).toMatchObject({ total_price: 2000 });
    expect(h.state.orders[0].total_discounts).toBeUndefined();
    expect(h.state.reservations).toHaveLength(0);
    expect(h.state.quizCodes.get(CODE)!.reserved_for).toBeNull();
    expect(h.state.analytics[0].props).not.toHaveProperty('discount');
  });
});
