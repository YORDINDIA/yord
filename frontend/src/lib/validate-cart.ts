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
  inventory_quantity: number;
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
    price: number | string;
    inventory_quantity: number;
    title: string | null;
    product_id: number;
    products: { title: string } | { title: string }[] | null;
  }[]) {
    const productTitle = Array.isArray(v.products)
      ? v.products[0]?.title
      : v.products?.title;
    byId.set(v.id, {
      id: v.id,
      price: Number(v.price),
      inventory_quantity: v.inventory_quantity,
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
    if (variant.inventory_quantity < line.quantity) {
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
