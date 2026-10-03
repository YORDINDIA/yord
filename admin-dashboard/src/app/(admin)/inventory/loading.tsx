import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Inventory loading state — deliberately neutral.
 *
 * This boundary also covers `?tab=locations`, which renders a different view
 * (a locations table, no stat strip), and a route-level fallback cannot read
 * `?tab=`. So both views get the shape they share — a page header above one
 * table card — instead of a stock-specific skeleton that would misrepresent
 * the locations view; whichever view lands adds only its own extras.
 */
export default function InventoryLoading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <div className="page-header" aria-hidden="true">
        <div className="page-header-main">
          <span className="skeleton" style={{ width: 32, height: 32, borderRadius: 10 }} />
          <div>
            <span className="skeleton skeleton-title" style={{ width: 150 }} />
            <span className="skeleton skeleton-line" style={{ width: 220, marginTop: 6 }} />
          </div>
        </div>
        <div className="page-actions">
          <span className="skeleton" style={{ width: 120, height: 28, borderRadius: 8 }} />
        </div>
      </div>
      <div className="card">
        <TableSkeleton rows={12} columns={6} />
      </div>
      <span className="sr-only">Loading inventory…</span>
    </div>
  );
}
