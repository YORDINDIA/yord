'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { classifyPage } from '@/lib/analytics/routeTemplate';
import { trackIfNew } from '@/lib/analytics/track';
import { loadPostHog, postHogEnabled } from '@/providers/posthog-sdk';

/**
 * Route-change bookkeeping. Two independent jobs:
 *
 *  - the first-party pageview (the admin's engagement rollups group on the
 *    classified template). It runs whether or not PostHog is configured, and
 *    `trackIfNew` keeps dev StrictMode remounts from double-counting one
 *    navigation.
 *  - PostHog's own `$pageview`, which needs the SDK. That used to be a
 *    module-scope `posthog-js/react` import, which put the SDK in the initial
 *    bundle even with no key; `loadPostHog()` fetches it only when a usable key
 *    exists, and the effect below never calls it otherwise. It is guarded by
 *    `lastPageviewUrl` the way `trackIfNew` guards the first-party event —
 *    dev StrictMode mounts the effect twice, and one navigation must not
 *    capture twice.
 */
// Last URL the `$pageview` effect captured. Production navigation always
// changes the URL between effect runs, so the guard cannot swallow a real
// pageview; it only dedupes a remount of the same one.
let lastPageviewUrl: string | null = null;

function PostHogPageViewInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const { template, handle } = classifyPage(pathname);
    trackIfNew(pathname, {
      type: 'page_viewed',
      template,
      ...(handle !== undefined ? { handle } : {}),
    });
  }, [pathname]);

  useEffect(() => {
    if (!pathname || !postHogEnabled()) return;

    let url = window.origin + pathname;
    const query = searchParams.toString();
    if (query) url = `${url}?${query}`;

    if (lastPageviewUrl === url) return;
    lastPageviewUrl = url;

    void loadPostHog().then((posthog) => {
      posthog?.capture('$pageview', { $current_url: url });
    });
  }, [pathname, searchParams]);

  return null;
}

export default function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageViewInner />
    </Suspense>
  );
}
