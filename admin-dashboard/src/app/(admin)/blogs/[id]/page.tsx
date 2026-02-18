import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { getNextId } from '@/lib/utils/ids';

async function updateBlog(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const id = Number(formData.get('id'));
  const title = String(formData.get('title') || '').trim();
  const handle = String(formData.get('handle') || '').trim();
  const tags = String(formData.get('tags') || '').trim();
  await supabase.from('blogs').update({ title, handle, tags: tags || null, updated_at: new Date().toISOString() }).eq('id', id);
}

async function createArticle(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const blogId = Number(formData.get('blog_id'));
  const title = String(formData.get('title') || '').trim();
  const handle = String(formData.get('handle') || '').trim();
  const author = String(formData.get('author') || 'YORD Team');
  const bodyHtml = String(formData.get('body_html') || '');
  const summary = String(formData.get('summary_html') || '');
  const tags = String(formData.get('tags') || '').trim();
  const id = await getNextId('articles');
  const now = new Date().toISOString();
  await supabase.from('articles').insert({
    id,
    blog_id: blogId,
    title,
    handle: handle || title.toLowerCase().replace(/\s+/g, '-'),
    author,
    body_html: bodyHtml || null,
    summary_html: summary || null,
    tags: tags || null,
    published: false,
    created_at: now,
    updated_at: now,
  });
}

export default async function BlogDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const { data: blog } = await supabase.from('blogs').select('*').eq('id', params.id).single();
  const { data: articles } = await supabase.from('articles').select('id, title, published').eq('blog_id', params.id);

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Blog Detail</div>
          </div>
          <Link className="button" href="/blogs">Back</Link>
        </div>
        <form action={updateBlog} className="form-grid">
          <input type="hidden" name="id" value={blog?.id} />
          <div>
            <label className="helper">Title</label>
            <input className="input" name="title" defaultValue={blog?.title || ''} />
          </div>
          <div>
            <label className="helper">Handle</label>
            <input className="input" name="handle" defaultValue={blog?.handle || ''} />
          </div>
          <div>
            <label className="helper">Tags</label>
            <input className="input" name="tags" defaultValue={blog?.tags || ''} />
          </div>
          <button className="button primary" type="submit">Save Blog</button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Articles</div>
          </div>
        </div>
        <ul className="helper">
          {(articles || []).map((article) => (
            <li key={article.id}><Link href={`/articles/${article.id}`}>{article.title}</Link> · {article.published ? 'Published' : 'Draft'}</li>
          ))}
        </ul>
        <form action={createArticle} className="form-grid" style={{ marginTop: 16 }}>
          <input type="hidden" name="blog_id" value={blog?.id} />
          <div>
            <label className="helper">Article Title</label>
            <input className="input" name="title" />
          </div>
          <div>
            <label className="helper">Handle</label>
            <input className="input" name="handle" />
          </div>
          <div>
            <label className="helper">Author</label>
            <input className="input" name="author" defaultValue="YORD Team" />
          </div>
          <div>
            <label className="helper">Tags</label>
            <input className="input" name="tags" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="helper">Summary</label>
            <textarea className="textarea" name="summary_html" rows={3} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="helper">Body HTML</label>
            <textarea className="textarea" name="body_html" rows={6} />
          </div>
          <button className="button" type="submit">Create Draft</button>
        </form>
      </div>
    </div>
  );
}
