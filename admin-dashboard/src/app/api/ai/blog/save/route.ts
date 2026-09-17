export const runtime = 'nodejs';

import { getNextId } from '@/lib/utils/ids';
import { requireAdmin } from '@/lib/utils/admin';
import { escapeHtml, slugify } from '@/lib/utils/sanitize';
import { clampText, failJson, okJson } from '@/lib/utils/prompt';

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const { service } = auth;

    const { topic, summary_html, body_html, tags, citations } = await req.json();
    if (!topic || typeof topic !== 'string' || !body_html || typeof body_html !== 'string') {
      return failJson('BAD_REQUEST', 'topic and body_html are required', 400);
    }

    const { data: blog } = await service
      .from('blogs')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    if (!blog) {
      return failJson('BAD_REQUEST', 'No blog available', 400);
    }

    const id = await getNextId('articles');
    const now = new Date().toISOString();
    const safeTopic = clampText(topic, 500);
    const handle = slugify(safeTopic);
    const citationBlock =
      Array.isArray(citations) && citations.length
        ? `<h4>Citations</h4><ul>${citations.map((c: unknown) => `<li>${escapeHtml(String(c))}</li>`).join('')}</ul>`
        : '';
    const finalBody = `${body_html}${citationBlock}`;

    const { error } = await service.from('articles').insert({
      id,
      blog_id: blog.id,
      title: safeTopic,
      handle,
      author: 'YORD Team',
      body_html: finalBody || null,
      summary_html: typeof summary_html === 'string' ? summary_html : null,
      tags: typeof tags === 'string' ? tags : null,
      published: false,
      created_at: now,
      updated_at: now,
    });
    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        return failJson('CONFLICT', 'An article with this handle already exists', 409);
      }
      console.error('articles insert failed', error);
      return failJson('INTERNAL', 'Failed to save article', 500);
    }

    return okJson({ id }, { success: true, id });
  } catch (error: unknown) {
    console.error('Blog save failed', error);
    return failJson('INTERNAL', 'Failed to save article', 500);
  }
}
