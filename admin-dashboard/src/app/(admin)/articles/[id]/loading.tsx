import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Loading state for the article editor.
 *
 * Mirrors the two-pane layout at the editor's real height — field cards on
 * the left (title/meta, the tall Body HTML textarea, excerpt and save row)
 * and the preview + cover rail cards on the right — so the editor does not
 * jump when the article lands.
 */
export default function ArticleDetailLoading() {
  return (
    <div className="layout-split" aria-busy="true" aria-live="polite">
      <div className="stack">
        <div className="card">
          <TableSkeleton variant="form" />
        </div>
        {/* Body HTML: the editor's tall textarea (18 rows) dominates the
            column; without this block the page grows by its whole height
            when the article lands. */}
        <div className="card">
          <div className="stack-sm">
            <span className="skeleton skeleton-line" style={{ width: '18%' }} />
            <span className="skeleton" style={{ height: 380, borderRadius: 8 }} />
            <span className="skeleton skeleton-line" style={{ width: '40%' }} />
          </div>
        </div>
        {/* Excerpt field + remaining form sections and the save row. */}
        <div className="card">
          <div className="stack-sm">
            <span className="skeleton skeleton-line" style={{ width: '24%' }} />
            <span className="skeleton" style={{ height: 88, borderRadius: 8 }} />
            <span className="skeleton skeleton-line" style={{ width: '55%' }} />
          </div>
        </div>
        <div className="card">
          <div className="stack-sm">
            <span className="skeleton skeleton-line" style={{ width: '30%' }} />
            <span className="skeleton" style={{ width: 150, height: 34, borderRadius: 8 }} />
          </div>
        </div>
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
        {/* Cover — the rail's second card. */}
        <div className="card">
          <div className="stack-sm">
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-card" />
            <span className="skeleton" style={{ width: 130, height: 32, borderRadius: 8 }} />
          </div>
        </div>
      </aside>
      <span className="sr-only">Loading the article editor…</span>
    </div>
  );
}
