'use client';

import { ErrorState } from '@/features/ui/ErrorState';

/** Artist page failures render here; an unknown handle calls `notFound()`. */
export default function ArtistError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-[60vh] bg-scrim px-6 flex items-center justify-center">
      {/* Dark scrim keeps the transparent on-media header legible; the card keeps
          the theme-following ErrorState text readable in BOTH themes. */}
      <div className="bg-surface-card border border-border-default p-8">
        <ErrorState
          title="We could not load this artist"
          message="The catalog service is unreachable right now. Check your connection and try again."
          onRetry={() => reset()}
        />
      </div>
    </main>
  );
}
