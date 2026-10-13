export interface ChartLegendItem {
  label: string;
  /** Any CSS colour — usually a value out of `useChartTheme().palette`. */
  color: string;
  /** Pre-formatted; the legend does not know whether this is money or a count. */
  value?: string;
}

/**
 * The legend strip. Server-safe (no hooks): pages that render a chart card with
 * server-known series render the legend themselves and pass it to `ChartCard`.
 *
 * A `<div>` rather than a `<ul>` on purpose — `.chart-legend` is `display: flex`,
 * which drops list semantics in several screen readers, so the markup does not
 * pretend to be a list it cannot be.
 */
export default function ChartLegend({ items }: { items: ChartLegendItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="chart-legend">
      {items.map((item, index) => (
        <span className="legend-item" key={`${item.label}-${index}`}>
          <span className="legend-dot" style={{ background: item.color }} aria-hidden="true" />
          <span>{item.label}</span>
          {item.value ? <span className="num">{item.value}</span> : null}
        </span>
      ))}
    </div>
  );
}
