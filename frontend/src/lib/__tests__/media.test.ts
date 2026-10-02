/**
 * `isDisplayableImageUrl` — the gate that stops a dead legacy URL from hiding a
 * working one.
 *
 * `collections.image_src` holds pre-migration Shopify URLs
 * (`http://www.yordindia.com/cdn/shop/...`) for 29 of 34 collections and all
 * seven distinct values 404. `getArtistsWithMetadata` used to prefer it over
 * the local `/artists/<handle>-hero.png`, so the artist cards rendered broken
 * images. These tests pin the rules the caller relies on: legacy hosts and
 * non-https URLs are rejected, root-relative paths and https URLs pass.
 */
import { describe, expect, it } from 'vitest';
import { LEGACY_IMAGE_HOSTS, firstDisplayableImageUrl, isDisplayableImageUrl } from '@/lib/media';

const DEAD_SHOPIFY = 'http://www.yordindia.com/cdn/shop/files/HaSJ_pMiS9-VL1kSvnyQ.png';
const LOCAL_HERO = '/artists/coldplay-hero.png';
const R2_IMAGE = 'https://pub-1b4ba83ceb0f448d85b64fc95d8847bb.r2.dev/products/coldplay-tee/01.webp';

describe('isDisplayableImageUrl', () => {
  it('accepts an https URL and a root-relative path', () => {
    expect(isDisplayableImageUrl(R2_IMAGE)).toBe(true);
    expect(isDisplayableImageUrl(LOCAL_HERO)).toBe(true);
  });

  it('rejects the legacy Shopify store hosts', () => {
    expect(isDisplayableImageUrl(DEAD_SHOPIFY)).toBe(false);
    expect(isDisplayableImageUrl('https://www.yordindia.com/cdn/shop/files/x.png')).toBe(false);
    expect(isDisplayableImageUrl('https://yordindia.com/cdn/shop/files/x.png')).toBe(false);
    expect(isDisplayableImageUrl('https://cdn.yordindia.com/x.png')).toBe(false);
    expect(isDisplayableImageUrl('https://yordindia.myshopify.com/cdn/shop/files/x.png')).toBe(false);
    expect(isDisplayableImageUrl('https://cdn.shopify.com/s/files/1/2/3/x.png')).toBe(true);
  });

  it('rejects a non-https URL (mixed content on an https page)', () => {
    expect(isDisplayableImageUrl('http://www.yordindia.com/x.png')).toBe(false);
    expect(isDisplayableImageUrl('http://cdn.shopify.com/x.png')).toBe(false);
    expect(isDisplayableImageUrl('ftp://cdn.shopify.com/x.png')).toBe(false);
    expect(isDisplayableImageUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects empty or unusable values', () => {
    for (const value of [null, undefined, '', '   ', 'coldplay', '//cdn.shopify.com/x.png']) {
      expect(isDisplayableImageUrl(value), String(value)).toBe(false);
    }
  });

  it('documents the legacy host list it checks', () => {
    expect(LEGACY_IMAGE_HOSTS).toContain('www.yordindia.com');
  });
});

describe('firstDisplayableImageUrl', () => {
  it('skips a dead database URL instead of shadowing the working local hero', () => {
    // The result reached the artist card as `heroImage`; with a plain `||`
    // chain the first (dead) candidate won and the card rendered nothing.
    expect(firstDisplayableImageUrl(DEAD_SHOPIFY, LOCAL_HERO)).toBe(LOCAL_HERO);
    expect(firstDisplayableImageUrl(DEAD_SHOPIFY, null, LOCAL_HERO)).toBe(LOCAL_HERO);
  });

  it('prefers the stored R2 image and returns undefined when nothing can render', () => {
    expect(firstDisplayableImageUrl(R2_IMAGE, LOCAL_HERO)).toBe(R2_IMAGE);
    expect(firstDisplayableImageUrl(DEAD_SHOPIFY, null, undefined)).toBeUndefined();
  });
});
