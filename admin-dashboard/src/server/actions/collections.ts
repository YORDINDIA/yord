'use server';

import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionState } from '@/lib/action-state';
import { BULK_COLLECTION_ACTIONS, isAutoCollectionHandle, isOneOf } from '@/lib/constants';
import { refusePublish } from '@/lib/collection-publishing';
import { diffMembership, sampleWithTitles } from '@/lib/collection-diff';
import { listCollectionProductIds, resolveSmartRuleMatches } from '@/lib/data/collections';
import { getNextId } from '@/lib/utils/ids';
import { sanitizeHtml, slugify } from '@/lib/utils/sanitize';
import {
  collectionIdSchema,
  collectionSchema,
  newCollectionSchema,
  productIdsSchema,
  smartRuleIdSchema,
  smartRuleSchema,
} from '@/lib/validation';
import { audit, parseForm, withAdmin } from './_shared';

const ENTITY = 'collections';

/** Human-readable label for a product count in the success copy. */
function productLabel(count: number): string {
  return `${count} product${count === 1 ? '' : 's'}`;
}

/** Field-level message for a handle the storefront computes itself. */
const RESERVED_HANDLE_FIELD = 'That handle is reserved.';

/**
 * Refuse a handle edit that would move a collection into or out of an auto
 * handle (`all`, `new-arrivals`). `null` when the edit is allowed.
 *
 * An auto handle is a storefront route the app computes itself, so the handle is
 * not editable in either direction:
 *
 *  - renaming the auto row away removes the handle the header/footer link. The
 *    storefront gates `/collection/<handle>` on the row (published + handle), so
 *    the link 404s even though the row is still published;
 *  - naming another row into it leaves two rows with the same handle, and the
 *    storefront resolves a handle with `.maybeSingle()`, which errors when two
 *    rows match — `collections.handle` has no unique constraint to catch it.
 *
 * `stored` is the persisted handle (`null` when the collection does not exist
 * yet, i.e. the create form).
 */
function reservedAutoHandle(stored: string | null | undefined, next: string): string | null {
  const storedIsAuto = isAutoCollectionHandle(stored);
  const nextIsAuto = isAutoCollectionHandle(next);
  if (storedIsAuto && next !== stored) {
    return `"${stored}" is a computed collection, so its handle cannot change: the storefront links /collection/${stored} and resolves it from this row. Nothing was changed.`;
  }
  if (nextIsAuto && !storedIsAuto) {
    return `"${next}" is reserved for the computed collection of that name. Pick another handle. Nothing was changed.`;
  }
  return null;
}

/**
 * Warn about stored rules the compiler cannot run (a column outside the builder's
 * list, or an unsupported relation — both reach the table through the Shopify
 * migration). A rule that has no effect must say so rather than leaving the admin
 * to wonder why the match count is short.
 */
function ignoredRulesNote(count: number): string {
  if (count === 0) return '';
  return ` ${count} stored rule${count === 1 ? '' : 's'} could not be evaluated here (unsupported field or relation) and ${count === 1 ? 'was' : 'were'} ignored.`;
}

