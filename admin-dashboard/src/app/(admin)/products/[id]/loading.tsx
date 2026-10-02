import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Product detail loading state: the editor column plus the side rail, so the
 * split layout does not jump when the read lands.
 */
export default function ProductDetailLoading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <div className="layout-split">
        <div className="stack">
          <div className="card">
            <TableSkeleton variant="form" />
          </div>
          <div className="card">
            <TableSkeleton rows={4} columns={4} />
          </div>
          <div className="card">
            <TableSkeleton variant="cards" rows={4} />
          </div>
        </div>
        <div className="side-rail">
          <div className="card">
            <span className="skeleton skeleton-chart" />
          </div>
          <div className="card">
            <span className="skeleton skeleton-stat" />
          </div>
          <div className="card">
            <span className="skeleton skeleton-stat" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading product…</span>
    </div>
  );
}
