import clsx from "clsx";
import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

export type TrendDirection = "up" | "down" | "flat";

const TREND_ICON: Record<TrendDirection, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
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
 * .flat`; the arrow is decorative, so it stays out of the accessibility tree
 * and the direction is carried by the caller's text.
 */
export function TrendPill({ direction, value, title }: TrendPillProps) {
  const Icon = TREND_ICON[direction] ?? Minus;
  return (
    <span className={clsx("delta", direction)} title={title}>
      <Icon size={11} aria-hidden="true" />
      {value}
    </span>
  );
}

export default TrendPill;
