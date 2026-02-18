import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils/format';

async function updateArticle(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const id = Number(formData.get('id'));
  const title = String(formData.get('title') || '').trim();
  const handle = String(formData.get('handle') || '').trim();
  const author = String(formData.get('author') || '').trim();
  const tags = String(formData.get('tags') || '').trim();
  const bodyHtml = String(formData.get('body_html') || '').trim();
  const summary = String(formData.get('summary_html') || '').trim();
  const published = formData.get('published') === 'on';
  const now = new Date().toISOString();

  await supabase.from('articles').update({
    title,
    handle,
    author,
    tags: tags || null,
    body_html: bodyHtml || null,
    summary_html: summary || null,
    published,
    published_at: published ? now : null,
    updated_at: now,
  }).eq('id', id);
}

export default async function ArticleDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const { data: article } = await supabase.from('articles').select('*').eq('id', params.id).single();

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Article</div>
          <div className="helper">Last updated {formatDate(article?.updated_at)}</div>
        </div>
        <Link className="button" href="/blogs">Back</Link>
      </div>
      <form action={updateArticle} className="form-grid">
        <input type="hidden" name="id" value={article?.id} />
        <div>
          <label className="helper">Title</label>
          <input className="input" name="title" defaultValue={article?.title || ''} />
        </div>
        <div>
          <label className="helper">Handle</label>
          <input className="input" name="handle" defaultValue={article?.handle || ''} />
        </div>
        <div>
          <label className="helper">Author</label>
          <input className="input" name="author" defaultValue={article?.author || ''} />
        </div>
        <div>
          <label className="helper">Tags</label>
          <input className="input" name="tags" defaultValue={article?.tags || ''} />
        </div>
        <div>
          <label className="helper">Published</label>
          <input type="checkbox" name="published" defaultChecked={article?.published ?? false} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="helper">Summary</label>
          <textarea className="textarea" name="summary_html" rows={4} defaultValue={article?.summary_html || ''} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="helper">Body HTML</label>
          <textarea className="textarea" name="body_html" rows={10} defaultValue={article?.body_html || ''} />
        </div>
        <button className="button primary" type="submit">Save Article</button>
      </form>
    </div>
  );
}
