import { getProductsFiltered, getProductTypes, getArtistsWithMetadata } from '@/lib/supabase/queries';
import { degrade } from '@/lib/result';
import { parseSortParam, parsePageParam } from '@/lib/product';
import { CatalogGrid } from '@/features/catalog/CatalogGrid';
import { ProductToolbar } from '@/features/catalog/ProductToolbar';
import { buildFilterUrl } from '@/features/catalog/catalogUrl';
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
  const page = parsePageParam(params.page);
  const pageSize = 20;
  const artistFilter = params.artist || undefined;
  const typeFilter = params.type || undefined;
  const sortBy = parseSortParam(params.sort);

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
    <main className="min-h-screen bg-surface-page pt-24 pb-16">
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
              style={{ color: 'var(--accent)' }}
            />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-text-primary mb-4">
            {currentArtist ? currentArtist.name : typeFilter || 'All Products'}
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-text-muted max-w-2xl mx-auto">
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

        {/* Product Grid — page 1 is SSR HTML; pages 2+ append via /api/products */}
        {products.length > 0 ? (
          <CatalogGrid
            initialProducts={products}
            totalCount={count}
            initialPage={page}
            query={{
              mode: 'filter',
              artist: artistFilter,
              type: typeFilter,
              sort: sortBy,
              pageSize,
            }}
          />
        ) : page > 1 && count > 0 ? (
          // A `?page=` past the end is not an empty catalog: the header above
          // says how many products exist, so say the same thing here (the
          // collection grid makes the identical distinction).
          <div className="text-center py-16">
            <ShoppingBag className="w-16 h-16 mx-auto text-text-muted mb-4" />
            <p className="font-[family-name:var(--font-playfair)] text-2xl text-text-muted mb-4">
              Nothing on this page
            </p>
            <p className="font-[family-name:var(--font-jakarta)] text-text-muted mb-8">
              Page {page} is past the end of this list of {count} products.
            </p>
            <Link
              href={buildFilterUrl(baseFilters, {})}
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-text-on-accent font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-accent-hover transition-colors"
            >
              BACK TO PAGE 1
            </Link>
          </div>
        ) : (
          <div className="text-center py-16">
            <ShoppingBag className="w-16 h-16 mx-auto text-text-muted mb-4" />
            <p className="font-[family-name:var(--font-jakarta)] text-text-muted mb-4">
              No products found{hasFilters ? ' with the selected filters' : ''}.
            </p>
            {hasFilters && (
              <Link
                href="/products"
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-text-on-accent font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-accent-hover transition-colors"
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
