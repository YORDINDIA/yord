export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { asBigintId } from '@/lib/validation';
import { getNextId } from '@/lib/utils/ids';
import { requireAdmin } from '@/lib/utils/admin';
import type { ServerClient } from '@/lib/supabase/server';

// Ordering (a DB trace always exists before money moves):
//   1. validate + fetch txn
//   2. reserve_refund() locks the transaction row, enforces the cumulative
//      refund cap, and inserts the pending `refunds` + `refund_transactions`
//      rows (see supabase/migrations/002_refund_idempotency.sql)
//   3. call the Razorpay gateway
//   4. mark the refund complete, then update the order status
// A concurrent or replayed submit fails in step 2 (row lock / ALREADY_REFUNDED)
// without touching money. Partial refunds are allowed until the cumulative
// amount reaches the transaction total.
//
// Idempotency: there is no dedicated key column, so the key travels inside
// `refunds.note` as `idem:<key>` (accepted in the JSON body as
// `idempotencyKey` or via the `Idempotency-Key` header, then stamped onto the
// reservation before the gateway call). A retry with the same key returns the
// existing reservation instead of reserving again — without this, two partial
// refunds of the same amount both fit under the remaining balance and the
// customer is refunded twice.
//
// Unknown gateway outcomes (timeout / 5xx / dropped connection) NEVER release
// the reservation: the refund may already exist at Razorpay. The row is marked
// `unknown … reconcile required` and later retries reconcile via
// `fetchMultipleRefund` before any new gateway call. Only definite gateway
// rejections (4xx validation) release the reservation.

const IDEM_PREFIX = 'idem:';
const PENDING_NOTE = 'pending reservation - gateway refund not yet issued';
const UNKNOWN_NOTE = 'unknown reservation - gateway outcome uncertain, reconcile required';

function normalizeKey(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const key = raw.trim();
  if (!key || key.length > 128) return undefined;
  return key;
}

function noteFor(key: string | undefined, base: string): string {
  return key ? `${base} | ${IDEM_PREFIX}${key}` : base;
}

// The key is always the note's tail (`… | idem:<key>`), so an exact
// ends-with compare is the match: a substring test would let key `abc`
// match a stored `abcdef` and report the wrong refund as the earlier one.
function noteHasKey(note: string | null | undefined, key: string): boolean {
  return typeof note === 'string' && note.endsWith(`${IDEM_PREFIX}${key}`);
}

function gatewayIdFromNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const match = note.match(/Razorpay refund (\S+)/);
  return match ? match[1] : null;
}

function isPendingNote(note: string | null | undefined): boolean {
  return typeof note === 'string' && note.includes('pending reservation');
}

function isUnknownNote(note: string | null | undefined): boolean {
  return typeof note === 'string' && note.includes('unknown reservation');
}

interface ReservationRow {
  id: number;
  // PostgREST returns BIGINT as a JSON number; normalize with String()
  // before comparing against the decimal-string order id.
  order_id: number | string;
  note: string | null;
  amount: number | null;
  processed_at: string | null;
  created_at: string | null;
}

/** Every reservation for an order, newest last. Small per order; filtered in JS. */
async function listReservations(
  service: ServerClient,
  orderId: string,
): Promise<ReservationRow[]> {
  // A failed lookup must not read as "no reservations" — that would bypass
  // idempotency and allow a second refund. Propagate and stop before reserving.
  const { data, error } = await service
    .from('refunds')
    .select('id, order_id, note, amount, processed_at, created_at')
    .eq('order_id', asBigintId(orderId))
    .order('id', { ascending: true });
  if (error) throw new Error(`Could not read refunds for order ${orderId}: ${error.message}`);
  return (data ?? []) as ReservationRow[];
}

async function linkedTransactionIds(
  service: ServerClient,
  refundIds: number[],
): Promise<Map<number, number[]>> {
  if (refundIds.length === 0) return new Map();
  const { data, error } = await service
    .from('refund_transactions')
    .select('refund_id, transaction_id')
    .in('refund_id', refundIds);
  if (error) throw new Error(`Could not read refund_transactions: ${error.message}`);
  const byRefund = new Map<number, number[]>();
  for (const row of (data ?? []) as { refund_id: number; transaction_id: number }[]) {
    const list = byRefund.get(row.refund_id) ?? [];
    list.push(row.transaction_id);
    byRefund.set(row.refund_id, list);
  }
  return byRefund;
}

