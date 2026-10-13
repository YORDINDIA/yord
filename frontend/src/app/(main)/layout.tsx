import { Header } from '@/features/layout/Header';
import { Footer } from '@/features/layout/Footer';
import { CartDrawer } from '@/features/layout/CartDrawer';
import { getArtistsWithMetadata } from '@/lib/supabase/queries';
import { degrade } from '@/lib/result';
import { conceptsEnabled } from '@/features/concepts/gate';
import { ConceptSwitcher } from '@/features/concepts/ConceptSwitcher';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Header nav + footer artist links are optional: a failed read degrades to
  // empty artist lists (header has no artist menu, footer keeps its "View All
  // Artists" link) rather than taking down every page under `(main)`. The
  // static (cookie-free) client keeps this layout prerenderable so the
  // catalog detail pages (`generateStaticParams` + `revalidate`) stay
  // static; the cookie-based variant forced dynamic rendering and broke
  // them on runtimes without Netlify-style static-to-dynamic fallback.
  const artistsResult = await degrade(getArtistsWithMetadata(true), [], 'layout:artists', 'collections');
  const artists = artistsResult.ok ? artistsResult.value : [];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Keyboard users otherwise tab through the logo, six nav items, the
          theme control, search, account, cart and the menu toggle on every
          navigation. The landmark below is this layout's, not the page's: a
          per-page `<main id="main">` was a contract every page had to
          remember, and most of them never did — the skip link did nothing on
          them, because nothing on the page carried `id="main"`. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent focus:text-text-on-accent focus:font-accent focus:text-sm focus:tracking-[0.1em]"
      >
        Skip to content
      </a>
      <Header artists={artists} />
      <CartDrawer />
      <main id="main" tabIndex={-1} className="flex-grow flex flex-col">
        {children}
      </main>
      <Footer artists={artists} />
      {conceptsEnabled && <ConceptSwitcher />}
    </div>
  );
}
