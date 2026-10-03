import clsx from 'clsx';
import { Check } from 'lucide-react';
import { formatDiscountValue, formatWindow } from './format';
import styles from './discounts.module.css';

/**
 * Coupon-style preview of the rule being created.
 *
 * Presentational only — the form owns every value, so the card has no state of
 * its own and cannot drift from what will be submitted. It is imported by a
 * client component, so it renders on the client too; it holds no hooks and no
 * browser APIs.
 */
export default function DiscountPreview({
  title,
  code,
  value,
  valueType,
  startsAt,
  endsAt,
}: {
  title: string;
  code: string;
  /** Raw input text, so an empty field previews as "no value" rather than ₹0. */
  value: string;
  valueType: string;
  startsAt: string;
  endsAt: string;
}) {
  const typed = value.trim() !== '' ? Number(value) : null;
  const formatted = typed === null ? null : formatDiscountValue(typed, valueType);

  return (
    <div className="card">
      <div className="card-header">
        <span className="section-title">Preview</span>
        <span className="helper">Updates as you type</span>
      </div>

      <div className={clsx('tone-orange', styles.coupon)}>
        <span className={clsx(styles.couponCode, 'mono', !code && styles.couponPlaceholder)}>
          {code || 'YOUR-CODE'}
        </span>
        <span className={styles.couponValue}>
          {formatted ? `${formatted} off` : 'No value yet'}
        </span>
        <span className="helper">{formatWindow(startsAt, endsAt)}</span>
      </div>

      <div className={styles.previewMeta}>
        <span className="helper truncate">{title || 'Untitled discount'}</span>
        <span className="row helper">
          <Check size={12} aria-hidden />
          Applies to all products
        </span>
      </div>
    </div>
  );
}
