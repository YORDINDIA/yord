import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Loading state for the customer list.
 *
 * Mirrors the real page's shape (stat strip, then one card holding the filter
 * bar and the table) so the layout does not jump when the data lands. Shaped
 * blocks rather than a spinner.
 */
export default function CustomersLoading() {
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
            <div className="section-title">Customers</div>
            <div className="helper">Fetching buyers, spend, and last order dates…</div>
          </div>
        </div>
        <TableSkeleton rows={8} columns={6} />
      </div>
    </>
  );
}
