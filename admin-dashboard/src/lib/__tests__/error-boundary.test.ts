import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DatabaseError, errorMessage } from '@/lib/errors';

/**
 * Regression tests for the admin error boundary.
 *
 * The boundary originally branched on `error instanceof DatabaseError`. That
 * check is always false: `DatabaseError` is thrown on the server and Next
 * serializes only `message`/`digest` into a client `error.tsx`, so the class
 * never crosses the RSC boundary. The branch compiled and never fired, so every
 * database failure rendered the generic copy and the admin was told to check the
 * server log for a read that had failed.
 *
 * These tests pin the message contract the boundary matches on. If the format
 * changes, the boundary degrades silently again — that is what this test exists
 * to prevent.
 *
 * The matcher itself is read out of `src/app/(admin)/error.tsx` (not
 * duplicated here): if the boundary ever stops recognizing database errors,
 * these tests fail against its own pattern instead of passing against a stale
 * local copy.
 */

/** The exact message pattern the client boundary matches on, read from its source. */
function boundaryPattern(): RegExp {
  const source = readFileSync(join(process.cwd(), 'src', 'app', '(admin)', 'error.tsx'), 'utf8');
  const match = /\/([^/\n]*Could not read[^/\n]*)\//.exec(source);
  if (!match) {
    throw new Error('error.tsx no longer matches DatabaseError by message prefix');
  }
  return new RegExp(match[1]);
}

function boundaryEntity(message: string): string | undefined {
  return boundaryPattern().exec(message)?.[1];
}

describe('DatabaseError', () => {
  it('prefixes the message with the entity so a client boundary can match it', () => {
    const error = new DatabaseError('orders', 'permission denied for table orders', '42501');

    expect(error.message).toBe('Could not read orders: permission denied for table orders');
    expect(error.name).toBe('DatabaseError');
    expect(error.code).toBe('42501');
  });

  it('is matched by the boundary regex on the serialized message alone', () => {
    const error = new DatabaseError('products', 'JWT expired', 'PGRST301');

    // Exactly what Next hands the client boundary: the class is gone, only the
    // message and digest survive.
    const asClientSeesIt = { message: error.message, digest: 'abc123' };
    expect(boundaryEntity(asClientSeesIt.message)).toBe('products');
  });

  it('handles an entity name containing spaces', () => {
    expect(boundaryEntity(new DatabaseError('product variants', 'boom').message)).toBe(
      'product variants',
    );
  });

  it('does not match a message missing the separator colon', () => {
    // Guards against the regex growing loose enough to catch unrelated errors.
    expect(boundaryEntity('Could not read orders')).toBeUndefined();
    expect(boundaryEntity('Could not render orders')).toBeUndefined();
  });

  it('fails loudly if error.tsx stops matching this contract', () => {
    // The pattern comes from the boundary's own source: if someone edits
    // error.tsx to match something else, this — not a stale copy — changes.
    expect(() => boundaryPattern()).not.toThrow();
    expect(boundaryEntity(new DatabaseError('orders', 'boom').message)).toBe('orders');
  });
});

describe('errorMessage', () => {
  it('prefers the message of an Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('handles a thrown string and an unknown value', () => {
    expect(errorMessage('plain string')).toBe('plain string');
    expect(errorMessage({ nope: true })).toBe('Unknown error');
  });

  it('returns the prefixed message for a DatabaseError', () => {
    expect(errorMessage(new DatabaseError('orders', 'boom'))).toBe('Could not read orders: boom');
  });
});
