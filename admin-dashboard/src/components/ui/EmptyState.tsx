import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

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

export interface EmptyStateProps {
  title: string;
  hint?: string;
  /** Primary CTA — renders only when both label and href are present. */
  actionLabel?: string;
  actionHref?: string;
  /** Quiet alternative next to the primary CTA. */
  secondaryAction?: { label: string; href: string };
  /** A lucide icon element (`<PackagePlus size={22} />`) or any node. */
  icon?: ReactNode;
  /** Hooks `--tone*` for the icon tile. Use `rose` for failure states. */
  tone?: ToneName;
  /** Extra content between the hint and the actions (links, a small form). */
  children?: ReactNode;
}

/**
 * The one empty/no-results block. Server-safe.
 *
 * Note the difference the error model draws: this is for a *successful* read
 * that returned nothing. A failed read throws `DatabaseError` and renders the
 * route's `error.tsx` instead, so "no results" never stands in for an error.
 */
export function EmptyState({
  title,
  hint,
  actionLabel,
  actionHref,
  secondaryAction,
  icon,
  tone,
  children,
}: EmptyStateProps) {
  const hasActions = Boolean((actionLabel && actionHref) || secondaryAction);

  return (
    <div className={clsx("empty-state", tone && `tone-${tone}`)}>
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="empty-title">{title}</div>
      {hint && <div className="empty-hint">{hint}</div>}
      {children}
      {hasActions && (
        <div className="empty-actions">
          {actionLabel && actionHref && (
            <Link className="button primary" href={actionHref}>
              {actionLabel}
            </Link>
          )}
          {secondaryAction && (
            <Link className="button" href={secondaryAction.href}>
              {secondaryAction.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
