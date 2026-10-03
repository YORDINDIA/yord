import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Loading state for the customer detail.
 *
 * Same shape as the page: page header, the avatar identity row, the stat
 * strip, then the main column (order history, addresses, notes & tags) and
 * the rail (profile, activity) — so the cards do not reflow once the
 * customer arrives.
 */
export default function CustomerDetailLoading() {
  return (
    <>
      {/* PageHeader + the identity row that sits under it. */}
      <div className="page-header" aria-hidden="true">
        <div className="page-header-main">
          <span className="skeleton" style={{ width: 32, height: 32, borderRadius: 10 }} />
          <div>
            <span className="skeleton skeleton-title" style={{ width: 170 }} />
            <span className="skeleton skeleton-line" style={{ width: 210, marginTop: 6 }} />
          </div>
        </div>
        <div className="page-actions">
          <span className="skeleton" style={{ width: 130, height: 28, borderRadius: 8 }} />
        </div>
      </div>
      <div className="row" style={{ gap: 10 }} aria-hidden="true">
        <span className="skeleton skeleton-block" style={{ width: 48, height: 48, borderRadius: 999 }} />
        <div className="stack-sm" style={{ gap: 4 }}>
          <span className="skeleton skeleton-line" style={{ width: 120 }} />
          <span className="skeleton skeleton-line" style={{ width: 180 }} />
        </div>
      </div>

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
          {/* Notes & tags — the main column's last card. */}
          <div className="card">
            <div className="stack-sm">
              <span className="skeleton skeleton-title" />
              <span className="skeleton" style={{ height: 88, borderRadius: 8 }} />
              <span className="skeleton skeleton-line" style={{ width: '60%' }} />
              <span className="skeleton" style={{ width: 110, height: 32, borderRadius: 8 }} />
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
          {/* Activity — the rail's second card. */}
          <div className="card">
            <div className="stack-sm">
              <span className="skeleton skeleton-title" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line" style={{ width: '70%' }} />
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
