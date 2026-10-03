import { describe, expect, it } from 'vitest';
import { stockCardSummary } from '@/components/products/stock-tone';

/**
 * The product rail's stock card totals.
 *
 * `inventory_quantity = null` means untracked, not zero: an uncounted variant
 * is unknown stock, and the card used to fold it into `0` — counting it toward
 * "out of stock" and dropping it from "Units on hand" as if it were sold.
 * `StockCell` (the inventory table) keeps the unknown state separate; this
 * summary is the card's side of that contract.
 */
describe('stockCardSummary', () => {
  it('counts only tracked variants into the total, low and out', () => {
    const summary = stockCardSummary([
      { inventory_quantity: 12 },
      { inventory_quantity: 3 }, // low
      { inventory_quantity: 0 }, // out
      { inventory_quantity: null }, // untracked — counted nowhere
    ]);

    expect(summary).toMatchObject({ total: 15, low: 1, out: 1, untracked: 1, max: 12 });
  });

  it('preserves per-variant nulls in order for the bar list', () => {
    const summary = stockCardSummary([
      { inventory_quantity: null },
      { inventory_quantity: 7 },
      { inventory_quantity: null },
    ]);

    expect(summary.quantities).toEqual([null, 7, null]);
  });

  it('reports an all-untracked product as fully unknown, not sold out', () => {
    const summary = stockCardSummary([
      { inventory_quantity: null },
      { inventory_quantity: null },
    ]);

    expect(summary).toMatchObject({ total: 0, low: 0, out: 0, untracked: 2 });
    expect(summary.max).toBe(1); // bar scaling never divides by zero
  });

  it('treats an empty product as zeroes across the board', () => {
    expect(stockCardSummary([])).toMatchObject({
      total: 0,
      low: 0,
      out: 0,
      untracked: 0,
      max: 1,
      quantities: [],
    });
  });

  it('does not count a negative tracked quantity as low', () => {
    const summary = stockCardSummary([{ inventory_quantity: -2 }]);

    expect(summary).toMatchObject({ out: 1, low: 0, total: -2 });
  });
});
