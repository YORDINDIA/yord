import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Route-level loading state.
 *
 * The admin had no Suspense boundary anywhere, so navigating between sections
 * left the previous page on screen with dead links until the next response
 * arrived. This renders a skeleton shaped like the list most routes produce.
 */
export default function AdminLoading() {
  return (
    <div className="card" aria-busy="true" aria-live="polite">
      <div className="card-header">
        <div>
          <div className="section-title">Loading…</div>
          <div className="helper">Fetching the latest data.</div>
        </div>
      </div>
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
