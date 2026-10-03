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
      <Header artists={artists} />
      <CartDrawer />
      <div className="flex-grow flex flex-col">
        {children}
      </div>
      <Footer artists={artists} />
      {conceptsEnabled && <ConceptSwitcher />}
    </div>
  );
}
