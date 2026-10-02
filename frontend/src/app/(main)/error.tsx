'use client';

import { ErrorState } from '@/features/ui/ErrorState';
import { useReportError } from '@/hooks/useReportError';

/** Catches failed reads anywhere under `(main)` — e.g. Supabase unreachable. */
export default function MainError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useReportError(error);

  return (
    <main className="min-h-[60vh] bg-surface-page px-6 flex items-center justify-center">
      <ErrorState
        title="We could not load this page"
        message="The store is unreachable right now. Your connection may be down, or our catalog service is having trouble."
        onRetry={() => reset()}
      />
    </main>
  );
}
