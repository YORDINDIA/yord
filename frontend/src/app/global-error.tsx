'use client';

import Link from 'next/link';
import { useReportError } from '@/hooks/useReportError';

/** Root fallback for errors thrown outside route segments (layout failures). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useReportError(error);

  return (
    <html lang="en-IN">
      <body className="antialiased bg-surface-page">
        <main className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center">
            <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.3em] text-accent mb-3">
              SOMETHING WENT WRONG
            </p>
            <h1 className="font-[family-name:var(--font-playfair)] text-4xl text-text-primary mb-4">
              YORD India is unavailable
            </h1>
            <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted max-w-md mx-auto mb-8">
              We could not load the store right now. Check your connection and try again.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => reset()}
                className="px-8 py-3 bg-accent text-text-on-accent font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] hover:bg-accent-hover transition-colors"
              >
                TRY AGAIN
              </button>
              <Link
                href="/"
                className="px-8 py-3 border border-border-strong text-text-secondary font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] hover:border-accent hover:text-accent transition-colors"
              >
                BACK TO HOME
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
