import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The behavioral collector (`lib/analytics/track.ts`).
 *
 * This is the module stores and checkout import, so the two contracts that
 * matter are: it must never throw into a caller (including in a Node/SSR
 * environment, where everything no-ops), and it must batch — a browse fires
 * a handful of requests, not one per interaction.
 *
 * track.ts holds module state (queue, session id) and registers unload
 * listeners at import time, so every test re-imports a fresh copy after
 * stubbing the browser globals.
 */

type TrackModule = typeof import('@/lib/analytics/track');

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

function browserStubs(options: { sendBeaconOk: boolean; existingSid?: string } = {}) {
  const store = new Map<string, string>(options.existingSid ? [['yord-sid', options.existingSid]] : []);
  const listeners: Record<string, (event?: unknown) => void> = {};
  let uuidCount = 0;
  const windowObj = {
    location: { pathname: '/product/coldplay-tee' },
    origin: 'https://shop.example',
    crypto: { randomUUID: () => (++uuidCount === 1 ? UUID_A : UUID_B) },
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
    addEventListener: vi.fn((type: string, handler: (event?: unknown) => void) => {
      listeners[type] = handler;
    }),
  };
  const documentObj = {
    referrer: '',
    visibilityState: 'visible',
    addEventListener: vi.fn((type: string, handler: (event?: unknown) => void) => {
      listeners[type] = handler;
    }),
  };
  const navigatorObj = {
    sendBeacon: vi.fn(() => options.sendBeaconOk ?? true),
  };
  const fetchMock = vi.fn(async () => ({ ok: true, status: 204 }));

  vi.stubGlobal('window', windowObj);
  vi.stubGlobal('document', documentObj);
  vi.stubGlobal('navigator', navigatorObj);
  vi.stubGlobal('fetch', fetchMock);
  return { store, listeners, navigatorObj, fetchMock };
}

async function freshTrack(): Promise<TrackModule> {
  vi.resetModules();
  return import('@/lib/analytics/track');
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('track (server environment)', () => {
  it('no-ops without a window and never throws', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { track, flushAnalytics } = await freshTrack();

    expect(() =>
      track({ type: 'product_viewed', productId: 1, handle: 'tee' }),
    ).not.toThrow();
    await expect(flushAnalytics()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('track (browser)', () => {
  it('batches at the queue limit into one send', async () => {
    const { navigatorObj } = browserStubs({ sendBeaconOk: true });
    const { track } = await freshTrack();

    for (let i = 0; i < 20; i += 1) {
      track({ type: 'cart_viewed', cartValue: i, cartItems: i });
    }
    expect(navigatorObj.sendBeacon).toHaveBeenCalledTimes(1);
    const [, blob] = navigatorObj.sendBeacon.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
  });

  it('attaches session fields and keeps camelCase props in the payload', async () => {
    const { fetchMock } = browserStubs({ sendBeaconOk: false });
    const { track, flushAnalytics } = await freshTrack();

    track({ type: 'add_to_cart', productId: 12, variantId: 34, quantity: 2, cartValue: 3998, cartItems: 3 });
    // Flush explicitly; the timer path has its own test above.
    await flushAnalytics();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [endpoint, init] = fetchMock.mock.calls[0];
    expect(endpoint).toBe('/api/analytics/events');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      type: 'add_to_cart',
      sid: UUID_A,
      path: '/product/coldplay-tee',
      productId: 12,
      variantId: 34,
      quantity: 2,
    });
    // No document.referrer in the stub: the key is omitted in transit and the
    // route stores NULL (pinned in analytics-events.test.ts).
    expect(body.events[0].referrer).toBeUndefined();
  });

  it('flushes queued events after the delay, not immediately', async () => {
    vi.useFakeTimers();
    const { fetchMock } = browserStubs({ sendBeaconOk: false });
    const { track } = await freshTrack();

    track({ type: 'cart_viewed', cartValue: 10, cartItems: 1 });
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('flushes on pagehide so a departing batch is not lost', async () => {
    const { listeners, fetchMock } = browserStubs({ sendBeaconOk: false });
    const { track } = await freshTrack();

    track({ type: 'page_viewed', template: 'home' });
    expect(listeners.pagehide).toBeTypeOf('function');

    listeners.pagehide();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('keeps one session id per browser and reuses a stored one', async () => {
    const first = browserStubs({});
    const { track, analyticsSessionId } = await freshTrack();
    track({ type: 'page_viewed', template: 'home' });
    expect(analyticsSessionId()).toBe(UUID_A);
    expect(first.store.get('yord-sid')).toBe(UUID_A);

    // A returning browser picks up the stored id instead of minting one.
    browserStubs({ existingSid: UUID_B });
    const again = await freshTrack();
    expect(again.analyticsSessionId()).toBe(UUID_B);
  });

  it('survives a throwing send without surfacing the error', async () => {
    const { navigatorObj, fetchMock } = browserStubs({ sendBeaconOk: false });
    navigatorObj.sendBeacon.mockImplementation(() => {
      throw new Error('beacon exploded');
    });
    fetchMock.mockImplementation(async () => {
      throw new Error('offline');
    });
    const { track, flushAnalytics } = await freshTrack();

    track({ type: 'cart_viewed', cartValue: 1, cartItems: 1 });
    await expect(flushAnalytics()).resolves.toBeUndefined();
  });
});

describe('trackIfNew', () => {
  it('fires once per key until the key changes', async () => {
    const { fetchMock } = browserStubs({ sendBeaconOk: false });
    const { trackIfNew, flushAnalytics } = await freshTrack();

    trackIfNew('product:12', { type: 'product_viewed', productId: 12, handle: 'tee' });
    trackIfNew('product:12', { type: 'product_viewed', productId: 12, handle: 'tee' });
    trackIfNew('product:13', { type: 'product_viewed', productId: 13, handle: 'hoodie' });

    await flushAnalytics();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events).toHaveLength(2);
    expect(body.events.map((event: { productId: number }) => event.productId)).toEqual([12, 13]);
  });
});
