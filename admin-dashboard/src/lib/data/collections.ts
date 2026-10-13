import 'server-only';

import { cache } from 'react';
import type { Collect, Collection, SmartCollectionRule } from '@yord/db-types';
import { PAGE_SIZE, isAutoCollectionHandle } from '@/lib/constants';
import { compileRules, escapeLikeValue, partitionRules, toOrFilter } from '@/lib/collection-rules';
import {
  COLLECTION_SCAN_LIMIT,
  filterAndSortCollections,
  pageCollections,
  toCollectionRow,
  type CollectionListFilters,
  type CollectionListPage,
  type CollectionSeed,
} from '@/lib/collection-list';
import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import { one, reader, rows, runPage } from './client';

/** The row contract the collections list page and its client table share. */
export type { CollectionListRow } from '@/lib/collection-list';

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

/**
 * The `collects` product ids for one collection, in storefront order.
 *
 * Exported because the smart-rules preview needs the *current* membership to
 * diff against what the rules now match — the confirm dialog's "+N / −N" is the
 * only warning before an apply replaces the whole set.
 */
export async function listCollectionProductIds(collectionId: number): Promise<number[]> {
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

/** Product counts for a set of collection ids, one grouped `collects` query
 * instead of a per-row embed. */
async function countProducts(ids: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (ids.length === 0) return counts;
  for (const row of await collectsForCollections(ids)) {
    counts.set(row.collection_id, (counts.get(row.collection_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Paged collection list with search, published/type/product-count filters and
 * sorting.
 *
 * The old query was `.limit(100)` with no pager, so anything past 100
 * collections was unreachable. Product counts come from one grouped `collects`
 * query over the page's ids rather than a per-row `collects(count)` embed.
 *
 * `hasProducts` and `sort=products` need the count *before* the row window is
 * chosen, which PostgREST cannot express without an embed the generated types
 * do not cover, so those two read every matching collection (bounded by
 * `COLLECTION_SCAN_LIMIT`) and page in memory. The catalog has tens of
 * collections; the bound is a guard, not an expected size.
 */
export async function listCollections(
  filters: CollectionListFilters,
): Promise<CollectionListPage> {
  const supabase = await reader();
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = clampPage(filters.page);
  const search = sanitizeSearch(filters.q);
  const sort = filters.sort ?? 'updated_at';
  const needsCountFirst = filters.hasProducts && filters.hasProducts !== 'all';

  let request = supabase
    .from('collections')
    .select(
      'id, title, handle, collection_type, published, updated_at, published_at, sort_order, disjunctive, image_src, storage_image_url',
      {
        count: 'exact',
      },
    )
    .order(sort === 'title' ? 'title' : 'updated_at', { ascending: sort === 'title' });
  if (search) request = request.or(`title.ilike.%${search}%,handle.ilike.%${search}%`);
  if (filters.published === 'yes') request = request.eq('published', true);
  if (filters.published === 'no') request = request.eq('published', false);
  if (filters.type === 'custom' || filters.type === 'smart') {
    request = request.eq('collection_type', filters.type);
  }

  if (needsCountFirst || sort === 'products') {
    // Count every matching collection, then filter/sort/paginate in memory.
    const scanned = await rows<CollectionSeed>(
      ENTITY,
      request.range(0, COLLECTION_SCAN_LIMIT - 1),
    );
    const counts = await countProducts(scanned.map((row) => row.id));
    const enriched = scanned.map((row) => toCollectionRow(row, counts.get(row.id) ?? 0));
    const filtered = filterAndSortCollections(enriched, filters);
    const paged = pageCollections(filtered, page, pageSize);
    // A full scan window means there may be more collections than the in-memory
    // path looked at, and the result would be short without saying so.
    const truncated = scanned.length >= COLLECTION_SCAN_LIMIT;
    if (truncated) {
      console.warn(
        `[collections] in-memory filter/sort scanned the full ${COLLECTION_SCAN_LIMIT}-collection window; the list and its count may be incomplete.`,
      );
    }
    return { ...paged, pageSize, truncated };
  }

  const { from, to } = pageRange(page, pageSize);
  const pageResult = await runPage<CollectionSeed>(ENTITY, request.range(from, to));
  const counts = await countProducts(pageResult.rows.map((row) => row.id));
  return {
    ...pageResult,
    rows: pageResult.rows.map((row) => toCollectionRow(row, counts.get(row.id) ?? 0)),
    page,
    pageSize,
    truncated: false,
  };
}

/**
 * Smart-collection rules for one collection. `[]` when it has none (a custom
 * collection never has rules); throws on a failed read.
 */
export async function listSmartRules(collectionId: number): Promise<SmartCollectionRule[]> {
  const supabase = await reader();
  return rows<SmartCollectionRule>(
    'smart_collection_rules',
    supabase
      .from('smart_collection_rules')
      .select('*')
      .eq('collection_id', collectionId)
      .order('id', { ascending: true }),
  );
}

export interface SmartRuleMatch {
  ids: number[];
  /** First few matching products, for the preview list. */
  sample: { id: number; title: string }[];
  /**
   * Stored rules this builder cannot evaluate (a column it does not offer, or a
   * relation outside equals/contains/not_equals — both exist in the table after
   * the Shopify import). They are excluded from the match and reported to the
   * caller, which shows them instead of quietly returning a short list.
   */
  unsupported: { id: number; column_name: string; relation: string; reason: 'column' | 'relation' }[];
}

const SMART_RULE_SAMPLE = 8;

/**
 * Resolve a collection's rules to the product ids they currently match.
 *
 * This is what makes a smart collection real: the rules are compiled to
 * PostgREST filters (`lib/collection-rules.ts`), run against `products`, and
 * the resulting ids are what "Preview matches" counts and "Apply now"
 * materialises into `collects`. Without it the rules table was write-only.
 *
 * `disjunctive` (the DB column) switches from AND to OR; no rules at all
 * returns an empty match, and the caller reports that rather than wiping the
 * collection's products.
 */
export async function resolveSmartRuleMatches(
  collectionId: number,
): Promise<SmartRuleMatch | null> {
  const supabase = await reader();
  const collection = await one<Pick<Collection, 'id' | 'disjunctive' | 'collection_type'>>(
    ENTITY,
    supabase
      .from('collections')
      .select('id, disjunctive, collection_type')
      .eq('id', collectionId)
      .limit(1)
      .maybeSingle(),
  );
  if (!collection) return null;

  const rules = await listSmartRules(collectionId);
  const { unsupported } = partitionRules(rules);
  const unsupportedRules = unsupported.map((entry) => ({
    id: entry.rule.id,
    column_name: entry.column_name,
    relation: entry.relation,
    reason: entry.reason,
  }));

  const filters = compileRules(rules);
  if (filters.length === 0) return { ids: [], sample: [], unsupported: unsupportedRules };

  // Ids only, paged: a broad rule can match the whole catalog, and a single
  // response is capped at 1,000 rows.
  const ids: number[] = [];
  const WINDOW = 1000;
  for (let from = 0; ; from += WINDOW) {
    let query = supabase
      .from('products')
      .select('id')
      .order('id', { ascending: true })
      .range(from, from + WINDOW - 1);
    if (collection.disjunctive) {
      query = query.or(toOrFilter(filters));
    } else {
      for (const filter of filters) {
        // Escape user text for the LIKE pattern, then add the wildcards
        // `compileRule` deliberately leaves out.
        query =
          filter.op === 'eq'
            ? query.eq(filter.column, filter.value)
            : filter.op === 'neq'
              ? query.neq(filter.column, filter.value)
              : query.ilike(filter.column, `%${escapeLikeValue(filter.value)}%`);
      }
    }
    const page = await rows<{ id: number }>('products', query);
    for (const row of page) ids.push(row.id);
    if (page.length < WINDOW) break;
  }

  const sample = ids.length
    ? await rows<{ id: number; title: string }>(
        'products',
        supabase
          .from('products')
          .select('id, title')
          .in('id', ids.slice(0, SMART_RULE_SAMPLE))
          .order('id', { ascending: true }),
      )
    : [];

  return { ids, sample, unsupported: unsupportedRules };
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
    listCollectionProductIds(id),
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

export interface CollectionStats {
  total: number;
  published: number;
  unpublished: number;
  smart: number;
  /** Custom collections with no products: the rows that cannot be published. */
  empty: number;
  /** True when the scan hit `COLLECTION_SCAN_LIMIT`, so every number is a floor. */
  truncated: boolean;
}

/**
 * Headline counts for the collections list.
 *
 * `empty` cannot be a Postgres `count`: it is a count of rows whose *related*
 * `collects` set is empty, and PostgREST cannot filter on an aggregate without
 * an embed the generated types do not cover (the same constraint that put the
 * list's product-count filters in memory). So this reads the collection window
 * once and groups `collects` once, exactly like `listCollections` does — two
 * queries for the whole strip rather than one per card.
 *
 * Auto handles are excluded from `empty` on purpose: their membership is
 * computed by the storefront, so a zero here is not a problem to fix.
 */
export async function getCollectionStats(): Promise<CollectionStats> {
  const supabase = await reader();
  const scanned = await rows<Pick<CollectionSeed, 'id' | 'published' | 'collection_type' | 'handle'>>(
    ENTITY,
    supabase
      .from('collections')
      .select('id, published, collection_type, handle')
      .order('id', { ascending: true })
      .range(0, COLLECTION_SCAN_LIMIT - 1),
  );
  const counts = await countProducts(scanned.map((row) => row.id));

  let published = 0;
  let smart = 0;
  let empty = 0;
  for (const row of scanned) {
    if (row.published) published += 1;
    if (row.collection_type === 'smart') smart += 1;
    if ((counts.get(row.id) ?? 0) === 0 && !isAutoCollectionHandle(row.handle)) empty += 1;
  }

  const truncated = scanned.length >= COLLECTION_SCAN_LIMIT;
  if (truncated) {
    console.warn(
      `[collections] stats scanned the full ${COLLECTION_SCAN_LIMIT}-collection window; the counts are a lower bound.`,
    );
  }

  return {
    total: scanned.length,
    published,
    unpublished: scanned.length - published,
    smart,
    empty,
    truncated,
  };
}
