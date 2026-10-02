import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Loading state for the customer detail.
 *
 * Same shape as the page: stat strip, then the main column / side rail split,
 * so the cards do not reflow once the customer arrives.
 */
export default function CustomerDetailLoading() {
  return (
    <>
      <div className="stat-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="layout-split" aria-busy="true" aria-live="polite">
        <div className="stack">
          <div className="card">
            <div className="stack-sm">
              <span className="skeleton skeleton-title" />
              <TableSkeleton rows={4} columns={4} />
            </div>
          </div>
          <div className="card">
            <div className="stack-sm">
              <span className="skeleton skeleton-title" />
              <span className="skeleton skeleton-card" />
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
      </div>
    </>
  );
}
