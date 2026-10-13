// Logger redaction tests: secret material must not reach the log payload.
// Runs through the public log functions (redactSecrets is private).
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { logDbError } from '@/lib/logger';

beforeEach(() => {
  vi.restoreAllMocks();
});

function lastPayload(spy: ReturnType<typeof vi.spyOn>): string {
  return String(spy.mock.calls.at(-1)?.[0] ?? '');
}

describe('logDbError redaction', () => {
  it('redacts opaque secret keys', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logDbError('checkout', {
      code: 'PGRST301',
      message: 'auth failed for key sb_secret_AbC123xyz_-abc',
    });
    const payload = lastPayload(spy);
    expect(payload).not.toContain('sb_secret_AbC123xyz_-abc');
    expect(payload).toContain('[REDACTED]');
  });

  it('redacts legacy service_role JWTs', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logDbError('checkout', {
      message:
        'failed eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature123',
    });
    const payload = lastPayload(spy);
    expect(payload).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(payload).toContain('[REDACTED_JWT]');
  });

  it('keeps route, code and detail readable', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logDbError('newsletter', { code: '42501', message: 'permission denied' });
    const payload = JSON.parse(lastPayload(spy));
    expect(payload.route).toBe('newsletter');
    expect(payload.code).toBe('42501');
    expect(payload.detail).toContain('permission denied');
  });
});
