import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Loading state for the article editor.
 *
 * Mirrors the two-pane layout (form sections on the left, the preview rail on
 * the right) so the editor does not jump when the article lands.
 */
export default function ArticleDetailLoading() {
  return (
    <div className="layout-split" aria-busy="true" aria-live="polite">
      <div className="stack">
        <TableSkeleton variant="form" />
      </div>
      <aside className="side-rail">
        <div className="card">
          <div className="stack-sm">
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-card" />
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line" />
          </div>
        </div>
      </aside>
      <span className="sr-only">Loading the article editor…</span>
    </div>
  );
}
