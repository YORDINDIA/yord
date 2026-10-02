import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Inventory loading state: the five-number strip, then the table's shape.
 *
 * A sibling of `(admin)/loading.tsx`, which cannot know the shape of a route
 * below it — this renders the exact strip the page shows (five stat cards, one
 * of them the wide value card) instead of a generic block, so the layout does
 * not jump when the reads land.
 */
export default function InventoryLoading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <div className="stat-grid">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="card">
        <TableSkeleton rows={12} columns={8} />
      </div>
      <span className="sr-only">Loading inventory…</span>
    </div>
  );
}
