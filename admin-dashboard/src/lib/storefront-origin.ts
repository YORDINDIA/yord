import 'server-only';

import { headers } from 'next/headers';

/**
 * The storefront origin (`NEXT_PUBLIC_APP_URL`), or null when there is nothing
 * to link to.
 *
 * A same-origin value is dropped: in dev both apps serve :3000, so a "View on
 * storefront" link would just reload the admin — landing on the admin's own
 * `/products/…` or `/blog/…` route, which does not exist and renders not-found.
 * This guard used to live only on the dashboard's header action; the product
 * preview card and the article page kept emitting those dead links, so every
 * storefront link now goes through here.
 *
 * Server-only (`next/headers`): it reads the request's `host`, so it answers
 * per request rather than per build.
 */
export async function storefrontOrigin(): Promise<string | null> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return null;

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    return null;
  }

  const host = (await headers()).get('host');
  if (host && url.host === host) return null;
  return url.origin;
}
