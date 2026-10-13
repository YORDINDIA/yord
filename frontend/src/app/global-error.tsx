'use client';

import { ErrorState } from '@/features/ui/ErrorState';
import { useReportError } from '@/hooks/useReportError';

/**
 * Root fallback for errors thrown outside route segments (layout failures).
 *
 * It renders its own `<html>`/`<body>` because the root layout is what failed,
 * so it cannot use the `(main)` chrome. It uses `ErrorState` rather than a
 * second hand-rolled copy of the same markup — the copy had drifted into its
 * own button recipes and a "SOMETHING WENT WRONG" eyebrow that `ErrorState`
 * had already dropped.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useReportError(error);

  return (
    <html lang="en-IN">
      <body className="antialiased bg-surface-page">
        <main id="main" tabIndex={-1} className="min-h-screen flex items-center justify-center px-6">
          <ErrorState
            title="YORD India is unavailable"
            message="We could not load the store right now. Check your connection and try again."
            onRetry={() => reset()}
          />
        </main>
      </body>
    </html>
  );
}
