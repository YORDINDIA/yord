import {
  DatabaseError,
  isPostgrestNotFound,
  postgrestCodeOf,
  type AppError,
} from './errors';
import { logDbError } from './logger';

/**
 * `Result<T>` for reads that may fail without taking the page down.
 * Load-bearing reads use `queryOrThrow`; optional sections use
 * `queryOrDegrade` so one failing section cannot blank the whole page.
 */

export type Result<T, E extends AppError = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<E extends AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}

// `PromiseLike` (not `Promise`): PostgREST filter builders are thenable but
// lack `catch`/`finally`, so they satisfy this without an `async` wrapper.
// `data` is `unknown` because inferred select shapes vary with the `Database`
// type (custom select strings, embedded relations); `queryOrThrow` narrows it
// to `T` once, at the boundary, instead of at every call site.
type QueryRun = () => PromiseLike<{ data: unknown; error: unknown }>;

/**
 * True when Supabase is not configured (no URL/anon key in env), e.g. a
 * backend-less `npm run build` or CI greenness check. Reads then degrade to
 * `null`/empty instead of throwing: prerendered pages build with empty
 * sections and self-heal at the next `revalidate` once configured. A
 * *configured* backend that fails still throws `DatabaseError` so error
 * boundaries fire at runtime.
 */
export function isSupabaseUnconfigured(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/**
 * Load-bearing read. Logs via `logDbError`, then:
 * - Supabase unconfigured → `null` (build-time degrade, see above)
 * - PostgREST `PGRST116` (`.single()` on a missing row) → `null`
 * - any other failure (network, 5xx, RLS, timeout) → throws `DatabaseError`
 *
 * Callers that need a row: `const row = await queryOrThrow(...); if (!row)
 * notFound();`. Callers where empty is valid (`[]`) get it passed through.
 */
export async function queryOrThrow<T>(route: string, entity: string, run: QueryRun): Promise<T | null> {
  if (isSupabaseUnconfigured()) {
    logDbError(route, 'Supabase unconfigured — degrading read to null');
    return null;
  }
  let result: { data: unknown; error: unknown };
  try {
    result = await run();
  } catch (error) {
    logDbError(route, error);
    throw new DatabaseError(entity, 'Query failed: transport error', postgrestCodeOf(error));
  }
  if (result.error) {
    if (isPostgrestNotFound(result.error)) return null;
    logDbError(route, result.error);
    throw new DatabaseError(entity, 'Query failed', postgrestCodeOf(result.error));
  }
  return result.data as T | null;
}

/**
 * Throw a logged `DatabaseError` for a failed read. For queries whose result
 * shape carries extra fields (e.g. PostgREST `count`) that don't fit
 * `queryOrThrow`'s `{ data, error }` contract.
 */
export function throwDbError(route: string, entity: string, error: unknown): never {
  logDbError(route, error);
  throw new DatabaseError(entity, 'Query failed', postgrestCodeOf(error));
}

/**
 * Wrap an already-throwing read (e.g. a cached query) as a `Result`.
 * Convenience over `queryOrDegrade` when the read is expressed as a promise.
 */
export async function degrade<T>(promise: Promise<T>, fallback: T, route: string, entity: string): Promise<Result<T>> {
  try {
    const data = await promise;
    return ok(data ?? fallback);
  } catch (error) {
    if (error instanceof DatabaseError) return err(error);
    logDbError(route, error);
    return err(new DatabaseError(entity, 'Query failed'));
  }
}

/**
 * Optional section read (homepage sections, sidebars). Never throws: a
 * failure is logged and returned as `{ ok: false }` so the section can render
 * an inline error + retry while the rest of the page stays up.
 */
export async function queryOrDegrade<T>(
  route: string,
  entity: string,
  run: QueryRun,
  fallback: T,
): Promise<Result<T>> {
  try {
    const data = await queryOrThrow<T>(route, entity, run);
    return ok(data ?? fallback);
  } catch (error) {
    if (error instanceof DatabaseError) return err(error);
    logDbError(route, error);
    return err(new DatabaseError(entity, 'Query failed'));
  }
}
