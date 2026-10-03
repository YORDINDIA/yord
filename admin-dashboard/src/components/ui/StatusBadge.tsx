import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

/**
 * Status → colour. Keys are normalised (lowercased, spaces/dashes folded to
 * underscores) before lookup, so `"Partially Paid"`, `"partially-paid"` and
 * `"partially_paid"` all resolve. Anything unknown falls back to `neutral` on
 * purpose: a typo in a status string should look plain, not alarming.
 */
const STATUS_TONE: Record<string, Tone> = {
  active: "success",
  paid: "success",
  fulfilled: "success",
  published: "success",
  complete: "success",
  completed: "success",
  yes: "success",
  true: "success",
  ok: "success",
  draft: "warning",
  pending: "warning",
  partial: "warning",
  partially_refunded: "warning",
  partially_paid: "warning",
  low: "warning",
  unknown: "warning",
  scheduled: "info",
  unfulfilled: "info",
  restocked: "info",
  processing: "info",
  authorized: "info",
  open: "info",
  archived: "neutral",
  cancelled: "neutral",
  canceled: "neutral",
  failed: "danger",
  voided: "danger",
  refunded: "danger",
  expired: "danger",
  no: "danger",
  false: "danger",
  out: "danger",
};

export function toneForStatus(value: string | null | undefined): Tone {
  if (!value) return "neutral";
  return STATUS_TONE[value.toLowerCase().replace(/[\s-]+/g, "_")] ?? "neutral";
}

export interface StatusBadgeProps {
  value?: string | null;
  /** Overrides the visible text while `value` still drives the tone. */
  label?: string;
  tone?: Tone;
  /** Small leading glyph — pass an 11-13px lucide icon. */
  icon?: LucideIcon;
  /** Leading status dot, tinted by the badge's current colour. */
  dot?: boolean;
  /** `sm` (default, 18px) is for table cells; `md` (22px) for detail headers. */
  size?: "sm" | "md";
}

/**
 * Status chip for orders, products, refunds, and admin users.
 *
 * `default`-exported with `toneForStatus` since existing pages import it that
 * way; the named export is the same component.
 */
export function StatusBadge({
  value,
  label,
  tone,
  icon: Icon,
  dot,
  size = "sm",
}: StatusBadgeProps) {
  const text = label ?? value ?? "-";
  const resolved = tone ?? toneForStatus(value ?? label);
  const showDot = dot ?? !Icon;

  return (
    <span className={clsx("badge", resolved, size === "md" && "badge-lg")}>
      {Icon && <Icon size={11} aria-hidden="true" />}
      {showDot && <span className="badge-dot" aria-hidden="true" />}
      {text}
    </span>
  );
}

export default StatusBadge;
