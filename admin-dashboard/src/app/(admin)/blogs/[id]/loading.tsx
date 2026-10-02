import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Loading state for the blog detail.
 *
 * Same shape as the page: the editor card and the article table in the main
 * column, three rail cards beside them, so nothing reflows when the blog lands.
 */
export default function BlogDetailLoading() {
  return (
    <div className="layout-split" aria-busy="true" aria-live="polite">
      <div className="stack">
        <div className="card">
          <div className="stack-sm">
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line" />
          </div>
        </div>
        <div className="card">
          <div className="stack-sm">
            <span className="skeleton skeleton-title" />
            <TableSkeleton rows={5} columns={5} />
          </div>
        </div>
      </div>
      <aside className="side-rail">
        <div className="card">
          <div className="stack-sm">
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line" />
          </div>
        </div>
      </aside>
      <span className="sr-only">Loading the blog…</span>
    </div>
  );
}
