// Error taxonomy + Result helper tests. Runners are injected, so no
// Supabase/Next imports — pure node.
import { describe, expect, it, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import {
  DatabaseError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  isPostgrestNotFound,
  postgrestCodeOf,
  errorMessage,
} from '@/lib/errors';
import {
  degrade,
  isSupabaseUnconfigured,
  ok,
  err,
  queryOrDegrade,
  queryOrThrow,
  throwDbError,
} from '@/lib/result';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// queryOrThrow short-circuits to null when Supabase is unconfigured, so the
// failure-path tests below run with dummy env (read per call, not per import).
const URL_KEY = 'NEXT_PUBLIC_SUPABASE_URL';
const PUBLISHABLE_KEY = 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY';
let savedUrl: string | undefined;
let savedPublishable: string | undefined;
beforeAll(() => {
  savedUrl = process.env[URL_KEY];
  savedPublishable = process.env[PUBLISHABLE_KEY];
  process.env[URL_KEY] = 'http://localhost:54321';
  process.env[PUBLISHABLE_KEY] = 'test-key';
});
afterAll(() => {
  if (savedUrl === undefined) delete process.env[URL_KEY];
  else process.env[URL_KEY] = savedUrl;
  if (savedPublishable === undefined) delete process.env[PUBLISHABLE_KEY];
  else process.env[PUBLISHABLE_KEY] = savedPublishable;
});

describe('error taxonomy', () => {
  it('carries stable codes', () => {
    expect(new DatabaseError('products', 'boom').code).toBe('DATABASE_ERROR');
    expect(new NotFoundError('products', 'x').code).toBe('NOT_FOUND');
    expect(new ValidationError('bad').code).toBe('VALIDATION_ERROR');
    expect(new RateLimitError().code).toBe('RATE_LIMITED');
  });

  it('DatabaseError keeps entity + postgrest code', () => {
    const e = new DatabaseError('orders', 'RLS', '42501');
    expect(e.entity).toBe('orders');
    expect(e.postgrestCode).toBe('42501');
  });

  it('detects PGRST116 missing-row errors only', () => {
    expect(isPostgrestNotFound({ code: 'PGRST116' })).toBe(true);
    expect(isPostgrestNotFound({ code: '42501' })).toBe(false);
    expect(isPostgrestNotFound(null)).toBe(false);
    expect(isPostgrestNotFound('PGRST116')).toBe(false);
  });

  it('extracts postgrest codes', () => {
    expect(postgrestCodeOf({ code: '42501' })).toBe('42501');
    expect(postgrestCodeOf({ code: '' })).toBeUndefined();
    expect(postgrestCodeOf(null)).toBeUndefined();
  });

  it('narrows unknown throws to messages', () => {
    expect(errorMessage(new Error('x'))).toBe('x');
    expect(errorMessage('plain')).toBe('plain');
    expect(errorMessage(42)).toBe('Unknown error');
  });
});

describe('queryOrThrow', () => {
  it('passes data through', async () => {
    const rows = [{ id: 1 }];
    await expect(
      queryOrThrow('r', 'products', () => Promise.resolve({ data: rows, error: null })),
    ).resolves.toEqual(rows);
  });

  it('maps PGRST116 to null (missing row)', async () => {
    await expect(
      queryOrThrow('r', 'products', () =>
        Promise.resolve({ data: null, error: { code: 'PGRST116' } }),
      ),
    ).resolves.toBeNull();
  });

  it('throws DatabaseError on query failure', async () => {
    const error = queryOrThrow('r', 'products', () =>
      Promise.resolve({ data: null, error: { code: '42501', message: 'denied' } }),
    );
    await expect(error).rejects.toThrow(DatabaseError);
    await expect(error).rejects.toMatchObject({ postgrestCode: '42501' });
  });

  it('wraps transport throws as DatabaseError', async () => {
    await expect(
      queryOrThrow('r', 'products', () => Promise.reject(new Error('fetch failed'))),
    ).rejects.toThrow(DatabaseError);
  });
});

describe('queryOrDegrade / degrade', () => {
  it('returns ok on success', async () => {
    const fallback: number[] = [];
    const result = await queryOrDegrade('r', 'products', () =>
      Promise.resolve({ data: [1], error: null }), fallback);
    expect(result).toEqual(ok([1]));
  });

  it('returns err (never throws) on failure', async () => {
    const fallback: number[] = [];
    const result = await queryOrDegrade('r', 'products', () =>
      Promise.resolve({ data: null, error: { code: '500' } }), fallback);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(DatabaseError);
  });

  it('degrade wraps a throwing promise with a fallback error', async () => {
    const result = await degrade(Promise.reject(new Error('x')), 'fb', 'r', 'products');
    expect(result.ok).toBe(false);
    expect(err(new DatabaseError('e', 'm')).ok).toBe(false);
  });

  it('throwDbError always throws DatabaseError', () => {
    expect(() => throwDbError('r', 'products', { code: '500' })).toThrow(DatabaseError);
  });
});

describe('isSupabaseUnconfigured', () => {
  it('reflects env presence', () => {
    expect(isSupabaseUnconfigured()).toBe(false);
    delete process.env[URL_KEY];
    expect(isSupabaseUnconfigured()).toBe(true);
    process.env[URL_KEY] = 'http://localhost:54321';
    expect(isSupabaseUnconfigured()).toBe(false);
  });
});
