'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import Thumb from '@/components/ui/Thumb';
import { formatCurrency } from '@/lib/utils/format';
import styles from './ai.module.css';

/** One pickable product. `handle` is null for search results (see below). */
export interface ProductOption {
  id: number;
  title: string;
  handle: string | null;
  price: number;
  imageUrl: string | null;
}

interface SearchRow {
  id: number;
  title: string;
  price?: number;
  imageUrl?: string | null;
}

/**
 * Searchable product picker for the AI listing studio.
 *
 * The studio rendered the first 200 products as a `<select>`: unusable past a
 * few dozen rows, with no image, handle or price to tell near-identical titles
 * apart. This shows the most recently touched products immediately — they are
 * server-rendered into the page, so the first list costs no request — and
 * searches the catalog through `GET /api/products/search`, the endpoint the
 * collection editor already uses. No second search path, no new route.
 *
 * The search passes `status=all`: the server-rendered list above is unfiltered,
 * so a draft or archived product is selectable from the first page but would
 * vanish from search results (the endpoint defaults `status=active`) once the
 * catalog grows past what the page pre-renders.
 *
 * That endpoint returns title/status/price/cover but not handle, so a search
 * result shows its handle only when the row also arrived in the initial list.
 */
export default function ProductPicker({
  products,
  selectedId,
  onSelect,
  disabled = false,
}: {
  /** Recently updated products, rendered on the server. */
  products: ProductOption[];
  /** Currently selected product id as a string (`''` when none). */
  selectedId: string;
  /** Fires with the chosen row (null when cleared), so callers can title panels. */
  onSelect: (id: string, product: ProductOption | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  // A search result is usually not in the server-rendered list, so the chosen
  // row is kept here rather than looked up by id.
  const [picked, setPicked] = useState<ProductOption | null>(null);
  // One search result set, keyed by the query it answers. Keying it means a
  // stale response is ignored by derivation rather than cleared by an effect
  // (clearing it in the effect body is a synchronous setState, which cascades).
  const [search, setSearch] = useState<{
    q: string;
    rows: ProductOption[];
    failed: boolean;
    loading: boolean;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmed = query.trim();
  const current = search?.q === trimmed ? search : null;
  const list = useMemo(() => current?.rows ?? products, [current, products]);
  const searching = current?.loading ?? false;
  const searchFailed = current?.failed ?? false;

  // Debounced catalog search. A query under two characters never fetches: the
  // key mismatch leaves the server-rendered list on screen.
  useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearch((previous) => ({
        q: trimmed,
        rows: previous?.q === trimmed ? previous.rows : [],
        failed: false,
        loading: true,
      }));
      // `status=all` matches the unfiltered server-rendered list (see above);
      // the endpoint defaults to `active`, which would hide drafts/archived.
      fetch(`/api/products/search?q=${encodeURIComponent(trimmed)}&pageSize=20&status=all`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { rows?: SearchRow[] } | null) => {
          setSearch({
            q: trimmed,
            rows: (data?.rows ?? []).map((row) => ({
              id: row.id,
              title: row.title,
              handle: null,
              price: Number(row.price ?? 0),
              imageUrl: row.imageUrl ?? null,
            })),
            failed: !data,
            loading: false,
          });
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setSearch({ q: trimmed, rows: [], failed: true, loading: false });
        });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed]);

  const selected =
    picked && String(picked.id) === selectedId
      ? picked
      : products.find((product) => String(product.id) === selectedId) ?? null;
  const active = list[activeIndex];

  function choose(row: ProductOption) {
    setPicked(row);
    onSelect(String(row.id), row);
    setQuery('');
    setSearch(null);
    setOpen(false);
    setActiveIndex(0);
  }

  function clear() {
    setPicked(null);
    onSelect('', null);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, list.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter' && open && active) {
      event.preventDefault();
      choose(active);
    }
  }

  return (
    <div>
      <label className="label" htmlFor="ai-product-search">
        Product
      </label>
      <div
        className={styles.pickerBox}
        onBlur={(event) => {
          // Focus moving to an option stays inside; focus leaving closes.
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <div className="search-input">
          <Search size={13} aria-hidden />
          <input
            id="ai-product-search"
            className="input"
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls="ai-product-options"
            aria-autocomplete="list"
            aria-describedby="ai-product-hint"
            aria-activedescendant={open && active ? `ai-product-option-${active.id}` : undefined}
            placeholder="Search by title, handle or tag…"
            value={query}
            disabled={disabled}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
        </div>

        {open && (
          <div className={styles.pickerList} role="listbox" id="ai-product-options" aria-label="Products">
            {searching && list.length === 0 && (
              <div className={styles.optionNote}>Searching the catalog…</div>
            )}
            {list.length === 0 && !searching && (
              <div className={styles.optionNote}>
                {searchFailed ? 'The catalog search failed. Try again.' : `No product matches “${trimmed}”.`}
              </div>
            )}
            {list.map((row, index) => (
              <button
                key={row.id}
                id={`ai-product-option-${row.id}`}
                type="button"
                role="option"
                aria-selected={String(row.id) === selectedId}
                data-active={index === activeIndex}
                className={styles.option}
                onClick={() => choose(row)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <Thumb src={row.imageUrl} alt="" size="sm" />
                <span className={styles.optionBody}>
                  <span className={styles.optionTitle}>{row.title}</span>
                  <span className={styles.optionSub}>
                    {row.handle ? `/${row.handle}` : `Product ${row.id}`}
                  </span>
                </span>
                <span className={styles.optionPrice}>{formatCurrency(row.price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="field-hint" id="ai-product-hint">
        {current === null
          ? `${products.length} most recently updated products — type at least 2 characters to search the whole catalog.`
          : `${list.length} match${list.length === 1 ? '' : 'es'} for “${trimmed}”.`}
      </div>

      {selected && (
        <div className={styles.selected} style={{ marginTop: 8 }}>
          <Thumb src={selected.imageUrl} alt="" size="lg" />
          <div className={styles.selectedBody}>
            <div className="cell-media-title">{selected.title}</div>
            <div className="cell-media-sub">
              {selected.handle ? `/${selected.handle} · ` : `#${selected.id} · `}
              {formatCurrency(selected.price)}
            </div>
          </div>
          <button type="button" className="button small" onClick={clear} disabled={disabled}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
