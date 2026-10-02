import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BookOpen, ExternalLink, FilePlus2 } from 'lucide-react';
import ArticleList from '@/components/blogs/ArticleList';
import BlogEditor from '@/components/blogs/BlogEditor';
import NewArticleForm from '@/components/blogs/NewArticleForm';
import {
  BLOG_INDEX_PATH,
  articleCountLabel,
  articlePath,
  formatRelative,
  formatTimestamp,
} from '@/components/blogs/display';
import PageHeader from '@/components/ui/PageHeader';
import ProgressBar from '@/components/ui/ProgressBar';
import StatusBadge from '@/components/ui/StatusBadge';
import styles from '@/components/blogs/blogs.module.css';
import { getBlog } from '@/lib/data/blogs';
import { formatDate } from '@/lib/utils/format';

type Params = Promise<{ id: string }>;

/** Label/value row for the side rail. */
function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="row-between">
      <span className="helper">{label}</span>
      <span className="strong">{value}</span>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const detail = await getBlog(Number(id)).catch(() => null);
  return { title: detail ? `${detail.blog.title} · YORD Admin` : 'Blog · YORD Admin' };
}

/**
 * Blog detail: the blog's own fields, then its articles.
 *
 * Both inline actions this page used to own are gone — `createArticle` inserted
 * without an audit record and skipped sanitizing — so every write here goes
 * through `src/server/actions/blogs.ts`. The page is read-only apart from the
 * two forms.
 *
 * Counting and status marks are derived, not stored: `blogs` has no publish
 * flag, so "live" means "has at least one published article" and the progress
 * meter is the published share of this blog's articles.
 */
export default async function BlogDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const detail = await getBlog(numericId);
  if (!detail) notFound();

  const { blog, articles } = detail;
  const publishedCount = articles.filter((article) => article.published).length;
  const draftCount = articles.length - publishedCount;
  const lastUpdatedAt =
    articles.reduce<string | null>(
      (newest, article) =>
        !newest || (article.updated_at ?? '') > newest ? (article.updated_at ?? newest) : newest,
      null,
    ) ?? blog.updated_at;
  // The newest published article is the one worth previewing: a blog has no
  // storefront page of its own, only the shared feed.
  const newestPublished = articles.find((article) => article.published && article.handle) ?? null;
  const previewPath = newestPublished ? articlePath(newestPublished.handle) : null;
  const storefrontBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ?? '';
  const feedHref = storefrontBase ? `${storefrontBase}${BLOG_INDEX_PATH}` : null;
  const previewHref =
    storefrontBase && previewPath ? `${storefrontBase}${previewPath}` : null;

  return (
    <>
      <PageHeader
        icon={BookOpen}
        title={blog.title || 'Untitled blog'}
        description={`${blog.handle ? `/${blog.handle}` : 'no handle'} · ${articleCountLabel(articles.length)} · ${publishedCount} live`}
        actions={
          <>
            <a className="button primary" href="#new-article">
              <FilePlus2 size={14} aria-hidden />
              New article
            </a>
            {feedHref && (
              <a
                className="button"
                href={feedHref}
                target="_blank"
                rel="noopener noreferrer"
                title="Open the storefront blog feed"
              >
                <ExternalLink size={13} aria-hidden />
                View feed
              </a>
            )}
          </>
        }
      />

      <div className="row" style={{ gap: 10 }}>
        <StatusBadge
          value={publishedCount > 0 ? 'published' : 'draft'}
          label={publishedCount > 0 ? `${publishedCount} live` : 'No live articles'}
          dot
          size="md"
        />
        <span className="chip">Blog #{blog.id}</span>
        <span className="helper" title={formatTimestamp(lastUpdatedAt)}>
          Last activity {formatRelative(lastUpdatedAt)}
        </span>
      </div>

      <div className="layout-split">
        <div className="stack">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="section-title">Blog details</div>
                <div className="helper">Title, handle, and tags. Saved through the audited action.</div>
              </div>
            </div>
            <BlogEditor blog={blog} />
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="section-title">Articles</div>
                <div className="helper">
                  {articleCountLabel(articles.length)} · {publishedCount} published ·{' '}
                  {draftCount} draft
                </div>
              </div>
              <Link className="button small" href="/blogs">
                All content
              </Link>
            </div>
            <ArticleList articles={articles} blogId={blog.id} />

            <div id="new-article" className={styles.anchorTarget} style={{ marginTop: 12 }}>
              <NewArticleForm blogId={blog.id} />
            </div>
          </div>
        </div>

        <aside className="side-rail">
          <div className="card">
            <div className="card-header">
              <div className="section-title">Publishing</div>
            </div>
            <div className="stack-sm">
              <MetaRow label="Published" value={publishedCount} />
              <MetaRow label="Drafts" value={draftCount} />
              <MetaRow label="Total" value={articles.length} />
            </div>
            <div style={{ marginTop: 10 }}>
              <ProgressBar
                value={publishedCount}
                max={articles.length}
                tone="amber"
                size="sm"
                label={
                  articles.length > 0
                    ? `${publishedCount} of ${articles.length} articles live`
                    : 'No articles yet'
                }
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="section-title">Blog</div>
            </div>
            <div className="stack-sm">
              <MetaRow label="ID" value={<span className="mono">{blog.id}</span>} />
              <MetaRow
                label="Handle"
                value={<span className="mono">{blog.handle ?? '—'}</span>}
              />
              <MetaRow
                label="Created"
                value={
                  <span title={formatTimestamp(blog.created_at)}>
                    {formatDate(blog.created_at)}
                  </span>
                }
              />
              <MetaRow
                label="Updated"
                value={
                  <span title={formatTimestamp(blog.updated_at)}>
                    {formatDate(blog.updated_at)}
                  </span>
                }
              />
              <MetaRow label="Tags" value={blog.tags || '—'} />
              <MetaRow label="Articles" value={articles.length} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="section-title">Storefront</div>
            </div>
            <div className="stack-sm">
              {feedHref ? (
                <a
                  className="row helper"
                  href={feedHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open the storefront blog feed"
                >
                  <ExternalLink size={12} aria-hidden />
                  <span className="mono">{BLOG_INDEX_PATH}</span>
                </a>
              ) : (
                <span
                  className="helper mono"
                  title="Set NEXT_PUBLIC_APP_URL to open the storefront"
                >
                  {BLOG_INDEX_PATH}
                </span>
              )}
              <p className="helper">
                The storefront has one feed for every published article; a blog itself has no page.
              </p>
              {previewPath ? (
                previewHref ? (
                  <a
                    className="row helper"
                    href={previewHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open ${newestPublished?.title ?? 'the newest published article'}`}
                  >
                    <ExternalLink size={12} aria-hidden />
                    <span className="mono truncate">{previewPath}</span>
                  </a>
                ) : (
                  <span className="helper mono truncate">{previewPath}</span>
                )
              ) : (
                <span className="helper">Nothing published from this blog yet.</span>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