/**
 * Collection mutations.
 *
 * `updateCollectionAction` replaces the worst of the 14 silent-failure actions:
 * it used to delete every `collects` row for the collection and then re-insert
 * them one at a time, returning early (`if (insertError) return`) on the first
 * failure. A mid-loop error left the collection holding a partial product set
 * with no message. The replace now runs through `set_collection_products()`, a
 * single transaction.
 *
 * `new-arrivals` and `all` are computed by the storefront, so their product
 * list is not editable here: the action skips the replace for those handles
 * instead of letting the form silently clear membership nothing reads.
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

    // An empty handle is create-only: persisting '' would make the record
    // unreachable by handle, so regenerate from the title.
    const handle = input.handle || slugify(input.title, before.handle ?? `collection-${input.id}`);
    // Auto by either handle: renaming into or out of an auto handle must not
    // start/stop rewriting a product list the storefront computes itself.
    const isAuto = isAutoCollectionHandle(before.handle) || isAutoCollectionHandle(handle);

    // …and the handle itself cannot move in either direction: it is the route
    // the storefront links. See `reservedAutoHandle`.
    const handleRefusal = reservedAutoHandle(before.handle, handle);
    if (handleRefusal) return actionError(handleRefusal, { handle: [RESERVED_HANDLE_FIELD] });

    // The edit form renders no publication or type control for an auto
    // collection (both are disabled, so the browser omits them). Reading the
    // absent fields as "unpublish" / "make it custom" emptied the storefront
    // header links — `new-arrivals` and `all` 404 when their row is unpublished.
    const collectionType = isAuto ? before.collection_type : input.collection_type;
    const published = isAuto ? before.published : input.published;
    const publishedAt = isAuto
      ? before.published_at
      : input.published
        ? (before.published_at ?? now)
        : null;

    // Publishing an empty custom collection produces an empty storefront page
    // linked from the nav; that is what "Collections are not active" looked
    // like. The decision runs on `input.product_ids` — the set this submit is
    // replacing `collects` with — so "add products and publish" succeeds while
    // "remove everything and publish" is refused. Smart collections are held to
    // the same rule: their members come from "Apply now", and a brand-new smart
    // collection has none yet.
    const refusal = refusePublish({
      isAuto,
      published,
      collectionType,
      productIds: input.product_ids,
    });
    if (refusal) return actionError(refusal.message, { product_ids: [refusal.fieldError] });

    const { error } = await context.service
      .from('collections')
      .update({
        title: input.title,
        handle,
        collection_type: collectionType,
        published,
        body_html: sanitizeHtml(input.body_html) || null,
        image_src: input.image_src || null,
        storage_image_url: input.storage_image_url || null,
        sort_order: input.sort_order || null,
        // Smart collections only: AND (default) vs OR across their rules.
        disjunctive: isAuto ? before.disjunctive : collectionType === 'smart' ? input.disjunctive : null,
        updated_at: now,
        // Stamp the publication date only on first publish: resetting it on
        // every save rewrote history and broke "newest collection" ordering.
        published_at: publishedAt,
      })
      .eq('id', input.id);
    if (error) {
      console.error('[collections] update failed', input.id, error);
      return actionError('Could not save the collection. Nothing was changed.');
    }

    // Auto collections are computed by the storefront: their `collects` rows
    // are not what the page reads, so a form round-trip must not rewrite them.
    if (isAuto) {
      await audit(context, {
        action: 'update',
        entity: ENTITY,
        entityId: input.id,
        before,
        after: {
          title: input.title,
          handle,
          published,
          collection_type: collectionType,
          auto: true,
          productListUntouched: true,
        },
      });
      revalidatePath(`/collections/${input.id}`);
      revalidatePath('/collections');
      return actionOk('Collection saved. Its products and publication state are managed automatically.');
    }

    // Atomic product-set replace: all products land, or none do.
    const { data: inserted, error: collectsError } = await context.service.rpc(
      'set_collection_products',
      { p_collection_id: input.id, p_product_ids: input.product_ids },
    );
    if (collectsError) {
      console.error('[collections] set_collection_products failed', input.id, collectsError);
      // The detail row above already committed, but the membership replace it
      // was made against did not. A submit that turned publishing ON therefore
      // must not stand: `refusePublish` judged the *submitted* set, and a failed
      // replace leaves the stored set (possibly empty) live — the linked empty
      // page the guard exists to prevent. A nonexistent product id (a stale
      // editor: the product was deleted after the page loaded) answers a
      // foreign-key error, not COLLECTION_NOT_FOUND, so it lands here.
      const publishTurnedOn = published && !before.published;
      let publishRolledBack = false;
      if (publishTurnedOn) {
        const { error: revertError } = await context.service
          .from('collections')
          .update({ published: false, published_at: before.published_at ?? null })
          .eq('id', input.id);
        publishRolledBack = !revertError;
        if (revertError) {
          console.error('[collections] publish rollback failed', input.id, revertError);
        } else {
          // The rollback is a write like any other: refresh the editor and the
          // list so the badge matches the message.
          revalidatePath(`/collections/${input.id}`);
          revalidatePath('/collections');
        }
      }
      // The detail row already committed: audit the partial mutation before
      // returning, or the committed update leaves no audit trail.
      await audit(context, {
        action: 'update_partial',
        entity: ENTITY,
        entityId: input.id,
        before,
        after: {
          title: input.title,
          handle,
          published,
          publishRolledBack,
          productIdsAttempted: input.product_ids,
          collectsError: collectsError.message,
        },
      });
      if (collectsError.message.includes('COLLECTION_NOT_FOUND')) {
        return actionError('That collection was deleted. Nothing was changed.');
      }
      if (publishTurnedOn) {
        return actionError(
          publishRolledBack
            ? 'Collection details saved, but its product list could not be replaced, so it was left unpublished. Add its products and publish again.'
            : 'Collection details saved, but its product list could not be replaced and the publish could not be rolled back. Check the collection before relying on its storefront page.',
        );
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
        handle,
        published,
        productCount: inserted,
      },
    });

    revalidatePath(`/collections/${input.id}`);
    revalidatePath('/collections');
    return actionOk(`Collection saved with ${productLabel(inserted ?? input.product_ids.length)}.`);
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

    // `all` / `new-arrivals` are storefront routes the app computes itself, and
    // the row with that handle already exists. Creating a second one leaves two
    // rows the storefront's `.maybeSingle()` cannot resolve, which takes out
    // `/collection/all` (a header link) — and a title of "All" derives that
    // handle too, so this is not only the hand-typed case.
    const handleRefusal = reservedAutoHandle(null, handle);
    if (handleRefusal) return actionError(handleRefusal, { handle: [RESERVED_HANDLE_FIELD] });

    // Same publish guard as the edit form: a new empty collection that is
    // published immediately becomes a linked, empty storefront page. A new smart
    // collection always starts with no products — its rules and their matches can
    // only be added after it exists — so publishing at create time is refused and
    // the message names the step that fills the list.
    const refusal = refusePublish({
      isAuto: false,
      published: input.published,
      collectionType: input.collection_type,
      productIds: input.product_ids,
      mode: 'create',
    });
    if (refusal) return actionError(refusal.message, { product_ids: [refusal.fieldError] });

    const { error } = await context.service.from('collections').insert({
      id,
      title: input.title,
      handle: handle || `collection-${id}`,
      collection_type: input.collection_type,
      published: input.published,
      body_html: sanitizeHtml(input.body_html) || null,
      image_src: input.image_src || null,
      storage_image_url: input.storage_image_url || null,
      sort_order: input.sort_order || null,
      disjunctive: input.collection_type === 'smart' ? input.disjunctive : null,
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
        // The collection row already committed: audit it before returning, or
        // the created collection leaves no audit trail.
        await audit(context, {
          action: 'create_partial',
          entity: ENTITY,
          entityId: id,
          after: {
            title: input.title,
            collection_type: input.collection_type,
            productIdsAttempted: productIds,
            collectsError: collectsError.message,
          },
        });
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
    return actionOk('Rule added. Use "Preview matches" to see what it selects.');
  });
}

/** Removes one smart rule. The collection's product list is left as-is. */
export async function deleteSmartRuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsed = parseForm(smartRuleIdSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;

    const { data: rule, error: readError } = await context.service
      .from('smart_collection_rules')
      .select('*')
      .eq('id', input.rule_id)
      .eq('collection_id', input.collection_id)
      .maybeSingle();
    if (readError) return actionError('Could not load that rule. Nothing was changed.');
    if (!rule) return actionError('That rule no longer exists.');

    const { error } = await context.service
      .from('smart_collection_rules')
      .delete()
      .eq('id', input.rule_id);
    if (error) {
      console.error('[collections] smart rule delete failed', input.rule_id, error);
      return actionError('Could not delete the rule. Nothing was changed.');
    }

    await audit(context, {
      action: 'delete_smart_rule',
      entity: 'smart_collection_rules',
      entityId: input.rule_id,
      before: rule,
    });

    revalidatePath(`/collections/${input.collection_id}`);
    return actionOk('Rule deleted.');
  });
}

