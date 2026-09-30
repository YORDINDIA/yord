'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { ProductWithDetails } from '@yord/db-types';
import type { SortOption } from '@/lib/product';

export type ProductsQueryMode = 'filter' | 'collection' | 'artist';

export interface ProductsQuery {
  mode: ProductsQueryMode;
  handle?: string;
  artist?: string;
  type?: string;
  sort: SortOption;
  pageSize: number;
}

export interface ProductsPageData {
  data: ProductWithDetails[];
  count: number;
  page: number;
  pageSize: number;
}

async function fetchProductsPage(query: ProductsQuery, page: number): Promise<ProductsPageData> {
  const params = new URLSearchParams({
    mode: query.mode,
    sort: query.sort,
    page: String(page),
    pageSize: String(query.pageSize),
  });
  if (query.handle) params.set('handle', query.handle);
  if (query.artist) params.set('artist', query.artist);
  if (query.type) params.set('type', query.type);

  const res = await fetch(`/api/products?${params.toString()}`);
  if (!res.ok) throw new Error(`Catalog request failed (${res.status})`);
  return res.json();
}

/**
 * Infinite catalog pages. Page 1 comes from SSR (`initial`) so the first
 * paint is SEO HTML; pages 2+ load from `GET /api/products` via the same
 * server helpers. `getNextPageParam` stops when loaded rows reach `count`.
 */
export function useProductsInfinite(
  query: ProductsQuery,
  initial: ProductsPageData,
  initialPage = 1,
) {
  return useInfiniteQuery({
    queryKey: ['products', query, initialPage],
    queryFn: ({ pageParam }) => fetchProductsPage(query, pageParam),
    initialPageParam: initialPage,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.flatMap((p) => p.data).length;
      return loaded < lastPage.count ? lastPage.page + 1 : undefined;
    },
    initialData: { pages: [initial], pageParams: [initialPage] },
    staleTime: 60_000,
  });
}
