import type { ReactNode } from 'react';
import styles from './dashboard.module.css';

/**
 * The fixed-width KPI strip.
 *
 * `StatCard` itself is agnostic about layout; `.stat-grid` in `globals.css` is
 * `auto-fit`, which on a wide screen puts all eight dashboard tiles on one row.
 * This wrapper pins the strip to 4 per row (3/2/1 as the viewport narrows) so
 * the tiles stay scannable.
 */
export default function KpiRow({ children }: { children: ReactNode }) {
  return <div className={styles.kpiRow}>{children}</div>;
}
