import TrendPill, { type TrendDirection } from "@/components/ui/TrendPill";
import StatNumber from "@/components/reactbits/StatNumber";
import type { ReactNode } from "react";

export interface HeroKpiProps {
  /** Uppercase eyebrow, e.g. "Revenue · last 7 days". */
  label: string;
  /** Pre-formatted headline figure in display type. */
  value: ReactNode;
  /** Raw figure behind `value`; when set, the headline counts up on load. */
  valueRaw?: number;
  /** Muted window note under the figure, e.g. "Whole UTC days, ending yesterday". */
  windowLabel?: string;
  delta?: { direction: TrendDirection; value: string; title?: string };
  /** Sparkline element; stretches to fill the band's trailing space. */
  spark?: ReactNode;
}

/**
 * The dashboard's headline band. Server-safe like `StatCard`:
 * plain markup and a passed-in sparkline, so it renders inside
 * the server page. Colour comes entirely from tokens — the band
 * resolves `--accent-local`, which the shell stamps per route.
 *
 * Renders its two halves without a wrapper: the dashboard page
 * frames the band with `StarCard`, which supplies the surface
 * (`innerClassName="hero-kpi"`), so there is exactly one
 * nested card, not a card within a card.
 *
 * With `valueRaw` the figure counts up from zero through the
 * same INR formatter every other revenue number uses, so the
 * headline and the strip below it can never disagree.
 */
export default function HeroKpi({
  label,
  value,
  valueRaw,
  windowLabel,
  delta,
  spark,
}: HeroKpiProps) {
  return (
    <>
      <div className="hero-kpi-main">
        <span className="hero-kpi-label">{label}</span>
        <div className="hero-kpi-row">
          <span className="hero-kpi-value">
            {valueRaw !== undefined ? (
              <StatNumber to={valueRaw} kind="currency" />
            ) : (
              value
            )}
          </span>
          {delta ? <TrendPill {...delta} /> : null}
        </div>
        {windowLabel ? <span className="hero-kpi-window">{windowLabel}</span> : null}
      </div>
      {spark ? <div className="hero-kpi-spark">{spark}</div> : null}
    </>
  );
}
