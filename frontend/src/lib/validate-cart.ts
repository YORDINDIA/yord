import type { SupabaseClient } from '@supabase/supabase-js';
import { computeTotals } from '@/lib/pricing';

export interface CartLine {
  variantId: number;
  quantity: number;
}

export type CartValidationCode = 'UNKNOWN_VARIANT' | 'BAD_AMOUNT' | 'OUT_OF_STOCK';

export interface ValidatedVariant {
  id: number;
  price: number;
  // NULL means "unknown" (untracked stock), not zero: the inventory UI renders
  // it as zero and the dashboard low-stock KPI counts it, so checkout must
  // fail closed on it before any money moves (the guarded decrement RPC would
  // reject it later, after capture, forcing a charge-then-refund).
  inventory_quantity: number | null;
  title: string | null;
  product_id: number;
  productTitle: string;
}

export type CartValidationResult =
  | {
      ok: true;
      subtotal: number;
      gstAmount: number;
      total: number;
      totalPaise: number;
      byId: Map<number, ValidatedVariant>;
    }
  | { ok: false; code: CartValidationCode; error: string; status: number };

type SupabaseLike = SupabaseClient;

/**
 * Single source for server-side cart validation.
 * Fetches authoritative variant prices, parses/validates amounts, checks
 * stock, and computes totals via `@/lib/pricing` (sole money-math source).
 * Client-supplied amounts are never trusted.
 */
export async function validateCartLines(
  supabase: SupabaseLike,
  items: CartLine[]
): Promise<CartValidationResult> {
  const variantIds = [...new Set(items.map((l) => l.variantId))];

  const { data: variants, error: variantsError } = await supabase
    .from('product_variants')
    .select('id, price, inventory_quantity, title, product_id, products ( title )')
    .in('id', variantIds);

  if (
    variantsError ||
    !variants ||
    (variants as unknown[]).length !== variantIds.length
  ) {
    return {
      ok: false,
      code: 'UNKNOWN_VARIANT',
      error: 'Invalid cart items',
      status: 400,
    };
  }

  const byId = new Map<number, ValidatedVariant>();
  for (const v of variants as {
    id: number;
    // NULL/empty means "no price": it must stay invalid. `Number(null)` is 0
    // and `Number('')` is 0, so converting before checking would sell the
    // variant for free whenever the cart also holds a priced item.
    price: number | string | null;
    inventory_quantity: number | null;
    title: string | null;
    product_id: number;
    products: { title: string } | { title: string }[] | null;
  }[]) {
    const productTitle = Array.isArray(v.products)
      ? v.products[0]?.title
      : v.products?.title;
    // Preserve null/empty as NaN (invalid) BEFORE numeric conversion: a NULL
    // database price must fail the BAD_AMOUNT check below, never become 0.
    const rawPrice = v.price;
    const price =
      rawPrice === null ||
      rawPrice === undefined ||
      (typeof rawPrice === 'string' && rawPrice.trim() === '')
        ? NaN
        : Number(rawPrice);
    byId.set(v.id, {
      id: v.id,
      price,
      inventory_quantity: v.inventory_quantity ?? null,
      title: v.title,
      product_id: v.product_id,
      productTitle: productTitle || 'Product',
    });
  }

  let subtotal = 0;
  for (const line of items) {
    const variant = byId.get(line.variantId);
    if (!variant) {
      return {
        ok: false,
        code: 'UNKNOWN_VARIANT',
        error: 'Invalid cart items',
        status: 400,
      };
    }
    if (!Number.isFinite(variant.price) || variant.price < 0) {
      return {
        ok: false,
        code: 'BAD_AMOUNT',
        error: 'Invalid cart items',
        status: 400,
      };
    }
    if (variant.inventory_quantity == null || variant.inventory_quantity < line.quantity) {
      return {
        ok: false,
        code: 'OUT_OF_STOCK',
        error: 'Insufficient stock for one or more items',
        status: 409,
      };
    }
    subtotal += variant.price * line.quantity;
  }

  if (subtotal <= 0) {
    return {
      ok: false,
      code: 'BAD_AMOUNT',
      error: 'Invalid cart items',
      status: 400,
    };
  }

  const { gstAmount, total, totalPaise } = computeTotals(subtotal);
  return { ok: true, subtotal, gstAmount, total, totalPaise, byId };
}
