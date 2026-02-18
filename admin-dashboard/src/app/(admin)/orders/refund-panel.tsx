"use client";

import { useState } from 'react';

interface Transaction {
  id: number;
  payment_id: string | null;
  amount: number | null;
}

export default function RefundPanel({ orderId, transactions }: { orderId: number; transactions: Transaction[] }) {
  const [transactionId, setTransactionId] = useState(transactions[0]?.id ?? 0);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!transactionId) return;
    setLoading(true);
    setMessage(null);
    const response = await fetch('/api/refunds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, transactionId, amount: amount ? Number(amount) : undefined }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error || 'Refund failed');
      return;
    }
    setMessage('Refund initiated successfully.');
  }

  return (
    <div className="form-grid">
      {transactions.length === 0 && (
        <div className="helper">No transactions available for refund.</div>
      )}
      <div>
        <label className="helper">Transaction</label>
        <select className="select" value={transactionId} onChange={(e) => setTransactionId(Number(e.target.value))}>
          {transactions.map((txn) => (
            <option key={txn.id} value={txn.id}>#{txn.id} · {txn.payment_id || 'no payment id'}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="helper">Amount (optional)</label>
        <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="leave empty for full" />
      </div>
      <button className="button" type="button" onClick={submit} disabled={loading}>
        {loading ? 'Processing...' : 'Trigger Refund'}
      </button>
      {message && <div className="helper">{message}</div>}
    </div>
  );
}
