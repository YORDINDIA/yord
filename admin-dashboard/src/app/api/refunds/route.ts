export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getNextId } from '@/lib/utils/ids';
import { requireAdmin } from '@/lib/utils/admin';

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
export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const { service } = auth;

    const { orderId, transactionId, amount } = await req.json();
    if (!orderId || !transactionId) {
      return NextResponse.json({ error: 'orderId and transactionId are required' }, { status: 400 });
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
      .eq('id', transactionId)
      .eq('order_id', orderId)
      .single();
    if (txnError || !txn?.payment_id) {
      return NextResponse.json({ error: 'Transaction not found for this order' }, { status: 404 });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: 'Refund service not configured' }, { status: 500 });
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
        p_transaction_id: transactionId,
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
        .eq('transaction_id', transactionId);
      await service.from('refunds').delete().eq('id', refundId);
      console.error('Reserve refund returned an unexpected payload', refundId, reserved);
      return NextResponse.json(
        { error: 'Failed to reserve refund. No money moved; safe to retry.' },
        { status: 500 }
      );
    }

    // Order status reflects the cumulative total, so a final partial refund
    // still marks the order fully refunded.
    const txnPaise = Math.round(Number(txn.amount) * 100);
    const isPartial = Number.isFinite(txnPaise) && txnPaise > 0 ? cumulativePaise < txnPaise : false;

    // Step 3: gateway call. Reserved rows exist, so a failure here is safe to retry.
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    let gatewayRefundId: string;
    try {
      const refund = (await razorpay.payments.refund(txn.payment_id, {
        amount: amountPaise,
      })) as unknown as { id: string };
      gatewayRefundId = refund.id;
    } catch (gatewayError) {
      // Release the reservation so a retry starts clean; nothing was refunded.
      await service
        .from('refund_transactions')
        .delete()
        .eq('refund_id', refundId)
        .eq('transaction_id', transactionId);
      await service
        .from('refunds')
        .update({ note: 'failed reservation - gateway error, no money moved' })
        .eq('id', refundId);
      console.error('Razorpay refund failed after reservation', refundId, gatewayError);
      return NextResponse.json(
        { error: 'Refund gateway failed. No money moved; safe to retry.', refundId },
        { status: 502 }
      );
    }

    // Step 4a: mark the reservation complete.
    const completedAt = new Date().toISOString();
    const { error: completeError } = await service
      .from('refunds')
      .update({ note: `Razorpay refund ${gatewayRefundId}`, processed_at: completedAt })
      .eq('id', refundId);
    if (completeError) {
      console.error('Refund record completion failed after gateway refund', gatewayRefundId, completeError);
      return NextResponse.json(
        { error: 'Refund issued but record failed. Contact support with refund id.', refundId: gatewayRefundId },
        { status: 500 }
      );
    }

    // Step 4b: order status. Link row already exists from the reservation.
    const { error: orderError } = await service
      .from('orders')
      .update({ financial_status: isPartial ? 'partially_refunded' : 'refunded' })
      .eq('id', orderId);
    if (orderError) {
      console.error('Order status update failed after refund', refundId, orderError);
      return NextResponse.json(
        { error: 'Refund issued but order status update failed. Manual reconciliation required.', refundId: gatewayRefundId },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, refundId: gatewayRefundId, amount: amountPaise });
  } catch (error: unknown) {
    console.error('Refund failed', error);
    return NextResponse.json({ error: 'Refund failed' }, { status: 500 });
  }
}
