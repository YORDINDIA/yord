import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Route-level loading state.
 *
 * The admin had no Suspense boundary anywhere, so navigating between sections
 * left the previous page on screen with dead links until the next response
 * arrived. This renders a skeleton shaped like the list most routes produce —
 * page header, stat row, table — inside the shell's own `.content` stack, so
 * the gaps come from the shell and the fallback does not have to guess them.
 *
 * Only the status text is real content; everything else is `aria-hidden`, so a
 * screen reader gets "Loading…" instead of a tour of empty boxes.
 */
export default function AdminLoading() {
  return (
    // `stack` re-applies the `.content` gaps inside this wrapper —
    // without it the header, stat row, and card sit flush together.
    <div className="stack" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      {/* Page header: 32px icon tile, title, description, and action pills. */}
      <div className="page-header" aria-hidden="true">
        <div className="page-header-main">
          <span className="skeleton" style={{ width: 32, height: 32, borderRadius: 10 }} />
          <div>
            <span className="skeleton skeleton-title" style={{ width: 150 }} />
            <span className="skeleton skeleton-line" style={{ width: 250, marginTop: 6 }} />
          </div>
        </div>
        <div className="page-actions">
          <span className="skeleton" style={{ width: 88, height: 28, borderRadius: 8 }} />
          <span className="skeleton" style={{ width: 88, height: 28, borderRadius: 8 }} />
        </div>
      </div>

      {/* Stat row (the `stats` shape of TableSkeleton, minus its chart block:
          most routes here are lists, not dashboards). */}
      <div className="stat-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} className="skeleton skeleton-stat" />
        ))}
      </div>

      <div className="card" aria-hidden="true">
        <div className="card-header">
          <span className="skeleton skeleton-title" style={{ width: 120 }} />
        </div>
        <TableSkeleton rows={6} columns={5} />
      </div>
    </div>
  );
}
