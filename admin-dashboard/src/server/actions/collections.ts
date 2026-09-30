'use server';

import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionState } from '@/lib/action-state';
import { getNextId } from '@/lib/utils/ids';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { collectionSchema, newCollectionSchema, smartRuleSchema } from '@/lib/validation';
import { audit, parseForm, withAdmin } from './_shared';

const ENTITY = 'collections';

/**
 * Collection mutations.
 *
 * `updateCollectionAction` replaces the worst of the 14 silent-failure actions:
 * it used to delete every `collects` row for the collection and then re-insert
 * them one at a time, returning early (`if (insertError) return`) on the first
 * failure. A mid-loop error left the collection holding a partial product set
 * with no message. The replace now runs through `set_collection_products()`, a
 * single transaction.
 */

export async function updateCollectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsed = parseForm(collectionSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;
    const now = new Date().toISOString();

    const { data: before, error: readError } = await context.service
      .from('collections')
      .select('*')
      .eq('id', input.id)
      .maybeSingle();
    if (readError) return actionError('Could not load the collection. Nothing was saved.');
    if (!before) return actionError('That collection no longer exists.');

    const { error } = await context.service
      .from('collections')
      .update({
        title: input.title,
        handle: input.handle,
        published: input.published,
        body_html: sanitizeHtml(input.body_html) || null,
        updated_at: now,
        published_at: input.published ? now : null,
      })
      .eq('id', input.id);
    if (error) {
      console.error('[collections] update failed', input.id, error);
      return actionError('Could not save the collection. Nothing was changed.');
    }

    // Atomic product-set replace: all products land, or none do.
    const { data: inserted, error: collectsError } = await context.service.rpc(
      'set_collection_products',
      { p_collection_id: input.id, p_product_ids: input.product_ids },
    );
    if (collectsError) {
      console.error('[collections] set_collection_products failed', input.id, collectsError);
      if (collectsError.message.includes('COLLECTION_NOT_FOUND')) {
        return actionError('That collection was deleted. Nothing was changed.');
      }
      return actionError(
        'Collection details saved, but its product list could not be replaced. Check the collection before publishing.',
      );
    }

    await audit(context, {
      action: 'update',
      entity: ENTITY,
      entityId: input.id,
      before,
      after: {
        title: input.title,
        handle: input.handle,
        published: input.published,
        productCount: inserted,
      },
    });

    revalidatePath(`/collections/${input.id}`);
    revalidatePath('/collections');
    return actionOk(`Collection saved with ${inserted} product(s).`);
  });
}

export async function createCollectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState<{ id: number }>> {
  return withAdmin<{ id: number }>(async (context) => {
    const parsed = parseForm(newCollectionSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;
    const now = new Date().toISOString();

    const id = await getNextId(ENTITY);
    const handle =
      input.handle || input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    const { error } = await context.service.from('collections').insert({
      id,
      title: input.title,
      handle: handle || `collection-${id}`,
      collection_type: input.collection_type,
      published: input.published,
      body_html: sanitizeHtml(input.body_html) || null,
      updated_at: now,
      published_at: input.published ? now : null,
    });
    if (error) {
      console.error('[collections] insert failed', error);
      return actionError('Could not create the collection.');
    }

    const productIds =
      input.collection_type === 'custom' && input.product_ids.length > 0 ? input.product_ids : [];
    if (productIds.length > 0) {
      const { error: collectsError } = await context.service.rpc('set_collection_products', {
        p_collection_id: id,
        p_product_ids: productIds,
      });
      if (collectsError) {
        console.error('[collections] initial products failed', collectsError);
        if (collectsError.message.includes('COLLECTION_NOT_FOUND')) {
          return actionError('The collection disappeared before its products could be attached.');
        }
        return actionError(
          'Collection created, but its product list could not be attached. Open the collection and add products.',
        );
      }
    }

    await audit(context, {
      action: 'create',
      entity: ENTITY,
      entityId: id,
      after: { title: input.title, collection_type: input.collection_type, productCount: productIds.length },
    });

    revalidatePath('/collections');
    return actionOk<{ id: number }>('Collection created.', { id });
  });
}

export async function addSmartRuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsed = parseForm(smartRuleSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;

    // The rule's `collection_id` comes from the form. A foreign key would reject
    // a deleted collection, but the error would read as a generic insert
    // failure; this reports the actual cause.
    const { data: collection, error: readError } = await context.service
      .from('collections')
      .select('id')
      .eq('id', input.collection_id)
      .maybeSingle();
    if (readError) return actionError('Could not load that collection. Nothing was saved.');
    if (!collection) return actionError('That collection no longer exists.');

    const { error } = await context.service.from('smart_collection_rules').insert({
      collection_id: input.collection_id,
      column_name: input.column_name,
      relation: input.relation,
      condition: input.condition,
    });
    if (error) {
      console.error('[collections] smart rule insert failed', error);
      return actionError('Could not add the rule.');
    }

    await audit(context, {
      action: 'add_smart_rule',
      entity: 'smart_collection_rules',
      entityId: input.collection_id,
      after: input,
    });

    revalidatePath(`/collections/${input.collection_id}`);
    return actionOk('Rule added.');
  });
}
