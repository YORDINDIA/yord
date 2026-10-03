"use client";

import Bars, { type BarDatum } from "@/components/charts/Bars";
import { compactCurrency, compactNumber } from "@/lib/chart-format";

export interface BarsChartProps {
  data: BarDatum[];
  height?: number;
  orientation?: "horizontal" | "vertical";
  /** `currency` for money series, `count` for units/rows. */
  valueKind?: "currency" | "count";
  ariaLabel: string;
}

/**
 * Client bridge for `Bars`. Same reason as `TrendChart`: `valueFormat` is a
 * function, so the page passes a serializable `valueKind` instead of the
 * formatter itself.
 */
export default function BarsChart({
  data,
  height = 240,
  orientation = "horizontal",
  valueKind = "count",
  ariaLabel,
}: BarsChartProps) {
  const format = valueKind === "currency" ? compactCurrency : compactNumber;

  return (
    <Bars
      data={data}
      height={height}
      orientation={orientation}
      valueFormat={format}
      ariaLabel={ariaLabel}
    />
  );
}
