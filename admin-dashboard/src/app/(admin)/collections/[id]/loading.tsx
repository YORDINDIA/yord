import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Collection detail loading state: the page-header block, the editor and rules
 * cards in the main column, and the three rail cards, so the split layout does
 * not jump when the read lands.
 */
export default function CollectionDetailLoading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <div className="stack-sm">
        <span className="skeleton skeleton-title" style={{ width: '35%' }} />
        <span className="skeleton skeleton-line" style={{ width: '55%' }} />
      </div>
      <div className="layout-split">
        <div className="stack">
          <div className="card">
            <div className="stack-sm">
              <span className="skeleton skeleton-title" />
              <TableSkeleton variant="form" />
            </div>
          </div>
          <div className="card">
            <div className="stack-sm">
              <span className="skeleton skeleton-title" />
              <span className="skeleton skeleton-block" style={{ height: 96 }} />
            </div>
          </div>
        </div>
        <aside className="side-rail">
          <div className="card">
            <span className="skeleton skeleton-chart" />
          </div>
          <div className="card">
            <div className="stack-sm">
              <span className="skeleton skeleton-title" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line" />
            </div>
          </div>
          <div className="card">
            <span className="skeleton skeleton-stat" />
          </div>
        </aside>
      </div>
      <span className="sr-only">Loading collection…</span>
    </div>
  );
}
