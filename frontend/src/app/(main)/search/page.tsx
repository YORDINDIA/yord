'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { ProductCard } from '@/features/ui/ProductCard';
import { Container } from '@/features/ui/Container';
import { CtaLink } from '@/features/ui/CtaLink';
import { EmptyState } from '@/features/ui/EmptyState';
import { ErrorState } from '@/features/ui/ErrorState';
import { IconButton } from '@/features/ui/IconButton';
import { Skeleton } from '@/features/ui/Skeleton';
import { track } from '@/lib/analytics/track';
import type { ProductWithDetails } from '@yord/db-types';

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';

  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [searchInput, setSearchInput] = useState(query);

  const searchProducts = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setProducts([]);
      setIsError(false);
      return;
    }

    setIsLoading(true);
    setIsError(false);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      // A non-ok response is a failed read, not "no matches": rendering the
      // empty copy for it told the shopper their term had no results when the
      // request had actually failed.
      if (!response.ok) throw new Error(`Search failed (${response.status})`);
      const data = await response.json();
      const results = data.products || [];
      setProducts(results);
      // One event per submitted query (this runs from the URL-sync effect,
      // never per keystroke). Zero-result searches feed the admin's
      // merchandising-gap list, so the term is tracked even at 0.
      track({
        type: 'search_performed',
        term: searchQuery.trim().slice(0, 128),
        results: results.length,
      });
    } catch (error) {
      console.error('Search error:', error);
      setIsError(true);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync URL query param (external navigation state) to input + results; deferred to avoid cascading render.
  useEffect(() => {
    if (query) {
      const q = query;
      queueMicrotask(() => {
        setSearchInput(q);
        void searchProducts(q);
      });
    }
  }, [query, searchProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  const clearSearch = () => {
    setSearchInput('');
    setProducts([]);
    setIsError(false);
    router.push('/search');
  };

  return (
    <div className="min-h-screen bg-surface-page pt-24 pb-16">
      <Container>
        {/* Search Header */}
        <div className="mb-12">
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl text-text-primary mb-6">
            Search
          </h1>

          {/* Search Form */}
          <form onSubmit={handleSearch} role="search" className="max-w-2xl">
            <div className="relative">
              <input
                type="search"
                name="q"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search for products, artists..."
                aria-label="Search products and artists"
                autoComplete="off"
                className="w-full h-14 pl-14 pr-14 bg-surface-card border border-border-strong text-text-primary font-body placeholder:text-text-muted focus:border-accent"
              />
              <Search
                aria-hidden="true"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted"
              />
              {searchInput && (
                <IconButton
                  label="Clear search"
                  variant="ghost"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X size={20} />
                </IconButton>
              )}
            </div>
          </form>
        </div>

        {/* Results */}
        {query && !isError && (
          <div className="mb-8">
            <p role="status" aria-live="polite" className="font-body text-text-muted">
              {isLoading ? (
                'Searching...'
              ) : (
                <>
                  {products.length} result{products.length !== 1 ? 's' : ''} for{' '}
                  <span className="text-text-secondary">&quot;{query}&quot;</span>
                </>
              )}
            </p>
          </div>
        )}

        {/* Product Grid */}
        {isLoading ? (
          <Skeleton variant="product-grid" count={8} />
        ) : isError ? (
          <ErrorState
            as="h2"
            title="Search failed"
            message="We could not reach the catalogue. Check your connection and try again."
            onRetry={() => searchProducts(query)}
            retryLabel="Retry search"
            showHomeLink={false}
          />
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 4} />
            ))}
          </div>
        ) : query ? (
          <EmptyState
            title="No products found"
            message={`Nothing matches "${query}". Try different keywords, or browse the full catalogue.`}
          >
            <CtaLink href="/products">Browse all products</CtaLink>
          </EmptyState>
        ) : (
          <EmptyState
            title="Search the catalogue"
            message="Enter a term above to find products and artists."
          />
        )}
      </Container>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-page pt-24 pb-16">
        <Container>
          <Skeleton variant="text-block" className="mb-6 max-w-xs" />
          <Skeleton variant="product-grid" count={8} />
        </Container>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
