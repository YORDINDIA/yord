import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react';
import ArticleEditor from '@/components/blogs/ArticleEditor';
import { articlePath, formatRelative } from '@/components/blogs/display';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { getArticle, getBlogRef } from '@/lib/data/blogs';
import { storefrontOrigin } from '@/lib/storefront-origin';
import { formatDate } from '@/lib/utils/format';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle(Number(id)).catch(() => null);
  return { title: article ? `${article.title} · YORD Admin` : 'Article · YORD Admin' };
}

/**
 * Article editor.
 *
 * The inline `updateArticle` this page used to own wrote `body_html` and
 * `summary_html` without sanitizing them — even though both are rendered with
 * `dangerouslySetInnerHTML` on the storefront — and dropped the database error
 * on failure. The write now goes through `updateArticleAction`: validated by
 * `articleSchema`, sanitized, audited, and reported through `ActionState`.
 *
 * The editor itself is a client component because the preview follows typing;
 * it renders the form and the preview rail side by side.
 */
export default async function ArticleDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const article = await getArticle(numericId);
  if (!article) notFound();

  const blogRef = await getBlogRef(article.blog_id);
  const path = articlePath(article.handle);
  // `storefrontOrigin()` drops a same-origin `NEXT_PUBLIC_APP_URL`: with the
  // repo's localhost setup both apps serve :3000, and this link would open the
  // admin's own `/blog/...` route (not-found) instead of the storefront.
  const origin = await storefrontOrigin();
  const liveHref = article.published && origin && path ? `${origin}${path}` : null;

  return (
    <>
      <PageHeader
        icon={FileText}
        title={article.title || 'Untitled article'}
        description={`${blogRef?.title ?? `Blog #${article.blog_id}`} · ${path ?? 'no handle'} · updated ${formatRelative(article.updated_at)}`}
        actions={
          <>
            {liveHref && (
              <a
                className="button"
                href={liveHref}
                target="_blank"
                rel="noopener noreferrer"
                title="Open the published article on the storefront"
              >
                <ExternalLink size={13} aria-hidden />
                View live
              </a>
            )}
            <Link className="button" href={`/blogs/${article.blog_id}`}>
              <ArrowLeft size={13} aria-hidden />
              Back to blog
            </Link>
          </>
        }
      />

      <div className="row" style={{ gap: 10 }}>
        <StatusBadge
          value={article.published ? 'published' : 'draft'}
          label={article.published ? 'Published' : 'Draft'}
          dot
          size="md"
        />
        <span className="chip">Article #{article.id}</span>
        <span className="helper">
          {article.published_at
            ? `First published ${formatDate(article.published_at)}`
            : 'Never published — the storefront does not serve it'}
        </span>
      </div>

      <ArticleEditor article={article} />
    </>
  );
}
