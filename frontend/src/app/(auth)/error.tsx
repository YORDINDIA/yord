'use client';

import { ErrorState } from '@/features/ui/ErrorState';
import { useReportError } from '@/hooks/useReportError';

/** Catches failures under `(auth)` without leaking session details. */
export default function AuthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useReportError(error);

  return (
    <main className="min-h-[60vh] bg-surface-page px-6 flex items-center justify-center">
      <ErrorState
        title="We could not load this page"
        message="Sign-in is unreachable right now. Check your connection and try again."
        onRetry={() => reset()}
      />
    </main>
  );
}
