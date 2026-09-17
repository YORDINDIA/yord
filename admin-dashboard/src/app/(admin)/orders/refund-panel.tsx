"use client";

import { useMemo, useState } from 'react';
import { toast } from '@/components/ui/Toast';

interface Transaction {
  id: number;
  payment_id: string | null;
  amount: number | null;
  status?: string | null;
}

export default function RefundPanel({ orderId, transactions }: { orderId: number; transactions: Transaction[] }) {
  const refundable = useMemo(
    () => transactions.filter((t) => (t.status || '').toLowerCase() !== 'refunded'),
    [transactions],
  );
  const [transactionId, setTransactionId] = useState(refundable[0]?.id ?? 0);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const disabled = loading || done || refundable.length === 0 || !transactionId;

  async function submit() {
    if (disabled) return;
    const parsedAmount = amount.trim() === '' ? undefined : Number(amount);
    if (parsedAmount !== undefined && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
      const err = 'Enter a positive amount, or leave empty for a full refund.';
      setMessage(err);
      toast(err, 'error');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, transactionId, amount: parsedAmount }),
      });
      const data = await response.json();
      if (!response.ok) {
        const err = data.error || 'Refund failed';
        setMessage(err);
        toast(err, 'error');
        return;
      }
      setDone(true);
      setMessage('Refund initiated successfully.');
      toast('Refund initiated successfully.', 'success');
    } catch {
      setMessage('Network error, try again.');
      toast('Network error, try again.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form-grid">
      {refundable.length === 0 && (
        <div className="helper">No refundable transactions. Everything here is already refunded.</div>
      )}
      <div>
        <label className="helper">Transaction</label>
        <select className="select" value={transactionId} onChange={(e) => setTransactionId(Number(e.target.value))} disabled={refundable.length === 0}>
          {refundable.map((txn) => (
            <option key={txn.id} value={txn.id}>#{txn.id} · {txn.payment_id || 'no payment id'}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="helper">Amount (optional)</label>
        <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="leave empty for full" inputMode="decimal" />
      </div>
      <button className="button" type="button" onClick={submit} disabled={disabled}>
        {loading ? 'Processing...' : done ? 'Refunded' : refundable.length === 0 ? 'Nothing to refund' : 'Trigger Refund'}
      </button>
      {message && <div className="helper">{message}</div>}
    </div>
  );
}
