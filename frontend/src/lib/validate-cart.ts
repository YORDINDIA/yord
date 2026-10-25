import type { SupabaseClient } from '@supabase/supabase-js';
import { computeTotals, type PricedLine } from '@/lib/pricing';

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
      discountAmount: number;
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
 *
 * `discountPercent` is the value the *caller* resolved from a promo code — this
 * helper never looks a code up, because the same code has to be resolved once
 * per request and the three checkout routes each need the answer before they
 * need the totals. It is clamped inside `computeTotals`, so a bad value from a
 * caller under-charges rather than over-charges.
 */
export async function validateCartLines(
  supabase: SupabaseLike,
  items: CartLine[],
  discountPercent = 0
): Promise<CartValidationResult> {
  const variantIds = [...new Set(items.map((l) => l.variantId))];

  const { data: variants, error: variantsError } = await supabase
    .from('product_variants')
    .select('id, price, inventory_quantity, title, product_id, products ( title, status )')
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
    products:
      | { title: string; status: string | null }
      | { title: string; status: string | null }[]
      | null;
  }[]) {
    const product = Array.isArray(v.products) ? v.products[0] : v.products;
    // Only an `active` product is on sale. This lookup runs through the
    // service client (RLS bypassed) and carries no status predicate of its
    // own, so without this a variant id belonging to a draft or archived
    // product could be checked out at its real price even though the
    // storefront never links it. A variant whose parent row is missing has no
    // status either and fails closed the same way. Skipping the row (rather
    // than rejecting here) keeps the `!variant` branch below as the single
    // source of the UNKNOWN_VARIANT response.
    if (!product || product.status !== 'active') continue;
    const productTitle = product.title;
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

  // Units requested per variant, summed across lines. Stock is a property of
  // the variant, not of the line: checking each line on its own let a crafted
  // body repeat a variant id and pass this pre-capture gate with more units
  // than the variant had, and the guarded decrement RPC then rejected the
  // second line *after* capture — a charge-then-refund instead of a clean 409.
  // The store merges quantities per variant, so only a hand-built body reaches
  // this. Keyed by the raw variantId, exactly like `byId`: a non-integer id
  // never matches a row and still fails closed as UNKNOWN_VARIANT.
  const requestedByVariant = new Map<number, number>();
  for (const line of items) {
    requestedByVariant.set(
      line.variantId,
      (requestedByVariant.get(line.variantId) ?? 0) + line.quantity
    );
  }

  const priced: PricedLine[] = [];
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
    const requested = requestedByVariant.get(line.variantId) ?? line.quantity;
    if (variant.inventory_quantity == null || variant.inventory_quantity < requested) {
      return {
        ok: false,
        code: 'OUT_OF_STOCK',
        error: 'Insufficient stock for one or more items',
        status: 409,
      };
    }
    priced.push({ price: variant.price, quantity: line.quantity });
  }

  const { subtotal, discountAmount, gstAmount, total, totalPaise } = computeTotals(
    priced,
    discountPercent
  );

  if (subtotal <= 0) {
    return {
      ok: false,
      code: 'BAD_AMOUNT',
      error: 'Invalid cart items',
      status: 400,
    };
  }

  return {
    ok: true,
    subtotal,
    discountAmount,
    gstAmount,
    total,
    totalPaise,
    byId,
  };
}
