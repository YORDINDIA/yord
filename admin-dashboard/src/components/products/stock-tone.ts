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

/** Totals for the product rail's stock card, untracked variants kept distinct. */
export interface StockCardSummary {
  /** Sum of tracked quantities. Untracked variants contribute nothing. */
  total: number;
  /** Tracked variants at 1 … LOW_STOCK_THRESHOLD units. */
  low: number;
  /** Tracked variants at or below zero. */
  out: number;
  /** Variants with NULL inventory: unknown, never zero (mirrors `StockCell`). */
  untracked: number;
  /** Largest tracked quantity, floored at 1 so bar scaling never divides by zero. */
  max: number;
  /** Per-variant quantity with NULL preserved, in input order. */
  quantities: (number | null)[];
}

/**
 * Reduce a product's variants to the stock card's numbers.
 *
 * `inventory_quantity = null` means untracked, not zero: an uncounted variant
 * is unknown stock, and folding it into `0` mislabeled it as sold out — both in
 * the totals and in the low/out badge counts. The NULL rides through
 * `quantities` so the card can render each untracked variant as its own state,
 * the way `StockCell` does in the inventory table.
 */
export function stockCardSummary(
  variants: { inventory_quantity: number | null | undefined }[],
): StockCardSummary {
  const quantities = variants.map((variant) =>
    variant.inventory_quantity === null || variant.inventory_quantity === undefined
      ? null
      : Number(variant.inventory_quantity),
  );
  const tracked = quantities.filter((quantity): quantity is number => quantity !== null);
  return {
    quantities,
    total: tracked.reduce((sum, quantity) => sum + quantity, 0),
    max: Math.max(1, ...tracked),
    low: tracked.filter((quantity) => quantity > 0 && quantity <= LOW_STOCK_THRESHOLD).length,
    out: tracked.filter((quantity) => quantity <= 0).length,
    untracked: quantities.length - tracked.length,
  };
}
