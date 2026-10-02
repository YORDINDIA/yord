import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Loading state for `/settings`.
 *
 * Mirrors the page's shape — the stat strip first, then one card of dense rows
 * — so the layout does not jump when the reads land. Shaped blocks rather than a
 * spinner, and no tab-specific markup: this route serves both surfaces, so it
 * shows the block they share.
 */
export default function SettingsLoading() {
  return (
    <>
      <div className="stat-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="card" aria-busy="true" aria-live="polite">
        <div className="card-header">
          <div>
            <div className="section-title">Loading…</div>
            <div className="helper">
              Fetching administrators, their identities, and the audit trail.
            </div>
          </div>
        </div>
        <TableSkeleton rows={6} columns={5} />
      </div>
    </>
  );
}
