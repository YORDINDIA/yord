'use server';

import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionState } from '@/lib/action-state';
import { PRODUCT_STATUSES, isOneOf } from '@/lib/constants';
import { getNextId } from '@/lib/utils/ids';
import { sanitizeHtml, slugify } from '@/lib/utils/sanitize';
import {
  aiListingApplySchema,
  firstIssue,
  imageIdSchema,
  newProductSchema,
  parseVariantRows,
  productIdsSchema,
  productImageSchema,
  productSchema,
} from '@/lib/validation';
import { audit, parseForm, withAdmin } from './_shared';

const ENTITY = 'products';

/**
 * Product mutations. Every one of these used to be an inline `'use server'`
 * function in `products/[id]/page.tsx` that returned `undefined` on failure,
 * so a failed save looked identical to a successful one.
 */

export async function updateProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsed = parseForm(productSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;
    const now = new Date().toISOString();

    const { data: before, error: readError } = await context.service
      .from('products')
      .select('*')
      .eq('id', input.id)
      .maybeSingle();
    if (readError) {
      console.error('[products] read before update failed', readError);
      return actionError('Could not load the product. Nothing was saved.');
    }
    if (!before) return actionError('That product no longer exists.');

    // An empty handle is create-only (auto-generated): persisting '' on an
    // update would make the record unreachable by handle, so regenerate from
    // the title and fall back to the previous handle.
    const handle = input.handle || slugify(input.title, before.handle ?? `product-${input.id}`);

    const { error } = await context.service
      .from('products')
      .update({
        title: input.title,
        handle,
        status: input.status,
        tags: input.tags || null,
        // Admin-authored HTML is sanitized before storage: this column is later
        // rendered with dangerouslySetInnerHTML in the AI previews and on the
        // storefront.
        body_html: sanitizeHtml(input.body_html) || null,
        updated_at: now,
        published_at:
          input.status === 'active' ? (before.published_at ?? now) : before.published_at,
      })
      .eq('id', input.id);

    if (error) {
      console.error('[products] update failed', input.id, error);
      return actionError('Could not save the product. Nothing was changed.');
    }

    await audit(context, {
      action: 'update',
      entity: ENTITY,
      entityId: input.id,
      before,
      after: { title: input.title, handle, status: input.status, tags: input.tags },
    });

    revalidatePath(`/products/${input.id}`);
    revalidatePath('/products');
    return actionOk('Product saved.');
  });
}

export async function createProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState<{ id: number }>> {
  return withAdmin(async (context) => {
    const parsed = parseForm(newProductSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;

    const [productId, variantId] = await Promise.all([
      getNextId(ENTITY),
      getNextId('product_variants'),
    ]);
    const now = new Date().toISOString();
    const handle =
      input.handle || input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    const { error: productError } = await context.service.from('products').insert({
      id: productId,
      title: input.title,
      handle: handle || `product-${productId}`,
      vendor: input.vendor || 'YORD',
      product_type: input.product_type || 'Apparel',
      tags: input.tags || null,
      body_html: sanitizeHtml(input.body_html) || null,
      status: input.status,
      created_at: now,
      updated_at: now,
    });
    if (productError) {
      console.error('[products] insert failed', productError);
      return actionError('Could not create the product.');
    }

    const { error: variantError } = await context.service
      .from('product_variants')
      .insert({
        id: variantId,
        product_id: productId,
        title: 'Default',
        price: input.price,
        inventory_quantity: input.inventory,
        position: 1,
        created_at: now,
        updated_at: now,
      });
    if (variantError) {
      console.error('[products] default variant insert failed', variantError);
      // The product row exists but has no variant; surface it loudly rather than
      // reporting success, and remove the half-created product so a retry is
      // clean.
      await context.service.from('products').delete().eq('id', productId);
      return actionError('Could not create the default variant. Nothing was saved.');
    }

    await audit(context, {
      action: 'create',
      entity: ENTITY,
      entityId: productId,
      after: { title: input.title, handle, price: input.price, inventory: input.inventory },
    });

    revalidatePath('/products');
    return actionOk<{ id: number }>(`Created draft #${productId}.`, { id: productId });
  });
}

/** Bulk status change from the products table's selection column. */
export async function bulkUpdateProductStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    // The bulk form submits `ids` as repeated (or comma-joined) fields.
    const ids = productIdsSchema.parse(formData.getAll('ids').join(','));
    const status = String(formData.get('bulk_status') ?? '');

    if (ids.length === 0) return actionError('Select at least one product first.');
    if (!isOneOf(PRODUCT_STATUSES, status)) return actionError('Choose a valid status.');

    // One RPC statement, so a failure cannot leave products active with
    // `published_at = NULL` (the old two-update version only logged the stamp
    // failure and still reported success). The RPC backfills missing
    // publication timestamps via coalesce, preserving existing ones.
    const { error } = await context.service.rpc('bulk_set_product_status', {
      p_ids: ids,
      p_status: status,
    });
    if (error) {
      console.error('[products] bulk update failed', error);
      return actionError(`Could not update ${ids.length} product(s). Nothing was changed.`);
    }

    await audit(context, {
      action: 'bulk_update_status',
      entity: ENTITY,
      entityId: ids.join(','),
      after: { status, count: ids.length },
    });

    revalidatePath('/products');
    return actionOk(`Updated ${ids.length} product(s) to ${status}.`);
  });
}

