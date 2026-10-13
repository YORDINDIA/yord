import { ProgressBar } from '@/components/ui/ProgressBar';
import StatusBadge from '@/components/ui/StatusBadge';
import { LOW_STOCK_THRESHOLD, stockTone } from '@/lib/constants';
import styles from './inventory.module.css';

/**
 * Stock chip for one variant: the status at a glance, plus a threshold meter.
 *
 * The four states are disjoint and match the page's strip and filters:
 * out (`<= 0`, rose), low (`1 … LOW_STOCK_THRESHOLD`, amber), in stock
 * (emerald), untracked (NULL quantity, neutral). NULL is deliberately not zero:
 * an uncounted variant is unknown, not sold out, and rendering it as 0 both
 * mislabels it and invites saving 0 over it.
 *
 * The chip carries the number in its text, so the meter below it is decorative
 * (`aria-hidden`) — it never becomes the only source of the value — and the
 * cell keeps to one 18px line plus a 4px track.
 */
export default function StockCell({ quantity }: { quantity: number | null | undefined }) {
  if (quantity === null || quantity === undefined) {
    return (
      <span className={styles.stockCell}>
        <StatusBadge value="untracked" label="Untracked" tone="neutral" dot />
      </span>
    );
  }

  const tone = stockTone(quantity);
  const label =
    tone === 'out' ? 'Out of stock' : tone === 'low' ? `Low · ${quantity}` : `In stock · ${quantity}`;
  const badgeTone = tone === 'out' ? 'danger' : tone === 'low' ? 'warning' : 'success';
  const barTone = tone === 'out' ? 'rose' : tone === 'low' ? 'amber' : 'emerald';

  return (
    <span
      className={styles.stockCell}
      title={
        tone === 'ok'
          ? `${quantity} in stock · reorder at ${LOW_STOCK_THRESHOLD}`
          : `${label} · reorder at ${LOW_STOCK_THRESHOLD}`
      }
    >
      <StatusBadge value={tone} label={label} tone={badgeTone} dot />
      {/* Full track = at or above the reorder threshold; an empty one is out.
          `size="sm"` keeps the whole cell inside the dense row height. */}
      <span className={styles.stockBar} aria-hidden>
        <ProgressBar value={Math.max(quantity, 0)} max={LOW_STOCK_THRESHOLD} tone={barTone} size="sm" />
      </span>
    </span>
  );
}
