import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/layout/CartDrawer';
import { getArtistsWithMetadata } from '@/lib/supabase/queries';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const artists = await getArtistsWithMetadata();

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
