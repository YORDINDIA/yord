import clsx from 'clsx';
import { IndianRupee, Percent, Tag } from 'lucide-react';
import ProgressBar, { type ToneName } from '@/components/ui/ProgressBar';
import { formatCount } from './format';
import styles from './discounts.module.css';

/**
 * The list row's leading mark. There is no image for a discount, so the tile is
 * a glyph: the value type (`%` vs `₹`) on a surface tinted by the row's status,
 * in the same 26px box `.thumb-sm` uses.
 *
 * Server-safe — no state, no hooks — so the server page can pass it to
 * `DataTable`'s `leading` slot.
 */
export function DiscountMark({ tone, valueType }: { tone: ToneName; valueType: string }) {
  const Icon =
    valueType === 'percentage' ? Percent : valueType === 'fixed_amount' ? IndianRupee : Tag;
  return (
    <span className={clsx(styles.mark, `tone-${tone}`)}>
      <Icon size={13} aria-hidden />
    </span>
  );
}

/**
 * Redemptions cell: the code's `usage_count`, and — only when the rule sets a
 * `usage_limit` — the meter against it, so a nearly-spent code is visible
 * without opening the rule.
 *
 * The meter is `aria-hidden` because the numbers beside it already say
 * "12 / 50"; an unnamed `progressbar` role would announce nothing useful. The
 * `title` carries the same sentence for a pointer.
 */
export function RedemptionCell({ used, limit }: { used: number; limit: number | null }) {
  // A limit of 0 or NULL means "unlimited" in the schema; only a positive limit
  // is a meter.
  const max = typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? limit : null;
  const exhausted = max !== null && used >= max;
  const label = max === null ? `${used} redemptions` : `${used} of ${max} redemptions used`;

  return (
    <span className={styles.usage} title={label}>
      <span className="num">{formatCount(used)}</span>
      {max !== null && (
        <>
          <span className="helper num">/ {formatCount(max)}</span>
          <span className={styles.usageBar} aria-hidden>
            <ProgressBar value={used} max={max} size="sm" tone={exhausted ? 'rose' : 'violet'} />
          </span>
        </>
      )}
    </span>
  );
}