function razorpayClient(): Razorpay | null {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

interface GatewayRefundItem {
  id: string;
  amount?: number;
  status?: string;
  /** Echoed from the refund request; we send the DB refund id as the receipt. */
  receipt?: string | null;
}

/** Best-effort fetch of the refunds Razorpay knows about for a payment. */
async function fetchGatewayRefunds(
  razorpay: Razorpay,
  paymentId: string,
): Promise<GatewayRefundItem[] | null> {
  try {
    const result = (await (
      razorpay.payments as unknown as {
        fetchMultipleRefund: (
          paymentId: string,
        ) => Promise<{ items?: GatewayRefundItem[] }>;
      }
    ).fetchMultipleRefund(paymentId)) as { items?: GatewayRefundItem[] };
    return result?.items ?? [];
  } catch {
    return null;
  }
}

/** A gateway failure that may still have moved money (never release on these). */
function isUnknownGatewayError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true;
  const err = error as { statusCode?: number; status?: number; code?: unknown; message?: string };
  const status = err.statusCode ?? err.status;
  if (typeof status === 'number') return status >= 500;
  const code = String(err.code ?? '').toUpperCase();
  if (/TIMEOUT|ECONN|ENOTFOUND|EAI_AGAIN|ABORT|502|503|504/.test(code)) return true;
  const message = String(err.message ?? '').toLowerCase();
  if (/timeout|timed out|network|socket|econn|502|503|504|try again/.test(message)) return true;
  return false;
}

/**
 * Re-derive the cumulative refund for a transaction and (re)write the order's
 * financial_status. Used when a retry finds an already-completed reservation:
 * finalizeRefund may have persisted `processed_at` and then failed the order
 * update, so success must not be reported without repairing the status.
 */
async function ensureOrderStatus(
  service: ServerClient,
  args: { orderId: string; transactionId: number },
): Promise<void> {
  const { data: txn } = await service
    .from('transactions')
    .select('amount')
    .eq('id', args.transactionId)
    .maybeSingle();
  const txnPaise = Math.round(Number((txn as { amount?: unknown } | null)?.amount) * 100);
  const { data: links } = await service
    .from('refund_transactions')
    .select('refund_id')
    .eq('transaction_id', args.transactionId);
  const refundIds = ((links ?? []) as { refund_id: number }[]).map((l) => l.refund_id);
  let cumulativePaise = 0;
  if (refundIds.length > 0) {
    const { data: rows } = await service
      .from('refunds')
      .select('amount')
      .in('id', refundIds);
    for (const row of (rows ?? []) as { amount: number | null }[]) {
      cumulativePaise += Number(row.amount) || 0;
    }
  }
  const isPartial =
    Number.isFinite(txnPaise) && txnPaise > 0 ? cumulativePaise < txnPaise : false;
  const { error } = await service
    .from('orders')
    .update({ financial_status: isPartial ? 'partially_refunded' : 'refunded' })
    .eq('id', asBigintId(args.orderId));
  if (error) {
    console.error('Order status repair failed', args.orderId, error);
  }
}

/**
 * Idempotent finalization: records the gateway id on the reservation (kept
 * across retries via note) and sets the order status. Safe to call twice —
 * both writes converge on the same values.
 */
