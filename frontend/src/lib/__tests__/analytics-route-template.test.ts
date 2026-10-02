import { describe, expect, it } from 'vitest';
import { classifyPage } from '@/lib/analytics/routeTemplate';

/**
 * The route buckets `page_viewed` events carry, which the admin's
 * "Views by page type" donut groups on. A template landing in the wrong
 * bucket silently skews that chart, so the mapping is pinned here.
 */
describe('classifyPage', () => {
  it('buckets the home route', () => {
    expect(classifyPage('/')).toEqual({ template: 'home' });
  });

  it('extracts handles from entity routes', () => {
    expect(classifyPage('/product/coldplay-tee')).toEqual({
      template: 'product',
      handle: 'coldplay-tee',
    });
    expect(classifyPage('/collection/tshirts')).toEqual({
      template: 'collection',
      handle: 'tshirts',
    });
    // The plural form is the same collection page in this app.
    expect(classifyPage('/collections/new-arrivals')).toEqual({
      template: 'collection',
      handle: 'new-arrivals',
    });
    expect(classifyPage('/artist/diljit-dosanjh')).toEqual({
      template: 'artist',
      handle: 'diljit-dosanjh',
    });
    expect(classifyPage('/blog/tour-outfits')).toEqual({
      template: 'blog',
      handle: 'tour-outfits',
    });
  });

  it('buckets listing and utility routes without handles', () => {
    expect(classifyPage('/products')).toEqual({ template: 'catalog' });
    expect(classifyPage('/search')).toEqual({ template: 'search' });
    expect(classifyPage('/cart')).toEqual({ template: 'cart' });
    expect(classifyPage('/checkout')).toEqual({ template: 'checkout' });
    expect(classifyPage('/account/orders')).toEqual({ template: 'account' });
    expect(classifyPage('/collections')).toEqual({ template: 'collection' });
  });

  it('ignores query strings and buckets everything else as other', () => {
    expect(classifyPage('/products?sort=price-asc')).toEqual({ template: 'catalog' });
    expect(classifyPage('/about')).toEqual({ template: 'other' });
    expect(classifyPage('/concerts/coldplay')).toEqual({ template: 'other' });
    expect(classifyPage('/track-order')).toEqual({ template: 'other' });
  });

  it('keeps entity templates when the handle is missing', () => {
    expect(classifyPage('/product/')).toEqual({ template: 'product' });
  });
});
