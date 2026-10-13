import type { Metadata } from 'next';
import { ARTISTS } from '@yord/db-types';
import { getProductsFiltered, getProductTypes, getArtistsWithMetadata } from '@/lib/supabase/queries';
import { getCatalogSizesCached } from '@/lib/supabase/cached-queries';
import { degrade } from '@/lib/result';
import { parseSortParam, parsePageParam } from '@/lib/product';
import { parseCatalogFilters } from '@/lib/catalogFilters';
import { CatalogGrid } from '@/features/catalog/CatalogGrid';
import { CatalogLayout } from '@/features/catalog/CatalogLayout';
import { buildFilterUrl, type CatalogFilters } from '@/features/catalog/catalogUrl';
import { CtaLink } from '@/features/ui/CtaLink';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/jsonld';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 24;

/** The heading names the narrowest filter the shopper chose. */
function headingFor(f: ReturnType<typeof parseCatalogFilters>, artistName?: string): string {
  if (artistName && f.type) return `${artistName} ${f.type}`;
  if (artistName) return artistName;
  if (f.type) return f.type;
  return 'All products';
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const f = parseCatalogFilters(await searchParams);
  if (!f.artist && !f.type && !f.size && !f.price && !f.stock) {
    return {
      title: 'All Concert Merchandise | Shop 65+ Artists',
      description:
        'Browse our complete collection of premium concert merchandise for 65+ artists. Coldplay, Diljit Dosanjh, Karan Aujla, Ed Sheeran & more. Free shipping on every order.',
      alternates: { canonical: '/products' },
    };
  }
  const artistName = f.artist ? (ARTISTS[f.artist]?.name ?? f.artist.replace(/-/g, ' ')) : undefined;
  const subject = [artistName, f.type].filter(Boolean).join(' ') || 'Concert';
  // Artist and category views are pages worth indexing; size, price and stock
  // are facets of them.
  const canonical = buildFilterUrl({ artist: f.artist, type: f.type }, {});
  return {
    title: `${subject} Merchandise`,
    description: `Shop ${subject} merchandise at YORD India. Free shipping on every order.`,
    alternates: { canonical },
    ...(f.size || f.price || f.stock ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = parsePageParam(params.page);
  const filters = parseCatalogFilters(params);
  const sortBy = parseSortParam(params.sort);

  // The product list is load-bearing: a failed read throws and the error
  // boundary renders. Facet lists are optional: on failure the panel drops them.
  const [{ data: products, count }, typesResult, artistsResult, sizesResult] = await Promise.all([
    getProductsFiltered({
      artist: filters.artist,
      productType: filters.type,
      size: filters.size,
      price: filters.price,
      stock: filters.stock,
      page,
      pageSize: PAGE_SIZE,
      sortBy,
    }),
    degrade(getProductTypes(), [] as string[], 'products:types', 'products'),
    degrade(getArtistsWithMetadata(), [], 'products:artists', 'collections'),
    degrade(getCatalogSizesCached(), [] as string[], 'products:sizes', 'products'),
  ]);
  const artists = artistsResult.ok ? artistsResult.value : [];
  const currentArtist = filters.artist ? artists.find((a) => a.handle === filters.artist) : undefined;

  const rawFilters: CatalogFilters = {
    artist: filters.artist,
    type: filters.type,
    size: filters.size,
    price: filters.price,
    stock: filters.stock ? '1' : undefined,
    sort: sortBy,
  };
  const hasFilters = Boolean(filters.artist || filters.type || filters.size || filters.price || filters.stock);

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Products', url: '/products' },
        ])}
      />
      <CatalogLayout
        title={headingFor(filters, currentArtist?.name ?? filters.artist)}
        count={count}
        // Filtered views list their filters under the bar instead.
        description={hasFilters ? undefined : 'Premium concert merchandise for 65+ artists. Free shipping on every order.'}
        facets={{
          filters: rawFilters,
          path: '/products',
          sortBy,
          artists,
          types: typesResult.ok ? typesResult.value : [],
          sizes: sizesResult.ok ? sizesResult.value : [],
        }}
      >
        {/* Page 1 is SSR HTML; pages 2+ append via /api/products. The grid owns
            the empty, page-overflow and failed-read states. */}
        <CatalogGrid
          initialProducts={products}
          totalCount={count}
          initialPage={page}
          query={{
            mode: 'filter',
            artist: filters.artist,
            type: filters.type,
            size: filters.size,
            price: filters.price,
            stock: filters.stock,
            sort: sortBy,
            pageSize: PAGE_SIZE,
          }}
          emptyTitle={hasFilters ? 'Nothing matches these filters' : 'No products found'}
          emptyMessage={hasFilters ? 'Try removing a filter.' : 'Check back soon for new arrivals.'}
          emptyAction={hasFilters ? <CtaLink href="/products">Clear filters</CtaLink> : undefined}
          // Page 1 of the *filtered* list, so a deep `?page=` keeps the filters.
          pageOneHref={buildFilterUrl(rawFilters, {})}
        />
      </CatalogLayout>
    </>
  );
}
