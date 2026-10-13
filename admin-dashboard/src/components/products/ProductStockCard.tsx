import clsx from 'clsx';
import ProgressBar from '@/components/ui/ProgressBar';
import StatusBadge from '@/components/ui/StatusBadge';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { stockCardSummary, stockToneName } from './stock-tone';
import styles from './products.module.css';

/** Rows this card draws before summarising the rest: a rail is not a table. */
const BAR_LIMIT = 8;

/**
 * Variants/stock summary for the product side rail.
 *
 * Server component — the numbers are all derived from the variants the page
 * already read, so this costs no query. Each bar is scaled against the largest
 * variant so the shape of the stock reads at a glance; the tone is the same
 * out/low/ok vocabulary the table and the catalog use.
 *
 * Untracked variants (`inventory_quantity = null`) are their own state, not
 * zero: they are excluded from "Units on hand" and from the low/out counts and
 * reported separately, mirroring `StockCell` in the inventory table.
 *
 * The rail is a fixed 320px column (294px of card content), so the bar list
 * carries `styles.bars`: a long variant name used to make `ProgressBar`'s label
 * line 302px wide, 8px past the card. See `products.module.css` for the scoped
 * shrink/ellipsis rules.
 */
export default function ProductStockCard({
  variants,
}: {
  variants: { id: number; title: string | null; inventory_quantity: number | null }[];
}) {
  const { quantities, total, max, low, out, untracked } = stockCardSummary(variants);

  return (
    <div className="card">
      <div className="card-header">
        <div className="section-title">Stock</div>
        <span className="helper">
          {variants.length} variant{variants.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className={clsx('row-between', styles.railRow)}>
        <span className="helper">Units on hand</span>
        <span className="num strong">{total}</span>
      </div>

      {(low > 0 || out > 0 || untracked > 0) && (
        <div className={clsx('row', styles.wrapRow)} style={{ marginTop: 8 }}>
          {low > 0 && <StatusBadge value="low" label={`${low} low`} dot />}
          {out > 0 && <StatusBadge value="out" label={`${out} out`} dot />}
          {untracked > 0 && (
            <StatusBadge value="untracked" label={`${untracked} untracked`} tone="neutral" dot />
          )}
        </div>
      )}

      {variants.length > 0 ? (
        <div className={clsx('stack-sm', styles.bars)} style={{ marginTop: 10 }}>
          {variants.slice(0, BAR_LIMIT).map((variant, index) => {
            const quantity = quantities[index];
            const name = variant.title?.trim() || 'Default';
            // No meter for an unknown quantity: a zero-height bar would read
            // as "sold out", the exact mislabel this card no longer makes.
            return quantity === null ? (
              <div key={variant.id} className="stack-sm">
                <div className="row-between">
                  <span className="helper">{name}</span>
                  <span className="helper">Untracked</span>
                </div>
              </div>
            ) : (
              <ProgressBar
                key={variant.id}
                size="sm"
                value={quantity}
                max={max}
                tone={stockToneName(quantity)}
                label={name}
              />
            );
          })}
          {variants.length > BAR_LIMIT && (
            <span className="helper">+ {variants.length - BAR_LIMIT} more variants</span>
          )}
        </div>
      ) : (
        <div className="helper" style={{ marginTop: 8 }}>
          No variants on this product.
        </div>
      )}

      <div className="helper" style={{ marginTop: 8 }}>
        Low stock is at or below {LOW_STOCK_THRESHOLD} units.
        {untracked > 0
          ? ` ${untracked} untracked variant${untracked === 1 ? ' is' : 's are'} not counted.`
          : ''}
        {variants.length > 1 ? ' Bars are scaled to the largest variant.' : ''}
      </div>
    </div>
  );
}
