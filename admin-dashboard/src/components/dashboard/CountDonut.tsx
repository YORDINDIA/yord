"use client";

import Donut, { type DonutSlice } from "@/components/charts/Donut";
import { compactNumber } from "@/lib/chart-format";

export interface CountDonutProps {
  data: DonutSlice[];
  height?: number;
  centerLabel?: string;
  /** Pre-formatted headline (the donut never formats numbers). */
  centerValue?: string;
  ariaLabel: string;
}

/**
 * Client bridge for `Donut`, pinned to count formatting.
 *
 * Every mix this admin renders is a row count (orders per status, products per
 * status), so the formatter is fixed here rather than threaded through as a
 * function prop, which cannot cross the server→client boundary. `Donut`
 * renders its own legend and hidden data table; a zero total renders
 * `ChartEmpty` instead of an empty ring.
 */
export default function CountDonut({
  data,
  height = 220,
  centerLabel,
  centerValue,
  ariaLabel,
}: CountDonutProps) {
  return (
    <Donut
      data={data}
      height={height}
      centerLabel={centerLabel}
      centerValue={centerValue}
      valueFormat={compactNumber}
      ariaLabel={ariaLabel}
    />
  );
}
