import 'server-only';

import { cache } from 'react';
import type { Collect, Collection, SmartCollectionRule } from '@yord/db-types';
import { PAGE_SIZE } from '@/lib/constants';
import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import { one, reader, rows, runPage, type Paged } from './client';

const ENTITY = 'collections';

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
  const collects = ids.length
    ? await rows<Pick<Collect, 'collection_id'>>(
        'collects',
        supabase.from('collects').select('collection_id').in('collection_id', ids),
      )
    : [];

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

  const [collects, rules] = await Promise.all([
    rows<Pick<Collect, 'product_id'>>(
      'collects',
      supabase
        .from('collects')
        .select('product_id')
        .eq('collection_id', id)
        .order('position', { ascending: true }),
    ),
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
    productIds: collects.map((row) => row.product_id),
    rules,
  };
});
