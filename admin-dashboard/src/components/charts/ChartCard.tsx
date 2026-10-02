import clsx from 'clsx';
import type { ReactNode } from 'react';
import GlowCard from '@/components/reactbits/GlowCard';

export interface ChartCardProps {
  className?: string;
  /**
   * Wrap the card in the cursor-tracked accent wash
   * (`GlowCard`). Reserved for the one chart the page is
   * about; every other chart keeps the plain card.
   */
  glow?: boolean;
  title: string;
  /** One-line explainer under the title. */
  description?: string;
  /** Right-aligned slot in the header: a range switch, a link, a menu. */
  action?: ReactNode;
  /** Below the plot: usually `<ChartLegend />`. */
  legend?: ReactNode;
  /** Reserves the plot's height before the chart measures, so the card cannot jump. */
  height?: number;
  children: ReactNode;
  /** Small print under the plot: totals, a footnote, a "last updated". */
  footer?: ReactNode;
}

/**
 * Chart card shell, plus the two pieces of chrome every chart in this folder
 * shares: `ChartEmpty` (the no-data state) and `ChartDataTable` (the `sr-only`
 * table that gives assistive tech the underlying values).
 *
 * No hooks and no `"use client"`: pages are server components, and this file is
 * imported by both the server page (the card) and the client chart (the table).
 *
 * With `glow`, the surface becomes a `GlowCard` client island: the content
 * stays server-rendered, only the pointer wash is interactive.
 */
export function ChartCard({
  className,
  glow,
  title,
  description,
  action,
  legend,
  height,
  children,
  footer,
}: ChartCardProps) {
  const body = (
    <>
      <div className="card-header">
        <div className="stack-sm">
          <h3 className="section-title chart-title">
            <span className="chart-title-tick" aria-hidden="true" />
            {title}
          </h3>
          {description ? <p className="helper">{description}</p> : null}
        </div>
        {action ? <div className="row">{action}</div> : null}
      </div>

      <div style={height === undefined ? undefined : { minHeight: height }}>{children}</div>

      {legend ? <div style={{ marginTop: 8 }}>{legend}</div> : null}
      {footer ? (
        <div className="helper" style={{ marginTop: 8 }}>
          {footer}
        </div>
      ) : null}
    </>
  );

  const cls = clsx('card', className);

  if (glow) {
    // A client island around server-rendered content: the wash
    // tracks the pointer, the chart does not re-render.
    return <GlowCard className={cls}>{body}</GlowCard>;
  }

  return <section className={cls}>{body}</section>;
}

/**
 * No-data state. Deliberately not `EmptyState`: that one is built for a whole
 * table page (42px icon, 30px padding), and a chart inside an analytics grid
 * needs the quiet version.
 */
export function ChartEmpty({ message = 'No data for this range.' }: { message?: string }) {
  return (
    <div className="empty-state" style={{ padding: '18px 12px' }}>
      <p className="empty-hint">{message}</p>
    </div>
  );
}

export interface ChartDataTableRow {
  label: string;
  value: string;
}

/**
 * The accessible version of a plot: a real table, visually hidden, label →
 * value. A `role="img"` + `aria-label` alone tells a screen reader that a chart
 * exists but not what it says, so every chart renders one of these next to it.
 */
export function ChartDataTable({
  caption,
  rows,
  valueHeading = 'Value',
}: {
  caption: string;
  rows: ChartDataTableRow[];
  valueHeading?: string;
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Label</th>
          <th scope="col">{valueHeading}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.label}-${index}`}>
            <th scope="row">{row.label}</th>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ChartCard;
