"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipPayload,
} from "recharts";
import { compactNumber } from "@/lib/chart-format";
import { ChartDataTable, ChartEmpty } from "./ChartCard";
import { useChartTheme } from "./chart-theme";

export interface BarDatum {
  label: string;
  value: number;
  /** Secondary line: SKU, artist, collection. Shown in the tooltip and the table. */
  sub?: string;
  /** Palette index. Without it, bars cycle the ramp so a ranking reads as a set. */
  tone?: number;
}

export interface BarsProps {
  data: BarDatum[];
  height?: number;
  /** `horizontal` (default) draws rows ranked top-down; `vertical` draws columns. */
  orientation?: "horizontal" | "vertical";
  valueFormat?: (value: number) => string;
  ariaLabel: string;
}

/** Category labels are cut at 16 characters; the full label stays in the tooltip. */
const LABEL_LIMIT = 16;

function truncateLabel(label: string): string {
  return label.length > LABEL_LIMIT ? `${label.slice(0, LABEL_LIMIT - 1)}…` : label;
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function BarTooltip({
  active,
  payload,
  format,
}: {
  active?: boolean;
  payload?: TooltipPayload;
  format: (value: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0].payload as BarDatum | undefined;
  if (!row) return null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">
        {row.label}
        {row.sub ? ` · ${row.sub}` : ""}
      </div>
      <div className="chart-tooltip-row">
        <span>Value</span>
        <strong>{format(toNumber(payload[0].value))}</strong>
      </div>
    </div>
  );
}

/**
 * Ranked bars, horizontal by default (a top-10 list reads better as rows than
 * as a forest of rotated ticks).
 *
 * Each bar gets its own `Cell` so a per-row `tone` is one line of data, and
 * bars without a tone cycle the ramp — a ranking is a set of distinct things,
 * not one metric over time.
 */
export default function Bars({
  data,
  height = 220,
  orientation = "horizontal",
  valueFormat,
  ariaLabel,
}: BarsProps) {
  const theme = useChartTheme();
  const format = valueFormat ?? compactNumber;

  if (data.length === 0) return <ChartEmpty />;

  const isHorizontal = orientation === "horizontal";
  const colorFor = (row: BarDatum, index: number) =>
    theme.palette[row.tone ?? index % theme.palette.length] ?? theme.palette[0];

  // The category axis reserves its own width; estimate it from the longest
  // (already truncated) label so it neither clips text nor eats the plot.
  const longestLabel = data.reduce((max, row) => Math.max(max, truncateLabel(row.label).length), 0);
  const labelWidth = Math.min(150, Math.max(56, Math.round(longestLabel * 6.4) + 10));

  return (
    <>
      <div className="chart-wrap" style={{ height }} role="img" aria-label={ariaLabel}>
        <div aria-hidden="true" style={{ width: "100%", height: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            {isHorizontal ? (
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
                // Decorative plot: the data table below is the accessible
                // chart, so no focusable recharts region inside aria-hidden.
                accessibilityLayer={false}
              >
                <CartesianGrid horizontal={false} stroke={theme.grid} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => format(toNumber(value))}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={labelWidth}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  tickFormatter={truncateLabel}
                />
                <Tooltip cursor={{ fill: theme.cursor }} content={<BarTooltip format={format} />} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={18}>
                  {data.map((row, index) => (
                    <Cell key={`${row.label}-${index}`} fill={colorFor(row, index)} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart
                data={data}
                margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                accessibilityLayer={false}
              >
                <CartesianGrid vertical={false} stroke={theme.grid} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={4} tickFormatter={truncateLabel} />
                <YAxis
                  width={44}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => format(toNumber(value))}
                />
                <Tooltip cursor={{ fill: theme.cursor }} content={<BarTooltip format={format} />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={28}>
                  {data.map((row, index) => (
                    <Cell key={`${row.label}-${index}`} fill={colorFor(row, index)} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <ChartDataTable
        caption={ariaLabel}
        rows={data.map((row) => ({
          // The table IS the accessible chart, so it carries the untruncated
          // label plus the secondary line the axis had to drop.
          label: row.sub ? `${row.label} — ${row.sub}` : row.label,
          value: format(row.value),
        }))}
      />
    </>
  );
}
