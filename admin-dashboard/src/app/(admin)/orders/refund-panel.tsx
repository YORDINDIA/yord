'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, RotateCcw } from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/ToastProvider';
import { refundSchema } from '@/lib/validation';
import { formatCurrency } from '@/lib/utils/format';
import { postJson } from '@/lib/utils/post-json';
import {
  formatPaise,
  paiseToInput,
  remainingRefundablePaise,
  toPaise,
} from '@/components/orders/format';
import styles from '@/components/orders/orders.module.css';

/** Shape the refund panel needs; the real `Transaction` row has more columns. */
export interface RefundTransaction {
  id: number;
  payment_id: string | null;
  amount: number | null;
  currency?: string | null;
  status?: string | null;
  /** Refunded against this transaction so far, in paise. */
  refundedPaise?: number;
  /** A pre-migration refund with no amount: the transaction is fully refunded. */
  unknownAmount?: boolean;
}

/** 25 / 50 / 100% of the remaining refundable balance, in paise. */
const QUICK_FILLS = [25, 50, 100] as const;

/**
 * Refund trigger.
 *
 * The money path stays the authenticated `POST /api/refunds` route, because
 * refund idempotency depends on `reserve_refund()` running before the gateway
 * call (supabase/migrations/002_refund_idempotency.sql) — moving that into a
 * server action would not change the ordering, but keeping the existing,
 * reviewed route is the smaller risk. The body is exactly what `refundSchema`
 * parses, unchanged.
 *
 * The panel mirrors the route's cap before the click: `remainingRefundablePaise`
 * is the same arithmetic `reserve_refund()` applies (transaction total less
 * everything already refunded, and zero when a refund row has no amount), so the
 * prefilled amount, the quick fills, and the inline error all agree with the
 * server instead of failing at the gateway.
 *
 * The amount is checked with `refundSchema` before the request is sent. That is
 * fast feedback only: the route hand-validates its payload and is the boundary.
 */
