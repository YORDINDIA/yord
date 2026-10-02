import Link from 'next/link';
import type { Metadata } from 'next';
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  FilePen,
  FilePlus2,
  FileText,
  Plus,
  X,
} from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import FilterBar, { FilterSelect } from '@/components/data/FilterBar';
import Pagination from '@/components/data/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import Thumb from '@/components/ui/Thumb';
import {
  articleImageUrl,
  articlePath,
  formatRelative,
  formatTimestamp,
  liveLabel,
} from '@/components/blogs/display';
import {
  contentSummary,
  getBlogRef,
  listArticleRows,
  listBlogsWithMeta,
  parseArticleStatus,
  type ArticleListItem,
  type BlogListRow,
} from '@/lib/data/blogs';
import { clampPage, firstParam, qs } from '@/lib/pagination';
import { formatDate } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Content · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

const countFormat = new Intl.NumberFormat('en-IN');

/** Status options for the article table's filter. */
const ARTICLE_STATUS_OPTIONS = [
  { value: 'all', label: 'All articles' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
] as const;

/**
 * Content index: blogs on top, articles underneath.
 *
 * Both tables are paged (`blog_page` / `article_page`) — the blog list used to
 * be unbounded and the article list was capped at ten with no pager, so
 * everything past the tenth article was unreachable. Both go through
 * `DataTable`, so a wide table scrolls instead of overflowing a phone, and both
 * empty states are designed rather than blank.
 *
 * Reads: one page of blogs with its per-blog counts/cover (two queries), one
 * page of articles, and one summary payload for the stat strip. No per-row
 * reads and no embeddings.
 */
export default async function BlogsPage({ searchParams }: { searchParams?: Promise<Search> }) {
  const resolved = searchParams ? await searchParams : {};
  const q = firstParam(resolved.q)?.trim() || undefined;
  const blogPage = clampPage(firstParam(resolved.blog_page));
  const articlePage = clampPage(firstParam(resolved.article_page));
  const status = parseArticleStatus(firstParam(resolved.article_status));
  const blogParam = Number(firstParam(resolved.blog));
  const blogFilterId = Number.isInteger(blogParam) && blogParam > 0 ? blogParam : undefined;

  const [blogs, articles, summary, blogRef] = await Promise.all([
    // `q` filters the blog table only; the article table has its own status and
    // blog filters, so passing the search term to it would silently ignore it
    // while the UI implied otherwise.
    listBlogsWithMeta({ q, page: blogPage }),
    listArticleRows({ blogId: blogFilterId, status, page: articlePage }),
    contentSummary(),
    blogFilterId ? getBlogRef(blogFilterId) : Promise.resolve(null),
  ]);

  /** Filters that apply to both tables, so paging one does not drop the other. */
  const sharedParams: Record<string, string | undefined> = {
    q,
    article_status: status,
    blog: blogFilterId ? String(blogFilterId) : undefined,
  };
  const articleFiltered = Boolean(status || blogFilterId);

  const blogColumns: DataTableColumn<BlogListRow>[] = [
    {
      key: 'title',
      header: 'Blog',
      render: (blog) => (
        <div className="cell-media-body">
          <Link className="cell-media-title" href={`/blogs/${blog.id}`}>
            {blog.title || 'Untitled blog'}
          </Link>
          <div className="cell-media-sub mono">{blog.handle ? `/${blog.handle}` : 'no handle'}</div>
        </div>
      ),
    },
    {
      key: 'articles',
      header: 'Articles',
      render: (blog) =>
        blog.meta.articleCount > 0 ? (
          <Link
            className="num"
            href={qs('/blogs', { q, article_status: status }, { blog: blog.id, article_page: 1 })}
            title={`Filter the article table to ${blog.title || 'this blog'}`}
          >
            {countFormat.format(blog.meta.articleCount)}
          </Link>
        ) : (
          <span className="helper">0</span>
        ),
    },
    {
      key: 'state',
      header: 'State',
      render: (blog) => (
        <StatusBadge
          value={blog.meta.publishedCount > 0 ? 'published' : 'draft'}
          label={liveLabel(blog.meta.publishedCount)}
          dot
        />
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      hideOnMobile: true,
      render: (blog) => {
        const at = blog.meta.lastUpdatedAt ?? blog.updated_at;
        return (
          <span className="nowrap" title={formatTimestamp(at)}>
            {formatRelative(at)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (blog) => (
        <Link
          className="button small"
          href={`/blogs/${blog.id}#new-article`}
          aria-label={`New article in ${blog.title || 'this blog'}`}
        >
          <FilePlus2 size={12} aria-hidden />
          Article
        </Link>
      ),
    },
  ];

  const articleColumns: DataTableColumn<ArticleListItem>[] = [
    {
      key: 'title',
      header: 'Article',
      render: (article) => (
        <div className="cell-media-body">
          <Link className="cell-media-title" href={`/articles/${article.id}`}>
            {article.title || 'Untitled article'}
          </Link>
          <div className="cell-media-sub mono">{articlePath(article.handle) ?? 'no handle'}</div>
        </div>
      ),
    },
    {
      key: 'author',
      header: 'Author',
      hideOnMobile: true,
      render: (article) => article.author || <span className="helper">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (article) => <StatusBadge value={article.published ? 'published' : 'draft'} dot />,
    },
    {
      key: 'published',
      header: 'Published',
      hideOnTablet: true,
      render: (article) =>
        article.published_at ? (
          <span className="nowrap" title={formatTimestamp(article.published_at)}>
            {formatDate(article.published_at)}
          </span>
        ) : (
          <span className="helper">Not published</span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (article) => (
        <Link
          className="button small"
          href={`/articles/${article.id}`}
          aria-label={`Edit ${article.title || 'this article'}`}
        >
          Edit
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        icon={BookOpen}
        title="Content"
        description="Blogs, articles, and publishing."
        actions={
          <Link className="button primary" href="/blogs/new">
            <Plus size={14} aria-hidden />
            New blog
          </Link>
        }
      />

      <div className="stat-grid">
        <StatCard
          label="Published"
          value={countFormat.format(summary.published)}
          icon={CheckCircle2}
          tone="emerald"
          href="/blogs?article_status=published"
          hint="live on the storefront"
        />
        <StatCard
          label="Drafts"
          value={countFormat.format(summary.drafts)}
          icon={FilePen}
          tone="amber"
          href="/blogs?article_status=draft"
          hint="not visible to shoppers"
        />
        <StatCard
          label="Blogs"
          value={countFormat.format(summary.blogs)}
          icon={BookOpen}
          tone="amber"
          hint={`${countFormat.format(summary.articles)} articles total`}
        />
        <StatCard
          label="Last updated"
          value={summary.lastUpdatedAt ? formatRelative(summary.lastUpdatedAt) : '—'}
          icon={CalendarClock}
          tone="slate"
          hint={summary.lastUpdatedAt ? formatDate(summary.lastUpdatedAt) : 'No articles yet'}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Blogs</div>
            <div className="helper">
              {countFormat.format(blogs.count)} {blogs.count === 1 ? 'blog' : 'blogs'} · a blog is
              the container its articles live in.
            </div>
          </div>
        </div>

        <FilterBar>
          {/*
            A plain `name="q"` input, not `SearchInput`: `SearchInput` renders
            its own `<form>` and a form inside the filter form is invalid markup
            (the browser drops the inner one, so the debounce never fires). This
            is the same call the products filter bar documents. Enter and Apply
            both submit, which is what `delayMs={0}` did before.
          */}
          <input
            className="input"
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search blogs by title or handle"
            aria-label="Search blogs"
          />
          <FilterSelect
            name="article_status"
            label="Filter the article table by status"
            value={status ?? 'all'}
            options={ARTICLE_STATUS_OPTIONS}
          />
          {blogFilterId && <input type="hidden" name="blog" value={blogFilterId} />}
        </FilterBar>

        {blogs.rows.length === 0 ? (
          <EmptyState
            tone="amber"
            icon={<BookOpen size={22} aria-hidden />}
            title={q ? 'No blogs match that search' : 'No blogs yet'}
            hint={
              q
                ? 'Search covers blog titles and handles only. Clear it to see every blog.'
                : 'Create a blog to hold a set of articles — its drafts stay off the storefront until you publish them.'
            }
            actionLabel={q ? 'Clear search' : 'New blog'}
            actionHref={q ? '/blogs' : '/blogs/new'}
            secondaryAction={q ? { label: 'New blog', href: '/blogs/new' } : undefined}
          />
        ) : (
          <DataTable
            caption="Blogs"
            columns={blogColumns}
            rows={blogs.rows}
            rowKey={(blog) => blog.id}
            leading={(blog) => (
              <Thumb src={blog.meta.coverUrl} alt="" size="sm" fallbackIcon={BookOpen} />
            )}
            dense
            stickyHeader
          />
        )}

        <Pagination
          basePath="/blogs"
          params={{ ...sharedParams, article_page: articlePage > 1 ? String(articlePage) : undefined }}
          page={blogs.page}
          pageSize={blogs.pageSize}
          total={blogs.count}
          shown={blogs.rows.length}
          label="blogs"
          pageParam="blog_page"
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Articles</div>
            <div className="helper">
              {countFormat.format(articles.count)}{' '}
              {articleFiltered ? 'matching articles' : 'articles'}
              {blogRef ? ` in ${blogRef.title}` : ''}
              {status ? ` · ${status === 'published' ? 'published only' : 'drafts only'}` : ''}
            </div>
          </div>
          {articleFiltered && (
            <Link className="button small" href={qs('/blogs', { q }, {})}>
              <X size={12} aria-hidden />
              Clear article filters
            </Link>
          )}
        </div>

        {articles.rows.length === 0 ? (
          <EmptyState
            tone="amber"
            icon={<FileText size={22} aria-hidden />}
            title={articleFiltered ? 'No articles match these filters' : 'No articles yet'}
            hint={
              articleFiltered
                ? blogFilterId
                  ? 'This blog has no article in that state. Clear the filters to see its whole list.'
                  : 'No article has that publish state yet. Clear the filter to see every article.'
                : 'Open a blog above and add its first draft from the blog page.'
            }
            actionLabel={articleFiltered ? 'Clear article filters' : 'New blog'}
            actionHref={articleFiltered ? qs('/blogs', { q }, {}) : '/blogs/new'}
            secondaryAction={
              articleFiltered && blogFilterId
                ? { label: 'Open the blog', href: `/blogs/${blogFilterId}` }
                : undefined
            }
          />
        ) : (
          <DataTable
            caption="Articles"
            columns={articleColumns}
            rows={articles.rows}
            rowKey={(article) => article.id}
            leading={(article) => (
              <Thumb src={articleImageUrl(article)} alt="" size="sm" fallbackIcon={FileText} />
            )}
            dense
            stickyHeader
          />
        )}

        <Pagination
          basePath="/blogs"
          params={{ ...sharedParams, blog_page: blogPage > 1 ? String(blogPage) : undefined }}
          page={articles.page}
          pageSize={articles.pageSize}
          total={articles.count}
          shown={articles.rows.length}
          label="articles"
          pageParam="article_page"
        />
      </div>
    </>
  );
}
