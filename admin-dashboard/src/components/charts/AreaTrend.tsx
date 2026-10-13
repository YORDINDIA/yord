"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipPayload,
} from "recharts";
import { compactNumber } from "@/lib/chart-format";
import { ChartDataTable, ChartEmpty } from "./ChartCard";
import { useChartTheme, withAlpha } from "./chart-theme";

export interface TrendPoint {
  label: string;
  value: number;
}

export interface AreaTrendProps {
  data: TrendPoint[];
  /** Plot height in px. The axis labels are drawn inside this box. */
  height?: number;
  /** Palette index; `0` is the saffron accent. */
  tone?: number;
  /** Tooltip, data table, and (when `labelFormat` is absent) axis values. */
  valueFormat?: (value: number) => string;
  labelFormat?: (label: string) => string;
  /** Previous period, aligned by label (index is the fallback). Drawn dashed. */
  compare?: TrendPoint[];
  ariaLabel: string;
}

interface TrendRow {
  label: string;
  value: number;
  compare: number | null;
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * `compare` arrives as its own series, so it is matched back onto the primary
 * labels: the two arrays can cover different windows, and drawing them by index
 * would silently pair yesterday's total with today's date.
 */
function mergeCompare(data: TrendPoint[], compare: TrendPoint[] | undefined): TrendRow[] {
  const byLabel = new Map(compare?.map((point) => [point.label, point.value]) ?? []);
  return data.map((point, index) => ({
    label: point.label,
    value: point.value,
    compare: compare ? (byLabel.get(point.label) ?? compare[index]?.value ?? null) : null,
  }));
}

function TrendTooltip({
  active,
  label,
  payload,
  format,
  formatLabel,
}: {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayload;
  format: (value: number) => string;
  formatLabel: (label: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const heading = typeof label === "string" ? formatLabel(label) : String(label ?? "");

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{heading}</div>
      {payload.map((entry, index) => (
        <div className="chart-tooltip-row" key={String(entry.dataKey ?? index)}>
          <span
            className="legend-dot"
            style={{ background: entry.color ?? entry.stroke ?? "currentColor" }}
            aria-hidden="true"
          />
          <span>{entry.name}</span>
          <strong>{format(toNumber(entry.value))}</strong>
        </div>
      ))}
    </div>
  );
}

/**
 * Single-series trend with a dashed average line, optionally compared against a
 * previous period.
 *
 * The average reference line is the one thing a trend chart is read for ("is
 * this day above normal?"), so it is drawn rather than left to the reader, and
 * it is also a row of the hidden data table so it is not lost to a screen
 * reader.
 */
export default function AreaTrend({
  data,
  height = 220,
  tone = 0,
  valueFormat,
  labelFormat,
  compare,
  ariaLabel,
}: AreaTrendProps) {
  const theme = useChartTheme();
  const gradientId = `area-trend-${useId().replace(/:/g, "")}`;
  const strokeGradientId = `area-stroke-${useId().replace(/:/g, "")}`;

  const color = theme.palette[tone] ?? theme.palette[0];
  const compareColor = theme.palette[1] ?? theme.palette[0];
  const format = valueFormat ?? compactNumber;
  const formatLabel = labelFormat ?? ((value: string) => value);

  if (data.length === 0) return <ChartEmpty />;

  const rows = mergeCompare(data, compare);
  const average = rows.reduce((sum, row) => sum + row.value, 0) / rows.length;
  const hasCompare = compare !== undefined && compare.length > 0;

  const tableRows = rows.flatMap((row) => {
    const current = { label: formatLabel(row.label), value: format(row.value) };
    if (!hasCompare) return [current];
    return [
      current,
      {
        label: `${formatLabel(row.label)} (previous)`,
        value: row.compare === null ? "—" : format(row.compare),
      },
    ];
  });
  tableRows.push({ label: "Average", value: format(average) });

  return (
    <>
      <div className="chart-wrap" style={{ height }} role="img" aria-label={ariaLabel}>
        {/* Recharts renders its own SVG chrome; the accessible story above is
            the label plus the table below, so the plot is decorative here. */}
        <div aria-hidden="true" style={{ width: "100%", height: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            {/* `accessibilityLayer` off: it puts a focusable region inside the
                aria-hidden plot, and the data table below already carries the
                values for assistive tech. */}
            <AreaChart
              data={rows}
              margin={{ top: 8, right: 10, bottom: 0, left: 0 }}
              accessibilityLayer={false}
            >
              <defs>
                {/* Three stops: the fill is present at the line and
                    falls off through a mid step instead of fading
                    straight to nothing, so the shape reads. */}
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.42} />
                  <stop offset="55%" stopColor={color} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={withAlpha(color, 0)} />
                </linearGradient>
                {/* The stroke carries a whisper of depth too: full
                    hue at the top, slightly settled at the bottom. */}
                <linearGradient id={strokeGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} />
                  <stop offset="100%" stopColor={withAlpha(color, 0.72)} />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} stroke={theme.grid} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                tickFormatter={formatLabel}
              />
              <YAxis
                width={44}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => format(toNumber(value))}
              />
              <Tooltip
                cursor={{ stroke: theme.axis, strokeDasharray: "3 3" }}
                content={<TrendTooltip format={format} formatLabel={formatLabel} />}
              />
              <ReferenceLine y={average} stroke={theme.axis} strokeDasharray="3 3" />

              <Area
                type="monotone"
                dataKey="value"
                name="Value"
                stroke={`url(#${strokeGradientId})`}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                activeDot={{
                  r: 5,
                  fill: color,
                  stroke: "var(--surface-card)",
                  strokeWidth: 2,
                }}
              />
              {hasCompare ? (
                <Line
                  type="monotone"
                  dataKey="compare"
                  name="Previous"
                  stroke={compareColor}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls
                />
              ) : null}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ChartDataTable caption={ariaLabel} rows={tableRows} />
    </>
  );
}
