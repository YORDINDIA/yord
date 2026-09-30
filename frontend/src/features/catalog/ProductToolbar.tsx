import Link from 'next/link';
import { X, ChevronDown } from 'lucide-react';
import type { ArtistData } from '@yord/db-types';
import type { SortOption } from '@/lib/product';

export interface CatalogFilters {
  artist?: string;
  type?: string;
  sort?: string;
}

export function buildFilterUrl(
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

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'title', label: 'Alphabetical' },
];

interface ProductToolbarProps {
  artists: ArtistData[];
  productTypes: string[];
  baseFilters: CatalogFilters;
  artistFilter?: string;
  typeFilter?: string;
  sortBy: SortOption;
  currentArtist: ArtistData | null;
}

/**
 * Server-rendered filter rows for `/products`: active-filter pills, artist
 * pills, sort dropdown, category pills. All navigation is plain `Link`s, so
 * no client JS is needed; filter state lives in the URL.
 */
export function ProductToolbar({
  artists,
  productTypes,
  baseFilters,
  artistFilter,
  typeFilter,
  sortBy,
  currentArtist,
}: ProductToolbarProps) {
  const hasFilters = artistFilter || typeFilter;

  return (
    <>
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
              {SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Newest'}
              <ChevronDown size={16} className="ml-auto" />
            </button>
            <div className="absolute top-full right-0 mt-1 bg-noir-900 border border-noir-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 min-w-[180px]">
              {SORT_OPTIONS.map((option) => (
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
    </>
  );
}
