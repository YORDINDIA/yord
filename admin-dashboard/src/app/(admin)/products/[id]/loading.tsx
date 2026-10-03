import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Product detail loading state: the editor column plus the side rail, so the
 * split layout does not jump when the read lands.
 */
export default function ProductDetailLoading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      {/* PageHeader placeholder: the real header (icon tile, title, id line,
          status pill, back button) renders above the split. */}
      <div className="page-header" aria-hidden="true">
        <div className="page-header-main">
          <span className="skeleton" style={{ width: 32, height: 32, borderRadius: 10 }} />
          <div>
            <span className="skeleton skeleton-title" style={{ width: 180 }} />
            <span className="skeleton skeleton-line" style={{ width: 240, marginTop: 6 }} />
          </div>
        </div>
        <div className="page-actions">
          <span className="skeleton" style={{ width: 92, height: 28, borderRadius: 8 }} />
          <span className="skeleton" style={{ width: 132, height: 28, borderRadius: 8 }} />
        </div>
      </div>
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
