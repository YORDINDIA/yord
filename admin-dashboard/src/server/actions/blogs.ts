'use server';

import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionState } from '@/lib/action-state';
import { isUniqueViolation } from '@/lib/errors';
import { getNextId } from '@/lib/utils/ids';
import { sanitizeHtml, slugify } from '@/lib/utils/sanitize';
import { articleSchema, blogSchema, newArticleSchema, newBlogSchema } from '@/lib/validation';
import { audit, parseForm, withAdmin } from './_shared';

/**
 * Blog and article mutations.
 *
 * Articles had three overlapping writers — `blogs/[id]/page.tsx` (create),
 * `articles/[id]/page.tsx` (update), and `api/ai/blog/save` (create from AI) —
 * and two of the three skipped `logAudit` entirely. All three now go through
 * this module, so every article write is validated by one schema, sanitized,
 * and audited.
 */

export async function updateBlogAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsed = parseForm(blogSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;

    const { data: before, error: readError } = await context.service
      .from('blogs')
      .select('*')
      .eq('id', input.id)
      .maybeSingle();
    if (readError) return actionError('Could not load the blog. Nothing was saved.');
    if (!before) return actionError('That blog no longer exists.');

    // An empty handle is create-only: persisting '' would make the record
    // unreachable by handle, so regenerate from the title.
    const handle = input.handle || slugify(input.title, before.handle ?? `blog-${input.id}`);

    const { error } = await context.service
      .from('blogs')
      .update({
        title: input.title,
        handle,
        tags: input.tags || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id);
    if (error) {
      console.error('[blogs] update failed', input.id, error);
      return actionError('Could not save the blog. Nothing was changed.');
    }

    await audit(context, {
      action: 'update',
      entity: 'blogs',
      entityId: input.id,
      before,
      after: { title: input.title, handle, tags: input.tags },
    });

    revalidatePath(`/blogs/${input.id}`);
    revalidatePath('/blogs');
    return actionOk('Blog saved.');
  });
}

export async function createBlogAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState<{ id: number }>> {
  return withAdmin<{ id: number }>(async (context) => {
    const parsed = parseForm(newBlogSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;

    const id = await getNextId('blogs');
    const now = new Date().toISOString();
    const handle =
      input.handle || input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    const { error } = await context.service.from('blogs').insert({
      id,
      title: input.title,
      handle: handle || `blog-${id}`,
      tags: input.tags || null,
      created_at: now,
      updated_at: now,
    });
    if (error) {
      console.error('[blogs] insert failed', error);
      return actionError('Could not create the blog.');
    }

    await audit(context, {
      action: 'create',
      entity: 'blogs',
      entityId: id,
      after: { title: input.title, handle },
    });

    revalidatePath('/blogs');
    return actionOk<{ id: number }>('Blog created.', { id });
  });
}

/** Article create from the blog detail page. */
export async function createArticleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState<{ id: number }>> {
  return withAdmin<{ id: number }>(async (context) => {
    const parsed = parseForm(newArticleSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;

    const { data: blog, error: blogError } = await context.service
      .from('blogs')
      .select('id')
      .eq('id', input.blog_id)
      .maybeSingle();
    // A failed lookup is a load failure, not a deleted blog: reporting it as
    // "no longer exists" sends the admin hunting for a record that is there.
    if (blogError) return actionError('Could not load the blog. Nothing was saved.');
    if (!blog) return actionError('That blog no longer exists.');

    const id = await getNextId('articles');
    const now = new Date().toISOString();
    const handle =
      input.handle || input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    const { error } = await context.service.from('articles').insert({
      id,
      blog_id: input.blog_id,
      title: input.title,
      handle: handle || `article-${id}`,
      author: input.author || 'YORD Team',
      body_html: sanitizeHtml(input.body_html) || null,
      summary_html: sanitizeHtml(input.summary_html) || null,
      tags: input.tags || null,
      published: false,
      created_at: now,
      updated_at: now,
    });
    if (error) {
      console.error('[articles] insert failed', error);
      if (isUniqueViolation(error)) {
        return actionError('An article with that handle already exists.');
      }
      return actionError('Could not create the article.');
    }

    await audit(context, {
      action: 'create',
      entity: 'articles',
      entityId: id,
      after: { blog_id: input.blog_id, title: input.title, handle },
    });

    revalidatePath(`/blogs/${input.blog_id}`);
    revalidatePath('/blogs');
    return actionOk<{ id: number }>(`Draft #${id} created.`, { id });
  });
}

/**
 * Article update. This is the single writer for article edits: `articles/[id]`
 * used to own its own unguarded action while `api/ai/blog/save` created rows
 * behind the audit trail.
 */
export async function updateArticleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsed = parseForm(articleSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;
    const now = new Date().toISOString();

    const { data: before, error: readError } = await context.service
      .from('articles')
      .select('*')
      .eq('id', input.id)
      .maybeSingle();
    if (readError) return actionError('Could not load the article. Nothing was saved.');
    if (!before) return actionError('That article no longer exists.');

    // An empty handle is create-only: persisting '' would make the record
    // unreachable by handle, so regenerate from the title.
    const handle = input.handle || slugify(input.title, before.handle ?? `article-${input.id}`);

    const { error } = await context.service
      .from('articles')
      .update({
        title: input.title,
        handle,
        author: input.author || null,
        tags: input.tags || null,
        // Both HTML columns are rendered with dangerouslySetInnerHTML downstream.
        body_html: sanitizeHtml(input.body_html) || null,
        summary_html: sanitizeHtml(input.summary_html) || null,
        published: input.published,
        published_at: input.published ? (before.published_at ?? now) : null,
        updated_at: now,
      })
      .eq('id', input.id);
    if (error) {
      console.error('[articles] update failed', input.id, error);
      if (isUniqueViolation(error)) {
        return actionError('Another article already uses that handle.');
      }
      return actionError('Could not save the article. Nothing was changed.');
    }

    await audit(context, {
      action: 'update',
      entity: 'articles',
      entityId: input.id,
      before,
      after: { title: input.title, handle, published: input.published },
    });

    revalidatePath(`/articles/${input.id}`);
    revalidatePath(`/blogs/${before.blog_id}`);
    revalidatePath('/blogs');
    return actionOk('Article saved.');
  });
}
