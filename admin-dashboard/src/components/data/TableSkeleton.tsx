/**
 * Loading placeholder for list/detail routes.
 *
 * Renders table *structure* rather than a spinner, so a slow query shows the
 * shape of what is coming instead of a blank card. Callers provide the
 * surrounding card (the admin route `loading.tsx` does).
 */
export default function TableSkeleton({
  rows = 8,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
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
