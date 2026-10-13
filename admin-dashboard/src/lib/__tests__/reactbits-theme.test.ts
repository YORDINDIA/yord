import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `reactbits-theme` reads live browser globals (`document`, `getComputedStyle`,
 * `MutationObserver`) and vitest here is node-environment, so each test installs
 * minimal stubs. The colour cache lives at module scope, so every test
 * re-imports the module fresh.
 *
 * What is pinned down: the snapshot must be stable while the theme is unchanged
 * (or React re-renders forever), but must re-resolve when `data-theme` changes —
 * including a flip that happens while no consumer is subscribed, when the
 * MutationObserver is disconnected. That flip used to leave the stale palette
 * cached until the next observed mutation.
 */

type MutationCallback = (mutations: unknown[], observer: unknown) => void;

interface ObserverStub {
  callback: MutationCallback;
  observed: boolean;
  observedAttributes: string[] | undefined;
  fire(): void;
}

let theme: string | null;
let tokens: Record<string, string>;
let observers: ObserverStub[];

function installBrowserGlobals() {
  vi.stubGlobal('document', {
    documentElement: {
      getAttribute: (name: string) => (name === 'data-theme' ? theme : null),
    },
  });
  vi.stubGlobal(
    'getComputedStyle',
    () =>
      ({
        getPropertyValue: (name: string) => tokens[name] ?? '',
      }) as unknown as CSSStyleDeclaration,
  );
  vi.stubGlobal(
    'MutationObserver',
    class {
      callback: MutationCallback;
      observed = false;
      observedAttributes: string[] | undefined;
      constructor(callback: MutationCallback) {
        this.callback = callback;
      }
      observe(_target: unknown, options?: { attributeFilter?: string[] }) {
        this.observed = true;
        this.observedAttributes = options?.attributeFilter;
        observers.push(this as unknown as ObserverStub);
      }
      disconnect() {
        this.observed = false;
      }
      // The real observer fires asynchronously after the attribute change, and
      // stops delivering entirely once disconnected — mirror both behaviours so
      // `fire()` cannot fake a callback the real observer would never make.
      fire() {
        if (!this.observed) return;
        this.callback([], this);
      }
    },
  );
}

function flipTheme(nextTheme: string, nextTokens: Record<string, string>) {
  theme = nextTheme;
  tokens = nextTokens;
}

async function importStore() {
  vi.resetModules();
  const themeModule = await import('@/lib/reactbits-theme');
  return themeModule.reactBitsColorsStore;
}

const DARK = { '--accent': '#f3b13f', '--surface-card': '#12151d' };
const LIGHT = { '--accent': '#8a6100', '--surface-card': '#ffffff' };

beforeEach(() => {
  theme = 'dark';
  tokens = DARK;
  observers = [];
  installBrowserGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reactBitsColorsStore', () => {
  it('re-resolves after a theme flip with no consumer subscribed', async () => {
    const store = await importStore();
    const dark = store.getSnapshot();
    expect(dark.accent).toBe('#f3b13f');

    // No subscription exists here — this is the window the old cache leaked
    // across: the observer is disconnected, nothing clears the cache.
    flipTheme('light', LIGHT);

    const light = store.getSnapshot();
    expect(light.accent).toBe('#8a6100');
    expect(light.surface).toBe('#ffffff');
    expect(light).not.toBe(dark);
  });

  it('returns the identical object while the theme is unchanged', async () => {
    const store = await importStore();
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);
    expect(store.getSnapshot()).toBe(first);
  });

  it('notifies subscribers on a theme mutation and re-reads the cascade', async () => {
    const store = await importStore();
    const onChange = vi.fn();
    const unsubscribe = store.subscribe(onChange);
    expect(observers).toHaveLength(1);
    expect(observers[0].observedAttributes).toEqual(['data-theme']);

    const dark = store.getSnapshot();
    flipTheme('light', LIGHT);
    observers[0].fire();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().accent).toBe('#8a6100');
    expect(store.getSnapshot()).not.toBe(dark);
    unsubscribe();
  });

  it('stops notifying after unsubscribe but still re-reads by theme key', async () => {
    const store = await importStore();
    const onChange = vi.fn();
    const unsubscribe = store.subscribe(onChange);
    const observer = observers[0];

    unsubscribe();
    expect(observer.observed).toBe(false);

    flipTheme('light', LIGHT);
    observer.fire();
    expect(onChange).not.toHaveBeenCalled();
    expect(store.getSnapshot().accent).toBe('#8a6100');
  });

  it('treats a missing data-theme attribute as its own cache key', async () => {
    theme = null;
    tokens = { '--accent': '#111111' };
    const store = await importStore();
    const unthemed = store.getSnapshot();
    expect(unthemed.accent).toBe('#111111');

    flipTheme('dark', DARK);
    expect(store.getSnapshot().accent).toBe('#f3b13f');
    expect(store.getSnapshot()).not.toBe(unthemed);
  });

  it('keeps the document-less contract: empty server snapshot, noop subscribe', async () => {
    vi.unstubAllGlobals();
    const store = await importStore();

    const server = store.getServerSnapshot();
    expect(server.accent).toBe('');
    expect(server.surface).toBe('');
    expect(store.getSnapshot()).toBe(server);

    const unsubscribe = store.subscribe(() => {});
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });
});
