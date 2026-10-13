/**
 * Loading placeholder for list/detail routes.
 *
 * Renders *structure* rather than a spinner, so a slow query shows the shape of
 * what is coming instead of a blank card. Callers provide the surrounding card
 * (the admin route `loading.tsx` does).
 *
 * `variant` picks that shape: `table` (default, `rows` × `columns`),
 * `stats` (four stat cards + a chart block), `cards` (a `rows`-item grid), or
 * `form` (two `.form-section` blocks of field lines).
 */
export default function TableSkeleton({
  rows = 8,
  columns = 5,
  variant = 'table',
}: {
  rows?: number;
  columns?: number;
  variant?: 'table' | 'stats' | 'cards' | 'form';
}) {
  if (variant === 'stats') {
    return (
      <div className="stack">
        <div className="stat-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} className="skeleton skeleton-stat" />
          ))}
        </div>
        <span className="skeleton skeleton-chart" />
        <span className="sr-only">Loading data…</span>
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className="media-grid">
        {Array.from({ length: rows }, (_, index) => (
          <span key={index} className="skeleton skeleton-card" />
        ))}
        <span className="sr-only">Loading data…</span>
      </div>
    );
  }

  if (variant === 'form') {
    return (
      <div className="stack">
        {Array.from({ length: 2 }, (_, sectionIndex) => (
          <div key={sectionIndex} className="form-section">
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line" />
          </div>
        ))}
        <span className="sr-only">Loading data…</span>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Loading…</caption>
        <thead>
          <tr>
            {Array.from({ length: columns }, (_, index) => (
              <th key={index} scope="col">
                <span className="skeleton skeleton-cell" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }, (_, colIndex) => (
                <td key={colIndex}>
                  <span className="skeleton skeleton-cell" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <span className="sr-only">Loading data…</span>
    </div>
  );
}
