'use client';

import { ErrorState } from '@/features/ui/ErrorState';
import { useReportError } from '@/hooks/useReportError';

/** Collection failures render here; a missing handle calls `notFound()`. */
export default function CollectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useReportError(error);

  return (
    <main className="min-h-[60vh] bg-surface-page px-6 flex items-center justify-center">
      <ErrorState
        title="We could not load this collection"
        message="The catalog service is unreachable right now. Check your connection and try again."
        onRetry={() => reset()}
      />
    </main>
  );
}
