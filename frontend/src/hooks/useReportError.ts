'use client';

import { useEffect } from 'react';
import { sentryOptions } from '@/sentry-options';

/**
 * Reports an error-boundary error to Sentry once per distinct error object.
 *
 * The SDK is imported on demand rather than at module scope: with no DSN
 * configured (the deployed default) the ~110 KB client SDK used to be parsed
 * and executed on every page for nothing. `sentryOptions().enabled` is the
 * same DSN + production gate the client initialiser uses, so this is a no-op
 * exactly when Sentry is off, and a cache hit (the SDK is already loaded) when
 * it is on.
 *
 * Server-thrown errors are also captured by `onRequestError` in
 * `src/instrumentation.ts`; duplicates group together in Sentry and are the
 * price of also catching client-side render errors, which nothing else sees.
 */
export function useReportError(error: Error & { digest?: string }) {
  useEffect(() => {
    if (!sentryOptions().enabled) return;
    void import('@sentry/nextjs')
      .then((Sentry) => {
        Sentry.captureException(error);
      })
      // A failed chunk fetch must not surface as a console error on top of
      // the error the boundary is already showing.
      .catch(() => {});
  }, [error]);
}
