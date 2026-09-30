'use client';

import { ErrorState } from '@/features/ui/ErrorState';

/** Catches failed reads anywhere under `(main)` — e.g. Supabase unreachable. */
export default function MainError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-[60vh] bg-noir-950 px-6 flex items-center justify-center">
      <ErrorState
        title="We could not load this page"
        message="The store is unreachable right now. Your connection may be down, or our catalog service is having trouble."
        onRetry={() => reset()}
      />
    </main>
  );
}
