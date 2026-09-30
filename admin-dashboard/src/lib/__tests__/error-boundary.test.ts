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
 */
const DATABASE_PREFIX = /^Could not read ([^:]+):/;

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
    expect(DATABASE_PREFIX.exec(asClientSeesIt.message)?.[1]).toBe('products');
  });

  it('handles an entity name containing spaces', () => {
    expect(DATABASE_PREFIX.exec(new DatabaseError('product variants', 'boom').message)?.[1]).toBe(
      'product variants',
    );
  });

  it('does not match a message missing the separator colon', () => {
    // Guards against the regex growing loose enough to catch unrelated errors.
    expect(DATABASE_PREFIX.exec('Could not read orders')?.[1]).toBeUndefined();
    expect(DATABASE_PREFIX.exec('Could not render orders')?.[1]).toBeUndefined();
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
