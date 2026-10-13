/** The cart's cap for a variant with no counted inventory. */
export const DEFAULT_MAX_QUANTITY = 10;

/**
 * The cart line cap for a variant.
 *
 * `inventory_quantity` is 0 — not NULL — for a variant the migration never
 * counted, and a 0 cap would make the line unaddable, so only a positive count
 * is a real limit and everything else takes the default. Written once because
 * `inventory_quantity > 0 ? inventory_quantity : 10` was copy-pasted into four
 * components, each of which could have drifted separately.
 */
export function maxQuantityFor(inventoryQuantity: number | null | undefined): number {
  return inventoryQuantity && inventoryQuantity > 0 ? inventoryQuantity : DEFAULT_MAX_QUANTITY;
}
