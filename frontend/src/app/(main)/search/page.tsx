'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { ProductCard } from '@/components/ui/ProductCard';
import type { ProductWithDetails } from '@/types/database';

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';

  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(query);

  const searchProducts = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setProducts([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Search error:', error);
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
    router.push('/search');
  };

  return (
    <main className="min-h-screen bg-noir-950 pt-24 pb-16">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Search Header */}
        <div className="mb-12">
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl md:text-4xl lg:text-5xl text-ivory-50 mb-6">
            Search
          </h1>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="max-w-2xl">
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search for products, artists..."
                className="w-full h-14 pl-14 pr-12 bg-noir-900 border border-noir-700 text-ivory-50 font-[family-name:var(--font-jakarta)] placeholder:text-ivory-500 focus:outline-none focus:border-gold-200"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ivory-400" />
              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ivory-400 hover:text-ivory-100"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Results */}
        {query && (
          <div className="mb-8">
            <p className="font-[family-name:var(--font-jakarta)] text-ivory-400">
              {isLoading ? (
                'Searching...'
              ) : (
                <>
                  {products.length} result{products.length !== 1 ? 's' : ''} for{' '}
                  <span className="text-ivory-100">&quot;{query}&quot;</span>
                </>
              )}
            </p>
          </div>
        )}

        {/* Product Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-noir-800" />
                <div className="pt-4 space-y-2">
                  <div className="h-4 bg-noir-800 w-1/3" />
                  <div className="h-5 bg-noir-800 w-2/3" />
                  <div className="h-4 bg-noir-800 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : query ? (
          <div className="text-center py-16">
            <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 mb-4">
              No products found matching your search.
            </p>
            <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-500">
              Try different keywords or browse our collections.
            </p>
          </div>
        ) : (
          <div className="text-center py-16">
            <Search className="w-16 h-16 mx-auto text-ivory-600 mb-4" />
            <p className="font-[family-name:var(--font-jakarta)] text-ivory-400">
              Enter a search term to find products
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-noir-950 pt-24 pb-16">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="animate-pulse">
            <div className="h-12 bg-noir-800 w-48 mb-6" />
            <div className="h-14 bg-noir-800 max-w-2xl" />
          </div>
        </div>
      </main>
    }>
      <SearchContent />
    </Suspense>
  );
}
