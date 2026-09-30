/**
 * Small error taxonomy for the storefront data layer.
 *
 * Every error carries a stable `code` so UI boundaries and logs can switch on
 * it without parsing messages. The data-layer contract is:
 *
 * - genuinely empty  → return `[]` / `null`
 * - missing row      → return `null` (page calls `notFound()`)
 * - failed query     → throw `DatabaseError` (nearest `error.tsx` renders)
 */

export type AppErrorCode = 'NOT_FOUND' | 'DATABASE_ERROR' | 'VALIDATION_ERROR' | 'RATE_LIMITED';

export abstract class AppError extends Error {
  abstract readonly code: AppErrorCode;
}

/** A row that should exist does not (detail pages map this to `notFound()`). */
export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND' as const;
  readonly entity: string;
  readonly identifier?: string;

  constructor(entity: string, identifier?: string) {
    super(identifier ? `${entity} not found: ${identifier}` : `${entity} not found`);
    this.name = 'NotFoundError';
    this.entity = entity;
    this.identifier = identifier;
  }
}

/**
 * A query failed: network, 5xx, RLS denial, or timeout. Never swallowed —
 * load-bearing reads throw this so the error boundary renders instead of a
 * misleading "no results" state.
 */
export class DatabaseError extends AppError {
  readonly code = 'DATABASE_ERROR' as const;
  /** Supabase/PostgREST error code when one is available (e.g. '42501'). */
  readonly postgrestCode?: string;
  /** Entity/table the failed read belonged to, for error UI copy. */
  readonly entity: string;

  constructor(entity: string, message: string, postgrestCode?: string) {
    super(message);
    this.name = 'DatabaseError';
    this.entity = entity;
    this.postgrestCode = postgrestCode;
  }
}

/** Caller-supplied input failed validation (bad params, bad cart lines). */
export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** A rate limit was hit; `retryAfterSeconds` may be absent when unknown. */
export class RateLimitError extends AppError {
  readonly code = 'RATE_LIMITED' as const;
  readonly retryAfterSeconds?: number;

  constructor(message = 'Too many requests. Please try again shortly.', retryAfterSeconds?: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** PostgREST "no rows" code from `.single()` — a missing row, not a failure. */
export function isPostgrestNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'PGRST116'
  );
}

/** Extract the PostgREST error code when present (e.g. '42501', 'PGRST116'). */
export function postgrestCodeOf(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string' && code.length > 0) return code;
  }
  return undefined;
}

/** Narrow an unknown thrown value to a message string. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}
