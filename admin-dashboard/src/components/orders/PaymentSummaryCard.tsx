import MetaRow from './MetaRow';
import styles from './orders.module.css';
import { formatPaise } from './format';
import { formatCurrency } from '@/lib/utils/format';

/**
 * What the order cost, using the order's own stored totals.
 *
 * Nothing here is recomputed from the line items except the subtotal, and only
 * when the order stored none (`derived`) — the admin needs the numbers the
 * customer was charged, not a fresh sum that silently disagrees with the
 * payment. The refunded figure is shown as a deduction so the total on screen
 * still reads as the amount captured.
 */
export default function PaymentSummaryCard({
  currency,
  subtotal,
  derived,
  discounts,
  shipping,
  tax,
  total,
  refundedPaise,
  refundablePaise,
}: {
  currency: string;
  subtotal: number;
  /** True when `subtotal` came from the line items. */
  derived: boolean;
  discounts: number;
  shipping: number;
  tax: number;
  total: number;
  refundedPaise: number;
  refundablePaise: number;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Payment summary</div>
          <div className="helper">
            {derived
              ? 'Subtotal derived from the line items — the order did not store one.'
              : `Charged in ${currency}. Totals are the order's own, not recomputed.`}
          </div>
        </div>
        {refundablePaise > 0 && (
          <span className="helper">{formatPaise(refundablePaise, currency)} still refundable</span>
        )}
      </div>

      <dl className={styles.totals}>
        <MetaRow label="Subtotal">{formatCurrency(subtotal, currency)}</MetaRow>
        {discounts > 0 && (
          <MetaRow label="Discounts">
            <span className={styles.totalDeduction}>−{formatCurrency(discounts, currency)}</span>
          </MetaRow>
        )}
        <MetaRow label="Shipping">{formatCurrency(shipping, currency)}</MetaRow>
        <MetaRow label="Tax">{formatCurrency(tax, currency)}</MetaRow>
        <MetaRow label="Total" strong>
          {formatCurrency(total, currency)}
        </MetaRow>
        {refundedPaise > 0 && (
          <MetaRow label="Refunded">
            <span className={styles.totalDeduction}>−{formatPaise(refundedPaise, currency)}</span>
          </MetaRow>
        )}
      </dl>
    </div>
  );
}
