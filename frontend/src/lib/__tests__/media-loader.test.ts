// Media loader tests: the product-image width→variant rewrite, pass-through for
// every other stored URL, and the r2.dev → custom-domain rewrite that keeps a
// domain move out of the database.
import { describe, expect, it } from 'vitest';
import mediaLoader, { isR2DevUrl, productVariantWidth } from '@/lib/media-loader';

const R2_DEV = 'https://pub-abc123.r2.dev';
const PRODUCT = `${R2_DEV}/products/premium-tee/01.webp`;

describe('productVariantWidth', () => {
  it('maps a requested width to the nearest sibling, ties rounding up', () => {
    expect(productVariantWidth(96)).toBe(320);
    expect(productVariantWidth(160)).toBe(320);
    expect(productVariantWidth(256)).toBe(320);
    expect(productVariantWidth(320)).toBe(320);
    expect(productVariantWidth(384)).toBe(320);
    expect(productVariantWidth(480)).toBe(640); // tie: 160 from both 320 and 640
    expect(productVariantWidth(640)).toBe(640);
    expect(productVariantWidth(800)).toBe(960); // tie: 160 from both 640 and 960
    expect(productVariantWidth(960)).toBe(960);
    expect(productVariantWidth(1120)).toBe(1280); // tie: 160 from both 960 and 1280
    expect(productVariantWidth(1280)).toBe(1280);
  });

  it('keeps the 1600px original above the largest sibling', () => {
    expect(productVariantWidth(1281)).toBe(1600);
    expect(productVariantWidth(1600)).toBe(1600);
    expect(productVariantWidth(3840)).toBe(1600);
  });

  it('falls back to the smallest sibling for a missing or nonsense width', () => {
    expect(productVariantWidth(0)).toBe(320);
    expect(productVariantWidth(-1)).toBe(320);
    expect(productVariantWidth(Number.NaN)).toBe(320);
  });
});

