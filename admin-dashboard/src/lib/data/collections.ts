import 'server-only';

import { cache } from 'react';
import type { Collect, Collection, SmartCollectionRule } from '@yord/db-types';
import { PAGE_SIZE } from '@/lib/constants';
import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import { one, reader, rows, runPage, type Paged } from './client';

const ENTITY = 'collections';

/**
 * Supabase caps a single response at 1,000 rows. Any `collects` read that can
 * exceed that — a popular collection's membership, or the enrichment fan-out
 * for a page of collections — pages through `.range()` windows instead of
 * trusting one response. A truncated id set is dangerous here: the detail form
 * submits the loaded ids as the replacement set, so saving after a truncated
 * read would silently delete the collection's remaining products.
 */
const COLLECTS_WINDOW = 1000;

async function collectsForCollections(ids: number[]): Promise<Pick<Collect, 'collection_id'>[]> {
  const supabase = await reader();
  const all: Pick<Collect, 'collection_id'>[] = [];
  // Stable order across windows so no row is skipped or repeated.
  for (let from = 0; ; from += COLLECTS_WINDOW) {
    const page = await rows<Pick<Collect, 'collection_id'>>(
      'collects',
      supabase
        .from('collects')
        .select('collection_id')
        .in('collection_id', ids)
        .order('collection_id', { ascending: true })
        .order('product_id', { ascending: true })
        .range(from, from + COLLECTS_WINDOW - 1),
    );
    all.push(...page);
    if (page.length < COLLECTS_WINDOW) return all;
  }
}

async function collectProductIds(collectionId: number): Promise<number[]> {
  const supabase = await reader();
  const ids: number[] = [];
  for (let from = 0; ; from += COLLECTS_WINDOW) {
    const page = await rows<Pick<Collect, 'product_id'>>(
      'collects',
      supabase
        .from('collects')
        .select('product_id')
        .eq('collection_id', collectionId)
        .order('position', { ascending: true })
        // `position` is frequently tied (the keyword population script sets
        // every match to 1), so `product_id` breaks the tie: without it the
        // `.range()` windows are nondeterministic and a >1000-member
        // collection can omit or duplicate ids across pages.
        .order('product_id', { ascending: true })
        .range(from, from + COLLECTS_WINDOW - 1),
    );
    for (const row of page) ids.push(row.product_id);
    if (page.length < COLLECTS_WINDOW) return ids;
  }
}

export interface CollectionListFilters {
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface CollectionListRow {
  id: number;
  title: string;
  collection_type: string;
  published: boolean | null;
  updated_at: string | null;
  productCount: number;
}

/**
 * Paged collection list. The old query was `.limit(100)` with no pager, so
 * anything past 100 collections was unreachable.
 *
 * Product counts come from one grouped `collects` query over the page's ids
 * rather than a per-row `collects(count)` embed.
 */
export async function listCollections(
  filters: CollectionListFilters,
): Promise<Paged<CollectionListRow>> {
  const supabase = await reader();
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = clampPage(filters.page);
  const { from, to } = pageRange(page, pageSize);
  const search = sanitizeSearch(filters.q);

  let request = supabase
    .from('collections')
    .select('id, title, collection_type, published, updated_at', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, to);
  if (search) request = request.or(`title.ilike.%${search}%,handle.ilike.%${search}%`);

  const pageResult = await runPage<{
    id: number;
    title: string;
    collection_type: string;
    published: boolean | null;
    updated_at: string | null;
  }>(ENTITY, request);

  const ids = pageResult.rows.map((row) => row.id);
  const collects = ids.length ? await collectsForCollections(ids) : [];

  const counts = new Map<number, number>();
  for (const row of collects) {
    counts.set(row.collection_id, (counts.get(row.collection_id) ?? 0) + 1);
  }

  return {
    ...pageResult,
    rows: pageResult.rows.map((row) => ({
      ...row,
      productCount: counts.get(row.id) ?? 0,
    })),
    page,
    pageSize,
  };
}

export interface CollectionDetail {
  collection: Collection;
  productIds: number[];
  rules: SmartCollectionRule[];
}

/**
 * One collection with its `collects` product ids and smart rules. `null` when
 * the id does not exist (page calls `notFound()`).
 */
export const getCollection = cache(async (id: number): Promise<CollectionDetail | null> => {
  const supabase = await reader();
  const collection = await one<Collection>(
    ENTITY,
    supabase.from('collections').select('*').eq('id', id).limit(1).maybeSingle(),
  );
  if (!collection) return null;

  const [productIds, rules] = await Promise.all([
    collectProductIds(id),
    rows<SmartCollectionRule>(
      'smart_collection_rules',
      supabase
        .from('smart_collection_rules')
        .select('*')
        .eq('collection_id', id)
        .order('id', { ascending: true }),
    ),
  ]);

  return {
    collection,
    productIds,
    rules,
  };
});
