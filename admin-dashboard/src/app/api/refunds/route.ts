export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createServiceClient } from '@/lib/supabase/server';
import { getNextId } from '@/lib/utils/ids';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

export async function POST(req: Request) {
  try {
    const { orderId, transactionId, amount } = await req.json();
    const supabase = createServiceClient();

    const { data: txn } = await supabase.from('transactions').select('*').eq('id', transactionId).single();
    if (!txn?.payment_id) {
      return NextResponse.json({ error: 'Missing payment_id for transaction' }, { status: 400 });
    }

    const refundAmount = amount ? Math.round(Number(amount) * 100) : undefined; // Razorpay expects paise
    const refund = await razorpay.payments.refund(txn.payment_id, refundAmount ? { amount: refundAmount } : undefined);

    const refundId = await getNextId('refunds');
    const now = new Date().toISOString();
    await supabase.from('refunds').insert({
      id: refundId,
      order_id: orderId,
      note: `Razorpay refund ${refund.id}`,
      created_at: now,
      processed_at: now,
    });
    await supabase.from('refund_transactions').insert({
      refund_id: refundId,
      transaction_id: transactionId,
    });
    await supabase.from('orders').update({ financial_status: 'refunded' }).eq('id', orderId);

    return NextResponse.json({ success: true, refund });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to refund' }, { status: 500 });
  }
}
