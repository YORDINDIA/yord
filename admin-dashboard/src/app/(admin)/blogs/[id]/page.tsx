import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import BlogEditor from '@/components/blogs/BlogEditor';
import ArticleList from '@/components/blogs/ArticleList';
import NewArticleForm from '@/components/blogs/NewArticleForm';
import { getBlog } from '@/lib/data/blogs';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const detail = await getBlog(Number(id)).catch(() => null);
  return { title: detail ? `${detail.blog.title} · YORD Admin` : 'Blog · YORD Admin' };
}

/**
 * Blog detail.
 *
 * Both inline actions here dropped their Supabase errors, and `createArticle`
 * inserted without any audit record. The writes now go through
 * `src/server/actions/blogs.ts`, the single audited article writer.
 */
export default async function BlogDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const detail = await getBlog(numericId);
  if (!detail) notFound();

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Blog Detail</div>
            <div className="helper">{detail.articles.length} article(s)</div>
          </div>
          <Link className="button" href="/blogs">
            Back
          </Link>
        </div>
        <BlogEditor blog={detail.blog} />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Articles</div>
            <div className="helper">Drafts are created unpublished.</div>
          </div>
        </div>
        <ArticleList articles={detail.articles} />
        <NewArticleForm blogId={detail.blog.id} />
      </div>
    </div>
  );
}
