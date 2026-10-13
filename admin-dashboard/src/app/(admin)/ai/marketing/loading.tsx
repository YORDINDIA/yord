/**
 * AI marketing studio loading state: the brief card, then the plan card.
 *
 * Sibling of `(admin)/loading.tsx`, shaped like the two cards this route
 * renders (a textarea and a text block) rather than a table it never shows.
 */
export default function AiMarketingLoading() {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <div className="page-header" aria-hidden="true">
        <div className="page-header-main">
          <span className="skeleton" style={{ width: 32, height: 32, borderRadius: 10 }} />
          <div>
            <span className="skeleton skeleton-title" style={{ width: 130 }} />
            <span className="skeleton skeleton-line" style={{ width: 300, marginTop: 6 }} />
          </div>
        </div>
      </div>

      <div className="card" aria-hidden="true">
        <div className="card-header">
          <span className="skeleton skeleton-title" style={{ width: 80 }} />
        </div>
        <div className="form-section">
          <span className="skeleton skeleton-title" />
          <span className="skeleton" style={{ height: 96, borderRadius: 10, marginTop: 8 }} />
        </div>
        <div className="row">
          <span className="skeleton" style={{ height: 24, width: 110, borderRadius: 8 }} />
          <span className="skeleton" style={{ height: 24, width: 90, borderRadius: 8 }} />
          <span className="skeleton" style={{ height: 24, width: 120, borderRadius: 8 }} />
        </div>
      </div>

      <div className="card" aria-hidden="true">
        <div className="card-header">
          <span className="skeleton skeleton-title" style={{ width: 140 }} />
        </div>
        <span className="skeleton" style={{ height: 180, borderRadius: 10 }} />
      </div>

      <span className="sr-only">Loading the AI marketing studio…</span>
    </div>
  );
}
