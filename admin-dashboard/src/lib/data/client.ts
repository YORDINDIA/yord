import 'server-only';

import type { Database } from '@yord/db-types';
import { createServerClient, createServiceClient, type ServerClient } from '@/lib/supabase/server';
import { DatabaseError } from '@/lib/errors';

/**
 * Shared plumbing for every module in `src/lib/data`.
 *
 * Pages contain zero `.from()` calls; all reads go through here. The three
 * outcomes stay distinct on purpose:
 *
 *   | Outcome   | Signal                                |
 *   |-----------|---------------------------------------|
 *   | empty     | `[]` (or `0` for counts)              |
 *   | not found | `null` → the page calls `notFound()`  |
 *   | failed    | throws `DatabaseError` → `error.tsx`  |
 *
 * The old code returned `[]` on failure, so a permission or network error was
 * indistinguishable from "no rows" and the admin saw an empty table.
 */
export type Db = Database['public']['Tables'];

/** A page of rows plus the exact total, as every paginated list returns it. */
export interface Paged<T> {
  rows: T[];
  count: number;
  page: number;
  pageSize: number;
}

/** Minimal shape of the PostgREST error we branch on. */
export interface DbError {
  message: string;
  code?: string;
}

/** Throw a `DatabaseError` carrying the entity and PostgREST code. */
export function fail(entity: string, error: DbError | null | undefined): never {
  throw new DatabaseError(entity, error?.message ?? 'Unknown database error', error?.code);
}

/** Options shared by the read helpers. */
export interface ReadOptions {
  /**
   * Read as the signed-in admin instead of through the service client.
   *
   * Only `getCurrentAdminId()` needs this: `auth.getUser()` reads the caller's
   * cookies, and the service client has no session to read. Every other read in
   * this layer wants the service client.
   */
  session?: boolean;
}

/**
 * The client every read in this layer uses.
 *
 * Defaults to the **service** client, not the session-scoped one. RLS is on for
 * every migrated table, and most of them have no policies at all — or a
 * storefront-shaped one, where `products` is `status = 'active'` and
 * `collections` is `published = true`. Reading with the caller's publishable
 * session therefore hides exactly the rows an admin exists to manage, and hides
 * them *silently*: the query succeeds and returns nothing, so the page renders a
 * plausible empty state instead of an error.
 *
 * Measured 2026-10-05 against the live project, impersonating the admin with the
 * session client: 0 of 612 orders, 0 of 635 customers, 0 of 10 discount codes,
 * 0 of 237 transactions, and the 2 draft products and 4 unpublished collections
 * were invisible — so Orders, Customers, Discounts and Transactions were all
 * empty pages, and a newly created product (which always starts as `draft`)
 * vanished from the list the moment it was saved.
 *
 * The admin is authenticated before any of this runs — `middleware.ts` and
 * `(admin)/layout.tsx` both read `admin_users` with their own session-scoped
 * client — so bypassing RLS here is the intended model, not a hole. Pass
 * `session: true` only when a read genuinely depends on who is signed in.
 */
export async function reader(options: ReadOptions = {}): Promise<ServerClient> {
  return options.session ? createServerClient() : createServiceClient();
}

/**
 * A query builder result narrowed to what the helpers need. Declared structurally
 * instead of importing Postgrest builder generics, so the helpers stay readable.
 */
export interface Result<T> {
  data: T;
  error: DbError | null;
}
export interface CountedResult<T> extends Result<T> {
  count: number | null;
}

/**
 * The subset of a PostgREST builder these helpers need. Declared structurally
 * rather than importing the builder generics, so the data layer does not
 * re-derive PostgREST's type machinery at every call site.
 */
type Builder = PromiseLike<CountedResult<unknown>>;

/** Run a query for one row. `null` when absent; throws on failure. */
export async function one<T>(entity: string, query: Builder): Promise<T | null> {
  const { data, error } = await query;
  if (error) {
    // `.single()` reports "no row" as PGRST116; a genuine miss is not a failure.
    if (error.code === 'PGRST116') return null;
    fail(entity, error);
  }
  return (data ?? null) as T | null;
}

/** Run a query for a row array. `[]` when genuinely empty; throws on failure. */
export async function rows<T>(entity: string, query: Builder): Promise<T[]> {
  const { data, error } = await query;
  if (error) fail(entity, error);
  return (data ?? []) as T[];
}

/** Run a query, returning rows plus the exact total (for pagination). */
export async function runPage<T>(
  entity: string,
  query: Builder,
): Promise<{ rows: T[]; count: number }> {
  const { data, error, count } = await query;
  if (error) fail(entity, error);
  const list = (data ?? []) as T[];
  return { rows: list, count: count ?? list.length };
}

/** Head-only count. */
export async function runCount(entity: string, query: Builder): Promise<number> {
  const { error, count } = await query;
  if (error) fail(entity, error);
  return count ?? 0;
}

/**
 * Group rows by a key column, dropping rows whose key is null.
 *
 * Replaces PostgREST embedded-resource selects (`collects(count)`,
 * `product_variants(price)`): those cannot be typed from `@yord/db-types`
 * because the generated `Relationships` metadata is empty, so every embed in
 * the old pages needed a hand-written `as` cast. Two parallel queries carrying
 * real row types beat an untyped embed.
 */
export function groupBy<T, K extends number | string>(
  items: T[],
  keyOf: (row: T) => K | null | undefined,
): Map<K, T[]> {
  const grouped = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (key === null || key === undefined) continue;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(item);
    else grouped.set(key, [item]);
  }
  return grouped;
}

/** Distinct non-null values, for `IN (...)` filters. */
export function uniqueIds<K extends number | string>(values: (K | null | undefined)[]): K[] {
  return [...new Set(values.filter((v): v is K => v !== null && v !== undefined))];
}
