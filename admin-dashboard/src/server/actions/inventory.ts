'use server';

import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionState } from '@/lib/action-state';
import { inventoryUpdateSchema } from '@/lib/validation';
import { actionFieldErrors, audit, parseForm, withAdmin } from './_shared';

/**
 * Per-row inventory quantity save.
 *
 * The previous inline action was the only one of the 14 that returned
 * `{ error }`, and it is the shape `ActionState` generalizes: the stepper now
 * reads `formError` instead of a bespoke `error` field.
 */
export async function updateInventoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    // Reject a missing/non-string quantity BEFORE zod coercion: an omitted
    // field or an empty string would otherwise normalize to 0 (`Number('')`
    // is 0) and silently zero the variant's stock. Only an explicit integer
    // string passes; the schema then enforces int >= 0.
    const rawQuantity = formData.get('inventory_quantity');
    if (typeof rawQuantity !== 'string' || !/^\d+$/.test(rawQuantity.trim())) {
      return actionError('Invalid quantity.');
    }
    const parsed = parseForm(inventoryUpdateSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;

    const { data: before, error: readError } = await context.service
      .from('product_variants')
      .select('id, product_id, inventory_quantity')
      .eq('id', input.variant_id)
      .maybeSingle();
    // A failed lookup is a server-side problem, not a bad quantity: report it
    // as one so an outage is not misread as a validation error.
    if (readError) {
      console.error('[inventory] variant lookup failed', input.variant_id, readError);
      return actionError('Could not load that variant. Nothing was saved.');
    }
    if (!before) return actionError('That variant no longer exists.');

    const { error } = await context.service
      .from('product_variants')
      .update({ inventory_quantity: input.inventory_quantity, updated_at: new Date().toISOString() })
      .eq('id', input.variant_id);
    if (error) {
      console.error('[inventory] update failed', input.variant_id, error);
      return actionError('Could not save inventory.');
    }

    await audit(context, {
      action: 'update_inventory',
      entity: 'product_variants',
      entityId: input.variant_id,
      before,
      after: { inventory_quantity: input.inventory_quantity },
    });

    revalidatePath('/inventory');
    revalidatePath(`/products/${before.product_id}`);
    return actionOk('Inventory saved.');
  });
}

/**
 * Upper bound on variants one bulk adjustment may touch. The bar can only ever
 * submit the rows on the current page, so this is a guard against a hand-built
 * POST, not a UI limit.
 */
const MAX_BULK_IDS = 100;

/**
 * Set the same quantity on every selected variant.
 *
 * Kept separate from `updateInventoryAction` on purpose: that one is the
 * per-row save and its contract (one variant, one quantity, `before`/`after` in
 * the audit) is unchanged.
 *
 * The write goes through the `adjust_inventory_quantities` RPC, which locks
 * the selected rows (SELECT ... FOR UPDATE), reads each previous quantity
 * under the lock, applies the update, and returns the locked `before` values.
 * The previous shape — one query to read, a second to write — let a concurrent
 * save land in between, so the audit's `before` could be any stale value
 * rather than what immediately preceded this adjustment.
 *
 * The submitted quantity goes through the same integer guard as the single-row
 * save (and then the same shared zod schema), because `z.coerce.number()` turns
 * an empty string into 0: without the guard, submitting the bar with no quantity
 * would silently zero every selected variant.
 */
export async function bulkAdjustInventoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const rawQuantity = formData.get('inventory_quantity');
    if (typeof rawQuantity !== 'string' || !/^\d+$/.test(rawQuantity.trim())) {
      return actionFieldErrors({
        inventory_quantity: ['Enter a whole quantity of 0 or more.'],
      });
    }
    const quantity = inventoryUpdateSchema.shape.inventory_quantity.safeParse(rawQuantity.trim());
    if (!quantity.success) {
      return actionFieldErrors({
        inventory_quantity: [quantity.error.issues[0]?.message ?? 'Invalid quantity.'],
      });
    }

    // `ids` is submitted as one hidden input per ticked row. Duplicates are
    // collapsed so the audit count matches what was written.
    const ids = [
      ...new Set(
        formData
          .getAll('ids')
          .map((value) => String(value).trim())
          .filter((value) => /^[1-9][0-9]*$/.test(value))
          .map(Number),
      ),
    ];
    if (ids.length === 0) return actionError('Select at least one variant first.');
    if (ids.length > MAX_BULK_IDS) {
      return actionError(`Adjust at most ${MAX_BULK_IDS} variants at a time.`);
    }

    // One atomic RPC: lock, read the previous quantity under the lock, write.
    // Variants that no longer exist are simply absent from the result, so the
    // "no longer exist" copy below stays accurate.
    const { data: adjusted, error } = await context.service.rpc(
      'adjust_inventory_quantities',
      { p_variants: ids.map((id) => ({ id, inventory_quantity: quantity.data })) },
    );
    if (error) {
      console.error('[inventory] bulk adjust failed', ids.length, error);
      // The RPC rejects the whole batch if any row is malformed rather than
      // updating a subset, so any error here means nothing was changed. The
      // malformed-batch raise is mapped to its own cause (the caller should
      // have caught it first); everything else keeps the generic copy.
      if (error.message.includes('INVALID_VARIANT_ROWS')) {
        return actionError(
          'The database rejected one of the variant rows. Nothing was changed. Reload the page and try again.',
        );
      }
      return actionError(`Could not update ${ids.length} variant(s). Nothing was changed.`);
    }

    const rows = adjusted ?? [];
    if (rows.length === 0) return actionError('Those variants no longer exist.');

    // The audit's `before` is the quantity locked by the RPC — the value that
    // was current immediately before this adjustment, not a stale read.
    await audit(context, {
      action: 'bulk_adjust_inventory',
      entity: 'product_variants',
      entityId: ids.join(','),
      before: {
        variants: rows.map((row) => ({
          id: row.id,
          product_id: row.product_id,
          inventory_quantity: row.previous_quantity,
        })),
      },
      after: { inventory_quantity: quantity.data, variants: rows.length },
    });

    revalidatePath('/inventory');
    // Each affected product page shows its own variants, so refresh those too.
    for (const productId of new Set(rows.map((row) => row.product_id))) {
      revalidatePath(`/products/${productId}`);
    }

    return actionOk(
      rows.length < ids.length
        ? `Set quantity to ${quantity.data} on ${rows.length} variant(s); ${ids.length - rows.length} no longer exist.`
        : `Set quantity to ${quantity.data} on ${rows.length} variant(s).`,
    );
  });
}