export async function addProductImageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsed = parseForm(productImageSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;

    // `product_id` comes from the form. A foreign key would reject a deleted
    // product, but the error would read as a generic insert failure and consume
    // a sequence id; this reports the real cause before allocating one.
    const { data: product, error: readError } = await context.service
      .from('products')
      .select('id')
      .eq('id', input.product_id)
      .maybeSingle();
    if (readError) return actionError('Could not load that product. Nothing was saved.');
    if (!product) return actionError('That product no longer exists.');

    const id = await getNextId('product_images');
    const now = new Date().toISOString();
    const { error } = await context.service.from('product_images').insert({
      id,
      product_id: input.product_id,
      // Position 1 keeps a new image behind the cover; `set_cover_image` is the
      // only thing that puts an image at 0.
      position: 1,
      src: input.image_url,
      supabase_url: input.image_url,
      alt: input.alt || null,
      created_at: now,
      updated_at: now,
    });
    if (error) {
      console.error('[products] image insert failed', error);
      return actionError('Could not add the image.');
    }

    await audit(context, {
      action: 'add_image',
      entity: 'product_images',
      entityId: id,
      after: { product_id: input.product_id, src: input.image_url },
    });

    revalidatePath(`/products/${input.product_id}`);
    return actionOk('Image added.');
  });
}

export async function deleteProductImageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsedId = imageIdSchema.safeParse({ image_id: formData.get('image_id') });
    if (!parsedId.success) return actionError('Invalid image id.');
    const imageId = parsedId.data.image_id;

    const { data: image, error: readError } = await context.service
      .from('product_images')
      .select('id, product_id, supabase_url, alt')
      .eq('id', imageId)
      .maybeSingle();
    if (readError) return actionError('Could not load that image.');
    if (!image) return actionError('That image no longer exists.');

    const { error } = await context.service.from('product_images').delete().eq('id', imageId);
    if (error) {
      console.error('[products] image delete failed', error);
      return actionError('Could not delete the image.');
    }

    await audit(context, {
      action: 'delete_image',
      entity: 'product_images',
      entityId: imageId,
      before: image,
    });

    revalidatePath(`/products/${image.product_id}`);
    return actionOk('Image deleted.');
  });
}

/**
 * Promote an image to the cover.
 *
 * The old inline action set `position = 0` on the chosen image and never demoted
 * the previous cover, so two images ended up at position 0. Its comment claimed
 * a swap that the code did not perform. `set_cover_image()` does the whole swap
 * in one statement (sql/004_atomic_writes.sql).
 */
export async function setCoverImageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsedId = imageIdSchema.safeParse({ image_id: formData.get('image_id') });
    if (!parsedId.success) return actionError('Invalid image id.');
    const imageId = parsedId.data.image_id;

    const { data, error } = await context.service.rpc('set_cover_image', {
      p_image_id: imageId,
    });
    if (error) {
      console.error('[products] set_cover_image failed', imageId, error);
      // The RPC raises IMAGE_NOT_FOUND for an id that no longer exists, which
      // is reachable here: the image list comes from the last render, so a
      // concurrent delete leaves a stale row. Report that as the stale-link case
      // rather than as a write that may or may not have landed.
      if (error.message.includes('IMAGE_NOT_FOUND')) {
        return actionError('That image no longer exists. Refresh the page.');
      }
      return actionError('Could not update the cover image. Nothing was changed.');
    }

    await audit(context, {
      action: 'set_cover_image',
      entity: 'product_images',
      entityId: imageId,
      after: { product_id: data },
    });

    revalidatePath(`/products/${data}`);
    return actionOk('Cover image updated.');
  });
}

/**
 * Apply an edited variant set.
 *
 * The old action `JSON.parse`d a raw client blob and `continue`d past bad rows,
 * applying updates one at a time, so a failure half-way left the variant table
 * inconsistent. The payload is parsed through `parseVariantRows`, checked
 * against the product the form is editing, then applied by a single
 * `set_product_variants` statement.
 */
