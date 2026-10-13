import Link from 'next/link';
import { X } from 'lucide-react';
import type { ArtistData } from '@yord/db-types';
import { PRICE_BANDS } from '@/lib/catalogFilters';
import { buildFilterUrl, type CatalogFilters } from './catalogUrl';

/** One removable line per active filter, as plain text links. */
export function ActiveFilters({ filters, path, artists }: { filters: CatalogFilters; path: string; artists: ArtistData[] }) {
  const artistName = artists.find((a) => a.handle === filters.artist)?.name ?? filters.artist;
  const items = [
    filters.artist && { key: 'artist', label: artistName },
    filters.type && { key: 'type', label: filters.type },
    filters.size && { key: 'size', label: `Size ${filters.size}` },
    filters.price && { key: 'price', label: PRICE_BANDS.find((b) => b.key === filters.price)?.label },
    filters.stock && { key: 'stock', label: 'In stock' },
  ].filter(Boolean) as { key: keyof CatalogFilters; label: string }[];

  if (items.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Active filters">
      {items.map((item) => (
        <li key={item.key}>
          <Link
            href={buildFilterUrl(filters, { [item.key]: null }, path)}
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
          className="font-body text-sm text-text-muted hover:text-accent"
        >
          Clear all
        </Link>
      </li>
    </ul>
  );
}
