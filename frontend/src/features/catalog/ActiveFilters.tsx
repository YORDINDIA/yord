'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import type { ArtistData } from '@yord/db-types';
import { PRICE_BANDS } from '@/lib/catalogFilters';
import { buildFilterUrl, type CatalogFilters } from './catalogUrl';
import { onFilterClick, useCatalogFilters } from './CatalogFilterContext';

/**
 * One removable line per active filter.
 *
 * State comes from `CatalogFilterProvider`, so removing a chip re-queries the
 * grid in place; the anchor's real `href` stays for copy-link and crawlers.
 */
export function ActiveFilters({ artists }: { artists: ArtistData[] }) {
  const { filters, setFilter, clearAll, path } = useCatalogFilters();
  const artistName = artists.find((a) => a.handle === filters.artist)?.name ?? filters.artist;
  const items = [
    filters.artist && { key: 'artist' as const, label: artistName },
    filters.type && { key: 'type' as const, label: filters.type },
    filters.size && { key: 'size' as const, label: `Size ${filters.size}` },
    filters.price && { key: 'price' as const, label: PRICE_BANDS.find((b) => b.key === filters.price)?.label },
    filters.stock && { key: 'stock' as const, label: 'In stock' },
  ].filter(Boolean) as { key: keyof CatalogFilters; label: string }[];

  if (items.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Active filters">
      {items.map((item) => (
        <li key={item.key}>
          <Link
            href={buildFilterUrl(filters, { [item.key]: null }, path)}
            onClick={(e) => onFilterClick(e, () => setFilter(item.key, null))}
            aria-label={`Remove ${item.label}`}
            className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-text-primary hover:text-accent"
          >
            {item.label}
            <X size={14} aria-hidden="true" className="text-text-muted" />
          </Link>
        </li>
      ))}
      <li>
        <Link
          href={buildFilterUrl({ sort: filters.sort }, {}, path)}
          onClick={(e) => onFilterClick(e, clearAll)}
          className="font-body text-sm text-text-muted hover:text-accent"
        >
          Clear all
        </Link>
      </li>
    </ul>
  );
}
