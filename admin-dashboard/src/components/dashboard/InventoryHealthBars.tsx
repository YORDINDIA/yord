import ProgressBar from '@/components/ui/ProgressBar';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import type { InventoryHealth } from '@/lib/data/analytics';

/**
 * Stock split as four meters.
 *
 * `low + out + unknown` is exactly what the sidebar's low-stock badge counts
 * (it treats NULL stock as low), so the meters explain the badge instead of
 * contradicting it. Percentages come from `ProgressBar`; the counts ride in
 * the label because a share alone does not tell an admin how much work is
 * waiting.
 *
 * An empty catalog renders a sentence, not four 0% tracks.
 */
export default function InventoryHealthBars({ health }: { health: InventoryHealth }) {
  const { healthy, low, out, unknown, total } = health;

  if (total === 0) {
    return <p className="helper">No variants in the catalog yet — stock health appears here once products have variants.</p>;
  }

  return (
    <div className="stack-sm">
      <ProgressBar
        tone="emerald"
        label={`Healthy · above ${LOW_STOCK_THRESHOLD} (${healthy})`}
        value={healthy}
        max={total}
      />
      <ProgressBar
        tone="amber"
        label={`Low · 1–${LOW_STOCK_THRESHOLD} (${low})`}
        value={low}
        max={total}
      />
      <ProgressBar tone="rose" label={`Out of stock (${out})`} value={out} max={total} />
      {unknown > 0 ? (
        <ProgressBar
          tone="slate"
          label={`Unknown · not counted (${unknown})`}
          value={unknown}
          max={total}
        />
      ) : null}
      <p className="helper">{total} variants tracked across the catalog.</p>
    </div>
  );
}
