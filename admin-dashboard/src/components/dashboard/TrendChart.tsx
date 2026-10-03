"use client";

import AreaTrend, { type TrendPoint } from "@/components/charts/AreaTrend";
import { compactCurrency, compactNumber, formatDayLabel } from "@/lib/chart-format";

export interface TrendChartProps {
  /** One point per day: `label` is `YYYY-MM-DD`. */
  data: TrendPoint[];
  /** Previous window, same length; index-aligned, drawn dashed. */
  compare?: TrendPoint[];
  height?: number;
  /** Palette index; `0` is the saffron brand accent. */
  tone?: number;
  /** `currency` for money series, `count` for orders/units. */
  valueKind?: "currency" | "count";
  ariaLabel: string;
}

/**
 * Client bridge for `AreaTrend`.
 *
 * `AreaTrend` formats through function props, and a function cannot cross the
 * server→client boundary, so the page passes a serializable `valueKind` and
 * this component picks the formatter. It also fixes the day label format for
 * every trend in the admin: `formatDayLabel` reads `YYYY-MM-DD` as UTC, so a
 * chart opened from IST does not shift a bucket back a day.
 */
export default function TrendChart({
  data,
  compare,
  height = 220,
  tone = 0,
  valueKind = "currency",
  ariaLabel,
}: TrendChartProps) {
  const format = valueKind === "currency" ? compactCurrency : compactNumber;

  return (
    <AreaTrend
      data={data}
      compare={compare}
      height={height}
      tone={tone}
      valueFormat={format}
      labelFormat={formatDayLabel}
      ariaLabel={ariaLabel}
    />
  );
}
