"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { CHART_TONES, useChartTheme, withAlpha } from "./chart-theme";

export interface SparklineProps {
  /** Raw values in time order; there is no label axis at this size. */
  data: number[];
  /** Palette index. Without it, `positive` picks emerald or rose. */
  tone?: number;
  height?: number;
  /** `false` draws the line in rose. Defaults to the emerald "good" tone. */
  positive?: boolean;
  /** Defaults to "Trend" — a sparkline sits next to its own label. */
  ariaLabel?: string;
}

const EMERALD = CHART_TONES.indexOf("emerald");
const ROSE = CHART_TONES.indexOf("rose");

/**
 * Micro trend line for a stat card.
 *
 * No axes, grid, or tooltip: at 28px tall there is nothing to read off it
 * except direction, and a hover target that small is a fidget, not a feature.
 * Animation is off because stat cards render in a grid, and eight lines
 * animating at once on every filter change is noise, not feedback.
 */
export default function Sparkline({
  data,
  tone,
  height = 28,
  positive,
  ariaLabel = "Trend",
}: SparklineProps) {
  const theme = useChartTheme();
  const gradientId = `spark-${useId().replace(/:/g, "")}`;

  const paletteIndex = tone ?? (positive === false ? ROSE : EMERALD);
  const color = theme.palette[paletteIndex] ?? theme.palette[EMERALD];

  if (data.length === 0) {
    // Keeps the row's layout without announcing an empty image.
    return <div className="chart-wrap" style={{ height }} aria-hidden="true" />;
  }

  const rows = data.map((value, index) => ({ index, value }));
  const first = data[0];
  const last = data[data.length - 1];
  const min = Math.min(...data);
  const max = Math.max(...data);

  return (
    <>
      <div
        className="chart-wrap"
        style={{ height }}
        role="img"
        aria-label={`${ariaLabel}: ${data.length} points, from ${first} to ${last}, low ${min}, high ${max}`}
      >
        <div aria-hidden="true" style={{ width: "100%", height: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={rows}
              margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
              accessibilityLayer={false}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={withAlpha(color, 0.45)} />
                  <stop offset="60%" stopColor={withAlpha(color, 0.12)} />
                  <stop offset="100%" stopColor={withAlpha(color, 0)} />
                </linearGradient>
              </defs>

              {/* Renders nothing; it pins the domain so a series sitting between
                  1.02 and 1.04 fills the box instead of hugging the top. */}
              <YAxis hide domain={["dataMin", "dataMax"]} />

              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
