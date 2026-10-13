'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X, Loader2, ArrowRight } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { cn, formatPrice } from '@yord/ui';
import { getFirstByPosition } from '@/lib/product';
import { buildSearchOrFilter } from '@/lib/search';
import type { ProductWithDetails } from '@yord/db-types';
import { Overlay } from '@/features/ui/Overlay';
import { IconButton } from '@/features/ui/IconButton';
import { getPopularSearches, type QuickSearch } from './popularSearches';
import { readRecentSearches, rememberSearch } from './recentSearches';

/** The server truncates at 100 chars too; the input advertises it. */
const MAX_QUERY_LENGTH = 100;
/** Matches `Overlay`'s exit transition, so the panel does not empty while it fades. */
const EXIT_MS = 300;

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function QuickChip({ item, onSelect }: { item: QuickSearch; onSelect: () => void }) {
  const isArtist = item.type === 'artist';
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 text-xs font-body transition-colors',
        isArtist
          ? 'bg-accent-tint text-accent hover:bg-accent/15'
          : 'bg-surface-raised text-text-muted hover:bg-surface-inset'
      )}
    >
      {/* The artist's brand colour is a mark, never the label: a brand yellow is
          ~1.6:1 as text on this surface. */}
      {isArtist && item.accentColor ? (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: item.accentColor }}
          aria-hidden="true"
        />
      ) : null}
      {item.label}
    </button>
  );
}

/**
 * Product search.
 *
 * Three things changed beyond the move onto `Overlay`:
 *
 * 1. It renders a plain list of links. It used to put `role="combobox"` on the
 *    input and `role="listbox"` on the results with no `aria-activedescendant`
 *    and no arrow-key handling, and the "options" were `<button>`s that pushed
 *    a route — invalid ARIA and a half-built combobox. The results and the
 *    "VIEW ALL RESULTS" link are now both `next/link`.
 * 2. The popular-search chips moved into the empty state, where they are
 *    actually useful, instead of sitting under a list of results.
 * 3. The chips no longer paint an artist's brand colour as text.
 */