/**
 * Count (and sample) the products a smart collection's rules currently match.
 *
 * The rules table was write-only before this: the storefront never evaluated
 * it and no action materialised it, so "smart" collections were permanently
 * empty. Pure read — preview never writes.
 */
export async function previewSmartRulesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState<SmartRulesPreview>> {
  return withAdmin<SmartRulesPreview>(async (context) => {
    const parsed = parseForm(collectionIdSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { collection_id } = parsed.data;

    const { data: collection, error } = await context.service
      .from('collections')
      .select('id, collection_type')
      .eq('id', collection_id)
      .maybeSingle();
    if (error) return actionError('Could not load the collection.');
    if (!collection) return actionError('That collection no longer exists.');
    if (collection.collection_type !== 'smart') {
      return actionError('This is a custom collection. Switch it to smart to use rules.');
    }

    const match = await resolveSmartRuleMatches(collection_id);
    if (!match) return actionError('That collection no longer exists.');

    // "Matched 84 products" is not the number an admin needs before pressing a
    // button that replaces the whole membership: how many come in, and how many
    // of the current members go out, is. An empty match keeps its own message,
    // but its diff is still computed so the dialog can show that applying now
    // would remove everyone (the apply action refuses that case).
    const current = await listCollectionProductIds(collection_id);
    const diff = diffMembership(current, match.ids);

    // Titles for the first few adds/removes, in one bounded query. They are
    // cosmetic in the dialog, so a failed lookup falls back to `#id` labels
    // instead of failing a read that already succeeded.
    const titleIds = [...diff.adds.slice(0, DIFF_SAMPLE), ...diff.removes.slice(0, DIFF_SAMPLE)];
    const titles = new Map<number, string>();
    if (titleIds.length > 0) {
      const { data: titleRows, error: titleError } = await context.service
        .from('products')
        .select('id, title')
        .in('id', titleIds);
      if (!titleError) {
        for (const row of titleRows ?? []) titles.set(row.id, row.title);
      } else {
        console.error('[collections] preview title lookup failed', collection_id, titleError);
      }
    }

    const preview: SmartRulesPreview = {
      count: match.ids.length,
      sample: match.sample,
      unsupported: match.unsupported.length,
      adds: diff.adds.length,
      removes: diff.removes.length,
      unchanged: diff.unchanged,
      sampleAdds: sampleWithTitles(diff.adds, titles, DIFF_SAMPLE),
      sampleRemoves: sampleWithTitles(diff.removes, titles, DIFF_SAMPLE),
    };

    const ignored = ignoredRulesNote(match.unsupported.length);
    if (match.ids.length === 0) {
      return actionOk(`No products match these rules yet.${ignored}`, preview);
    }
    return actionOk(`Matched ${productLabel(match.ids.length)}.${ignored}`, preview);
  });
}

/**
 * Materialise the rules into `collects` ("Apply now").
 *
 * The storefront reads `collects`, not the rules, so this is the step that
 * actually makes a smart collection show products. An empty match is refused
 * rather than applied: silently wiping a curated list because a rule matched
 * nothing is the failure this guard exists for.
 */
export async function applySmartRulesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState<{ count: number }>> {
  return withAdmin<{ count: number }>(async (context) => {
    const parsed = parseForm(collectionIdSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { collection_id } = parsed.data;

    const { data: collection, error } = await context.service
      .from('collections')
      .select('id, title, collection_type')
      .eq('id', collection_id)
      .maybeSingle();
    if (error) return actionError('Could not load the collection.');
    if (!collection) return actionError('That collection no longer exists.');
    if (collection.collection_type !== 'smart') {
      return actionError('This is a custom collection. Switch it to smart to use rules.');
    }

    const match = await resolveSmartRuleMatches(collection_id);
    if (!match) return actionError('That collection no longer exists.');
    if (match.ids.length === 0) {
      return actionError('No products match these rules, so nothing was changed.');
    }

    const { data: inserted, error: collectsError } = await context.service.rpc(
      'set_collection_products',
      { p_collection_id: collection_id, p_product_ids: match.ids },
    );
    if (collectsError) {
      console.error('[collections] apply rules failed', collection_id, collectsError);
      return actionError('Could not apply the rules. Nothing was changed.');
    }

    await audit(context, {
      action: 'apply_smart_rules',
      entity: ENTITY,
      entityId: collection_id,
      after: {
        title: collection.title,
        matched: match.ids.length,
        applied: inserted,
        unsupportedRules: match.unsupported.length,
      },
    });

    revalidatePath(`/collections/${collection_id}`);
    revalidatePath('/collections');
    return actionOk(
      `Applied: ${productLabel(match.ids.length)} now in this collection.${ignoredRulesNote(match.unsupported.length)}`,
      { count: match.ids.length },
    );
  });
}

/** Bulk publish/unpublish from the collections table's selection column. */
export async function bulkUpdateCollectionStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    // Read with `getAll` + `join`, not `parseForm`: the table's selection column
    // submits one repeated `ids` field, and `parseForm` builds its input with
    // `Object.fromEntries`, which keeps only the last value (see the
    // repeated-field note in `_shared.ts`) — switching would silently act on one
    // collection.
    //
    // The `.parse()` cannot throw here: `productIdsSchema` is a string parser
    // with no refinements, so nonsense entries are dropped instead of raising a
    // ZodError that `withAdmin`'s catch-all would report as "Something went
    // wrong" (pinned by a unit test). The empty case has its own guard below.
    const ids = productIdsSchema.parse(formData.getAll('ids').join(','));
    const status = String(formData.get('bulk_status') ?? '');
    if (ids.length === 0) return actionError('Select at least one collection first.');
    if (!isOneOf(BULK_COLLECTION_ACTIONS, status)) return actionError('Choose a valid action.');
    const published = status === 'published';
    const now = new Date().toISOString();

    const { data: targets, error: readError } = await context.service
      .from('collections')
      .select('id, title, handle, published_at')
      .in('id', ids);
    if (readError) return actionError('Could not load those collections. Nothing was changed.');
    if (!targets || targets.length === 0) {
      return actionError('Those collections no longer exist. Nothing was changed.');
    }

    // Product counts come from a separate grouped query, not an embedded
    // `collects(count)`: the generated types carry no relationship metadata, so
    // an embed would need an untyped cast (see lib/data/client.ts `groupBy`).
    const counts = new Map<number, number>();
    const WINDOW = 1000;
    for (let from = 0; ; from += WINDOW) {
      const { data: collects, error } = await context.service
        .from('collects')
        .select('collection_id')
        .in('collection_id', ids)
        .order('collection_id', { ascending: true })
        .order('product_id', { ascending: true })
        .range(from, from + WINDOW - 1);
      if (error) return actionError('Could not count those collections. Nothing was changed.');
      for (const row of collects ?? []) {
        counts.set(row.collection_id, (counts.get(row.collection_id) ?? 0) + 1);
      }
      if ((collects?.length ?? 0) < WINDOW) break;
    }

    // Publishing refuses rows that would go live empty — an empty collection
    // linked from the nav is what "collections are not active" looked like.
    // Publishing an auto handle stays allowed (it is the only way back from an
    // unpublished `new-arrivals`); *unpublishing* one is refused, because the
    // storefront header/footer link them and the row gates the route, so a
    // bulk unpublish would turn those links into 404s.
    const blocked: string[] = [];
    const skippedAuto: string[] = [];
    const publishable: number[] = [];
    const needsStamp: number[] = [];
    for (const row of targets) {
      const count = counts.get(row.id) ?? 0;
      const isAuto = isAutoCollectionHandle(row.handle);
      if (isAuto && !published) {
        skippedAuto.push(row.title);
        continue;
      }
      if (published && count === 0 && !isAuto) {
        blocked.push(row.title);
        continue;
      }
      publishable.push(row.id);
      if (published && !row.published_at) needsStamp.push(row.id);
    }

    if (publishable.length > 0) {
      // Stamp first publication only; rewriting it on every publish broke
      // "newest collection" ordering.
      if (needsStamp.length > 0) {
        const { error } = await context.service
          .from('collections')
          .update({ published_at: now })
          .in('id', needsStamp);
        if (error) {
          console.error('[collections] bulk publish stamp failed', error);
          return actionError('Could not update those collections. Nothing was changed.');
        }
      }
      const { error } = await context.service
        .from('collections')
        .update({ published, updated_at: now })
        .in('id', publishable);
      if (error) {
        console.error('[collections] bulk publish failed', error);
        return actionError('Could not update those collections. Nothing was changed.');
      }
    }

    await audit(context, {
      action: 'bulk_update_status',
      entity: ENTITY,
      entityId: ids.join(','),
      after: { published, count: publishable.length, blocked, skippedAuto },
    });

    revalidatePath('/collections');

    const emptyNote =
      blocked.length > 0
        ? ` ${blocked.length} empty collection${blocked.length === 1 ? '' : 's'} stayed unpublished (${blocked.join(', ')}). Add products first.`
        : '';
    const autoNote =
      skippedAuto.length > 0
        ? ` ${skippedAuto.length} auto collection${skippedAuto.length === 1 ? '' : 's'} (${skippedAuto.join(', ')}) stayed published: the storefront links them.`
        : '';

    // Nothing published/unpublished at all is a failure with nothing changed;
    // a partially applied selection is a success that reports what it skipped,
    // so the banner does not claim a write that did land did not happen.
    if (publishable.length === 0) {
      return actionError(`${emptyNote}${autoNote}`.trim() || 'Nothing was changed.');
    }

    return actionOk(
      `${published ? 'Published' : 'Unpublished'} ${publishable.length} collection${publishable.length === 1 ? '' : 's'}.${emptyNote}${autoNote}`,
    );
  });
}

