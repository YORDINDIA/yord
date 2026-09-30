'use client';

import { ErrorState } from '@/components/ui/ErrorState';

/** Artist page failures render here; an unknown handle calls `notFound()`. */
export default function ArtistError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-[60vh] bg-noir-950 px-6 flex items-center justify-center">
      <ErrorState
        title="We could not load this artist"
        message="The catalog service is unreachable right now. Check your connection and try again."
        onRetry={() => reset()}
      />
    </main>
  );
}
