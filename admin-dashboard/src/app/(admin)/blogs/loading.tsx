import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Loading state for the Content index.
 *
 * Mirrors the real page's shape — stat strip, then the two table cards — so the
 * layout does not jump when the data lands.
 */
export default function BlogsLoading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
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