/** How many adds/removes the apply dialog lists by title. */
const DIFF_SAMPLE = 5;

/**
 * What "Preview matches" reports.
 *
 * `count` / `sample` / `unsupported` are the original payload; `adds`, `removes`
 * and `unchanged` are the membership diff the confirm dialog shows before an
 * apply replaces the collection's whole `collects` set. Nothing here writes.
 */
export interface SmartRulesPreview {
  count: number;
  sample: { id: number; title: string }[];
  unsupported: number;
  /** Matched but not yet a member. */
  adds: number;
  /** Current members the rules no longer match — what an apply would remove. */
  removes: number;
  /** Matched and already members: the part of an apply that changes nothing. */
  unchanged: number;
  /** First few adds/removes by title, for the confirm dialog. */
  sampleAdds: { id: number; title: string }[];
  sampleRemoves: { id: number; title: string }[];
}

/**
 * Delete a collection.
 *
 * The storefront answers `/collection/<handle>` from the row itself, so a
 * delete takes the page down — that is the point, and the confirm modal on the
 * detail page says so before the write happens. `collects` and
 * `smart_collection_rules` both cascade (`scripts/schema.sql`), so one statement
 * removes membership and rules; a loop would be redundant, not safer.
 *
 * Auto handles are refused outright: `new-arrivals` and `all` are computed by
 * the storefront and linked from its header/footer, so deleting the row would
 * only turn those links into 404s. Unpublish instead.
 */
