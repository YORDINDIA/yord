'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { refundSchema } from '@/lib/validation';
import { formatCurrency } from '@/lib/utils/format';
import { postJson } from '@/lib/utils/post-json';

/** Shape the refund panel needs; the real `Transaction` row has more columns. */
export interface RefundTransaction {
  id: number;
  payment_id: string | null;
  amount: number | null;
  currency?: string | null;
  status?: string | null;
}

/**
 * Refund trigger.
 *
 * The money path stays the authenticated `POST /api/refunds` route, because
 * refund idempotency depends on `reserve_refund()` running before the gateway
 * call (supabase/migrations/002_refund_idempotency.sql) — moving that into a
 * server action would not change the ordering, but keeping the existing,
 * reviewed route is the smaller risk.
 *
 * The amount is checked with `refundSchema` before the request is sent. That is
 * fast feedback only: the route hand-validates its payload and is the boundary.
 * Failures raise one toast through the provider.
 */
export default function RefundPanel({
  orderId,
  transactions,
}: {
  orderId: number;
  transactions: RefundTransaction[];
}) {
  const refundable = useMemo(
    () => transactions.filter((t) => (t.status || '').toLowerCase() !== 'refunded'),
    [transactions],
  );
  const [transactionId, setTransactionId] = useState(refundable[0]?.id ?? 0);
  const [amount, setAmount] = useState('');
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const disabled = pending || done || refundable.length === 0 || !transactionId;

  function submit() {
    if (disabled) return;
    const raw = amount.trim();
    // Fast feedback; the API route re-validates.
    const parsed = refundSchema.safeParse({
      orderId,
      transactionId,
      amount: raw === '' ? undefined : raw,
    });
    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message ?? 'Check the refund amount.', 'error');
      return;
    }
    startTransition(async () => {
      const result = await postJson<{ refundId: string }>(
        '/api/refunds',
        parsed.data,
        'Refund failed',
      );
      if (!result.ok) {
        toast(result.message, 'error');
        return;
      }
      setDone(true);
      toast(`Refund ${result.data.refundId} initiated.`, 'success');
      router.refresh();
    });
  }

  return (
    <div className="form-grid">
      {refundable.length === 0 && (
        <div className="helper">
          No refundable transactions. Everything here is already refunded.
        </div>
      )}
      <div>
        <label className="helper" htmlFor="refund-transaction">
          Transaction
        </label>
        <select
          id="refund-transaction"
          className="select"
          value={transactionId}
          onChange={(e) => setTransactionId(Number(e.target.value))}
          disabled={refundable.length === 0 || pending}
        >
          {refundable.map((txn) => (
            <option key={txn.id} value={txn.id}>
              #{txn.id} · {txn.payment_id || 'no payment id'} ·{' '}
              {formatCurrency(txn.amount, txn.currency || 'INR')}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="helper" htmlFor="refund-amount">
          Amount (optional)
        </label>
        <input
          id="refund-amount"
          className="input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="leave empty for full"
          inputMode="decimal"
          disabled={pending}
          aria-describedby="refund-amount-hint"
        />
        <div className="helper" id="refund-amount-hint">
          Partial refunds are capped at the remaining refundable amount.
        </div>
      </div>
      <div>
        <button className="button" type="button" onClick={submit} disabled={disabled}>
          {pending
            ? 'Processing…'
            : done
              ? 'Refunded'
              : refundable.length === 0
                ? 'Nothing to refund'
                : 'Trigger Refund'}
        </button>
      </div>
    </div>
  );
}
