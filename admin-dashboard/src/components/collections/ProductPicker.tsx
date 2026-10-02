'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ImageOff, Plus, Search, Trash2, X } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import type { ProductPickerRow } from '@/lib/data/products';

/** Rows per search page (the API caps pageSize at 48). */
const SEARCH_PAGE_SIZE = 12;

/**
 * Upper bound for "Add all matching". The API pages 48 at a time and a broad
 * search ("t-shirt") matches the whole catalog; 500 covers every real
 * collection in this store while keeping the request count bounded.
 */
const MAX_ADD_ALL = 500;

interface PickerResponse {
  rows: ProductPickerRow[];
  count: number;
}

async function fetchPicker(
  params: { q?: string; page?: number; pageSize?: number },
  signal?: AbortSignal,
): Promise<PickerResponse> {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  search.set('page', String(params.page ?? 1));
  search.set('pageSize', String(params.pageSize ?? SEARCH_PAGE_SIZE));
  const response = await fetch(`/api/products/search?${search.toString()}`, {
    headers: { accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`Picker search failed (${response.status})`);
  return (await response.json()) as PickerResponse;
}

function PickerThumb({ row }: { row: ProductPickerRow }) {
  if (!row.imageUrl) {
    return (
      <span className="thumb thumb-sm" aria-hidden="true">
        <ImageOff size={12} />
      </span>
    );
  }
  return (
    <Image
      className="thumb thumb-sm"
      src={row.imageUrl}
      alt=""
      width={26}
      height={26}
      // 26px on screen; the stored R2 variant is already web-sized, so a
      // downsized request keeps the picker light without a second transform.
      sizes="26px"
    />
  );
}

/**
 * Product picker for the collection editor.
 *
 * Replaces a comma-separated bigint text box: search the catalog by title /
 * handle / tags, add with one click, reorder, remove, or pull in every match of
 * the current search. The selection is submitted through a hidden
 * `product_ids` input in exactly the format `productIdsSchema` already parses,
 * so the atomic `set_collection_products` RPC and the action contract are
 * unchanged — this is a better way to fill the same field.
 *
 * Order is kept as a list order and saved with the collection (`collects`), but
 * it is not what the storefront sorts by: the storefront orders a collection
 * with the collection's own "Default product order" (`sort_order`). The ↑/↓
 * controls therefore tidy the admin's list rather than changing the shop page.
 */
export default function ProductPicker({
  initialSelected,
  memberCount,
  disabled = false,
  hiddenInputName = 'product_ids',
}: {
  initialSelected: ProductPickerRow[];
  /** Total members in the DB when the editor opened (may exceed the loaded rows). */
  memberCount?: number;
  /** Read-only mode for auto collections (membership is computed elsewhere). */
  disabled?: boolean;
  hiddenInputName?: string;
}) {
  const [selected, setSelected] = useState<ProductPickerRow[]>(initialSelected);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<ProductPickerRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [addingAll, setAddingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(() => new Set(selected.map((row) => row.id)), [selected]);

  // Debounced, abortable search. The abort matters on every keystroke: without
  // it a slow first response could land after a faster second one and show
  // results for a query the admin already changed.
  useEffect(() => {
    if (disabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPicker(
          { q: query.trim() || undefined, page, pageSize: SEARCH_PAGE_SIZE },
          controller.signal,
        );
        setResults(data.rows);
        setCount(data.count);
      } catch (cause) {
        if (controller.signal.aborted) return;
        console.error('[picker] search failed', cause);
        setError('Could not load products. Adjust the search and try again.');
        setResults([]);
        setCount(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, page, disabled]);

  const add = useCallback((row: ProductPickerRow) => {
    setSelected((prev) => (prev.some((item) => item.id === row.id) ? prev : [...prev, row]));
  }, []);

  const remove = useCallback((id: number) => {
    setSelected((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const move = useCallback((index: number, delta: number) => {
    setSelected((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const addAllMatching = useCallback(async () => {
    setAddingAll(true);
    setError(null);
    try {
      const collected: ProductPickerRow[] = [];
      let nextPage = 1;
      // Page until the match set is exhausted or the cap is reached.
      while (collected.length < MAX_ADD_ALL) {
        const data = await fetchPicker({
          q: query.trim() || undefined,
          page: nextPage,
          pageSize: 48,
        });
        if (data.rows.length === 0) break;
        collected.push(...data.rows);
        if (data.rows.length < 48 || collected.length >= data.count) break;
        nextPage += 1;
      }
      const capped = collected.slice(0, MAX_ADD_ALL);
      setSelected((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const additions = capped.filter((row) => !seen.has(row.id));
        return [...prev, ...additions];
      });
    } catch (cause) {
      console.error('[picker] add-all failed', cause);
      setError('Could not load every match. Try again, or add results one at a time.');
    } finally {
      setAddingAll(false);
    }
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(count / SEARCH_PAGE_SIZE));

  if (disabled) {
    return (
      <div className="card-inset">
        <div className="helper">
          {typeof memberCount === 'number' ? `${memberCount} products` : `${selected.length} products`} ·
          membership is computed automatically by the storefront for this collection, so it cannot be edited here.
        </div>
        {selected.length > 0 && (
          <ul className="helper" style={{ marginTop: 8 }}>
            {selected.slice(0, 8).map((row) => (
              <li key={row.id}>{row.title}</li>
            ))}
            {selected.length > 8 && <li>…and {selected.length - 8} more</li>}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* The single hidden field the action parses: ids in display order. */}
      <input type="hidden" name={hiddenInputName} value={selected.map((row) => row.id).join(',')} />

      <div className="helper" style={{ marginBottom: 8 }}>
        <strong>{selected.length}</strong> selected
        {typeof memberCount === 'number' && memberCount !== selected.length
          ? ` (${memberCount} in the database)`
          : ''}
        {' · '}saved list order; the storefront sorts by “Default product order”.
      </div>

      <div className="grid-2">
        {/* ── Search side ─────────────────────────────────────────────── */}
        <div>
          <div className="toolbar">
            <Search size={14} aria-hidden="true" />
            <input
              className="input"
              type="search"
              value={query}
              placeholder="Search products by title, handle, tags"
              aria-label="Search products to add"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="toolbar" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="button small"
              onClick={addAllMatching}
              disabled={addingAll || loading || count === 0}
              aria-busy={addingAll}
            >
              <Plus size={12} aria-hidden="true" />
              {addingAll
                ? 'Adding…'
                : `Add ${count > MAX_ADD_ALL ? `first ${MAX_ADD_ALL}` : `all ${count}`} matching`}
            </button>
            <span className="spacer" />
            <span className="helper" aria-live="polite">
              {loading ? 'Searching…' : `${count} match${count === 1 ? '' : 'es'}`}
            </span>
          </div>

          {error && (
            <div className="field-error" role="alert" style={{ marginTop: 8 }}>
              {error}
            </div>
          )}

          <ul className="list-rows" style={{ marginTop: 8, maxHeight: 360, overflowY: 'auto' }}>
            {results.map((row) => {
              const already = selectedIds.has(row.id);
              return (
                <li key={row.id} className="list-row">
                  <PickerThumb row={row} />
                  <span className="list-row-body list-row-title" title={row.title}>
                    {row.title}
                  </span>
                  <StatusBadge value={row.status} />
                  <button
                    type="button"
                    className="button small"
                    onClick={() => add(row)}
                    disabled={already}
                    aria-label={already ? `${row.title} already added` : `Add ${row.title}`}
                  >
                    {already ? 'Added' : 'Add'}
                  </button>
                </li>
              );
            })}
            {!loading && results.length === 0 && (
              <li className="helper">No products match that search.</li>
            )}
          </ul>

          {totalPages > 1 && (
            <div className="toolbar" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="button small"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading}
              >
                Previous
              </button>
              <span className="helper">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="button small"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || loading}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* ── Selected side ───────────────────────────────────────────── */}
        <div>
          <div className="toolbar">
            <span className="helper-strong">Selected products</span>
            <span className="spacer" />
            <button
              type="button"
              className="button small"
              onClick={() => setSelected([])}
              disabled={selected.length === 0}
            >
              <Trash2 size={12} aria-hidden="true" />
              Clear all
            </button>
          </div>

          <ol className="list-rows" style={{ marginTop: 8, maxHeight: 360, overflowY: 'auto' }}>
            {selected.map((row, index) => (
              <li key={row.id} className="list-row">
                <span className="helper" style={{ minWidth: 18 }}>
                  {index + 1}
                </span>
                <PickerThumb row={row} />
                <span className="list-row-body list-row-title" title={row.title}>
                  {row.title}
                </span>
                <button
                  type="button"
                  className="button icon-button small"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${row.title} up`}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  className="button icon-button small"
                  onClick={() => move(index, 1)}
                  disabled={index === selected.length - 1}
                  aria-label={`Move ${row.title} down`}
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  className="button icon-button small"
                  onClick={() => remove(row.id)}
                  aria-label={`Remove ${row.title}`}
                >
                  <X size={12} />
                </button>
              </li>
            ))}
            {selected.length === 0 && (
              <li className="helper">
                No products yet. Search on the left and add the products this collection should show.
              </li>
            )}
          </ol>
        </div>
      </div>
    </div>
  );
}
