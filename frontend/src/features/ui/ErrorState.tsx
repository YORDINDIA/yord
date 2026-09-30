'use client';

import Link from 'next/link';

/**
 * Standard error state: branded message + retry + Back to home.
 * `onRetry` is `reset()` inside `error.tsx` boundaries and
 * `router.refresh()` inside degraded server sections — both are
 * `() => void`, so one component serves both.
 */
export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this right now. Check your connection and try again.',
  onRetry,
  retryLabel = 'Try again',
  showHomeLink = true,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  showHomeLink?: boolean;
}) {
  return (
    <div className="py-16 text-center">
      <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.3em] text-gold-200 mb-3">
        SOMETHING WENT WRONG
      </p>
      <p className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-50 mb-3">{title}</p>
      <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 max-w-md mx-auto mb-8">
        {message}
      </p>
      <div className="flex items-center justify-center gap-4">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="px-8 py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] hover:bg-gold-300 transition-colors"
          >
            {retryLabel.toUpperCase()}
          </button>
        ) : null}
        {showHomeLink ? (
          <Link
            href="/"
            className="px-8 py-3 border border-noir-600 text-ivory-200 font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] hover:border-gold-200 hover:text-gold-200 transition-colors"
          >
            BACK TO HOME
          </Link>
        ) : null}
      </div>
    </div>
  );
}
