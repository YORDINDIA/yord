'use server';

import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionState } from '@/lib/action-state';
import { getFirstBlogId } from '@/lib/data/blogs';
import { isUniqueViolation } from '@/lib/errors';
import { getNextId } from '@/lib/utils/ids';
import { escapeHtml, sanitizeHtml, slugify } from '@/lib/utils/sanitize';
import { aiBlogSaveSchema, firstIssue, imageIdSchema } from '@/lib/validation';
import { audit, withAdmin } from './_shared';

/**
 * AI draft persistence.
 *
 * `api/ai/blog/save` created `articles` rows directly, without `logAudit`, and
 * validated only `typeof body_html === 'string'`. The write now lives here, so
 * it gets `requireAdmin()`, the shared zod schema, HTML sanitization, and an
 * audit entry. `AiBlogStudio` calls it directly; the route is gone.
 */
export async function saveAiDraftAction(
  _prev: ActionState,
  input: unknown,
): Promise<ActionState<{ id: number }>> {
  return withAdmin<{ id: number }>(async (context) => {
    const parsed = aiBlogSaveSchema.safeParse(input);
    if (!parsed.success) {
      return actionError(firstIssue(parsed.error, 'The draft payload was invalid.'));
    }
    const draft = parsed.data;

    const [blogId, id] = await Promise.all([getFirstBlogId(), getNextId('articles')]);
    if (!blogId) return actionError('No blog exists yet. Create one first.');

    const now = new Date().toISOString();
    const safeTopic = draft.topic.slice(0, 500);
    const handle = slugify(safeTopic, `ai-draft-${id}`);

    // Model output is still untrusted input: sanitize before storage, since the
    // storefront renders body_html with dangerouslySetInnerHTML.
    const citationBlock =
      draft.citations.length > 0
        ? `<h4>Citations</h4><ul>${draft.citations
            .map((citation) => `<li>${escapeHtml(citation)}</li>`)
            .join('')}</ul>`
        : '';
    const body = sanitizeHtml(`${draft.body_html}${citationBlock}`);

    const { error } = await context.service.from('articles').insert({
      id,
      blog_id: blogId,
      title: safeTopic,
      handle,
      author: 'YORD Team',
      body_html: body || null,
      summary_html: sanitizeHtml(draft.summary_html) || null,
      tags: draft.tags || null,
      published: false,
      created_at: now,
      updated_at: now,
    });
    if (error) {
      console.error('[ai] article insert failed', error);
      if (isUniqueViolation(error)) {
        return actionError('An article with this handle already exists.');
      }
      return actionError('Could not save the draft.');
    }

    await audit(context, {
      action: 'ai_save_draft',
      entity: 'articles',
      entityId: id,
      after: { blog_id: blogId, title: safeTopic, handle, citations: draft.citations.length },
    });

    revalidatePath('/blogs');
    revalidatePath(`/blogs/${blogId}`);
    return actionOk<{ id: number }>(`Draft #${id} saved (unpublished).`, { id });
  });
}

/**
 * Apply an AI image to a product image row.
 *
 * `ai/listing/page.tsx` wrote `product_images.storage_url` directly from the
 * browser with the publishable key, bypassing the audit trail entirely. That write is
 * now this action, behind `requireAdmin()`.
 */
export async function applyAiImageAction(
  _prev: ActionState,
  input: { imageId: number; url: string },
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsedId = imageIdSchema.safeParse({ image_id: input?.imageId });
    const url = String(input?.url ?? '');
    if (!parsedId.success) return actionError('Invalid image id.');
    const imageId = parsedId.data.image_id;
    if (!url.startsWith('https://')) {
      return actionError('The generated image URL must be https.');
    }

    const { data: before, error: readError } = await context.service
      .from('product_images')
      .select('id, product_id, storage_url')
      .eq('id', imageId)
      .maybeSingle();
    if (readError) return actionError('Could not load that image.');
    if (!before) return actionError('That image no longer exists.');

    const { error } = await context.service
      .from('product_images')
      .update({ storage_url: url, updated_at: new Date().toISOString() })
      .eq('id', imageId);
    if (error) {
      console.error('[ai] image apply failed', imageId, error);
      return actionError('Could not apply the image. Nothing was changed.');
    }

    await audit(context, {
      action: 'ai_apply_image',
      entity: 'product_images',
      entityId: imageId,
      before,
      after: { storage_url: url },
    });

    revalidatePath(`/products/${before.product_id}`);
    revalidatePath('/ai/listing');
    return actionOk('Image applied to the product.');
  });
}
