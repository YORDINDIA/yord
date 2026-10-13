import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import StatNumber from "@/components/reactbits/StatNumber";
import TrendPill, { type TrendDirection } from "@/components/ui/TrendPill";

/**
 * Palette names exposed by the `.tone-*` utilities in `globals.css`. Each
 * primitive carries its own copy of this union so a page can import the type
 * from whichever component it already uses; `globals.css` is the source of
 * truth for the list.
 */
export type ToneName =
  | "saffron"
  | "emerald"
  | "amber"
  | "rose"
  | "blue"
  | "violet"
  | "cyan"
  | "indigo"
  | "orange"
  | "fuchsia"
  | "slate";

export interface StatCardProps {
  label: string;
  /** Pre-formatted ("₹4,20,000", "18"). Large values: pass `valueSm`. */
  value: ReactNode;
  /**
   * Raw number behind `value`. When set, the figure counts up from
   * zero through `StatNumber` (and formats through the app's own
   * locale helpers, so it cannot drift from the static rendering).
   * `value` is then only the fallback for no-JS renders.
   */
  valueRaw?: number;
  /** How `valueRaw` is formatted: grouped count or INR currency. */
  animateKind?: "count" | "currency";
  icon?: LucideIcon;
  /** Hooks `--tone*` for the accent rail and icon tile. Omit for the section accent. */
  tone?: ToneName;
  delta?: { direction: TrendDirection; value: string; title?: string };
  /** Small muted note, e.g. "vs previous 30 days". Sits opposite the delta. */
  hint?: string;
  /** Sparkline element (see the chart wrappers). Renders in a 26px-tall band. */
  spark?: ReactNode;
  /** When set the whole card becomes a link — the only interactive variant. */
  href?: string;
  /** Drop the value to 17px when the number is long or has a suffix. */
  valueSm?: boolean;
  /** The strip's headline tile: tone-tinted wash, larger value, brand-filled icon. */
  emphasis?: boolean;
}

/**
 * The KPI tile every admin page uses. Server-safe: `Link` and plain markup
 * only, so it renders inside a server page with a passed-in sparkline.
 *
 * Structure is fixed by `.stat-card` in globals.css — label + tone icon on top,
 * tabular value, then a foot row that carries the delta and the hint. The tone
 * class goes on the card itself so `.stat-icon`, the accent rail, and any
 * caller-supplied `tone-*` children all resolve `--tone`.
 */
export function StatCard({
  label,
  value,
  valueRaw,
  animateKind = "count",
  icon: Icon,
  tone,
  delta,
  hint,
  spark,
  href,
  valueSm,
  emphasis,
}: StatCardProps) {
  const className = clsx(
    "stat-card",
    tone && `tone-${tone}`,
    emphasis && "stat-card--emphasis",
  );

  const body = (
    <>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {Icon && (
          <span className="stat-icon">
            <Icon size={14} aria-hidden="true" />
          </span>
        )}
      </div>
      <div className={clsx("stat-value", valueSm && "stat-value-sm")}>
        {valueRaw !== undefined ? (
          <StatNumber to={valueRaw} kind={animateKind} />
        ) : (
          value
        )}
      </div>
      {(delta || hint) && (
        <div className="stat-foot">
          {delta ? <TrendPill {...delta} /> : <span />}
          {hint && <span className="helper truncate">{hint}</span>}
        </div>
      )}
      {spark && <div className="spark">{spark}</div>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}

export default StatCard;
