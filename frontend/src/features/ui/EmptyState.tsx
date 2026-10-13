import { cn } from '@yord/ui';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  message?: string;
  children?: ReactNode;
  /**
   * Heading level for the title. `h2` is the safe default for a section that
   * has nothing in it; pass `p` for a decorative one.
   */
  as?: 'h2' | 'h3' | 'p';
  className?: string;
}

/**
 * Standard empty state: what is missing, one line of guidance, and an optional
 * action.
 *
 * Use this — not a hand-written `<p>` — for every "nothing here" case, so the
 * wording, the heading level and the announcement behaviour are the same in
 * the cart, the catalog, the wishlist and search. It is deliberately NOT the
 * right answer for a failed read: that is `ErrorState` (a failed read must
 * never look like an empty result).
 *
 * Server-safe.
 */
export function EmptyState({
  title,
  message,
  children,
  as: Heading = 'h2',
  className,
}: EmptyStateProps) {
  return (
    // `role="status"` so a filtered result that comes back empty is announced
    // rather than silently swapping the grid for nothing.
    <div role="status" aria-live="polite" className={cn('py-16 text-center', className)}>
      <Heading className="font-display text-2xl text-text-secondary mb-3">{title}</Heading>
      {message ? (
        // Capped at the same measure as ErrorState; uncapped, one sentence
        // stretches across the full 1440px page grid.
        <p className="font-body text-sm text-text-muted max-w-md mx-auto mb-6">{message}</p>
      ) : null}
      {children}
    </div>
  );
}
