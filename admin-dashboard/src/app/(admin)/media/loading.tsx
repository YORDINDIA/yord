import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Loading state for the media library.
 *
 * Mirrors the real page's shape — stat strip, then one card whose filter bar
 * and tile grid land underneath — so the layout does not jump. Shaped blocks
 * rather than a spinner.
 */
export default function MediaLoading() {
  return (
    <>
      <div className="stat-grid" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="card" aria-busy="true" aria-live="polite">
        <div className="card-header">
          <div>
            <div className="section-title">Library</div>
            <div className="helper">Fetching assets, owners, and upload history…</div>
          </div>
        </div>
        <TableSkeleton variant="cards" rows={30} />
      </div>
    </>
  );
}