async function finalizeRefund(
  service: ServerClient,
  args: {
    refundDbId: number;
    orderId: string;
    gatewayRefundId: string;
    isPartial: boolean;
    idemKey?: string;
  },
): Promise<{ ok: true } | { ok: false; step: 'refund' | 'order'; error: unknown }> {
  const completedAt = new Date().toISOString();
  const { data: current } = await service
    .from('refunds')
    .select('note')
    .eq('id', args.refundDbId)
    .maybeSingle();
  const currentNote =
    (current as { note?: string | null } | null)?.note ?? '';
  const note = gatewayIdFromNote(currentNote)
    ? currentNote
    : noteFor(args.idemKey, `${currentNote} | Razorpay refund ${args.gatewayRefundId}`.replace(/^ \| /, ''));
  const { error: completeError } = await service
    .from('refunds')
    .update({ note, processed_at: completedAt })
    .eq('id', args.refundDbId);
  if (completeError) {
    console.error(
      'Refund record completion failed after gateway refund',
      args.gatewayRefundId,
      completeError,
    );
    return { ok: false, step: 'refund', error: completeError };
  }
  const { error: orderError } = await service
    .from('orders')
    .update({ financial_status: args.isPartial ? 'partially_refunded' : 'refunded' })
    .eq('id', asBigintId(args.orderId));
  if (orderError) {
    console.error('Order status update failed after refund', args.refundDbId, orderError);
    return { ok: false, step: 'order', error: orderError };
  }
  return { ok: true };
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const { service } = auth;

    const body = (await req.json().catch(() => null)) as {
      orderId?: unknown;
      transactionId?: unknown;
      amount?: unknown;
      idempotencyKey?: unknown;
      reconcileRefundId?: unknown;
    } | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { orderId, transactionId, amount } = body;
    // Validate once: unknown-typed JSON must never reach PostgREST as `{}`.
    // The order id stays a decimal string — BIGINT ids above
    // Number.MAX_SAFE_INTEGER round through `Number()`, and a rounded id can
    // target a neighboring order — so it is pattern-checked verbatim instead.
    const orderIdStr = typeof orderId === 'string' ? orderId : String(orderId ?? '');
    const transactionIdNum = Number(transactionId);
    if (!/^[1-9][0-9]*$/.test(orderIdStr)) {
      return NextResponse.json({ error: 'orderId and transactionId are required' }, { status: 400 });
    }
    if (!Number.isInteger(transactionIdNum) || transactionIdNum <= 0) {
      return NextResponse.json({ error: 'orderId and transactionId are required' }, { status: 400 });
    }

    const idemKey =
      normalizeKey(body.idempotencyKey) ?? normalizeKey(req.headers.get('idempotency-key'));

    // Reconcile path (no money moves): finish a reservation whose gateway
    // refund already exists but whose local rows never completed (crash or DB
    // failure after gateway success). Retried with the DB refund id.
    if (body.reconcileRefundId !== undefined && body.reconcileRefundId !== null) {
      const reconcileId = Number(body.reconcileRefundId);
      if (!Number.isInteger(reconcileId) || reconcileId <= 0) {
        return NextResponse.json({ error: 'Invalid reconcileRefundId' }, { status: 400 });
      }
      return reconcileReservation(service, {
        refundDbId: reconcileId,
        orderId: orderIdStr,
        transactionId: transactionIdNum,
      });
    }

    let refundAmount: number | undefined;
    if (amount !== undefined && amount !== null && amount !== '') {
      const parsed = typeof amount === 'number' ? amount : Number(amount);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
      }
      refundAmount = Math.round(parsed * 100); // Razorpay expects paise
    }

    const { data: txn, error: txnError } = await service
      .from('transactions')
      .select('amount, payment_id')
      .eq('id', transactionIdNum)
      .eq('order_id', asBigintId(orderIdStr))
      .single();
    if (txnError || !txn?.payment_id) {
      return NextResponse.json({ error: 'Transaction not found for this order' }, { status: 404 });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: 'Refund service not configured' }, { status: 500 });
    }

    // Step 1.5: idempotency lookup BEFORE reserving. A retry carrying the same
    // key returns the existing reservation (completed → success, pending →
    // reused for the gateway call below) instead of reserving a second refund.
    if (idemKey) {
      const reservations = await listReservations(service, orderIdStr);
      const links = await linkedTransactionIds(
        service,
        reservations.map((r) => r.id),
      );
      const existing = reservations.find(
        (r) =>
          noteHasKey(r.note, idemKey) &&
          (links.get(r.id) ?? []).includes(transactionIdNum),
      );
      if (existing) {
        const gatewayId = gatewayIdFromNote(existing.note);
        if (gatewayId && existing.processed_at) {
          // The earlier attempt may have completed the refund row but failed
          // the order update. Re-run finalization before reporting success so
          // the retry repairs the status instead of papering over it.
          await ensureOrderStatus(service, {
            orderId: orderIdStr,
            transactionId: transactionIdNum,
          });
          return NextResponse.json(
            { success: true, refundId: gatewayId, amount: existing.amount, deduplicated: true },
          );
        }
        // Pending/unknown reservation with the same key: reuse it for the
        // gateway call below rather than reserving a second refund.
        const reused = await continueWithReservation(service, {
          refundDbId: existing.id,
          orderId: orderIdStr,
          transactionId: transactionIdNum,
          paymentId: txn.payment_id as string,
          txnAmount: txn.amount as number | null,
          idemKey,
          deduplicated: true,
        });
        if (reused) return reused;
      }
    } else {
      // Keyless rapid double-submit guard: a pending reservation for the same
      // transaction + amount created in the last 10 minutes is the first
      // click still in flight — report it instead of issuing a second refund.
      const reservations = await listReservations(service, orderIdStr);
      const links = await linkedTransactionIds(
        service,
        reservations.map((r) => r.id),
      );
      const recent = Date.now() - 10 * 60 * 1000;
      const inFlight = reservations.find((r) => {
        if (!isPendingNote(r.note) && !isUnknownNote(r.note)) return false;
        if ((links.get(r.id) ?? []).includes(transactionIdNum) === false) return false;
        if (refundAmount !== undefined && r.amount !== refundAmount) return false;
        const created = r.created_at ? Date.parse(r.created_at) : NaN;
        return Number.isFinite(created) && created >= recent;
      });
      if (inFlight) {
        return NextResponse.json(
          {
            error: 'A refund for this transaction is already in progress.',
            refundId: inFlight.id,
            code: 'REFUND_IN_PROGRESS',
          },
          { status: 409 },
        );
      }
    }

    // Step 2: atomic reservation BEFORE any gateway call. A crash from here on
    // leaves a `pending reservation` refunds row to reconcile.
    // Retry id allocation once: two concurrent admins can draw the same
    // admin_next_id value, and the loser's explicit-id insert then fails
    // with 23505. Retrying with a fresh id keeps the retry safe (no money
    // has moved yet); a second collision surfaces as a 500.
    let refundId = await getNextId('refunds');
    let reserved: unknown = null;
    let reserveError: { message?: string } | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const attemptResult = await service.rpc('reserve_refund', {
        p_refund_id: refundId,
        p_transaction_id: transactionIdNum,
        p_amount: refundAmount ?? null,
      });
      reserved = attemptResult.data;
      reserveError = attemptResult.error;
      if (!reserveError) break;
      const msg = reserveError.message || '';
      const idCollision =
        msg.includes('duplicate') || (reserveError as { code?: string }).code === '23505';
      if (!idCollision || attempt === 1) break;
      refundId = await getNextId('refunds');
    }
    if (reserveError) {
      const message = reserveError.message || '';
      if (message.includes('TRANSACTION_NOT_FOUND')) {
        return NextResponse.json({ error: 'Transaction not found for this order' }, { status: 404 });
      }
      if (message.includes('ALREADY_REFUNDED')) {
        // A pending reservation from an earlier attempt may never have been
        // finalized (gateway success + DB failure). Reconcile it before
        // reporting "already refunded", so a completed gateway refund always
        // ends with a complete local record.
        const reconciled = await reconcilePendingForTransaction(service, {
          orderId: orderIdStr,
          transactionId: transactionIdNum,
        });
        if (reconciled) return reconciled;
        return NextResponse.json({ error: 'Transaction already refunded' }, { status: 409 });
      }
      if (message.includes('EXCEEDS_REMAINING')) {
        return NextResponse.json(
          { error: 'Refund amount exceeds the remaining refundable amount' },
          { status: 400 }
        );
      }
      if (message.includes('AMOUNT_UNKNOWN')) {
        return NextResponse.json(
          { error: 'Transaction amount is missing; refund cannot be verified' },
          { status: 400 }
        );
      }
      console.error('Refund reservation failed; gateway not called', refundId, reserveError);
      return NextResponse.json(
        { error: 'Failed to reserve refund. No money moved; safe to retry.' },
        { status: 500 }
      );
    }

    // `reserve_refund` is set-returning, so the row arrives as a one-item array.
    const reservedRow = (Array.isArray(reserved) ? reserved[0] : reserved) as
      | { effective?: number; cumulative?: number }
      | null
      | undefined;
    const amountPaise = Number(reservedRow?.effective);
    const cumulativePaise = Number(reservedRow?.cumulative);
    if (!Number.isFinite(amountPaise) || !Number.isFinite(cumulativePaise)) {
      // Unknown reservation state and no gateway call was made: release our row.
      await service
        .from('refund_transactions')
        .delete()
        .eq('refund_id', refundId)
        .eq('transaction_id', transactionIdNum);
      await service.from('refunds').delete().eq('id', refundId);
      console.error('Reserve refund returned an unexpected payload', refundId, reserved);
      return NextResponse.json(
        { error: 'Failed to reserve refund. No money moved; safe to retry.' },
        { status: 500 }
      );
    }

    // Stamp the idempotency key before the gateway call so a retry that lands
    // while this request is in flight finds the reservation.
    if (idemKey) {
      await service
        .from('refunds')
        .update({ note: noteFor(idemKey, PENDING_NOTE) })
        .eq('id', refundId);
    }

    const continued = await continueWithReservation(service, {
      refundDbId: refundId,
      orderId: orderIdStr,
      transactionId: transactionIdNum,
      paymentId: txn.payment_id as string,
      txnAmount: txn.amount as number | null,
      amountPaise,
      cumulativePaise,
      idemKey,
    });
    if (continued) return continued;
    return NextResponse.json({ error: 'Refund failed' }, { status: 500 });
  } catch (error: unknown) {
    console.error('Refund failed', error);
    return NextResponse.json({ error: 'Refund failed' }, { status: 500 });
  }
}

