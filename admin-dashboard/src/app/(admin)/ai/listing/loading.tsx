/**
 * AI listing studio loading state.
 *
 * Renders the two steps the page actually shows — the picker card and the
 * review card — rather than the generic list skeleton from `(admin)/loading.tsx`,
 * which would draw a table that never appears here.
 */
export default function AiListingLoading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <div className="page-header" aria-hidden="true">
        <div className="page-header-main">
          <span className="skeleton" style={{ width: 32, height: 32, borderRadius: 10 }} />
          <div>
            <span className="skeleton skeleton-title" style={{ width: 140 }} />
            <span className="skeleton skeleton-line" style={{ width: 320, marginTop: 6 }} />
          </div>
        </div>
      </div>

      <div className="card" aria-hidden="true">
        <div className="card-header">
          <span className="skeleton skeleton-title" style={{ width: 130 }} />
        </div>
        <span className="skeleton" style={{ height: 30, borderRadius: 8 }} />
        <div className="row" style={{ marginTop: 10 }}>
          <span className="skeleton" style={{ height: 28, width: 170, borderRadius: 8 }} />
          <span className="skeleton" style={{ height: 28, width: 120, borderRadius: 8 }} />
        </div>
      </div>

      <div className="card" aria-hidden="true">
        <div className="card-header">
          <span className="skeleton skeleton-title" style={{ width: 160 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="skeleton skeleton-line" style={{ width: '40%' }} />
          <span className="skeleton skeleton-line" style={{ width: '85%' }} />
          <span className="skeleton skeleton-line" style={{ width: '72%' }} />
          <span className="skeleton" style={{ height: 180, borderRadius: 10, marginTop: 4 }} />
        </div>
      </div>

      <span className="sr-only">Loading the AI listing studio…</span>
    </div>
  );
}
