import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { LOW_STOCK_THRESHOLD, PRODUCT_STATUSES, isOneOf, stockTone } from '@/lib/constants';
import { isUniqueViolation } from '@/lib/errors';
import { firstIssue } from '@/lib/validation';

/** Small shared helpers that replaced hand-written copies across actions and pages. */

describe('firstIssue', () => {
  const schema = z.object({ topic: z.string().min(3, 'Too short.') });
  const failure = (input: unknown) => {
    const result = schema.safeParse(input);
    if (result.success) throw new Error('expected a failure');
    return result.error;
  };

  it('prefixes the field path', () => {
    expect(firstIssue(failure({ topic: 'a' }), 'fallback')).toBe('topic: Too short.');
  });

  it('uses rootPath for an issue on the root value', () => {
    expect(firstIssue(failure('nope'), 'fallback', 'body')).toMatch(/^body: /);
  });

  it('returns the bare message for a root issue with no rootPath', () => {
    const error = failure('nope');
    expect(firstIssue(error, 'fallback')).toBe(error.issues[0].message);
  });

  it('returns the fallback when there are no issues', () => {
    expect(firstIssue(new z.ZodError([]), 'fallback')).toBe('fallback');
  });
});

describe('isOneOf', () => {
  it('accepts members and rejects everything else', () => {
    expect(isOneOf(PRODUCT_STATUSES, 'draft')).toBe(true);
    expect(isOneOf(PRODUCT_STATUSES, 'nope')).toBe(false);
    expect(isOneOf(PRODUCT_STATUSES, undefined)).toBe(false);
    expect(isOneOf(PRODUCT_STATUSES, 3)).toBe(false);
  });
});

describe('stockTone', () => {
  it('splits on zero and the low-stock threshold', () => {
    expect(stockTone(0)).toBe('out');
    expect(stockTone(-2)).toBe('out');
    expect(stockTone(1)).toBe('low');
    expect(stockTone(LOW_STOCK_THRESHOLD)).toBe('low');
    expect(stockTone(LOW_STOCK_THRESHOLD + 1)).toBe('ok');
  });
});

describe('isUniqueViolation', () => {
  it('matches the 23505 code or a duplicate message', () => {
    expect(isUniqueViolation({ code: '23505', message: 'x' })).toBe(true);
    expect(isUniqueViolation({ message: 'duplicate key value' })).toBe(true);
    expect(isUniqueViolation({ code: '42501', message: 'denied' })).toBe(false);
  });
});
