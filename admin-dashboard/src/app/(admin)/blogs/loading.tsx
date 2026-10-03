import Link from 'next/link';
import { BookOpen, Plus } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Loading state for the Content index.
 *
 * Mirrors the real page's shape — page header, stat strip, then the two table
 * cards — so the layout does not jump when the data lands. The header is the
 * real component: its only action is a plain link, safe to render while
 * loading.
 */
export default function BlogsLoading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
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
      <div className="stat-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Blogs</div>
            <div className="helper">Fetching blogs, articles, and publish states…</div>
          </div>
        </div>
        <TableSkeleton rows={5} columns={5} />
      </div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Articles</div>
            <div className="helper">Fetching the article list…</div>
          </div>
        </div>
        <TableSkeleton rows={6} columns={5} />
      </div>
      <span className="sr-only">Loading content…</span>
    </div>
  );
}
