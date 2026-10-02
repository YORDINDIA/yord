'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Reports an error-boundary error to Sentry once per distinct error object.
 *
 * Server-thrown errors are also captured by `onRequestError` in
 * `src/instrumentation.ts`; duplicates group together in Sentry and are the
 * price of also catching client-side render errors, which nothing else sees.
 */
export function useReportError(error: Error & { digest?: string }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
}
