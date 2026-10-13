import { CreditCard } from 'lucide-react';
import type { Refund, Transaction } from '@yord/db-types';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import ProgressBar from '@/components/ui/ProgressBar';
import StatusBadge from '@/components/ui/StatusBadge';
import CopyButton from './CopyButton';
import {
  formatDateTime,
  formatPaise,
  gatewayRefundId,
  orderRefundTotals,
  refundNoteLabel,
  relativeTime,
  remainingRefundablePaise,
} from './format';
import type { TransactionRefundState } from '@/lib/data/orders';
import { formatCurrency } from '@/lib/utils/format';

/**
 * Payments against the order, with the refund position next to every row.
 *
 * The per-row "refunded / remaining" pair is the same arithmetic
 * `reserve_refund()` enforces, and the summary at the foot reconciles it against
 * the captured total — the two numbers an admin needs before deciding whether a
 * refund is even possible. A refund row whose `amount` is null (recorded before
 * the reservation flow) is called out as unverifiable rather than shown as zero.
 */
export default function TransactionsCard({
  transactions,
  refunds,
  refundState,
  currency,
}: {
  transactions: Transaction[];
  refunds: Refund[];
  refundState: Record<string, TransactionRefundState>;
  currency: string;
}) {
  const {
    capturedPaise: captured,
    refundedPaise: refunded,
    refundablePaise: refundable,
  } = orderRefundTotals(transactions, refundState);

  const columns: DataTableColumn<Transaction>[] = [
    {
      key: 'kind',
      header: 'Kind',
      render: (txn) => <span className="cell-title">{txn.kind || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (txn) => <StatusBadge value={txn.status} dot />,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (txn) =>
        txn.amount === null ? (
          <span className="helper">amount not recorded</span>
        ) : (
          <span className="table-num">{formatCurrency(txn.amount, txn.currency || currency)}</span>
        ),
    },
    {
      key: 'refunded',
      header: 'Refunded / remaining',
      align: 'right',
      render: (txn) => {
        const state = refundState[String(txn.id)];
        const refundedPaise = state?.refundedPaise ?? 0;
        const remaining = remainingRefundablePaise({
          id: txn.id,
          amount: txn.amount,
          refundedPaise,
          unknownAmount: state?.unknownAmount,
        });
        return (
          <>
            <span className="table-num">{formatPaise(refundedPaise, txn.currency || currency)}</span>
            <div className="cell-sub">
              {state?.unknownAmount
                ? 'unverifiable — pre-migration refund'
                : `${formatPaise(remaining, txn.currency || currency)} left`}
            </div>
          </>
        );
      },
    },
    {
      key: 'payment',
      header: 'Payment id',
      hideOnTablet: true,
      render: (txn) => (
        <span className="row">
          <span className="mono">{txn.payment_id || '—'}</span>
          <CopyButton
            small
            value={txn.payment_id}
            ariaLabel={txn.payment_id ? `Copy payment id ${txn.payment_id}` : 'No payment id'}
            toastMessage="Payment id copied."
          />
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Date',
      align: 'right',
      hideOnMobile: true,
      render: (txn) => (
        <span className="table-num helper" title={formatDateTime(txn.created_at)}>
          {relativeTime(txn.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Transactions</div>
          <div className="helper">Captured, refunded, and still refundable. Refunds run through Razorpay.</div>
        </div>
        {captured > 0 && (
          <span className="helper">
            {formatPaise(refunded, currency)} of {formatPaise(captured, currency)} refunded
          </span>
        )}
      </div>

      <DataTable
        caption="Transactions"
        columns={columns}
        rows={transactions}
        rowKey={(txn) => txn.id}
        emptyTitle="No payment recorded"
        emptyHint="Nothing has been charged against this order — there is nothing to refund."
        emptyIcon={<CreditCard size={26} aria-hidden />}
      />

      {transactions.length > 0 && (
        <div className="card-inset" style={{ marginTop: 10 }}>
          <div className="row-between">
            <span className="helper">Captured</span>
            <span className="table-num">{formatPaise(captured, currency)}</span>
          </div>
          <div className="row-between">
            <span className="helper">Refunded</span>
            <span className="table-num">{formatPaise(refunded, currency)}</span>
          </div>
          <div className="row-between">
            <span className="helper">Still refundable</span>
            <span className="table-num">{formatPaise(refundable, currency)}</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <ProgressBar tone="rose" size="sm" label="Refunded" value={refunded} max={captured} />
          </div>
        </div>
      )}

      {refunds.length > 0 && (
        <div className="list-rows" style={{ marginTop: 10 }}>
          <div className="helper" style={{ padding: '0 8px 4px' }}>
            Refund records
          </div>
          {refunds.map((refund) => {
            const gatewayId = gatewayRefundId(refund.note);
            return (
              <div key={refund.id} className="list-row">
                <span className="list-row-body">
                  <span className="list-row-title">
                    Refund #{refund.id} ·{' '}
                    {refund.amount === null
                      ? 'amount not recorded'
                      : formatPaise(Number(refund.amount), currency)}
                  </span>
                  <span className="list-row-sub">
                    {gatewayId ? `Razorpay ${gatewayId}` : refundNoteLabel(refund.note)}
                  </span>
                </span>
                <span className="list-row-meta" title={formatDateTime(refund.created_at)}>
                  {relativeTime(refund.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
