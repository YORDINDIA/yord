/**
 * AI Studio hub loading state.
 *
 * Sibling of `(admin)/loading.tsx`, matching this route's own shape: three
 * capability cards, then the connection and "how it works" pair.
 */
export default function AiLoading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <div className="page-header" aria-hidden="true">
        <div className="page-header-main">
          <span className="skeleton" style={{ width: 32, height: 32, borderRadius: 10 }} />
          <div>
            <span className="skeleton skeleton-title" style={{ width: 120 }} />
            <span className="skeleton skeleton-line" style={{ width: 260, marginTop: 6 }} />
          </div>
        </div>
      </div>

      <div className="grid-3" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="card">
            <div className="row">
              <span className="skeleton" style={{ width: 34, height: 34, borderRadius: 10 }} />
              <div>
                <span className="skeleton skeleton-line" style={{ width: 110 }} />
                <span className="skeleton skeleton-line" style={{ width: 160, marginTop: 6 }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
              <span className="skeleton skeleton-line" style={{ width: '70%' }} />
              <span className="skeleton skeleton-line" style={{ width: '55%' }} />
              <span className="skeleton skeleton-line" style={{ width: '62%' }} />
            </div>
            <span
              className="skeleton"
              style={{ height: 28, width: 110, borderRadius: 8, marginTop: 12 }}
            />
          </div>
        ))}
      </div>

      <div className="grid-2" aria-hidden="true">
        <div className="card">
          <span className="skeleton skeleton-title" style={{ width: 150 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            <span className="skeleton skeleton-line" style={{ width: '80%' }} />
            <span className="skeleton skeleton-line" style={{ width: '55%' }} />
            <span className="skeleton skeleton-line" style={{ width: '65%' }} />
          </div>
        </div>
        <div className="card">
          <span className="skeleton skeleton-title" style={{ width: 120 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            <span className="skeleton skeleton-line" style={{ width: '90%' }} />
            <span className="skeleton skeleton-line" style={{ width: '84%' }} />
            <span className="skeleton skeleton-line" style={{ width: '76%' }} />
          </div>
        </div>
      </div>

      <span className="sr-only">Loading AI Studio…</span>
    </div>
  );
}