export default function RefundPanel({
  orderId,
  transactions,
  currency = 'INR',
}: {
  orderId: string;
  transactions: RefundTransaction[];
  currency?: string;
}) {
  const refundable = useMemo(
    () =>
      transactions.filter(
        (txn) => (txn.status || '').toLowerCase() !== 'refunded' && remainingRefundablePaise(txn) > 0,
      ),
    [transactions],
  );

  const [selectedId, setSelectedId] = useState(refundable[0]?.id ?? 0);
  const selected = refundable.find((txn) => txn.id === selectedId) ?? refundable[0];
  const maxPaise = selected ? remainingRefundablePaise(selected) : 0;

  // Prefill = the full remaining balance. Adjusted during render (not in an
  // effect) when the selection changes or when `router.refresh()` hands back a
  // smaller balance, which is the pattern `SearchInput` documents.
  const [prefill, setPrefill] = useState({ id: selected?.id ?? 0, max: maxPaise });
  const [amount, setAmount] = useState(() => paiseToInput(maxPaise));
  if (prefill.id !== (selected?.id ?? 0) || prefill.max !== maxPaise) {
    setPrefill({ id: selected?.id ?? 0, max: maxPaise });
    setAmount(paiseToInput(maxPaise));
  }

  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<{ refundId: string; paise: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  // Fast feedback; the API route re-validates and is the boundary.
  const parsed = refundSchema.safeParse({
    orderId,
    transactionId: selected?.id ?? 0,
    amount: amount.trim() === '' ? undefined : amount.trim(),
  });
  const schemaError = parsed.success ? undefined : parsed.error.issues[0]?.message;
  const overCap =
    parsed.success && parsed.data.amount !== undefined && toPaise(parsed.data.amount) > maxPaise
      ? `That is more than the ${formatPaise(maxPaise, currency)} still refundable on this transaction.`
      : undefined;
  const validationError = schemaError ?? overCap;

  const amountPaise = parsed.success
    ? parsed.data.amount === undefined
      ? maxPaise
      : toPaise(parsed.data.amount)
    : 0;

  const disabled = pending || done !== null || refundable.length === 0 || !selected;

  function submit() {
    if (disabled || !selected || !parsed.success || validationError) return;
    // Exactly the schema's output — the route coerces and re-validates.
    const payload = parsed.data;
    startTransition(async () => {
      const result = await postJson<{ refundId: string }>('/api/refunds', payload, 'Refund failed');
      setConfirming(false);
      if (!result.ok) {
        // The route's own text is the message (already preferred by postJson),
        // including "reconcile first" outcomes from an unknown gateway state.
        setFormError(result.message);
        toast(result.message, 'error');
        return;
      }
      setFormError(null);
      setDone({ refundId: result.data.refundId, paise: amountPaise });
      toast(`Refund ${result.data.refundId} initiated.`, 'success');
      router.refresh();
    });
  }

  if (refundable.length === 0 && !done) {
    return (
      <div className="stack-sm">
        <span className="helper">
          {transactions.length === 0
            ? 'No payment on this order, so there is nothing to refund.'
            : 'Nothing left to refund — every captured transaction is already refunded in full.'}
        </span>
      </div>
    );
  }

  return (
    <>
      {done ? (
        <div className={styles.successBlock}>
          <span className={styles.successTitle}>
            <Check size={13} aria-hidden />
            Refund initiated
          </span>
          <span className="helper">
            {formatPaise(done.paise, currency)} sent to Razorpay. The order status updates when the
            gateway settles.
          </span>
          <span className={styles.refundIdRow}>
            <span className="helper">Razorpay refund id</span>
            <span className="chip mono">{done.refundId}</span>
          </span>
          <button className="button small" type="button" onClick={() => setDone(null)}>
            Refund another transaction
          </button>
        </div>
      ) : (
        <div className="stack-sm">
          <div className="stack-sm">
            <span className="helper">Transaction</span>
            <div className={styles.pickList} role="group" aria-label="Choose a transaction to refund">
              {refundable.map((txn) => {
                const remaining = remainingRefundablePaise(txn);
                const isSelected = txn.id === selected?.id;
                return (
                  <button
                    key={txn.id}
                    type="button"
                    className={styles.pickRow}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedId(txn.id)}
                    disabled={pending}
                  >
                    <span className={styles.pickBody}>
                      <span className={styles.pickTitle}>
                        {formatCurrency(txn.amount, txn.currency || currency)}
                      </span>
                      <span className={styles.pickSub}>
                        #{txn.id} · {(txn.payment_id || 'no payment id').trim()}
                      </span>
                      <span className={styles.pickSub}>
                        {formatPaise(remaining, txn.currency || currency)} refundable
                        {(txn.refundedPaise ?? 0) > 0
                          ? ` · ${formatPaise(txn.refundedPaise ?? 0, txn.currency || currency)} already refunded`
                          : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="refund-amount">
              Amount to refund
            </label>
            <input
              id="refund-amount"
              className="input"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="leave empty for full"
              inputMode="decimal"
              disabled={pending}
              aria-invalid={Boolean(validationError)}
              aria-describedby="refund-amount-hint"
            />
            <div className={styles.quickFills}>
              {QUICK_FILLS.map((percent) => (
                <button
                  key={percent}
                  type="button"
                  className="button small"
                  disabled={pending || maxPaise === 0}
                  onClick={() => setAmount(paiseToInput(Math.floor((maxPaise * percent) / 100)))}
                >
                  {percent === 100 ? 'Max' : `${percent}%`}
                </button>
              ))}
            </div>
            {validationError ? (
              <div className={styles.amountError} id="refund-amount-hint" role="alert">
                {validationError}
              </div>
            ) : (
              <div className="helper" id="refund-amount-hint">
                Up to {formatPaise(maxPaise, currency)}. Leave empty to refund the remainder.
              </div>
            )}
          </div>

          {formError && (
            <div className="form-alert form-alert-error tone-rose" role="alert">
              <AlertTriangle size={14} className="tone-icon" aria-hidden style={{ flex: 'none' }} />
              <span>{formError}</span>
            </div>
          )}

          <button
            className="button danger block"
            type="button"
            onClick={() => setConfirming(true)}
            disabled={disabled || Boolean(validationError)}
            aria-busy={pending}
          >
            <RotateCcw size={13} aria-hidden />
            {pending ? 'Processing…' : 'Refund via Razorpay'}
          </button>
          <span className="helper">
            Opens a confirmation step. The reservation is written before the gateway call, so a
            double-click cannot refund twice.
          </span>
        </div>
      )}

      <ConfirmModal
        open={confirming}
        tone="danger"
        title="Refund this transaction?"
        confirmLabel={`Refund ${formatPaise(amountPaise, currency)}`}
        pending={pending}
        onClose={() => setConfirming(false)}
        onConfirm={submit}
        body="Razorpay is called immediately and the money leaves your account. This cannot be undone from here."
      >
        <dl className={styles.totals}>
          <div className={styles.totalRow}>
            <dt className={styles.totalLabel}>Transaction</dt>
            <dd className={styles.totalValue}>#{selected?.id ?? 0}</dd>
          </div>
          <div className={styles.totalRow}>
            <dt className={styles.totalLabel}>Payment id</dt>
            <dd className={styles.totalValue}>{selected?.payment_id || '—'}</dd>
          </div>
          <div className={styles.totalRow}>
            <dt className={styles.totalLabel}>Refund amount</dt>
            <dd className={styles.totalValue}>{formatPaise(amountPaise, currency)}</dd>
          </div>
          <div className={styles.totalRow}>
            <dt className={styles.totalLabel}>Left refundable after this</dt>
            <dd className={styles.totalValue}>
              {formatPaise(Math.max(0, maxPaise - amountPaise), currency)}
            </dd>
          </div>
        </dl>
      </ConfirmModal>
    </>
  );
}
