import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Products list loading state: the stat strip, then the table's shape.
 *
 * A sibling of `(admin)/loading.tsx`, which cannot know the shape of a route
 * below it — this renders the five stat cards the page actually shows instead
 * of a generic chart block.
 */
export default function ProductsLoading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <div className="stat-grid">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="card">
        <TableSkeleton rows={8} columns={6} />
      </div>
      <span className="sr-only">Loading products…</span>
    </div>
  );
}
