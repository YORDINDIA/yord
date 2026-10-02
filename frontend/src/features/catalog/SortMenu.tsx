'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { cn } from '@yord/ui';
import type { SortOption } from '@/lib/product';
import { buildFilterUrl, SORT_OPTIONS, type CatalogFilters } from './catalogUrl';


interface SortMenuProps {
  sortBy: SortOption;
  baseFilters: CatalogFilters;
}

/**
 * Click/keyboard-operated sort menu for `/products`. (The previous
 * `group-hover` CSS-only dropdown was unreachable by keyboard and touch.)
 */
export function SortMenu({ sortBy, baseFilters }: SortMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        // The focused option unmounts with the menu; return focus to the
        // trigger instead of stranding keyboard users on the document body.
        triggerRef.current?.focus();
      }
    };
    const onClick = () => setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [open ]);

  return (
    <div className="flex items-center gap-2">
      <span className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.1em] text-text-muted">
        SORT:
      </span>
      <div className="relative">
        <button
          type="button"
          ref={triggerRef}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex items-center gap-2 px-4 py-2 bg-surface-card border border-border-default text-text-muted text-sm font-[family-name:var(--font-jakarta)] hover:border-accent transition-colors min-w-[180px]"
        >
          {SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Newest'}
          <ChevronDown size={16} className="ml-auto" />
        </button>
        {open && (
          <div role="listbox" aria-label="Sort products" className="absolute top-full right-0 mt-1 bg-surface-card border border-border-default z-10 min-w-[180px]">
            {SORT_OPTIONS.map((option) => (
              <Link
                key={option.value}
                role="option"
                aria-selected={sortBy === option.value}
                href={buildFilterUrl(baseFilters, { sort: option.value })}
                onClick={() => setOpen(false)}
                className={cn(
                  'block px-4 py-2 text-sm font-[family-name:var(--font-jakarta)] hover:bg-surface-raised transition-colors',
                  sortBy === option.value ? 'text-accent' : 'text-text-muted'
                )}
              >
                {option.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
