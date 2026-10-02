"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipPayload } from "recharts";
import { compactNumber } from "@/lib/chart-format";
import { ChartDataTable, ChartEmpty } from "./ChartCard";
import ChartLegend from "./ChartLegend";
import { useChartTheme } from "./chart-theme";
import styles from "./charts.module.css";

export interface DonutSlice {
  label: string;
  value: number;
  /** Palette index. Without it, slices cycle the ramp in data order. */
  tone?: number;
}

export interface DonutProps {
  data: DonutSlice[];
  height?: number;
  /** Small caps line under `centerValue`, e.g. "Total". */
  centerLabel?: string;
  /** Pre-formatted headline number, e.g. `₹1.2L`. */
  centerValue?: string;
  valueFormat?: (value: number) => string;
  ariaLabel: string;
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shareOf(value: number, total: number): string {
  if (total <= 0) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function DonutTooltip({
  active,
  payload,
  format,
  total,
}: {
  active?: boolean;
  payload?: TooltipPayload;
  format: (value: number) => string;
  total: number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const slice = payload[0].payload as DonutSlice | undefined;
  const value = toNumber(payload[0].value);

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{slice?.label ?? String(payload[0].name ?? "")}</div>
      <div className="chart-tooltip-row">
        <span>Value</span>
        <strong>{format(value)}</strong>
      </div>
      <div className="chart-tooltip-row">
        <span>Share</span>
        <strong>{shareOf(value, total)}</strong>
      </div>
    </div>
  );
}

/**
 * Composition donut: share of a whole, so every slice carries its value in the
 * legend rather than only on hover, and the hidden table repeats value + share.
 *
 * A zero total renders the empty state: every slice would have length zero, so
 * an "empty ring" would look like a loading bug.
 */
export default function Donut({
  data,
  height = 200,
  centerLabel,
  centerValue,
  valueFormat,
  ariaLabel,
}: DonutProps) {
  const theme = useChartTheme();
  const format = valueFormat ?? compactNumber;

  const total = data.reduce((sum, slice) => sum + (Number.isFinite(slice.value) ? slice.value : 0), 0);
  if (data.length === 0 || total <= 0) return <ChartEmpty message="Nothing to break down yet." />;

  const colorFor = (slice: DonutSlice, index: number) =>
    theme.palette[slice.tone ?? index % theme.palette.length] ?? theme.palette[0];

  const legendItems = data.map((slice, index) => ({
    label: slice.label,
    color: colorFor(slice, index),
    value: format(slice.value),
  }));
  const hasCenter = Boolean(centerValue || centerLabel);

  return (
    <>
      <div className="chart-wrap" style={{ height }} role="img" aria-label={ariaLabel}>
        <div aria-hidden="true" style={{ position: "relative", width: "100%", height: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            {/* Decorative: the legend and the data table below carry the values. */}
            <PieChart accessibilityLayer={false}>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="62%"
                outerRadius="88%"
                paddingAngle={2}
                stroke="none"
                startAngle={90}
                endAngle={-270}
                // Recharts makes the pie layer a tab stop by default; the plot
                // is decorative, so it must not be one (the table below is).
                rootTabIndex={-1}
              >
                {data.map((slice, index) => (
                  <Cell key={`${slice.label}-${index}`} fill={colorFor(slice, index)} />
                ))}
              </Pie>
              <Tooltip cursor={false} content={<DonutTooltip format={format} total={total} />} />
            </PieChart>
          </ResponsiveContainer>

          {hasCenter ? (
            <div className={styles.donutCenter}>
              {centerValue ? <div className={styles.donutValue}>{centerValue}</div> : null}
              {centerLabel ? <div className={styles.donutLabel}>{centerLabel}</div> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <ChartLegend items={legendItems} />
      </div>

      <ChartDataTable
        caption={ariaLabel}
        rows={data.map((slice) => ({
          label: slice.label,
          value: `${format(slice.value)} · ${shareOf(slice.value, total)}`,
        }))}
      />
    </>
  );
}
