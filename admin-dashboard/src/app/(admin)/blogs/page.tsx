import Link from 'next/link';
import type { Metadata } from 'next';
import { Newspaper } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import { SearchInput } from '@/components/data/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import { listArticles, listBlogs } from '@/lib/data/blogs';
import { firstParam, pageCount } from '@/lib/pagination';
import { formatDate } from '@/lib/utils/format';
import type { Article, Blog } from '@yord/db-types';

export const metadata: Metadata = { title: 'Blogs · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

/**
 * Blog index.
 *
 * Two problems: the blog list was unbounded (every blog on one page, no pager),
 * and the article list was `.limit(10)` with no pager, so every article past the
 * tenth was unreachable from this page. Both are paged now, and both tables go
 * through `DataTable` so they scroll instead of overflowing on a phone.
 */
export default async function BlogsPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const resolved = searchParams ? await searchParams : {};
  // Two paginated tables on one route, so they need two page params. Both
  // previously read a single `page` key, and the blog table was hardcoded to
  // page 1 with no pager at all — so a 26th blog was unreachable from this page
  // no matter what the admin did.
  const blogPage = Number(firstParam(resolved?.blog_page)) || 1;
  const articlePage = Number(firstParam(resolved?.article_page)) || 1;
  const params: Record<string, string | undefined> = {
    q: firstParam(resolved?.q)?.trim() || undefined,
  };

  const [blogs, articles] = await Promise.all([
    // `q` filters the blog list only; the articles query has no search term, so
    // passing one would be silently ignored while the UI implied otherwise.
    listBlogs({ q: params.q, page: blogPage }),
    listArticles({ page: articlePage }),
  ]);

  const blogColumns: DataTableColumn<Blog>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (blog) => <Link href={`/blogs/${blog.id}`}>{blog.title}</Link>,
    },
    { key: 'handle', header: 'Handle', render: (blog) => blog.handle || '—', hideOnMobile: true },
    {
      key: 'updated',
      header: 'Updated',
      render: (blog) => formatDate(blog.updated_at),
      hideOnTablet: true,
    },
  ];

  const articleColumns: DataTableColumn<Article>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (article) => <Link href={`/articles/${article.id}`}>{article.title}</Link>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (article) => <StatusBadge value={article.published ? 'published' : 'draft'} />,
    },
    {
      key: 'published',
      header: 'Published',
      render: (article) => formatDate(article.published_at),
      hideOnMobile: true,
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Blogs</div>
            <div className="helper">{blogs.count} blog(s) · manage containers and tags.</div>
          </div>
          <div className="toolbar">
            <SearchInput
              placeholder="Search blogs"
              delayMs={0}
            />
            <Link className="button primary" href="/blogs/new">
              New Blog
            </Link>
          </div>
        </div>
        <DataTable
          caption="Blogs"
          columns={blogColumns}
          rows={blogs.rows}
          rowKey={(blog) => blog.id}
          emptyTitle="No blogs yet"
          emptyHint="Create a blog to hold articles."
          emptyIcon={<Newspaper size={28} />}
        />
        <Pagination
          basePath="/blogs"
          params={{ q: params.q, article_page: articlePage > 1 ? String(articlePage) : undefined }}
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
              {articles.count} article(s) · page {articles.page} of{' '}
              {pageCount(articles.count, articles.pageSize)}
            </div>
          </div>
        </div>
        <DataTable
          caption="Articles"
          columns={articleColumns}
          rows={articles.rows}
          rowKey={(article) => article.id}
          emptyTitle="No articles yet"
          emptyHint="Add a draft from a blog's detail page."
          emptyIcon={<Newspaper size={28} />}
        />
        <Pagination
          basePath="/blogs"
          params={{ q: params.q, blog_page: blogPage > 1 ? String(blogPage) : undefined }}
          page={articles.page}
          pageSize={articles.pageSize}
          total={articles.count}
          shown={articles.rows.length}
          label="articles"
          pageParam="article_page"
        />
      </div>
    </div>
  );
}
