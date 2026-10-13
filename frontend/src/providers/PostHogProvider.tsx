'use client';

import { useEffect } from 'react';
import { loadPostHog, postHogEnabled } from '@/providers/posthog-sdk';

/**
 * PostHog bootstrap. Analytics stay off unless a real project key was inlined
 * at build time.
 *
 * Two problems this solves:
 *  1. The deployed build inlined the `.env.example` placeholder
 *     (`phc_xxxx…`), so every page initialised PostHog and fired
 *     `POST https://us.i.posthog.com/flags/?v=2` → 401, which is the
 *     Lighthouse "browser errors logged to console" failure. A missing or
 *     placeholder key is now a complete no-op.
 *  2. `posthog-js` used to be a module-scope import, putting the whole SDK
 *     (~62 KB brotli) in the initial bundle. It is fetched from an idle
 *     callback by `loadPostHog()` (see `providers/posthog-sdk.ts`), and only
 *     when a usable key exists.
 *
 * The SDK is initialised on its own shared default instance rather than by
 * rendering `<PostHogProvider client={…}>` from `posthog-js/react`:
 *  - that package statically imports `posthog-js` and registers it as its
 *    context default (`react/dist/esm/index.js`), so importing the React
 *    wrapper at module scope would pull the SDK straight back into the
 *    initial bundle — the thing this file exists to defer;
 *  - swapping this component's output root from a fragment to the provider
 *    once the client loads would unmount and remount the whole app subtree
 *    one idle callback after load.
 * Every caller (`PostHogPageView`, `useAuth`) reads the same instance through
 * `loadPostHog()`, so the React context is not needed.
 */

/** Next idle period; Safari has no `requestIdleCallback`. */
function scheduleIdle(callback: () => void): number {
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback, { timeout: 3000 });
  }
  return window.setTimeout(callback, 2000);
}

function cancelIdle(handle: number) {
  if (typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(handle);
  } else {
    window.clearTimeout(handle);
  }
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!postHogEnabled()) {
      if (process.env.NODE_ENV === 'development') {
        console.info(
          'PostHog is off: NEXT_PUBLIC_POSTHOG_KEY is missing or a placeholder.',
        );
      }
      return;
    }

    let cancelled = false;
    const handle = scheduleIdle(() => {
      if (cancelled) return;
      void loadPostHog();
    });

    return () => {
      cancelled = true;
      cancelIdle(handle);
    };
  }, []);

  return <>{children}</>;
}
