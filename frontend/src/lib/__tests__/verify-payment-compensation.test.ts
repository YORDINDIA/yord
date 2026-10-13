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
    variants: new Map<number, Variant>(),
    payments: new Map<string, Payment>(),
    raceStock: new Set<number>(),
    nextOrderId: 1,
    hideNextLookup: false,
    races: 0,
    fail: { lineItems: false, shipping: false, restore: false, restoreEmpty: false, refund: false },
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
        update: (patch: Row) => ({
          eq: (col: string, value: unknown) => {
            if (table !== 'orders') throw new Error(`unexpected update on ${table}`);
            const row = state.orders.find((o) => o[col] === value);
            if (row) Object.assign(row, patch);
            return Promise.resolve({ data: null, error: null });
          },
        }),
      };
    },
    rpc(
      name: string,
      args: { p_variant_id: number; p_qty: number } | { p_order_id: number; p_total: number }
    ) {
      if (name === 'adopt_order_claim') {
        // The migration 016 CAS, translated: adopt only a still-'paid',
        // uncancelled, unclaimed, line-less row whose total matches. Loose
        // null checks mirror SQL's `IS NULL` (a fresh row's absent columns
        // read as null).
        const { p_order_id, p_total } = args as { p_order_id: number; p_total: number };
        const row = state.orders.find((o) => o.id === p_order_id);
        if (
          !row ||
          Number(row.total_price) !== Number(p_total) ||
          row.financial_status !== 'paid' ||
          row.cancelled_at != null ||
          row.claim_adopted_at != null ||
          state.lineItems.some((li) => li.order_id === row.id)
        ) {
          return Promise.resolve({ data: false, error: null });
        }
        row.claim_adopted_at = new Date().toISOString();
        const stamp = `[stock-compensation ${new Date().toISOString()} adopt-claim] CAS adoption; stock re-decremented`;
        row.note = row.note ? `${row.note}\n${stamp}` : stamp;
        return Promise.resolve({ data: true, error: null });
      }
      if (name !== 'decrement_variant_stock') throw new Error(`unexpected rpc ${name}`);
      const { p_variant_id, p_qty } = args as { p_variant_id: number; p_qty: number };
      const variant = state.variants.get(p_variant_id);
      if (!variant) return Promise.resolve({ data: [], error: null });
      if (p_qty < 0) {
        // Restore: the real RPC updates unconditionally for a negative qty.
        if (state.fail.restore) return Promise.resolve({ data: null, error: { message: 'restore failed' } });
        // Empty data with no error: the variant row vanished between the
        // decrement and the restore, so nothing was actually put back.
        if (state.fail.restoreEmpty) return Promise.resolve({ data: [], error: null });
        variant.inventory_quantity -= p_qty;
        return Promise.resolve({
          data: [{ id: variant.id, inventory_quantity: variant.inventory_quantity }],
          error: null,
        });
      }
      // Guarded decrement: returns no row when the stock is not there, which
      // is how the route detects an oversell after capture. `raceStock`
      // simulates stock that vanished between validation and the decrement.
      if (state.raceStock.has(p_variant_id) || variant.inventory_quantity < p_qty) {
        return Promise.resolve({ data: [], error: null });
      }
      variant.inventory_quantity -= p_qty;
      return Promise.resolve({
        data: [{ id: variant.id, inventory_quantity: variant.inventory_quantity }],
        error: null,
      });
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
    validateCartLines: async (
      _supabase: unknown,
      items: { variantId: number; quantity: number }[]
    ) => {
      const variantFor = (id: number) => h.state.variants.get(id);
      if (items.some((line) => !variantFor(line.variantId))) {
        return { ok: false, code: 'UNKNOWN_VARIANT', error: 'Invalid cart items', status: 400 };
      }
      const subtotal = items.reduce(
        (sum, line) => sum + variantFor(line.variantId)!.price * line.quantity,
        0
      );
      const { gstAmount, total, totalPaise } = computeTotals(subtotal);
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
      return { ok: true, subtotal, gstAmount, total, totalPaise, byId };
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
// 2 x 1000 = 2000 subtotal, 18% GST = 360, total 2360 = 236000 paise.
const PAID_PAISE = 236000;

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
  h.state.raceStock.clear();
  h.state.nextOrderId = 1;
  h.state.hideNextLookup = false;
  h.state.races = 0;
  h.state.fail = { lineItems: false, shipping: false, restore: false, restoreEmpty: false, refund: false };
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
      total_price: 2360,
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
    // for. 2 x 1000 + 1 x 500 = 2500 + 450 GST = 2950 -> 295000 paise.
    h.state.variants.set(12, { id: 12, price: 500, inventory_quantity: 5 });
    h.state.raceStock.add(12);
    h.state.fail.restore = true;
    h.state.payments.set(PAYMENT_ID, {
      status: 'captured',
      amount: 295000,
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
    h.state.raceStock.add(VARIANT_ID);
    h.state.fail.refund = true;

    const first = await post(signedBody());
    expect(first.status).toBe(409);
    expect(String(first.body.error)).toBe('Insufficient stock for one or more items');
    expect(h.state.refunds).toEqual([]);
    expect(first.body.code).toBe('REFUND_FAILED');
    expect(String(h.state.orders[0].note)).toContain('refund-failed');
    // A replay retries the refund, never re-claims: while the gateway keeps
    // refusing, the answer stays REFUND_FAILED so the client keeps the body.
    const second = await post(signedBody());
    expect(second.body.code).toBe('REFUND_FAILED');
    expect(h.state.refunds).toEqual([]);
    // Once the refund lands, the payment settles as refunded.
    h.state.fail.refund = false;
    const third = await post(signedBody());
    expect(third.body.code).toBe('ORDER_REFUNDED');
    expect(h.state.refunds).toEqual([PAYMENT_ID]);
    expect(h.state.orders).toHaveLength(1);
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(5);
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

describe('verify-payment: crashed-claim adoption (CAS)', () => {
  const CLAIM_ID = 500;

  function seedIncompleteClaim(overrides: Row = {}) {
    h.state.orders.push({
      id: CLAIM_ID,
      name: 'YORD-1759600000-AAAA',
      order_number: 1759600000 * 65536 + 43690,
      email: 'buyer@example.in',
      phone: '9876543210',
      financial_status: 'paid',
      cancelled_at: null,
      currency: 'INR',
      total_price: 2360,
      confirmation_number: PAYMENT_ID,
      claim_adopted_at: null,
      note: '',
      ...overrides,
    });
  }

  it('adopts a crashed claim through the CAS: one decrement, one line item, success', async () => {
    seedIncompleteClaim();

    const attempt = await post(signedBody());
    expect(attempt.status).toBe(200);
    expect(attempt.body).toMatchObject({ success: true, db_order_id: CLAIM_ID });

    const row = h.state.orders[0];
    expect(row.claim_adopted_at).toBeTruthy();
    expect(String(row.note)).toContain('adopt-claim');
    expect(row.financial_status).toBe('paid');
    expect(h.state.lineItems).toHaveLength(1);
    expect(h.state.shipping).toHaveLength(1);
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(3);
    expect(h.state.refunds).toEqual([]);
  }, 15000);

  it('refuses a claim that was already adopted and answers without writing', async () => {
    seedIncompleteClaim({ claim_adopted_at: new Date().toISOString() });

    const attempt = await post(signedBody());
    // The CAS finds claim_adopted_at already set and returns false; the route
    // re-polls, the claim stays line-less, and the answer is the
    // wait-and-retry 409 — with zero writes of any kind.
    expect(attempt.status).toBe(409);
    expect(attempt.body.code).toBe('ORDER_INCOMPLETE');
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(5);
    expect(h.state.lineItems).toHaveLength(0);
    expect(h.state.shipping).toHaveLength(0);
    expect(h.state.refunds).toEqual([]);
    expect(h.state.analytics).toEqual([]);
  }, 15000);

  it('adopt_order_claim returns false for a row it already adopted', async () => {
    seedIncompleteClaim();

    const first = await h.chain.rpc('adopt_order_claim', { p_order_id: CLAIM_ID, p_total: 2360 });
    expect(first.data).toBe(true);
    expect(first.error).toBeNull();
    // The row now carries claim_adopted_at: the second call must lose the CAS
    // even though the claim is still line-less — this is the predicate that
    // keeps a re-decrement from happening twice.
    const second = await h.chain.rpc('adopt_order_claim', { p_order_id: CLAIM_ID, p_total: 2360 });
    expect(second.data).toBe(false);
    expect(second.error).toBeNull();
  });

  it('refuses the CAS and marks the row when the totals do not match', async () => {
    seedIncompleteClaim({ total_price: 999 });

    const attempt = await post(signedBody());
    expect(attempt.status).toBe(409);
    expect(attempt.body.code).toBe('ORDER_INCOMPLETE');
    // Marked for reconciliation, not compensated: still 'paid', no refund,
    // no stock movement — the money decision belongs to the attempt that
    // holds the payment.
    expect(String(h.state.orders[0].note)).toContain('claim-total-mismatch');
    expect(h.state.orders[0].financial_status).toBe('paid');
    expect(h.state.variants.get(VARIANT_ID)!.inventory_quantity).toBe(5);
    expect(h.state.refunds).toEqual([]);
  }, 15000);
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
      total_price: 2360,
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
      amount: 295000,
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
    expect(String(h.state.orders[0].note)).toContain('restore matched no variant row');
    // The money path is unchanged: the refund ran regardless.
    expect(h.state.refunds).toEqual([PAYMENT_ID]);
  });
});