export async function deleteCollectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState<{ id: number }>> {
  return withAdmin<{ id: number }>(async (context) => {
    const parsed = parseForm(collectionIdSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { collection_id } = parsed.data;

    const { data: collection, error: readError } = await context.service
      .from('collections')
      .select('*')
      .eq('id', collection_id)
      .maybeSingle();
    if (readError) return actionError('Could not load the collection. Nothing was deleted.');
    if (!collection) return actionError('That collection no longer exists.');
    if (isAutoCollectionHandle(collection.handle)) {
      return actionError(
        '`new-arrivals` and `all` are computed by the storefront and linked from its header and footer. Unpublish the row instead of deleting it.',
      );
    }

    const { error: deleteError } = await context.service
      .from('collections')
      .delete()
      .eq('id', collection_id);
    if (deleteError) {
      console.error('[collections] delete failed', collection_id, deleteError);
      return actionError('Could not delete the collection. Nothing was changed.');
    }

    // Audited after a successful delete, with the row captured before it: a
    // failed delete must not log a delete that did not happen, and `before` is
    // the only place the title and handle survive the write.
    await audit(context, {
      action: 'delete',
      entity: ENTITY,
      entityId: collection_id,
      before: collection,
    });

    revalidatePath('/collections');
    revalidatePath(`/collections/${collection_id}`);
    return actionOk<{ id: number }>(`Deleted "${collection.title}". Its storefront page will 404.`, {
      id: collection_id,
    });
  });
}
