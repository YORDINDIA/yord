'use client';

import Link from 'next/link';

/** Root fallback for errors thrown outside route segments (layout failures). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body className="antialiased bg-noir-950">
        <main className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center">
            <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.3em] text-gold-200 mb-3">
              SOMETHING WENT WRONG
            </p>
            <h1 className="font-[family-name:var(--font-playfair)] text-4xl text-ivory-50 mb-4">
              YORD India is unavailable
            </h1>
            <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 max-w-md mx-auto mb-8">
              We could not load the store right now. Check your connection and try again.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => reset()}
                className="px-8 py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] hover:bg-gold-300 transition-colors"
              >
                TRY AGAIN
              </button>
              <Link
                href="/"
                className="px-8 py-3 border border-noir-600 text-ivory-200 font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] hover:border-gold-200 hover:text-gold-200 transition-colors"
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
