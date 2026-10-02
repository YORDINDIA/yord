'use client';

import { ErrorState } from '@/features/ui/ErrorState';

/**
 * Product detail failures render here — never as a 404. A missing row calls
 * `notFound()`; only a failed query reaches this boundary.
 */
export default function ProductError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-[60vh] bg-surface-page px-6 flex items-center justify-center">
      <ErrorState
        title="We could not load this product"
        message="The product service is unreachable right now. Check your connection and try again."
        onRetry={() => reset()}
      />
    </main>
  );
}
