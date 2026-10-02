'use server';

import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionState } from '@/lib/action-state';
import { isUniqueViolation } from '@/lib/errors';
import { getNextId } from '@/lib/utils/ids';
import { discountSchema } from '@/lib/validation';
import { audit, parseForm, withAdmin } from './_shared';

/**
 * Create a price rule plus its code.
 *
 * The old inline action threw on either failure, so a failed rule insert left a
 * dangling row with no message. On a code failure the rule is now rolled back
 * explicitly, and the reason is reported.
 */
export async function createDiscountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState<{ id: number }>> {
  return withAdmin<{ id: number }>(async (context) => {
    const parsed = parseForm(discountSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;

    const [ruleId, codeId] = await Promise.all([
      getNextId('price_rules'),
      getNextId('discount_codes'),
    ]);
    const now = new Date().toISOString();
    const startsAt = input.starts_at ? new Date(input.starts_at).toISOString() : now;
    const endsAt = input.ends_at ? new Date(input.ends_at).toISOString() : null;
    // Codes are stored uppercased; compare in that form so `save10` and
    // `SAVE10` collide here instead of creating two codes for one rule shape.
    const normalizedCode = input.code.toUpperCase();

    // `discount_codes.code` has no unique constraint yet (see the migration in
    // the report), so check before inserting: without this, duplicates sail
    // through and the `isUniqueViolation` branch below is dead code.
    // `ilike` with LIKE-escaped input matches case-insensitively (`_` and `%`
    // are wildcards, so they must be escaped first).
    const escaped = normalizedCode.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: existing, error: lookupError } = await context.service
      .from('discount_codes')
      .select('id')
      .ilike('code', escaped)
      .limit(1)
      .maybeSingle();
    if (lookupError) {
      // A failed read is not "no duplicate": proceeding would create a
      // duplicate code on a transient error (the unique index that would catch
      // it is not installed yet). Fail the action; the admin retries.
      console.error('[discounts] duplicate lookup failed', lookupError);
      return actionError('Could not verify code uniqueness. Nothing was saved. Try again.');
    }
    if (existing) {
      return actionError('That discount code already exists.');
    }

    const { error: ruleError } = await context.service.from('price_rules').insert({
      id: ruleId,
      title: input.title,
      value: input.value,
      value_type: input.value_type,
      customer_selection: 'all',
      target_type: 'line_item',
      target_selection: 'all',
      allocation_method: 'across',
      once_per_customer: false,
      starts_at: startsAt,
      ends_at: endsAt,
      created_at: now,
      updated_at: now,
    });
    if (ruleError) {
      console.error('[discounts] price_rules insert failed', ruleError);
      return actionError('Could not create the discount.');
    }

    const { error: codeError } = await context.service.from('discount_codes').insert({
      id: codeId,
      price_rule_id: ruleId,
      code: normalizedCode,
      created_at: now,
      updated_at: now,
    });
    if (codeError) {
      console.error('[discounts] discount_codes insert failed', codeError);
      // Roll back the rule so a failed creation leaves nothing behind.
      await context.service.from('price_rules').delete().eq('id', ruleId);
      if (isUniqueViolation(codeError)) {
        return actionError('That discount code already exists.');
      }
      return actionError('Could not create the discount code. Nothing was saved.');
    }

    await audit(context, {
      action: 'create',
      entity: 'price_rules',
      entityId: ruleId,
      after: { title: input.title, code: normalizedCode, value: input.value, value_type: input.value_type },
    });

    revalidatePath('/discounts');
    return actionOk<{ id: number }>(`Discount ${normalizedCode} created.`, { id: ruleId });
  });
}
