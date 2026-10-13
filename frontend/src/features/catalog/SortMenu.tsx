'use client';

import { useId } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import type { SortOption } from '@/lib/product';
import { buildFilterUrl, sortChoices, type CatalogFilters } from './catalogUrl';

/**
 * The one sort control. A native `<select>` rather than a trigger + `role="listbox"`
 * panel: the select has real arrow-key semantics and the platform picker on
 * touch, and needs no open state, outside-click listener or focus restore.
 */
export function SortSelect({ value, onChange }: { value: SortOption; onChange: (sort: SortOption) => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2 shrink-0">
      <label htmlFor={id} className="font-body text-sm text-text-muted">
        Sort by
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => {
            const next = e.target.value as SortOption;
            // `manual` is the current collection order, not a choice: selecting
            // it again must not refetch.
            if (next !== value) onChange(next);
          }}
          className="appearance-none bg-surface-card text-text-primary font-body text-sm font-medium pl-3 pr-9 py-2 transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-focus-ring"
        >
          {sortChoices(value).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
      </div>
    </div>
  );
}

/** Sort that navigates, keeping every active filter in the URL. */
export function SortMenu({
  sortBy,
  baseFilters,
  path = '/products',
}: {
  sortBy: SortOption;
  baseFilters: CatalogFilters;
  path?: string;
}) {
  const router = useRouter();
  return <SortSelect value={sortBy} onChange={(sort) => router.push(buildFilterUrl(baseFilters, { sort }, path))} />;
}
