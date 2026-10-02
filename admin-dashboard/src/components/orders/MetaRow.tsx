import type { ReactNode } from 'react';
import styles from './orders.module.css';

/**
 * One label/value row in the order's totals, details, and refund summaries.
 *
 * `<dt>`/`<dd>` inside a `<div>` wrapper: valid inside a `<dl>` (HTML allows the
 * grouping element) and it gives the row a flex layout globals.css cannot
 * express without touching the design system.
 */
export default function MetaRow({
  label,
  children,
  strong = false,
}: {
  label: string;
  children: ReactNode;
  /** The grand-total row: heavier type and a rule above it. */
  strong?: boolean;
}) {
  return (
    <div className={strong ? `${styles.totalRow} ${styles.totalRowGrand}` : styles.totalRow}>
      <dt className={styles.totalLabel}>{label}</dt>
      <dd className={styles.totalValue}>{children}</dd>
    </div>
  );
}