export async function updateVariantsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsedPayload = parseVariantRows(String(formData.get('payload') ?? ''));
    if (!parsedPayload.ok) return actionError(parsedPayload.message);

    const rows = parsedPayload.rows;
    if (rows.length === 0) return actionError('There are no variants to save.');

    const requestedProductId = Number(formData.get('product_id'));

    // Scope the payload to the product the form claims to be editing, and fail if
    // any row names a variant of a different product.
    //
    // The variant ids come from a client-serialized JSON blob. The old code
    // applied them unverified, so a crafted payload could write to any variant in
    // the catalog, and the audit entry would still name the requested product —
    // an edit to product A recorded against product B. The RPC itself is
    // id-keyed and cannot check this, so it is enforced here.
    const variantIds = rows.map((row) => row.id);
    const { data: owned, error: ownerError } = await context.service
      .from('product_variants')
      .select('id, product_id')
      .in('id', variantIds);
    if (ownerError) {
      console.error('[products] variant ownership check failed', ownerError);
      return actionError('Could not verify which product those variants belong to. Nothing was changed.');
    }

    const foreign = (owned ?? []).filter(
      (row) => row.product_id !== requestedProductId,
    );
    if (foreign.length > 0) {
      console.error(
        '[products] variant payload crossed products',
        requestedProductId,
        foreign.map((row) => row.id),
      );
      return actionError('Those variants do not belong to this product. Nothing was changed.');
    }
    // A submitted id that does not exist cannot be updated; treat it as a
    // rejection rather than silently applying the subset that does exist.
    if ((owned ?? []).length !== variantIds.length) {
      return actionError('One of those variants no longer exists. Reload the page and try again.');
    }

    const productId = requestedProductId;
    const { error } = await context.service.rpc('set_product_variants', {
      p_rows: rows.map((row) => ({
        id: row.id,
        price: row.price ?? 0,
        compare_at_price: row.compare_at_price ?? null,
        inventory_quantity: row.inventory_quantity ?? 0,
        // Only rows the admin actually changed stock on may write inventory;
        // the RPC keeps the persisted value for the rest, so a price-only
        // save cannot restore stock a concurrent checkout decremented.
        include_inventory: row.include_inventory,
      })),
    });
    if (error) {
      console.error('[products] set_product_variants failed', error);
      // The RPC rejects the whole batch if any row is malformed rather than
      // updating the subset that happens to parse, so this means nothing was
      // applied — but the client-side parse should have caught it first, so it
      // is worth surfacing as a distinct cause.
      if (error.message.includes('INVALID_VARIANT_ROWS')) {
        return actionError(
          'The database rejected one of the variant rows. Nothing was changed. Reload the page and try again.',
        );
      }
      return actionError('Could not save variants. Nothing was changed.');
    }

    await audit(context, {
      action: 'update_variants',
      entity: 'product_variants',
      entityId: productId,
      after: { count: rows.length },
    });

    revalidatePath('/products');
    revalidatePath(`/products/${productId}`);
    return actionOk(`Saved ${rows.length} variant(s).`);
  });
}

/**
 * AI-studio apply path, kept beside the other product writes for one audit path.
 *
 * The schema here is the same shape `aiListingApplySchema` declares in
 * `lib/validation`; the API route re-parses the request body before calling, and
 * this action re-checks it so the write is safe from any caller.
 */
export async function applyListingSuggestionAction(input: {
  productId: number;
  suggestion: { title: string; body_html: string; tags?: string };
}): Promise<ActionState<{ productId: number }>> {
  return withAdmin<{ productId: number }>(async (context) => {
    const parsed = aiListingApplySchema.safeParse(input);
    if (!parsed.success) {
      return actionError(
        firstIssue(parsed.error, 'The suggestion payload was invalid.', 'suggestion'),
      );
    }
    const { productId, suggestion } = parsed.data;

    const { data: before, error: readError } = await context.service
      .from('products')
      .select('*')
      .eq('id', productId)
      .maybeSingle();
    if (readError) {
      console.error('[products] AI apply read failed', readError);
      return actionError('Could not load the product.');
    }
    if (!before) return actionError('That product no longer exists.');

    const { error } = await context.service
      .from('products')
      .update({
        title: suggestion.title,
        // Model output is untrusted; the storefront renders this column with
        // dangerouslySetInnerHTML.
        body_html: sanitizeHtml(suggestion.body_html),
        tags: suggestion.tags ?? before.tags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);
    if (error) {
      console.error('[products] AI apply failed', productId, error);
      return actionError('Could not apply the suggestion. Nothing was changed.');
    }

    await audit(context, {
      action: 'ai_apply',
      entity: ENTITY,
      entityId: productId,
      before,
      after: suggestion,
    });

    revalidatePath(`/products/${productId}`);
    revalidatePath('/products');
    return actionOk('Suggestion applied.', { productId });
  });
}
