import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import EmptyState from '@/components/ui/EmptyState';
import Thumb from '@/components/ui/Thumb';
import type { TopProduct } from '@/lib/data/analytics';
import { formatCurrency } from '@/lib/utils/format';
import styles from './dashboard.module.css';

/**
 * Ranked top products with covers and money.
 *
 * The list is the readable half of the `Bars` chart beside it: bars compare
 * units at a glance, the list carries the product name, the cover, and the
 * revenue the SQL rollup attributed to the product id.
 *
 * `covers` is a Map, not a per-row URL, because the rows all share one
 * `coversForProducts()` query — a product with no image is simply absent and
 * `Thumb` renders its placeholder glyph.
 */
export default function TopProductsList({
  rows,
  covers,
}: {
  rows: TopProduct[];
  covers: Map<number, string>;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 size={22} aria-hidden="true" />}
        title="No sales yet"
        hint="Products rank here once orders carry line items."
        actionLabel="Open catalog"
        actionHref="/products"
      />
    );
  }

  return (
    <ul className={styles.list}>
      {rows.map((row, index) => (
        <li key={`${row.productId ?? 'none'}-${row.title}`} className={styles.listRow}>
          <span className={styles.rank} aria-hidden="true">
            {index + 1}
          </span>
          <Thumb src={row.productId ? covers.get(row.productId) : undefined} size="md" />
          <div className={styles.listBody}>
            {row.productId ? (
              <Link className={styles.listTitle} href={`/products/${row.productId}`}>
                {row.title}
              </Link>
            ) : (
              // Deleted products keep their sales history; there is no page to
              // link to, so the title renders as plain text rather than a
              // dead link.
              <span className={styles.listTitle}>{row.title}</span>
            )}
            <span className={styles.listSub}>
              {row.quantity} {row.quantity === 1 ? 'unit' : 'units'}
            </span>
          </div>
          <span className={styles.listMeta}>
            <span className="num">{formatCurrency(row.revenue, 'INR')}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
