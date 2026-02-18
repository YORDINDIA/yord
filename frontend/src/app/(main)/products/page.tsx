import { getProductsFiltered, getProductTypes, getArtistsWithMetadata, type SortOption } from '@/lib/supabase/queries';
import { ProductsGrid } from '@/components/product/ProductsGrid';
import { ShoppingBag, X, ChevronDown } from 'lucide-react';
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

function buildFilterUrl(
  baseFilters: { artist?: string; type?: string; sort?: string },
  overrides: { artist?: string | null; type?: string | null; sort?: string | null }
): string {
  const params = new URLSearchParams();

  // Merge base filters with overrides (null means remove the filter)
  const artist = overrides.artist === null ? undefined : (overrides.artist ?? baseFilters.artist);
  const type = overrides.type === null ? undefined : (overrides.type ?? baseFilters.type);
  const sort = overrides.sort === null ? undefined : (overrides.sort ?? baseFilters.sort);

  if (artist) params.set('artist', artist);
  if (type) params.set('type', type);
  if (sort && sort !== 'newest') params.set('sort', sort);

  const queryString = params.toString();
  return queryString ? `/products?${queryString}` : '/products';
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || '1');
  const pageSize = 20;
  const artistFilter = params.artist || undefined;
  const typeFilter = params.type || undefined;
  const sortBy = (params.sort as SortOption) || 'newest';

  const [{ data: products, count }, productTypes, artists] = await Promise.all([
    getProductsFiltered({
      artist: artistFilter,
      productType: typeFilter,
      page,
      pageSize,
      sortBy,
    }),
    getProductTypes(),
    getArtistsWithMetadata(),
  ]);

  // Find the current artist for styling
  const currentArtist = artistFilter
    ? artists.find(a => a.vendorName.toLowerCase() === artistFilter.toLowerCase())
    : null;

  const hasFilters = artistFilter || typeFilter;
  const baseFilters = { artist: artistFilter, type: typeFilter, sort: sortBy };

  // Sort options
  const sortOptions = [
    { value: 'newest', label: 'Newest' },
    { value: 'price-asc', label: 'Price: Low to High' },
    { value: 'price-desc', label: 'Price: High to Low' },
    { value: 'title', label: 'Alphabetical' },
  ];

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

        {/* Active Filters */}
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.1em] text-ivory-500">
              ACTIVE FILTERS:
            </span>
            {artistFilter && currentArtist && (
              <Link
                href={buildFilterUrl(baseFilters, { artist: null })}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-[family-name:var(--font-jakarta)] transition-colors"
                style={{
                  backgroundColor: `${currentArtist.accentColor}20`,
                  color: currentArtist.accentColor,
                  border: `1px solid ${currentArtist.accentColor}40`
                }}
              >
                {currentArtist.name}
                <X size={14} />
              </Link>
            )}
            {typeFilter && (
              <Link
                href={buildFilterUrl(baseFilters, { type: null })}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-noir-800 border border-noir-600 text-ivory-300 text-sm font-[family-name:var(--font-jakarta)] hover:border-ivory-500 transition-colors"
              >
                {typeFilter}
                <X size={14} />
              </Link>
            )}
            <Link
              href="/products"
              className="px-3 py-1.5 text-ivory-500 text-sm font-[family-name:var(--font-jakarta)] hover:text-ivory-300 transition-colors"
            >
              Clear all
            </Link>
          </div>
        )}

        {/* Filters Row */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-8">
          {/* Artist Filters */}
          <div className="flex-1">
            <div className="flex flex-wrap gap-2">
              <span className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.1em] text-ivory-400 py-2 mr-2">
                ARTISTS:
              </span>
              {artists.map((artist) => {
                const isActive = artistFilter?.toLowerCase() === artist.vendorName.toLowerCase();
                return (
                  <Link
                    key={artist.handle}
                    href={isActive
                      ? buildFilterUrl(baseFilters, { artist: null })
                      : buildFilterUrl(baseFilters, { artist: artist.vendorName })
                    }
                    className="px-4 py-2 text-sm font-[family-name:var(--font-jakarta)] transition-all duration-200"
                    style={isActive ? {
                      backgroundColor: `${artist.accentColor}20`,
                      borderColor: artist.accentColor,
                      color: artist.accentColor,
                      border: '1px solid',
                    } : {
                      backgroundColor: 'rgb(23, 23, 23)',
                      borderColor: 'rgb(55, 55, 55)',
                      color: 'rgb(214, 211, 209)',
                      border: '1px solid',
                    }}
                  >
                    {artist.name}
                    {artist.productCount && (
                      <span className="ml-1.5 text-xs opacity-60">({artist.productCount})</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.1em] text-ivory-400">
              SORT:
            </span>
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 bg-noir-900 border border-noir-700 text-ivory-300 text-sm font-[family-name:var(--font-jakarta)] hover:border-gold-200 transition-colors min-w-[180px]">
                {sortOptions.find(o => o.value === sortBy)?.label || 'Newest'}
                <ChevronDown size={16} className="ml-auto" />
              </button>
              <div className="absolute top-full right-0 mt-1 bg-noir-900 border border-noir-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 min-w-[180px]">
                {sortOptions.map((option) => (
                  <Link
                    key={option.value}
                    href={buildFilterUrl(baseFilters, { sort: option.value })}
                    className={`block px-4 py-2 text-sm font-[family-name:var(--font-jakarta)] hover:bg-noir-800 transition-colors ${
                      sortBy === option.value ? 'text-gold-200' : 'text-ivory-300'
                    }`}
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Category Filters */}
        {productTypes.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <span className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.1em] text-ivory-400 py-2 mr-2">
              CATEGORIES:
            </span>
            {productTypes.map((type) => {
              const isActive = typeFilter === type;
              return (
                <Link
                  key={type}
                  href={isActive
                    ? buildFilterUrl(baseFilters, { type: null })
                    : buildFilterUrl(baseFilters, { type })
                  }
                  className={`px-4 py-2 border text-sm font-[family-name:var(--font-jakarta)] transition-colors ${
                    isActive
                      ? 'bg-gold-200/20 border-gold-200 text-gold-200'
                      : 'bg-noir-900 border-noir-700 text-ivory-300 hover:border-gold-200'
                  }`}
                >
                  {type}
                </Link>
              );
            })}
          </div>
        )}

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
