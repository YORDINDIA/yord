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
    // The entity goes into the message, not just a property. Next serializes only
    // `message` and `digest` when handing an error to a client `error.tsx`, so a
    // client boundary cannot `instanceof DatabaseError` — it can only match on
    // the message. Prefixing here keeps that distinguishable from an unexpected
    // error while leaving the PostgREST detail out of the admin-facing copy.
    super(`Could not read ${entity}: ${message}`);
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

/** Postgres unique-constraint violation (code 23505) as PostgREST reports it. */
export function isUniqueViolation(error: { code?: string; message: string }): boolean {
  return error.code === '23505' || error.message.includes('duplicate');
}

/** Narrow an unknown thrown value to a message string. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}
