import clsx from "clsx";

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

export interface ProgressBarProps {
  value: number;
  max?: number;
  /** Hooks `--tone` for the fill. Omit for the section accent. */
  tone?: ToneName;
  size?: "sm" | "md";
  /** When set, renders a label + percentage line above the track. */
  label?: string;
}

/**
 * Stock/fulfilment meter. Out-of-range and non-finite input is clamped rather
 * than thrown, because the numbers come from aggregate SQL and a bad row should
 * not blank the page. `max` of 0 or less is treated as 1 so the percentage
 * never divides by zero.
 */
export function ProgressBar({
  value,
  max = 100,
  tone,
  size = "md",
  label,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax) : 0;
  const percent = Math.round((clamped / safeMax) * 100);

  const bar = (
    // The tone class sits on the track so `.progress-fill` inherits --tone.
    <div
      className={clsx("progress", size === "sm" && "progress-sm", tone && `tone-${tone}`)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-label={label}
    >
      <div className="progress-fill" style={{ width: `${percent}%` }} />
    </div>
  );

  if (!label) return bar;

  return (
    <div className="stack-sm">
      <div className="row-between">
        <span className="helper">{label}</span>
        <span className="helper num">{percent}%</span>
      </div>
      {bar}
    </div>
  );
}

export default ProgressBar;
