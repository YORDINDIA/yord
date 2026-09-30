/**
 * Error types shared by the data layer and route handlers.
 *
 * The data layer never swallows a failed read: an empty result set is `[]`, a
 * missing row is `null`, and a broken query throws `DatabaseError` so the
 * nearest `error.tsx` renders instead of a silently empty table.
 */
export class DatabaseError extends Error {
  /** Supabase/PostgREST error code when one is available (e.g. '42501'). */
  readonly code?: string;
  /** Entity/table the failed read belonged to, for error UI copy. */
  readonly entity: string;

  constructor(entity: string, message: string, code?: string) {
    super(message);
    this.name = 'DatabaseError';
    this.entity = entity;
    this.code = code;
  }
}

/** Raised when an authenticated caller is missing or not an active admin. */
export class ForbiddenError extends Error {
  constructor(message = 'You do not have admin access.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** Narrow an unknown thrown value to a message string. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}