/**
 * Gateway call + finalization for an already-reserved refund (fresh or
 * reused). Returns the HTTP response; null only when the caller must fall
 * through (unreachable in the current flows, kept for exhaustiveness).
 */
async function continueWithReservation(
  service: ServerClient,
  args: {
    refundDbId: number;
    orderId: string;
    transactionId: number;
    paymentId: string;
    txnAmount: number | null;
    amountPaise?: number;
    cumulativePaise?: number;
    idemKey?: string;
    deduplicated?: boolean;
  },
): Promise<NextResponse | null> {
  // Resolve amounts when reusing a reservation created by an earlier attempt.
  let amountPaise = args.amountPaise;
  let cumulativePaise = args.cumulativePaise;
  if (amountPaise === undefined) {
    const { data } = await service
      .from('refunds')
      .select('amount')
      .eq('id', args.refundDbId)
      .maybeSingle();
    amountPaise = Number((data as { amount?: unknown } | null)?.amount);
    if (!Number.isFinite(amountPaise)) {
      return NextResponse.json(
        { error: 'Existing reservation has no usable amount. Contact support.', refundId: args.refundDbId },
        { status: 500 },
      );
    }
  }

  // Order status reflects the cumulative total, so a final partial refund
  // still marks the order fully refunded. For a reused (retried) reservation
  // the cumulative is recomputed from sibling rows.
  const txnPaise = Math.round(Number(args.txnAmount) * 100);
  if (cumulativePaise === undefined) {
    cumulativePaise = Number(amountPaise) || 0;
    const { data: siblings } = await service
      .from('refund_transactions')
      .select('refund_id')
      .eq('transaction_id', args.transactionId);
    const siblingIds = ((siblings ?? []) as { refund_id: number }[])
      .map((s) => s.refund_id)
      .filter((id) => id !== args.refundDbId);
    if (siblingIds.length > 0) {
      const { data: others } = await service
        .from('refunds')
        .select('amount')
        .in('id', siblingIds);
      for (const other of (others ?? []) as { amount: number | null }[]) {
        cumulativePaise += Number(other.amount) || 0;
      }
    }
  }
  const isPartial =
    Number.isFinite(txnPaise) && txnPaise > 0
      ? (cumulativePaise as number) < txnPaise
      : false;

  // Step 3: gateway call. Reserved rows exist, so a failure here is safe to retry.
  const razorpay = razorpayClient();
  if (!razorpay) {
    return NextResponse.json({ error: 'Refund service not configured' }, { status: 500 });
  }
  let gatewayRefundId: string;
  try {
    // `receipt` ties the gateway refund to this reservation row: when an
    // unknown outcome is reconciled by listing gateway refunds, an amount-only
    // match could pick an earlier same-size partial refund and mark this
    // reservation processed even though this attempt never refunded.
    const receipt = String(args.refundDbId);
    const refund = (await razorpay.payments.refund(args.paymentId, {
      amount: amountPaise,
      receipt,
    })) as unknown as { id: string };
    gatewayRefundId = refund.id;
  } catch (gatewayError) {
    if (isUnknownGatewayError(gatewayError)) {
      // Money may have moved: preserve the reservation and reconcile on
      // retry instead of releasing it for a duplicate refund.
      const gatewayRefunds = await fetchGatewayRefunds(razorpay, args.paymentId);
      // Only a refund carrying this reservation's receipt proves *this*
      // attempt moved money. An amount-only match could be an earlier
      // same-size partial refund, so without it leave the reservation
      // unreconciled (unknown) for the explicit reconcile path.
      const match = (gatewayRefunds ?? []).find(
        (r) => r.receipt === String(args.refundDbId),
      );
      if (match) {
        const finalized = await finalizeRefund(service, {
          refundDbId: args.refundDbId,
          orderId: args.orderId,
          gatewayRefundId: match.id,
          isPartial,
          idemKey: args.idemKey,
        });
        if (finalized.ok) {
          return NextResponse.json({
            success: true,
            refundId: match.id,
            amount: amountPaise,
            deduplicated: args.deduplicated,
            reconciled: true,
          });
        }
        return NextResponse.json(
          {
            error: 'Refund issued but record failed. Reconcile with refund id.',
            refundId: match.id,
            reconcileRefundId: args.refundDbId,
            reconcileRequired: true,
          },
          { status: 500 },
        );
      }
      await service
        .from('refunds')
        .update({ note: noteFor(args.idemKey, UNKNOWN_NOTE) })
        .eq('id', args.refundDbId);
      console.error(
        'Razorpay refund outcome unknown after reservation; preserved for reconcile',
        args.refundDbId,
        gatewayError,
      );
      return NextResponse.json(
        {
          error:
            'Refund outcome unknown: the gateway may have processed it. Do not retry blindly — reconcile first.',
          refundId: args.refundDbId,
          reconcileRefundId: args.refundDbId,
          reconcileRequired: true,
        },
        { status: 503 },
      );
    }
    // Definite gateway rejection: nothing was refunded, release the
    // reservation so a corrected retry starts clean.
    await service
      .from('refund_transactions')
      .delete()
      .eq('refund_id', args.refundDbId)
      .eq('transaction_id', args.transactionId);
    await service
      .from('refunds')
      .update({ note: noteFor(args.idemKey, 'failed reservation - gateway error, no money moved') })
      .eq('id', args.refundDbId);
    console.error('Razorpay refund failed after reservation', args.refundDbId, gatewayError);
    return NextResponse.json(
      { error: 'Refund gateway failed. No money moved; safe to retry.', refundId: args.refundDbId },
      { status: 502 }
    );
  }

  // Step 4: idempotent finalize. A failure here preserves the gateway id on
  // the reservation (never releases it), so a retry reconciles instead of
  // refunding again.
  const finalized = await finalizeRefund(service, {
    refundDbId: args.refundDbId,
    orderId: args.orderId,
    gatewayRefundId,
    isPartial,
    idemKey: args.idemKey,
  });
  if (!finalized.ok) {
    return NextResponse.json(
      {
        error:
          finalized.step === 'order'
            ? 'Refund issued but order status update failed. Reconcile with refund id.'
            : 'Refund issued but record failed. Reconcile with refund id.',
        refundId: gatewayRefundId,
        reconcileRefundId: args.refundDbId,
        reconcileRequired: true,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    refundId: gatewayRefundId,
    amount: amountPaise,
    deduplicated: args.deduplicated,
  });
}

/**
 * Explicit reconcile: no gateway call. Confirms the gateway refund for a
 * pending/unknown reservation via `fetchMultipleRefund`, then finalizes the
 * local rows. Powers the `reconcileRefundId` retry path.
 */
async function reconcileReservation(
  service: ServerClient,
  args: { refundDbId: number; orderId: string; transactionId: number },
): Promise<NextResponse> {
  const { data: reservation } = await service
    .from('refunds')
    .select('id, order_id, note, amount, processed_at')
    .eq('id', args.refundDbId)
    .maybeSingle();
  const row = reservation as ReservationRow | null;
  if (!row || String(row.order_id) !== args.orderId) {
    return NextResponse.json({ error: 'Reservation not found for this order' }, { status: 404 });
  }
  const links = await linkedTransactionIds(service, [row.id]);
  if ((links.get(row.id) ?? []).includes(args.transactionId) === false) {
    return NextResponse.json({ error: 'Reservation not found for this transaction' }, { status: 404 });
  }
  const knownGatewayId = gatewayIdFromNote(row.note);
  if (knownGatewayId && row.processed_at) {
    // Same repair as the retry path: the earlier attempt may have marked the
    // refund processed and then failed the order update.
    await ensureOrderStatus(service, {
      orderId: args.orderId,
      transactionId: args.transactionId,
    });
    return NextResponse.json({ success: true, refundId: knownGatewayId, amount: row.amount });
  }

  const { data: txn } = await service
    .from('transactions')
    .select('amount, payment_id')
    .eq('id', args.transactionId)
    .maybeSingle();
  const paymentId = (txn as { payment_id?: string } | null)?.payment_id;
  if (!paymentId) {
    return NextResponse.json({ error: 'Transaction not found for this order' }, { status: 404 });
  }
  const razorpay = razorpayClient();
  if (!razorpay) {
    return NextResponse.json({ error: 'Refund service not configured' }, { status: 500 });
  }
  const gatewayRefunds = await fetchGatewayRefunds(razorpay, paymentId);
  if (!gatewayRefunds) {
    return NextResponse.json(
      {
        error: 'Could not reach the gateway to reconcile. Try again.',
        reconcileRefundId: row.id,
        reconcileRequired: true,
      },
      { status: 503 },
    );
  }
  const match =
    (knownGatewayId && gatewayRefunds.find((r) => r.id === knownGatewayId)) ||
    gatewayRefunds.find((r) => r.receipt === String(row.id)) ||
    gatewayRefunds.find((r) => r.amount === Number(row.amount));
  if (!match) {
    return NextResponse.json(
      {
        error: 'No matching gateway refund found. It is safe to retry the refund.',
        reconcileRefundId: row.id,
      },
      { status: 404 },
    );
  }
  const txnPaise = Math.round(Number((txn as { amount?: unknown } | null)?.amount) * 100);
  const { data: siblings } = await service
    .from('refund_transactions')
    .select('refund_id')
    .eq('transaction_id', args.transactionId);
  const siblingIds = ((siblings ?? []) as { refund_id: number }[]).map((s) => s.refund_id);
  let cumulative = Number(row.amount) || 0;
  if (siblingIds.length > 1) {
    const { data: others } = await service
      .from('refunds')
      .select('amount')
      .in('id', siblingIds.filter((id) => id !== row.id));
    for (const other of (others ?? []) as { amount: number | null }[]) {
      cumulative += Number(other.amount) || 0;
    }
  }
  const finalized = await finalizeRefund(service, {
    refundDbId: row.id,
    orderId: args.orderId,
    gatewayRefundId: match.id,
    isPartial: Number.isFinite(txnPaise) && txnPaise > 0 ? cumulative < txnPaise : false,
  });
  if (!finalized.ok) {
    return NextResponse.json(
      {
        error: 'Gateway refund confirmed but local record failed. Reconcile again.',
        refundId: match.id,
        reconcileRefundId: row.id,
        reconcileRequired: true,
      },
      { status: 500 },
    );
  }
  return NextResponse.json({ success: true, refundId: match.id, amount: row.amount, reconciled: true });
}

/**
 * ALREADY_REFUNDED follow-up: a pending/unknown reservation may still need
 * its local rows completed even though the cap blocks a new reserve. Finalize
 * the matching one when the gateway confirms it; otherwise report 409.
 */
async function reconcilePendingForTransaction(
  service: ServerClient,
  args: { orderId: string; transactionId: number },
): Promise<NextResponse | null> {
  const reservations = await listReservations(service, args.orderId);
  const links = await linkedTransactionIds(
    service,
    reservations.map((r) => r.id),
  );
  const pending = reservations.find(
    (r) =>
      (links.get(r.id) ?? []).includes(args.transactionId) &&
      (isPendingNote(r.note) || isUnknownNote(r.note)) &&
      !r.processed_at,
  );
  if (!pending) return null;
  return reconcileReservation(service, {
    refundDbId: pending.id,
    orderId: args.orderId,
    transactionId: args.transactionId,
  }).then((response) => (response.status === 404 ? null : response));
}
