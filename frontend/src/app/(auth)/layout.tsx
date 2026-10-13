import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * One frame for all four auth pages: page surface, centred column, brand mark.
 * Each page renders only its card (`AuthShell`), so login/register/forgot/reset
 * cannot drift apart again.
 *
 * This layout owns the page's `<main>` landmark, as `(main)/layout.tsx` does
 * for the storefront: the pages under it are client components, and the
 * route-state files (`loading.tsx`, `error.tsx`) are `<div>`s, so no page has
 * to remember the landmark. Sign-in screens are utility pages that must never
 * sit in an index; each page declares its own canonical in the leaf layout
 * beside it, because a canonical set here would be inherited by all four.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="min-h-screen bg-surface-page pt-24 pb-16 flex items-center justify-center">
      <div className="w-full max-w-[440px] mx-auto px-6">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block" aria-label="YORD India — home">
            {/* Not a heading: the page's `h1` is the form title inside the card. */}
            <span className="font-accent text-3xl tracking-[0.2em] text-text-primary">YORD</span>
          </Link>
        </div>
        {children}
      </div>
    </main>
  );
}
