import { PackageCheck } from 'lucide-react';
import Link from 'next/link';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import Thumb from '@/components/ui/Thumb';
import type { LowStockRow } from '@/lib/data/analytics';
import { variantDetail } from './variant-detail';
import styles from './dashboard.module.css';

/** Label + tone for a variant's remaining stock. NULL is "unknown", never zero. */
function stockBadge(quantity: number | null) {
  if (quantity === null) return { value: 'unknown', label: 'Unknown' };
  if (quantity <= 0) return { value: 'out', label: 'Out of stock' };
  return { value: 'low', label: `${quantity} left` };
}

/**
 * The worst-stocked variants, thumbnails first.
 *
 * Rows come from `getDashboardExtras().lowStock` (already ordered, already
 * capped, cover images resolved in one query), so this is presentation only.
 * An empty list is a real result — every variant is above the threshold — and
 * says so rather than rendering an empty card.
 */
export default function LowStockList({ rows }: { rows: LowStockRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<PackageCheck size={22} aria-hidden="true" />}
        title="Stock is healthy"
        hint="No variant is at or below the low-stock threshold."
        actionLabel="Open inventory"
        actionHref="/inventory"
      />
    );
  }

  return (
    <ul className={styles.list}>
      {rows.map((row) => {
        const badge = stockBadge(row.quantity);
        const detail = variantDetail(row.title, row.variantTitle);
        return (
          <li key={row.variantId} className={styles.listRow}>
            <Thumb src={row.imageUrl} size="md" />
            <div className={styles.listBody}>
              <Link
                className={styles.listTitle}
                href={row.productId ? `/products/${row.productId}` : '/inventory'}
              >
                {row.title}
              </Link>
              {detail ? <span className={styles.listSub}>{detail}</span> : null}
            </div>
            <StatusBadge value={badge.value} label={badge.label} />
          </li>
        );
      })}
    </ul>
  );
}
