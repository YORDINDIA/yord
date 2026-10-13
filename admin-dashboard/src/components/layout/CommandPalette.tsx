'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FolderKanban,
  Image as ImageIcon,
  NotebookPen,
  Package,
  Search,
  Sparkles,
  Tags,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { SECTIONS, SECTION_ORDER } from '@/lib/sections';
import type { SearchResults } from '@/lib/data/search';
import styles from './layout.module.css';

/**
 * The ⌘K command palette.
 *
 * Three kinds of row, in one keyboard-navigable list: sections (from
 * `@/lib/sections`), quick-create actions, and live server results from
 * `/api/search` (products, orders, customers). ↑/↓ move, Enter opens, Escape
 * closes, Tab is trapped inside the dialog, and the page behind it cannot
 * scroll while it is open.
 *
 * The search term is only sent once it reaches two characters, debounced 200ms,
 * with the previous request aborted — so typing "coldplay" issues one request,
 * not eight.
 */

/** Quick-create links, shared with the topbar's `+` menu. */
export const QUICK_ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'New product', href: '/products/new', icon: Package },
  { label: 'New collection', href: '/collections/new', icon: FolderKanban },
  { label: 'New discount', href: '/discounts/new', icon: Tags },
  { label: 'New blog', href: '/blogs/new', icon: NotebookPen },
  { label: 'Upload media', href: '/media', icon: ImageIcon },
  { label: 'Ask AI', href: '/ai', icon: Sparkles },
];

/** Shortest term the endpoint is asked about (enforced here and in the route). */
const MIN_QUERY_LENGTH = 2;

/** How long typing has to pause before a request goes out. */
const DEBOUNCE_MS = 200;

const EMPTY_RESULTS: SearchResults = { products: [], orders: [], customers: [] };

interface PaletteItem {
  /** Stable key, and the DOM id suffix for `aria-activedescendant`. */
  id: string;
  label: string;
  meta?: string;
  href: string;
  icon: LucideIcon;
}

function matches(needle: string, ...fields: (string | null | undefined)[]): boolean {
  if (!needle) return true;
  return fields
    .filter((field): field is string => Boolean(field))
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  // The term `results` belong to. Reading them through this pair (rather than
  // clearing state when the input goes short) keeps a stale term's hits off the
  // screen without a setState in an effect.
  const [resultsFor, setResultsFor] = useState('');
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const term = query.trim();
  const needle = term.toLowerCase();

  // Focus the input on open, and hold the page still behind the dialog.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Live results. Below two characters nothing is requested; the rendered group
  // is gated on `resultsFor`, so a shorter term simply shows no results.
  useEffect(() => {
    if (!open || term.length < MIN_QUERY_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const payload = (await response.json()) as SearchResults;
        setResults(payload);
        setResultsFor(term);
      } catch (error) {
        if (controller.signal.aborted) return;
        // A failed search shows no hits, never the previous term's — the palette
        // must not imply a section match is a data match.
        console.error('Palette search failed', error);
        setResults(EMPTY_RESULTS);
        setResultsFor(term);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, term]);

  const live = term.length >= MIN_QUERY_LENGTH && resultsFor === term ? results : EMPTY_RESULTS;

  const groups = useMemo(() => {
    const sectionItems: PaletteItem[] = SECTION_ORDER.map((key) => SECTIONS[key])
      .filter((section) => matches(needle, section.label, section.short, section.description))
      .map((section) => ({
        id: `section:${section.key}`,
        label: section.label,
        meta: section.description,
        href: section.href,
        icon: section.icon,
      }));

    const actionItems: PaletteItem[] = QUICK_ACTIONS.filter((action) =>
      matches(needle, action.label),
    ).map((action) => ({
      id: `action:${action.href}`,
      label: action.label,
      href: action.href,
      icon: action.icon,
    }));

    const productItems: PaletteItem[] = live.products.map((product) => ({
      id: `product:${product.id}`,
      label: product.title,
      meta: product.meta,
      href: `/products/${product.id}`,
      icon: Package,
    }));

    const orderItems: PaletteItem[] = live.orders.map((order) => ({
      id: `order:${order.id}`,
      label: order.name,
      meta: order.email,
      href: `/orders/${order.id}`,
      icon: Tags,
    }));

    const customerItems: PaletteItem[] = live.customers.map((customer) => ({
      id: `customer:${customer.id}`,
      label: customer.name,
      meta: customer.email,
      href: `/customers/${customer.id}`,
      icon: ImageIcon,
    }));

    return [
      { label: 'Go to', items: sectionItems },
      { label: 'Create', items: actionItems },
      { label: 'Products', items: productItems },
      { label: 'Orders', items: orderItems },
      { label: 'Customers', items: customerItems },
    ].filter((group) => group.items.length > 0);
  }, [needle, live]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const indexOf = useMemo(
    () => new Map(flat.map((item, index) => [item.id, index])),
    [flat],
  );
  const activeIndex = flat.length === 0 ? -1 : Math.min(active, flat.length - 1);
  const activeItem = activeIndex >= 0 ? flat[activeIndex] : null;
  const activeDescendant = activeIndex >= 0 ? `palette-item-${activeIndex}` : undefined;

  function close() {
    setQuery('');
    setActive(0);
    // An in-flight request is aborted by the effect cleanup, which would leave
    // this flag set for the next open.
    setLoading(false);
    onClose();
  }

  function move(delta: number) {
    if (flat.length === 0) return;
    setActive((current) => {
      const base = Math.min(current, flat.length - 1);
      return (base + delta + flat.length) % flat.length;
    });
  }

  function go(item: PaletteItem | null) {
    if (!item) return;
    close();
    router.push(item.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      go(activeItem);
      return;
    }
    if (event.key === 'Tab') {
      // Trapped: the only focusables are the input, the result rows, and the
      // close affordance, so Tab cycles inside the dialog.
      const root = panelRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>('input, button:not([disabled]), a[href]'),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={close}>
      <div
        ref={panelRef}
        className={clsx('card', styles.palette)}
        role="dialog"
        aria-modal="true"
        aria-label="Search and navigate"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className={styles.paletteSearch}>
          <Search size={15} className="subtle" aria-hidden="true" />
          <input
            ref={inputRef}
            className={styles.paletteInput}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products, orders, customers, or jump to a section…"
            aria-label="Search products, orders, customers, and sections"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={activeDescendant}
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <span className="helper">Searching…</span>}
          <kbd className="kbd">esc</kbd>
        </div>

        <div className={styles.paletteList} id="palette-results" role="listbox" aria-label="Results">
          {groups.length === 0 ? (
            <div className={styles.paletteEmpty}>
              <div className="empty-title">No matches</div>
              <div className="empty-hint">
                Nothing in the admin matches “{term}”.
              </div>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label} role="group" aria-label={group.label}>
                <div className={styles.paletteGroupLabel} aria-hidden="true">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const index = indexOf.get(item.id) ?? -1;
                  const isActive = index === activeIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      id={`palette-item-${index}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={clsx(styles.item, isActive && styles.itemActive)}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(item)}
                    >
                      <Icon size={14} aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                      {item.meta && <span className={styles.itemMeta}>{item.meta}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className={styles.paletteFooter}>
          <kbd className="kbd">↑</kbd>
          <kbd className="kbd">↓</kbd>
          <span>move</span>
          <kbd className="kbd">↵</kbd>
          <span>open</span>
          <kbd className="kbd">esc</kbd>
          <span>close</span>
        </div>
      </div>
    </div>
  );
}
