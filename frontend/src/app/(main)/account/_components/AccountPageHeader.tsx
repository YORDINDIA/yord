import type { ReactNode } from 'react';
import { cn } from '@yord/ui';

export interface AccountPageHeaderProps {
  /** `h2`: the account layout owns the page's `h1`. */
  title: string;
  description?: ReactNode;
  /** Opposite the title on wide screens (a count, a filter, a CTA). */
  action?: ReactNode;
  className?: string;
}

/**
 * The heading every account page repeats. The four pages had four different
 * ones — some with a count on the right, some with nothing, one with the count
 * inside the title line — so the section now has a single heading rhythm.
 */
export function AccountPageHeader({ title, description, action, className }: AccountPageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div>
        <h2 className="font-display text-2xl text-text-primary">{title}</h2>
        {description ? (
          <p className="font-body text-sm text-text-muted mt-1">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
