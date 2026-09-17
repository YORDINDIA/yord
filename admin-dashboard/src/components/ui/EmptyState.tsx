import Link from "next/link";
import type { ReactNode } from "react";

export default function EmptyState({
  title,
  hint,
  actionLabel,
  actionHref,
  icon,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="empty-title">{title}</div>
      {hint && <div className="helper">{hint}</div>}
      {actionLabel && actionHref && (
        <Link className="button" href={actionHref}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
