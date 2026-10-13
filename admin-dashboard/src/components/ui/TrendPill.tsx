import clsx from "clsx";
import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

export type TrendDirection = "up" | "down" | "flat";

const TREND_ICON: Record<TrendDirection, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

/** Screen-reader text for the arrow — the only directional cue a
 *  delta like "10.0%" carries (no sign to read out). */
const SR_DIRECTION: Record<TrendDirection, string> = {
  up: "Up",
  down: "Down",
  flat: "Flat",
};

export interface TrendPillProps {
  direction: TrendDirection;
  /** Pre-formatted ("+12.4%", "2 fewer"). The pill never formats numbers. */
  value: string;
  /** Hover text for the comparison window ("vs previous 30 days"). */
  title?: string;
}

/**
 * Delta pill for stat cards and tables. Colour comes from `.delta.up/.down/
 * .flat`; the arrow is decorative, so the direction also ships as
 * screen-reader-only text before the value — unsigned deltas have no sign
 * for assistive tech to read.
 */
export function TrendPill({ direction, value, title }: TrendPillProps) {
  const Icon = TREND_ICON[direction] ?? Minus;
  return (
    <span className={clsx("delta", direction)} title={title}>
      <Icon size={11} aria-hidden="true" />
      <span className="sr-only">{SR_DIRECTION[direction]} </span>
      {value}
    </span>
  );
}

export default TrendPill;
