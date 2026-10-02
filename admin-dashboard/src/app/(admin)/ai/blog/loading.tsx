/**
 * AI blog studio loading state: the brief card, then the draft card.
 *
 * Sibling of `(admin)/loading.tsx`, which cannot know that this route has no
 * table — a generic table skeleton would promise rows that never render.
 */
export default function AiBlogLoading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <div className="page-header" aria-hidden="true">
        <div className="page-header-main">
          <span className="skeleton" style={{ width: 32, height: 32, borderRadius: 10 }} />
          <div>
            <span className="skeleton skeleton-title" style={{ width: 120 }} />
            <span className="skeleton skeleton-line" style={{ width: 300, marginTop: 6 }} />
          </div>
        </div>
      </div>

      <div className="card" aria-hidden="true">
        <div className="card-header">
          <span className="skeleton skeleton-title" style={{ width: 150 }} />
        </div>
        <div className="form-section">
          <span className="skeleton skeleton-title" />
          <div className="form-grid" style={{ marginTop: 8 }}>
            <span className="skeleton" style={{ height: 30, borderRadius: 8 }} />
            <span className="skeleton" style={{ height: 30, borderRadius: 8 }} />
          </div>
        </div>
        <div className="form-actions">
          <span className="skeleton" style={{ height: 28, width: 140, borderRadius: 8 }} />
        </div>
      </div>

      <div className="card" aria-hidden="true">
        <div className="card-header">
          <span className="skeleton skeleton-title" style={{ width: 90 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="skeleton skeleton-line" style={{ width: '45%' }} />
          <span className="skeleton skeleton-line" style={{ width: '90%' }} />
          <span className="skeleton skeleton-line" style={{ width: '78%' }} />
          <span className="skeleton skeleton-line" style={{ width: '84%' }} />
        </div>
      </div>

      <span className="sr-only">Loading the AI blog studio…</span>
    </div>
  );
}
