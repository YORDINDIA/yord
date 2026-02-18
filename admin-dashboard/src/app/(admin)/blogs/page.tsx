import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils/format';

export default async function BlogsPage() {
  const supabase = await createServerClient();
  const { data: blogs } = await supabase.from('blogs').select('id, title, handle, updated_at').order('updated_at', { ascending: false });
  const { data: articles } = await supabase.from('articles').select('id, title, handle, published, published_at').order('created_at', { ascending: false }).limit(10);

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Blogs</div>
            <div className="helper">Manage blog containers and tags.</div>
          </div>
          <Link className="button primary" href="/blogs/new">New Blog</Link>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Handle</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {(blogs || []).map((blog) => (
              <tr key={blog.id}>
                <td><Link href={`/blogs/${blog.id}`}>{blog.title}</Link></td>
                <td>{blog.handle || '-'}</td>
                <td>{formatDate(blog.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Recent Articles</div>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Published</th>
            </tr>
          </thead>
          <tbody>
            {(articles || []).map((article) => (
              <tr key={article.id}>
                <td><Link href={`/articles/${article.id}`}>{article.title}</Link></td>
                <td>{article.published ? 'Published' : 'Draft'}</td>
                <td>{formatDate(article.published_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
