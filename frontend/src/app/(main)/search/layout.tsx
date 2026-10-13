import type { Metadata } from 'next';

/**
 * `page.tsx` is a client component (`useSearchParams`), and a client component
 * cannot export metadata, so this route declares it here.
 *
 * A result set is a per-query view of the catalogue, never a page of its own in
 * an index, and the canonical is the bare `/search`: every `?q=` variant is the
 * same page.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: '/search' },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
