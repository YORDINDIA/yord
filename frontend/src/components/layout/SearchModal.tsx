'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X, Loader2, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { ProductWithDetails } from '@/types/database';
import { ARTISTS, ARTIST_COLLECTION_HANDLES } from '@/types/database';

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

  const supabase = createClient();

  // Fetch popular searches (artists from collections + categories)
  useEffect(() => {
    async function fetchPopularSearches() {
      // Get artist collections that have products
      const { data: collections } = await supabase
        .from('collections')
        .select('id, title, handle')
        .in('handle', ARTIST_COLLECTION_HANDLES as unknown as string[]);

      if (collections) {
        // Get counts for each collection
        const artistsWithCounts = await Promise.all(
          (collections as { id: number; title: string; handle: string | null }[]).map(async (col) => {
            const { count } = await supabase
              .from('collects')
              .select('*', { count: 'exact', head: true })
              .eq('collection_id', col.id);

            return {
              ...col,
              productCount: count || 0,
            };
          })
        );

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
  }, [supabase]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
      setHasSearched(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Debounced search
  const searchProducts = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
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
        .or(`title.ilike.%${searchQuery}%,vendor.ilike.%${searchQuery}%,tags.ilike.%${searchQuery}%`)
        .order('published_at', { ascending: false })
        .limit(8);

      if (!error && data) {
        setResults(data as ProductWithDetails[]);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-noir-950/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative max-w-3xl mx-auto mt-20 px-4">
        <div className="bg-noir-900 border border-noir-800 shadow-2xl">
          {/* Search Input */}
          <div className="flex items-center border-b border-noir-800">
            <Search className="w-5 h-5 text-ivory-500 ml-6" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, artists, collections..."
              className="flex-1 px-4 py-5 bg-transparent text-ivory-100 font-[family-name:var(--font-jakarta)] placeholder:text-ivory-500 focus:outline-none"
            />
            {isLoading && (
              <Loader2 className="w-5 h-5 text-gold-200 animate-spin mr-4" />
            )}
            <button
              onClick={onClose}
              className="p-4 text-ivory-500 hover:text-ivory-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {!hasSearched && query.length < 2 && (
              <div className="p-8 text-center">
                <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-500">
                  Start typing to search for products
                </p>
              </div>
            )}

            {hasSearched && results.length === 0 && !isLoading && (
              <div className="p-8 text-center">
                <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
                  No products found for &quot;{query}&quot;
                </p>
                <p className="font-[family-name:var(--font-jakarta)] text-xs text-ivory-500 mt-2">
                  Try searching for an artist name or product type
                </p>
              </div>
            )}

            {results.length > 0 && (
              <>
                <div className="divide-y divide-noir-800">
                  {results.map((product) => {
                    const image = product.product_images?.find(
                      (img) => img.position === 1
                    );
                    const imageUrl = image?.supabase_url || image?.src;
                    const variant = product.product_variants?.[0];
                    const price = variant?.price || 0;

                    return (
                      <button
                        key={product.id}
                        onClick={() => handleProductClick(product.handle)}
                        className="w-full flex items-center gap-4 p-4 hover:bg-noir-800/50 transition-colors text-left"
                      >
                        {/* Image */}
                        <div className="relative w-16 h-16 bg-noir-800 flex-shrink-0">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={product.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-ivory-600">
                              <Search size={20} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          {product.vendor && (
                            <p className="font-[family-name:var(--font-jakarta)] text-xs text-gold-200 uppercase tracking-wider">
                              {product.vendor}
                            </p>
                          )}
                          <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-100 truncate">
                            {product.title}
                          </p>
                          <p className="font-[family-name:var(--font-bebas)] text-sm text-ivory-400 mt-1">
                            {formatCurrency(price)}
                          </p>
                        </div>

                        {/* Arrow */}
                        <ArrowRight className="w-4 h-4 text-ivory-500" />
                      </button>
                    );
                  })}
                </div>

                {/* View All Results Link */}
                <div className="p-4 border-t border-noir-800">
                  <Link
                    href={`/search?q=${encodeURIComponent(query)}`}
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 py-3 text-gold-200 font-[family-name:var(--font-bebas)] text-sm tracking-wider hover:text-gold-300 transition-colors"
                  >
                    VIEW ALL RESULTS
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Quick Links */}
          <div className="border-t border-noir-800 p-4">
            <p className="font-[family-name:var(--font-jakarta)] text-xs text-ivory-500 uppercase tracking-wider mb-3">
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
                      : 'bg-noir-800 text-ivory-300 hover:bg-noir-700'
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
