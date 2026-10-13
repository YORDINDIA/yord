import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/components/reactbits/BrandShimmer', () => ({ default: () => null }));

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});

describe('storage-backed controls during hydration', () => {
  it('does not read localStorage while rendering the server-compatible first pass', async () => {
    const getItem = vi.fn(() => 'collapsed');
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: { getItem } },
    });
    const [{ default: Sidebar }, { default: ThemeToggle }] = await Promise.all([
      import('./Sidebar'),
      import('../ui/ThemeToggle'),
    ]);

    renderToString(createElement(Sidebar, { badges: { fulfillmentQueue: 0, lowStock: 0 } }));
    renderToString(createElement(ThemeToggle));

    expect(getItem).not.toHaveBeenCalled();
  });
});
