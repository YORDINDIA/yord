import TableSkeleton from '@/components/data/TableSkeleton';

/** Loading state for the create-blog form: two field sections, no tables. */
export default function NewBlogLoading() {
  return (
    <div className="card" aria-busy="true" aria-live="polite">
      <div className="card-header">
        <div>
          <div className="section-title">New blog</div>
          <div className="helper">Preparing the form…</div>
        </div>
      </div>
      <TableSkeleton variant="form" />
      <span className="sr-only">Loading the blog form…</span>
    </div>
  );
}