describe('mediaLoader', () => {
  it('rewrites a product image to the sibling for the requested width', () => {
    expect(mediaLoader({ src: PRODUCT, width: 320 }, '')).toBe(`${R2_DEV}/products/premium-tee/01-320.webp`);
    expect(mediaLoader({ src: PRODUCT, width: 640 }, '')).toBe(`${R2_DEV}/products/premium-tee/01-640.webp`);
    expect(mediaLoader({ src: PRODUCT, width: 960 }, '')).toBe(`${R2_DEV}/products/premium-tee/01-960.webp`);
    expect(mediaLoader({ src: PRODUCT, width: 1280 }, '')).toBe(`${R2_DEV}/products/premium-tee/01-1280.webp`);
    // Above 1280 (and 2x/3x descriptors) keeps the stored original.
    expect(mediaLoader({ src: PRODUCT, width: 1600 }, '')).toBe(PRODUCT);
    expect(mediaLoader({ src: PRODUCT, width: 1920 }, '')).toBe(PRODUCT);
    // Non-product widths from imageSizes still resolve to a real file.
    expect(mediaLoader({ src: PRODUCT, width: 96 }, '')).toBe(`${R2_DEV}/products/premium-tee/01-320.webp`);
    expect(mediaLoader({ src: PRODUCT, width: 384 }, '')).toBe(`${R2_DEV}/products/premium-tee/01-320.webp`);
  });

  it('rewrites named (non-numeric) product images the same way', () => {
    const src = `${R2_DEV}/products/chill-guy-tshirt/ai-angle-0.webp`;
    expect(mediaLoader({ src, width: 640 }, '')).toBe(
      `${R2_DEV}/products/chill-guy-tshirt/ai-angle-0-640.webp`,
    );
    const flat = `${R2_DEV}/products/x/01-flat-front.webp`;
    expect(mediaLoader({ src: flat, width: 640 }, '')).toBe(`${R2_DEV}/products/x/01-flat-front-640.webp`);
  });

  it('leaves an already-suffixed variant alone', () => {
    const src = `${R2_DEV}/products/premium-tee/01-640.webp`;
    expect(mediaLoader({ src, width: 960 }, '')).toBe(src);
  });

  it('returns every non-product stored URL untouched', () => {
    const sources = [
      '/artists/coldplay-hero.webp',
      '/concert-art/the-weeknd-india-2026.webp',
      `${R2_DEV}/collections/coldplay-generated.webp`,
      'https://rojruflnuhclvkhipjxs.supabase.co/storage/v1/object/public/products/1/2.webp',
      'https://cdn.shopify.com/s/files/1/a.jpg',
      'https://example.com/products/x/01.webp', // product-shaped, but not our bucket
      '/placeholder-product.png',
      '',
    ];
    for (const src of sources) {
      // `''` (not `undefined`) so the assertion never depends on an ambient
      // NEXT_PUBLIC_MEDIA_BASE_URL in the developer's shell.
      expect(mediaLoader({ src, width: 640 }, ''), src).toBe(src);
      expect(mediaLoader({ src, width: 1920, quality: 75 }, ''), src).toBe(src);
    }
  });

  it('applies the r2.dev rewrite and the variant rewrite in one pass', () => {
    expect(mediaLoader({ src: PRODUCT, width: 640 }, 'https://media.yordindia.com')).toBe(
      'https://media.yordindia.com/products/premium-tee/01-640.webp',
    );
    // Above 1280 the original key is kept, but still on the media domain.
    expect(mediaLoader({ src: PRODUCT, width: 1600 }, 'https://media.yordindia.com')).toBe(
      'https://media.yordindia.com/products/premium-tee/01.webp',
    );
  });

  it('rewrites a product image already served from the media domain', () => {
    const src = 'https://media.yordindia.com/products/premium-tee/01.webp';
    expect(mediaLoader({ src, width: 960 }, 'https://media.yordindia.com')).toBe(
      'https://media.yordindia.com/products/premium-tee/01-960.webp',
    );
  });

  it('without an override, a product URL already on the media domain is left unchanged', () => {
    // The variant rewrite is anchored on the configured media base URL — with
    // it unset the loader cannot recognise the domain, so it must not guess.
    const src = 'https://media.yordindia.com/products/premium-tee/01.webp';
    expect(mediaLoader({ src, width: 960 }, '')).toBe(src);
  });

  it('rewrites an r2.dev URL to the configured media domain', () => {
    expect(
      mediaLoader(
        { src: `${R2_DEV}/collections/coldplay-generated.webp`, width: 960 },
        'https://media.yordindia.com',
      ),
    ).toBe('https://media.yordindia.com/collections/coldplay-generated.webp');
  });

  it('preserves the path, query, and encoded segments on rewrite', () => {
    expect(
      mediaLoader(
        { src: `${R2_DEV}/products/caf%C3%A9%20tee/01.webp?v=2`, width: 640 },
        'https://media.yordindia.com',
      ),
    ).toBe('https://media.yordindia.com/products/caf%C3%A9%20tee/01-640.webp?v=2');
  });

  it('ignores an unset, insecure, or malformed override', () => {
    const src = `${R2_DEV}/products/x/01.webp`;
    expect(mediaLoader({ src, width: 640 }, '')).toBe(`${R2_DEV}/products/x/01-640.webp`);
    expect(mediaLoader({ src, width: 640 }, '   ')).toBe(`${R2_DEV}/products/x/01-640.webp`);
    expect(mediaLoader({ src, width: 640 }, 'http://media.yordindia.com')).toBe(
      `${R2_DEV}/products/x/01-640.webp`,
    );
  });

  it('never rewrites non-r2.dev hosts, even with an override set', () => {
    const src = 'https://cdn.shopify.com/s/files/1/a.jpg';
    expect(mediaLoader({ src, width: 640 }, 'https://media.yordindia.com')).toBe(src);
  });

  it('strips a trailing slash from the override so paths do not double up', () => {
    expect(
      mediaLoader({ src: `${R2_DEV}/collections/x.webp`, width: 640 }, 'https://media.yordindia.com/'),
    ).toBe('https://media.yordindia.com/collections/x.webp');
  });
});

describe('isR2DevUrl', () => {
  it('matches only https r2.dev hosts', () => {
    expect(isR2DevUrl(`${R2_DEV}/a.webp`)).toBe(true);
    expect(isR2DevUrl('http://pub-abc123.r2.dev/a.webp')).toBe(false);
    expect(isR2DevUrl('https://r2.dev.evil.com/a.webp')).toBe(false);
    expect(isR2DevUrl('/placeholder-product.png')).toBe(false);
  });
});
