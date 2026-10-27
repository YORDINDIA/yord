import type { Metadata } from 'next';
import { getProductsFiltered, getProductTypes, getArtistsWithMetadata } from '@/lib/supabase/queries';
import { getCatalogSizesCached } from '@/lib/supabase/cached-queries';
import { degrade } from '@/lib/result';
import { CatalogGrid } from '@/features/catalog/CatalogGrid';
import { CatalogLayout } from '@/features/catalog/CatalogLayout';
import { CatalogFilterProvider } from '@/features/catalog/CatalogFilterContext';
import type { ProductsQuery } from '@/hooks/useProductsInfinite';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/jsonld';

const PAGE_SIZE = 24;

/**
 * Prerendered once an hour, served from the R2 incremental cache after that.
 *
 * This page used to `await searchParams` in both the component and
 * `generateMetadata`, which is a dynamic API in Next: it opted the whole route
 * out of static rendering, so every request re-ran four Supabase reads and a
 * full React render. On Workers Free — 10 ms CPU per invocation against a
 * ~52 ms render — that was the largest single source of `exceededResources`.
 *
 * Filters now live in `CatalogFilterProvider`, which reads the query string
 * after hydration and pages through `GET /api/products`. The canonical,
 * unfiltered page 1 is the only thing rendered here.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'All Concert Merchandise | Shop 65+ Artists',
  description:
    'Browse our complete collection of premium concert merchandise for 65+ artists. Coldplay, Diljit Dosanjh, Karan Aujla, Ed Sheeran & more. Free shipping on every order.',
  alternates: { canonical: '/products' },
};

export default async function ProductsPage() {
  // The product list is load-bearing: a failed read throws and the error
  // boundary renders. Facet lists are optional: on failure the panel drops them.
  const [{ data: products, count }, typesResult, artistsResult, sizesResult] = await Promise.all([
    getProductsFiltered({ page: 1, pageSize: PAGE_SIZE, sortBy: 'newest' }, { useStatic: true }),
    degrade(getProductTypes(true), [] as string[], 'products:types', 'products'),
    degrade(getArtistsWithMetadata(true), [], 'products:artists', 'collections'),
    degrade(getCatalogSizesCached(), [] as string[], 'products:sizes', 'products'),
  ]);

  const baseQuery: ProductsQuery = { mode: 'filter', sort: 'newest', pageSize: PAGE_SIZE };

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Products', url: '/products' },
        ])}
      />
      <CatalogFilterProvider path="/products" baseQuery={baseQuery} initialCount={count}>
        <CatalogLayout
          title="All products"
          count={count}
          description="Premium concert merchandise for 65+ artists. Free shipping on every order."
          facets={{
            artists: artistsResult.ok ? artistsResult.value : [],
            types: typesResult.ok ? typesResult.value : [],
            sizes: sizesResult.ok ? sizesResult.value : [],
          }}
        >
          <CatalogGrid
            initialProducts={products}
            totalCount={count}
            initialPage={1}
            query={baseQuery}
            emptyTitle="No products found"
            emptyMessage="Check back soon for new arrivals."
            pageOneHref="/products"
          />
        </CatalogLayout>
      </CatalogFilterProvider>
    </>
  );
}
