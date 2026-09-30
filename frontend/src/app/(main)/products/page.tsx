import { getProductsFiltered, getProductTypes, getArtistsWithMetadata, type SortOption } from '@/lib/supabase/queries';
import { degrade } from '@/lib/result';
import { ProductsGrid } from '@/features/product/ProductsGrid';
import { ProductToolbar } from '@/features/catalog/ProductToolbar';
import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/jsonld';

export const metadata = {
  title: 'All Concert Merchandise | Shop 50+ Artists',
  description: 'Browse our complete collection of premium concert merchandise for 50+ artists. Coldplay, Diljit Dosanjh, Karan Aujla, Ed Sheeran & more. Free shipping above ₹1,999.',
  alternates: { canonical: '/products' },
};

interface ProductsPageProps {
  searchParams: Promise<{
    page?: string;
    type?: string;
    artist?: string;
    sort?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const rawPage = parseInt(params.page || '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 100) : 1;
  const pageSize = 20;
  const artistFilter = params.artist || undefined;
  const typeFilter = params.type || undefined;
  const sortBy = (params.sort as SortOption) || 'newest';

  // The product list is load-bearing: a failed read throws and the error
  // boundary renders. Filter metadata is optional: on failure the page still
  // renders, just without the artist/type filter rows.
  const [{ data: products, count }, typesResult, artistsResult] = await Promise.all([
    getProductsFiltered({
      artist: artistFilter,
      productType: typeFilter,
      page,
      pageSize,
      sortBy,
    }),
    degrade(getProductTypes(), [] as string[], 'products:types', 'products'),
    degrade(getArtistsWithMetadata(), [], 'products:artists', 'collections'),
  ]);
  const productTypes = typesResult.ok ? typesResult.value : [];
  const artists = artistsResult.ok ? artistsResult.value : [];

  // Find the current artist for styling
  const currentArtist = artistFilter
    ? artists.find(a => a.vendorName.toLowerCase() === artistFilter.toLowerCase()) || null
    : null;

  const hasFilters = artistFilter || typeFilter;
  const baseFilters = { artist: artistFilter, type: typeFilter, sort: sortBy };

  return (
    <main className="min-h-screen bg-noir-950 pt-24 pb-16">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Products', url: '/products' },
        ])}
      />
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div
            className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: currentArtist
                ? `${currentArtist.accentColor}15`
                : 'rgba(212, 175, 55, 0.1)'
            }}
          >
            <ShoppingBag
              className="w-8 h-8"
              style={{ color: currentArtist?.accentColor || '#D4AF37' }}
            />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-ivory-50 mb-4">
            {currentArtist ? currentArtist.name : typeFilter || 'All Products'}
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 max-w-2xl mx-auto">
            {count} {count === 1 ? 'product' : 'products'} available
            {currentArtist && ` from ${currentArtist.name}`}
            {typeFilter && !currentArtist && ` in ${typeFilter}`}
          </p>
        </div>

        <ProductToolbar
          artists={artists}
          productTypes={productTypes}
          baseFilters={baseFilters}
          artistFilter={artistFilter}
          typeFilter={typeFilter}
          sortBy={sortBy}
          currentArtist={currentArtist}
        />

        {/* Product Grid */}
        {products.length > 0 ? (
          <ProductsGrid
            initialProducts={products}
            totalCount={count}
            filters={{
              artist: artistFilter,
              type: typeFilter,
              sort: sortBy,
            }}
            pageSize={pageSize}
          />
        ) : (
          <div className="text-center py-16">
            <ShoppingBag className="w-16 h-16 mx-auto text-ivory-600 mb-4" />
            <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 mb-4">
              No products found{hasFilters ? ' with the selected filters' : ''}.
            </p>
            {hasFilters && (
              <Link
                href="/products"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors"
              >
                Clear Filters
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
