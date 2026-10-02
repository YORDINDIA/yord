import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ArticleEditor from '@/components/blogs/ArticleEditor';
import { getArticle } from '@/lib/data/blogs';
import { formatDate } from '@/lib/utils/format';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle(Number(id)).catch(() => null);
  return { title: article ? `${article.title} · YORD Admin` : 'Article · YORD Admin' };
}

/**
 * Article detail.
 *
 * The inline `updateArticle` here wrote `body_html` and `summary_html` without
 * sanitizing them, even though both are rendered with `dangerouslySetInnerHTML`
 * on the storefront, and it dropped the database error on failure. The write now
 * goes through `updateArticleAction`: sanitized, audited, and reported.
 */
export default async function ArticleDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const article = await getArticle(numericId);
  if (!article) notFound();

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Article</div>
          <div className="helper">Last updated {formatDate(article.updated_at)}</div>
        </div>
        <Link className="button" href="/blogs">
          Back
        </Link>
      </div>
      <ArticleEditor article={article} />
    </div>
  );
}
