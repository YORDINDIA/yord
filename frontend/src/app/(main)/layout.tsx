import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/layout/CartDrawer';
import { getArtistsWithMetadata } from '@/lib/supabase/queries';
import { degrade } from '@/lib/result';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Header nav metadata is optional: a failed read degrades to an empty
  // artist menu rather than taking down every page under `(main)`.
  const artistsResult = await degrade(getArtistsWithMetadata(), [], 'layout:artists', 'collections');
  const artists = artistsResult.ok ? artistsResult.value : [];

  return (
    <div className="flex flex-col min-h-screen">
      <Header artists={artists} />
      <CartDrawer />
      <div className="flex-grow flex flex-col">
        {children}
      </div>
      <Footer />
    </div>
  );
}
