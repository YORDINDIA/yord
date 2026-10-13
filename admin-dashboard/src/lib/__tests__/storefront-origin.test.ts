import { afterEach, describe, expect, it, vi } from 'vitest';
import { storefrontOrigin } from '@/lib/storefront-origin';

/**
 * The same-origin guard every storefront link goes through.
 *
 * In dev both apps serve :3000, so a "View on storefront" link built from a
 * same-origin `NEXT_PUBLIC_APP_URL` just reloads the admin — landing on the
 * admin's own `/products/…` route, which is not-found. The guard answers
 * per request: the configured origin is compared against the request's
 * `host` header, and a match yields null (suppress the link).
 */

const mockHost = vi.hoisted(() => ({ host: 'admin.example.com' }));

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name.toLowerCase() === 'host' ? mockHost.host : null),
  }),
}));

function withEnv(value: string | undefined, run: () => Promise<void>) {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  if (value === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = value;
  return run().finally(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  });
}

afterEach(() => {
  mockHost.host = 'admin.example.com';
});

describe('storefrontOrigin', () => {
  it('returns null when NEXT_PUBLIC_APP_URL is unset or blank', async () => {
    await withEnv(undefined, async () => {
      await expect(storefrontOrigin()).resolves.toBeNull();
    });
    await withEnv('   ', async () => {
      await expect(storefrontOrigin()).resolves.toBeNull();
    });
  });

  it('returns null for a value that is not a URL', async () => {
    await withEnv('not a url', async () => {
      await expect(storefrontOrigin()).resolves.toBeNull();
    });
  });

  it('returns null when the configured origin is the admin itself', async () => {
    await withEnv('https://admin.example.com/', async () => {
      await expect(storefrontOrigin()).resolves.toBeNull();
    });
    // Same host with an explicit port that the request host carries too.
    mockHost.host = 'localhost:3000';
    await withEnv('http://localhost:3000', async () => {
      await expect(storefrontOrigin()).resolves.toBeNull();
    });
  });

  it('returns the origin for a real storefront, stripping any path', async () => {
    await withEnv('https://yord.in/shop/', async () => {
      await expect(storefrontOrigin()).resolves.toBe('https://yord.in');
    });
  });

  it('compares host with port, not just the name', async () => {
    mockHost.host = 'localhost:3001';
    await withEnv('http://localhost:3000', async () => {
      // The storefront on :3000 is reachable even while the admin is on :3001.
      await expect(storefrontOrigin()).resolves.toBe('http://localhost:3000');
    });
  });

  it('links out when the request carries no host header', async () => {
    mockHost.host = '';
    await withEnv('https://yord.in', async () => {
      await expect(storefrontOrigin()).resolves.toBe('https://yord.in');
    });
  });
});
