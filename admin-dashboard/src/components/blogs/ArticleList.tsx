import Link from 'next/link';
import { FileText, Pencil, PenLine } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import Thumb from '@/components/ui/Thumb';
import { formatDate } from '@/lib/utils/format';
import { articleImageUrl, articlePath, formatRelative, formatTimestamp } from './display';
import type { ArticleListItem } from '@/lib/data/blogs';

/**
 * Article list for one blog.
 *
 * Shape only: the rows come from `getBlog`, the writes go through
 * `updateArticleAction`. There is no way to publish or delete from a row —
 * every article column the action requires (title, handle, author, tags, both
 * HTML bodies) would have to ride along in hidden inputs to submit the row, and
 * the admin has no delete action at all. Rows link to the editor, which owns
 * all three.
 */
export default function ArticleList({
  articles,
  blogId,
}: {
  articles: ArticleListItem[];
  blogId: number;
}) {
  if (articles.length === 0) {
    return (
      <EmptyState
        icon={<PenLine size={22} aria-hidden />}
        title="No articles in this blog yet"
        hint="Drafts start unpublished, so they stay off the storefront until you publish one."
        actionLabel="Write the first draft"
        actionHref={`/blogs/${blogId}#new-article`}
      />
    );
  }

  const columns: DataTableColumn<ArticleListItem>[] = [
    {
      key: 'title',
      header: 'Article',
      render: (article) => (
        <div className="cell-media-body">
          <Link className="cell-media-title" href={`/articles/${article.id}`}>
            {article.title || 'Untitled'}
          </Link>
          <div className="cell-media-sub mono">
            {articlePath(article.handle) ?? 'no handle yet'}
          </div>
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
      key: 'updated',
      header: 'Updated',
      hideOnMobile: true,
      render: (article) => (
        <span className="nowrap" title={formatTimestamp(article.updated_at)}>
          {formatRelative(article.updated_at)}
        </span>
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
          aria-label={`Edit ${article.title || 'untitled article'}`}
        >
          <Pencil size={12} aria-hidden />
          Edit
        </Link>
      ),
    },
  ];

  return (
    <DataTable
      caption="Articles in this blog"
      columns={columns}
      rows={articles}
      rowKey={(article) => article.id}
      leading={(article) => (
        <Thumb src={articleImageUrl(article)} alt="" size="sm" fallbackIcon={FileText} />
      )}
      dense
      stickyHeader
    />
  );
}
