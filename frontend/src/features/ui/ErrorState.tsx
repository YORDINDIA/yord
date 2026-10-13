'use client';

import { useState } from 'react';
import { Button } from './Button';
import { CtaLink } from './CtaLink';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  /** `reset()` in an `error.tsx` boundary, `router.refresh()` in a section. */
  onRetry?: () => void | Promise<void>;
  retryLabel?: string;
  showHomeLink?: boolean;
  /**
   * Heading level for the title. The `error.tsx` boundaries replace the whole
   * page, so `h1` is the default; an inline section inside a page that already
   * has a heading passes `h2`.
   */
  as?: 'h1' | 'h2';
}

/**
 * Standard error state: what failed, retry, Back to home.
 *
 * Both actions are the real primitives — `Button` and `CtaLink` — rather than
 * hand-rolled button recipes, so a change to the button styles reaches this
 * page too. It used to carry its own copy, which is how it ended up with the
 * only buttons in the app that ignored the shared focus treatment.
 */
export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this right now. Check your connection and try again.',
  onRetry,
  retryLabel = 'Try again',
  showHomeLink = true,
  as: Heading = 'h1',
}: ErrorStateProps) {
  const [retrying, setRetrying] = useState(false);

  // Awaited rather than fired and forgotten, so an async retry keeps the
  // button disabled and `aria-busy` for as long as it actually runs. A sync
  // `reset()` clears it on the next microtask, which is correct — the
  // boundary re-renders immediately.
  const handleRetry = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="py-16 text-center">
      {/* A real heading, not a <p>: inside `error.tsx` this is the whole page,
          so without it the route has no heading for a screen reader to land on
          or for the document outline to show. */}
      <Heading className="font-display text-2xl text-text-primary mb-3">{title}</Heading>
      <p className="font-body text-sm text-text-muted max-w-md mx-auto mb-8">{message}</p>
      <div className="flex items-center justify-center gap-4">
        {onRetry ? (
          <Button onClick={() => void handleRetry()} isLoading={retrying}>
            {retryLabel}
          </Button>
        ) : null}
        {showHomeLink ? (
          <CtaLink href="/" variant="secondary">
            Back to home
          </CtaLink>
        ) : null}
      </div>
    </div>
  );
}
