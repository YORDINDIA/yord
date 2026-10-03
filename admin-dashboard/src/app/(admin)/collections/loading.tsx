import PageHeader from '@/components/ui/PageHeader';
import TableSkeleton from '@/components/data/TableSkeleton';
import { SECTIONS } from '@/lib/sections';

/**
 * Collections list loading state: the real header (its content is static), then
 * the four-card stat strip and the table's shape, so the layout does not jump
 * when the reads resolve. A sibling of `(admin)/loading.tsx`, which cannot know
 * the shape of a route below it.
 */
export default function CollectionsLoading() {
  return (
    <>
      <PageHeader
        icon={SECTIONS.collections.icon}
        title="Collections"
        description={SECTIONS.collections.description}
      />

      <div className="stat-grid" aria-busy="true" aria-live="polite">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} className="skeleton skeleton-stat" />
        ))}
      </div>

      <div className="card">
        <TableSkeleton rows={8} columns={8} />
      </div>

      <span className="sr-only">Loading collections…</span>
    </>
  );
}
