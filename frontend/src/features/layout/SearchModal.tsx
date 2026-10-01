'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X, Loader2, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn, formatPrice } from '@yord/ui';
import { getFirstByPosition } from '@/lib/product';
import { buildSearchOrFilter } from '@/lib/search';
import type { ProductWithDetails } from '@yord/db-types';
import { ARTISTS, ARTIST_COLLECTION_HANDLES } from '@yord/db-types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QuickSearch {
  label: string;
  type: 'artist' | 'category';
  accentColor?: string;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [popularSearches, setPopularSearches] = useState<QuickSearch[]>([]);
  const searchRequestId = useRef(0);

  // Fetch popular searches (artists from collections + categories)
  useEffect(() => {
    async function fetchPopularSearches() {
      const supabase = createClient();
      // Get artist collections that have products
      const { data: collections } = await supabase
        .from('collections')
        .select('id, title, handle')
        .in('handle', ARTIST_COLLECTION_HANDLES as unknown as string[]);

      if (collections) {
        // Single query for all counts (not one per collection)
        const ids = (collections as { id: number }[]).map((c) => c.id);
        const { data: allCollects } = await supabase
          .from('collects')
          .select('collection_id')
          .in('collection_id', ids);
        const counts = new Map<number, number>();
        for (const row of (allCollects as { collection_id: number }[] | null) || []) {
          counts.set(row.collection_id, (counts.get(row.collection_id) || 0) + 1);
        }

        const artistsWithCounts = (collections as { id: number; title: string; handle: string | null }[]).map((col) => ({
          ...col,
          productCount: counts.get(col.id) || 0,
        }));

        // Filter to artists with products and take top 4
        const topArtists = artistsWithCounts
          .filter(a => a.productCount > 0)
          .sort((a, b) => b.productCount - a.productCount)
          .slice(0, 4);

        // Build quick searches: artists with metadata + fallback categories
        const artistSearches: QuickSearch[] = topArtists.map(col => {
          const handle = col.handle || '';
          const metadata = ARTISTS[handle];
          return {
            label: col.title,
            type: 'artist' as const,
            accentColor: metadata?.accentColor,
          };
        });

        const categorySearches: QuickSearch[] = [
          { label: 'T-Shirts', type: 'category' },
          { label: 'Hoodies', type: 'category' },
        ];

        setPopularSearches([...artistSearches, ...categorySearches]);
      }
    }

    fetchPopularSearches();
  }, []);

  // Focus input when modal opens (external DOM sync stays synchronous);
  // reset-on-close deferred to avoid cascading render.
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
    queueMicrotask(() => {
      setQuery('');
      setResults([]);
      setHasSearched(false);
    });
  }, [isOpen]);

  // Escape to close + body scroll lock, active only while open.
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  // Debounced search
  const searchProducts = useCallback(async (searchQuery: string) => {
    const q = searchQuery.trim().slice(0, 100);
    if (!q || q.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const requestId = ++searchRequestId.current;
    setIsLoading(true);
    setHasSearched(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_variants (
            id, title, price, compare_at_price,
            inventory_quantity, position
          ),
          product_images (
            id, src, supabase_url, alt, position
          )
        `)
        .eq('status', 'active')
        .or(buildSearchOrFilter(q))
        .order('published_at', { ascending: false })
        .limit(8);

      if (requestId !== searchRequestId.current) return;
      if (!error && data) {
        setResults(data as unknown as ProductWithDetails[]);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      if (requestId === searchRequestId.current) setIsLoading(false);
    }
  }, []);

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchProducts]);

  const handleProductClick = (handle: string) => {
    onClose();
    router.push(`/product/${handle}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search products">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-surface-page/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative max-w-3xl mx-auto mt-20 px-4">
        <div className="bg-surface-card border border-border-default shadow-2xl">
          {/* Search Input */}
          <div className="flex items-center border-b border-border-default">
            <Search className="w-5 h-5 text-text-muted ml-6" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, artists, collections..."
              aria-label="Search products, artists, collections"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="search-results-list"
              className="flex-1 px-4 py-5 bg-transparent text-text-secondary font-[family-name:var(--font-jakarta)] placeholder:text-text-muted"
            />
            {isLoading && (
              <Loader2 className="w-5 h-5 text-accent animate-spin mr-4" aria-label="Searching" />
            )}
            <button
              onClick={onClose}
              aria-label="Close search"
              className="p-4 text-text-muted hover:text-text-secondary transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {!hasSearched && query.length < 2 && (
              <div className="p-8 text-center">
                <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
                  Start typing to search for products
                </p>
              </div>
            )}

            {hasSearched && results.length === 0 && !isLoading && (
              <div className="p-8 text-center">
                <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
                  No products found for &quot;{query}&quot;
                </p>
                <p className="font-[family-name:var(--font-jakarta)] text-xs text-text-muted mt-2">
                  Try searching for an artist name or product type
                </p>
              </div>
            )}

            {results.length > 0 && (
              <>
                <div id="search-results-list" role="listbox" aria-label="Search results" className="divide-y divide-border-default">
                  {results.map((product) => {
                    const image = getFirstByPosition(product.product_images);
                    const imageUrl = image?.supabase_url || image?.src;
                    const variant = getFirstByPosition(product.product_variants);
                    const price = variant?.price || 0;

                    return (
                      <button
                        key={product.id}
                        onClick={() => handleProductClick(product.handle ?? '')}
                        className="w-full flex items-center gap-4 p-4 hover:bg-surface-raised/50 transition-colors text-left"
                      >
                        {/* Image */}
                        <div className="relative w-16 h-16 bg-surface-raised flex-shrink-0">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={product.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-text-muted">
                              <Search size={20} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          {product.vendor && (
                            <p className="font-[family-name:var(--font-jakarta)] text-xs text-accent uppercase tracking-wider">
                              {product.vendor}
                            </p>
                          )}
                          <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-secondary truncate">
                            {product.title}
                          </p>
                          <p className="font-[family-name:var(--font-bebas)] text-sm text-text-muted mt-1">
                            {formatPrice(price)}
                          </p>
                        </div>

                        {/* Arrow */}
                        <ArrowRight className="w-4 h-4 text-text-muted" />
                      </button>
                    );
                  })}
                </div>

                {/* View All Results Link */}
                <div className="p-4 border-t border-border-default">
                  <Link
                    href={`/search?q=${encodeURIComponent(query)}`}
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 py-3 text-accent font-[family-name:var(--font-bebas)] text-sm tracking-wider hover:text-accent-hover transition-colors"
                  >
                    VIEW ALL RESULTS
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Quick Links */}
          <div className="border-t border-border-default p-4">
            <p className="font-[family-name:var(--font-jakarta)] text-xs text-text-muted uppercase tracking-wider mb-3">
              Popular Searches
            </p>
            <div className="flex flex-wrap gap-2">
              {popularSearches.map((item) => (
                <button
                  key={item.label}
                  onClick={() => setQuery(item.label)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-[family-name:var(--font-jakarta)] transition-colors',
                    item.type === 'artist' && item.accentColor
                      ? 'hover:opacity-80'
                      : 'bg-surface-raised text-text-muted hover:bg-surface-inset'
                  )}
                  style={
                    item.type === 'artist' && item.accentColor
                      ? {
                          backgroundColor: `${item.accentColor}20`,
                          color: item.accentColor,
                          border: `1px solid ${item.accentColor}40`,
                        }
                      : undefined
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
