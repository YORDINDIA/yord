import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@yord/ui';
import type { ArtistData } from '@yord/db-types';
import { PRICE_BANDS } from '@/lib/catalogFilters';
import { buildFilterUrl, type CatalogFilters } from './catalogUrl';

/** Artists listed before the "All artists" disclosure takes over. */
const TOP_ARTISTS = 12;

export interface FacetData {
  /** Empty hides the artist facet (an artist page is already one artist). */
  artists: ArtistData[];
  types: string[];
  sizes: string[];
}

interface FilterPanelProps extends FacetData {
  filters: CatalogFilters;
  path: string;
}

function Facet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-body text-sm font-semibold text-text-primary">{title}</h2>
      {children}
    </section>
  );
}

const optionClass = (active: boolean) =>
  cn(
    'block py-1.5 font-body text-sm transition-colors',
    active ? 'font-semibold text-accent' : 'text-text-secondary hover:text-accent'
  );

/**
 * Catalog facets as plain links: filter state lives in the URL, so the panel
 * renders on the server and needs no client JS. Each option toggles: the active
 * one links to the URL without it. Selecting anything drops `?page=`.
 */
export function FilterPanel({ filters, path, artists, types, sizes }: FilterPanelProps) {
  const href = (o: Parameters<typeof buildFilterUrl>[1]) => buildFilterUrl(filters, o, path);
  const toggle = (key: 'artist' | 'type' | 'size' | 'price', value: string) =>
    href({ [key]: filters[key] === value ? null : value });

  const isActiveArtist = (a: ArtistData) => a.handle === filters.artist;
  // Most-stocked first; the active artist is always in the visible list, since a
  // filter the shopper cannot see is one they cannot clear.
  const ranked = [...artists].sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0));
  const top = ranked.slice(0, TOP_ARTISTS);
  const active = ranked.find(isActiveArtist);
  if (active && !top.includes(active)) top.push(active);
  const rest = ranked.filter((a) => !top.includes(a)).sort((a, b) => a.name.localeCompare(b.name));

  const artistLink = (a: ArtistData) => (
    <li key={a.handle}>
      <Link
        href={toggle('artist', a.handle)}
        aria-current={isActiveArtist(a) ? 'true' : undefined}
        className={cn(optionClass(isActiveArtist(a)), 'flex items-baseline justify-between gap-3')}
      >
        <span className="truncate">{a.name}</span>
        {a.productCount ? <span className="text-xs text-text-muted tabular-nums">{a.productCount}</span> : null}
      </Link>
    </li>
  );

  const inStock = filters.stock === '1';

  return (
    <div className="flex flex-col gap-9">
      <Facet title="Availability">
        <Link
          href={href({ stock: inStock ? null : '1' })}
          aria-current={inStock ? 'true' : undefined}
          className="group/stock flex items-center gap-3 py-1.5 font-body text-sm text-text-secondary hover:text-accent"
        >
          <span
            aria-hidden="true"
            className={cn(
              'flex h-[18px] w-[18px] shrink-0 items-center justify-center transition-colors',
              // The unchecked box needs a 3:1 edge to read as a control.
              inStock
                ? 'bg-accent text-text-on-accent'
                : 'bg-surface-card ring-1 ring-inset ring-border-strong group-hover/stock:ring-accent'
            )}
          >
            {inStock && (
              <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square">
                <path d="M2.5 6.2L5 8.5L9.5 3.5" />
              </svg>
            )}
          </span>
          In stock only
        </Link>
      </Facet>

      {sizes.length > 0 && (
        <Facet title="Size">
          <ul className="grid grid-cols-4 gap-1.5">
            {sizes.map((size) => {
              const on = filters.size === size;
              return (
                <li key={size}>
                  <Link
                    href={toggle('size', size)}
                    aria-current={on ? 'true' : undefined}
                    aria-label={`Size ${size}`}
                    className={cn(
                      'flex h-10 items-center justify-center font-body text-sm font-medium transition-colors',
                      on
                        ? 'bg-text-primary text-surface-page'
                        : 'bg-surface-card text-text-secondary hover:bg-accent-tint hover:text-text-primary'
                    )}
                  >
                    {size}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Facet>
      )}

      <Facet title="Price">
        <ul>
          {PRICE_BANDS.map((band) => (
            <li key={band.key}>
              <Link
                href={toggle('price', band.key)}
                aria-current={filters.price === band.key ? 'true' : undefined}
                className={optionClass(filters.price === band.key)}
              >
                {band.label}
              </Link>
            </li>
          ))}
        </ul>
      </Facet>

      {types.length > 0 && (
        <Facet title="Category">
          <ul>
            {types.map((type) => (
              <li key={type}>
                <Link
                  href={toggle('type', type)}
                  aria-current={filters.type === type ? 'true' : undefined}
                  className={optionClass(filters.type === type)}
                >
                  {type}
                </Link>
              </li>
            ))}
          </ul>
        </Facet>
      )}

      {artists.length > 0 && (
        <Facet title="Artist">
          <ul>{top.map(artistLink)}</ul>
          {rest.length > 0 && (
            <details className="group/more mt-1">
              <summary className="cursor-pointer list-none py-1.5 font-body text-sm font-medium text-text-primary hover:text-accent [&::-webkit-details-marker]:hidden">
                <span className="group-open/more:hidden">All artists ({rest.length} more)</span>
                <span className="hidden group-open/more:inline">Fewer artists</span>
              </summary>
              <ul>{rest.map(artistLink)}</ul>
            </details>
          )}
        </Facet>
      )}
    </div>
  );
}
