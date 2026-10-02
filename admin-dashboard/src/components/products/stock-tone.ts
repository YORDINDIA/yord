import { LOW_STOCK_THRESHOLD, stockTone } from '@/lib/constants';

/**
 * Shared stock vocabulary for the product surfaces.
 *
 * `stockTone()` in `lib/constants` owns the thresholds (`out` / `low` / `ok`);
 * this module maps that to the two things the UI needs: a design-system tone
 * name (for `ProgressBar`/`StatCard`, which accept `ToneName`) and a module
 * class suffix (`stockOut` / `stockLow` / `stockOk`) for the inline tinted
 * quantity. Kept out of `lib/constants` because it is presentation, not
 * business rules.
 */

type StockState = 'out' | 'low' | 'ok';

/** One word for a quantity, used in tooltips and the stock card. */
function stockState(quantity: number): StockState {
  return stockTone(Number.isFinite(quantity) ? quantity : 0);
}

export function stockLabel(quantity: number): string {
  switch (stockState(quantity)) {
    case 'out':
      return 'Out of stock';
    case 'low':
      return `Low stock (≤ ${LOW_STOCK_THRESHOLD})`;
    default:
      return 'In stock';
  }
}

/** CSS-module class for a quantity's tone (see `products.module.css`). */
export function stockClass(quantity: number): 'stockOut' | 'stockLow' | 'stockOk' {
  switch (stockState(quantity)) {
    case 'out':
      return 'stockOut';
    case 'low':
      return 'stockLow';
    default:
      return 'stockOk';
  }
}

/** `ProgressBar` tone for a quantity. */
export function stockToneName(quantity: number): 'rose' | 'amber' | 'emerald' {
  switch (stockState(quantity)) {
    case 'out':
      return 'rose';
    case 'low':
      return 'amber';
    default:
      return 'emerald';
  }
}