export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [popularSearches, setPopularSearches] = useState<QuickSearch[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchRequestId = useRef(0);

  // Popular searches load the first time the modal actually opens: doing it on
  // mount fired two PostgREST queries on every page load for a panel most
  // visitors never open.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void getPopularSearches()
      .then((searches) => {
        if (!cancelled) setPopularSearches(searches);
      })
      .catch(() => {
        // getPopularSearches already dropped the cached failure.
      });

    // localStorage is read in a frame, not in the effect body: it is a
    // browser-only value, and setState-in-effect is a lint error here.
    const raf = requestAnimationFrame(() => setRecentSearches(readRecentSearches()));

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [isOpen]);

  // Clear the panel after the exit transition, not during it, so it does not
  // visibly empty out while it fades.
  useEffect(() => {
    if (isOpen) return;
    const id = window.setTimeout(() => {
      setQuery('');
      setResults([]);
      setHasSearched(false);
    }, EXIT_MS);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  // Debounced search
  const searchProducts = useCallback(async (searchQuery: string) => {
    const q = searchQuery.trim().slice(0, MAX_QUERY_LENGTH);
    if (!q || q.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const requestId = ++searchRequestId.current;
    setIsLoading(true);
    setHasSearched(true);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_variants (
            id, title, price, compare_at_price,
            inventory_quantity, position
          ),
          product_images (
            id, src, storage_url, alt, position
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

  const remember = () => {
    const term = query.trim();
    if (term.length >= 2) rememberSearch(term);
  };

  // Choosing a chip unmounts the empty state, which takes the chip (and the
  // focus it holds) out of the DOM — so focus goes back to the field the
  // shopper is about to keep typing in.
  const chooseQuickSearch = (term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  const showEmptyState = !hasSearched && query.length < 2;

  return (
    <Overlay
      open={isOpen}
      onClose={onClose}
      label="Search products"
      initialFocusRef={inputRef}
      width="lg"
    >
      {/* Search Input. Sticky: the panel scrolls as a whole, so the field has
          to stay reachable while the result list is long. */}
      <div className="sticky top-0 z-10 flex items-center border-b border-border-default bg-surface-card">
        <Search className="w-5 h-5 text-text-muted ml-6" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Search products, artists, collections..."
          aria-label="Search products, artists, collections"
          className="flex-1 px-4 py-5 bg-transparent text-text-secondary font-body placeholder:text-text-muted"
        />
        {isLoading && (
          <Loader2 className="w-5 h-5 text-accent animate-spin mr-4" aria-hidden="true" />
        )}
        <IconButton label="Close search" onClick={onClose} className="mr-2">
          <X size={20} />
        </IconButton>
        {/* The spinner is decorative; this region carries the loading state and
            the result count for screen readers. Rendered unconditionally so the
            live region exists before the state it announces changes. */}
        <span role="status" className="sr-only">
          {isLoading
            ? 'Searching'
            : hasSearched
              ? `${results.length} ${results.length === 1 ? 'result' : 'results'}`
              : ''}
        </span>
      </div>

      {/* Results */}
      <div>
        {showEmptyState && (
          <div className="p-8">
            <p className="font-body text-sm text-text-muted text-center">
              Start typing to search for products
            </p>

            {recentSearches.length > 0 && (
              <div className="mt-8">
                <p className="font-body text-xs text-text-muted uppercase tracking-wider mb-3">
                  Recent Searches
                </p>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <QuickChip
                      key={term}
                      item={{ label: term, type: 'category' }}
                      onSelect={() => chooseQuickSearch(term)}
                    />
                  ))}
                </div>
              </div>
            )}

            {popularSearches.length > 0 && (
              <div className="mt-8">
                <p className="font-body text-xs text-text-muted uppercase tracking-wider mb-3">
                  Popular Searches
                </p>
                <div className="flex flex-wrap gap-2">
                  {popularSearches.map((item) => (
                    <QuickChip
                      key={item.label}
                      item={item}
                      onSelect={() => chooseQuickSearch(item.label)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {hasSearched && results.length === 0 && !isLoading && (
          <div className="p-8 text-center">
            <p className="font-body text-sm text-text-muted">
              No products found for &quot;{query}&quot;
            </p>
            <p className="font-body text-xs text-text-muted mt-2">
              Try searching for an artist name or product type
            </p>
          </div>
        )}

        {results.length > 0 && (
          <>
            <ul className="divide-y divide-border-default">
              {results.map((product) => {
                const image = getFirstByPosition(product.product_images);
                const imageUrl = image?.storage_url || image?.src;
                const variant = getFirstByPosition(product.product_variants);
                const price = variant?.price || 0;

                return (
                  <li key={product.id}>
                    <Link
                      href={`/product/${product.handle ?? ''}`}
                      onClick={() => {
                        remember();
                        onClose();
                      }}
                      className="flex items-center gap-4 p-4 hover:bg-surface-raised/50 transition-colors"
                    >
                      {/* Image */}
                      <div className="relative w-16 h-16 bg-surface-raised flex-shrink-0">
                        {imageUrl ? (
                          <Image src={imageUrl} alt={product.title} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-muted">
                            <Search size={20} aria-hidden="true" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {product.vendor && (
                          <p className="font-body text-xs text-accent uppercase tracking-wider">
                            {product.vendor}
                          </p>
                        )}
                        <p className="font-body text-sm text-text-secondary truncate">{product.title}</p>
                        <p className="font-accent text-sm text-text-muted mt-1">{formatPrice(price)}</p>
                      </div>

                      {/* Arrow */}
                      <ArrowRight className="w-4 h-4 text-text-muted" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* View All Results Link */}
            <div className="p-4 border-t border-border-default">
              <Link
                href={`/search?q=${encodeURIComponent(query)}`}
                onClick={() => {
                  remember();
                  onClose();
                }}
                className="flex items-center justify-center gap-2 py-3 text-accent font-accent text-sm tracking-wider hover:text-accent-hover transition-colors"
              >
                VIEW ALL RESULTS
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}
