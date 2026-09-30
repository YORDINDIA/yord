'use client';

import { ErrorState } from '@/components/ui/ErrorState';

/** Catches failures under `(auth)` without leaking session details. */
export default function AuthError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-[60vh] bg-noir-950 px-6 flex items-center justify-center">
      <ErrorState
        title="We could not load this page"
        message="Sign-in is unreachable right now. Check your connection and try again."
        onRetry={() => reset()}
      />
    </main>
  );
}
