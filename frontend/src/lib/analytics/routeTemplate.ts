import type { PageTemplate } from './eventsSchema';

/**
 * Classify a pathname into the coarse page buckets the admin's
 * `page_views_by_template` rollup groups on, plus the handle when the route
 * is entity-scoped (`/product/<handle>`, `/collection/<handle>`,
 * `/artist/<handle>`, `/blog/<slug>`).
 *
 * Pure and framework-free so the vitest suite can pin the mapping without
 * mounting a router. Query strings are ignored — the collector already sends
 * `location.pathname`.
 */
export interface PageClassification {
  template: PageTemplate;
  handle?: string;
}

export function classifyPage(pathname: string): PageClassification {
  const segments = pathname.split('?')[0].split('/').filter(Boolean);
  const [root, second] = segments;

  switch (root) {
    case undefined:
      return { template: 'home' };
    case 'product':
      return second ? { template: 'product', handle: second } : { template: 'product' };
    // Both singular and plural are collection pages in this app.
    case 'collection':
    case 'collections':
      return second ? { template: 'collection', handle: second } : { template: 'collection' };
    case 'artist':
      return second ? { template: 'artist', handle: second } : { template: 'artist' };
    case 'products':
      return { template: 'catalog' };
    case 'search':
      return { template: 'search' };
    case 'blog':
      return second ? { template: 'blog', handle: second } : { template: 'blog' };
    case 'cart':
      return { template: 'cart' };
    case 'checkout':
      return { template: 'checkout' };
    case 'account':
      return { template: 'account' };
    default:
      return { template: 'other' };
  }
}
