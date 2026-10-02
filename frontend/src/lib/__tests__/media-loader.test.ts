// Media loader tests: pass-through for stored variants, and the r2.dev →
// custom-domain rewrite that keeps a domain move out of the database.
import { describe, expect, it } from 'vitest';
import mediaLoader, { isR2DevUrl } from '@/lib/media-loader';

const R2_DEV = 'https://pub-abc123.r2.dev';

describe('mediaLoader', () => {
  it('returns stored URLs untouched — the bucket already holds the variant', () => {
    const sources = [
      `${R2_DEV}/products/premium-tee/01.webp`,
      'https://rojruflnuhclvkhipjxs.supabase.co/storage/v1/object/public/products/1/2.webp',
      'https://cdn.shopify.com/s/files/1/a.jpg',
      'https://example.com/a.jpg',
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

  it('rewrites an r2.dev URL to the configured media domain', () => {
    expect(
      mediaLoader(
        { src: `${R2_DEV}/products/premium-tee/01.webp`, width: 960 },
        'https://media.yordindia.com',
      ),
    ).toBe('https://media.yordindia.com/products/premium-tee/01.webp');
  });

  it('preserves the path, query, and encoded segments on rewrite', () => {
    expect(
      mediaLoader(
        { src: `${R2_DEV}/products/caf%C3%A9%20tee/01.webp?v=2`, width: 640 },
        'https://media.yordindia.com',
      ),
    ).toBe('https://media.yordindia.com/products/caf%C3%A9%20tee/01.webp?v=2');
  });

  it('ignores an unset, insecure, or malformed override', () => {
    const src = `${R2_DEV}/products/x/01.webp`;
    expect(mediaLoader({ src, width: 640 }, '')).toBe(src);
    expect(mediaLoader({ src, width: 640 }, '   ')).toBe(src);
    expect(mediaLoader({ src, width: 640 }, 'http://media.yordindia.com')).toBe(src);
  });

  it('never rewrites non-r2.dev hosts, even with an override set', () => {
    const src = 'https://cdn.shopify.com/s/files/1/a.jpg';
    expect(mediaLoader({ src, width: 640 }, 'https://media.yordindia.com')).toBe(src);
  });

  it('strips a trailing slash from the override so paths do not double up', () => {
    expect(
      mediaLoader({ src: `${R2_DEV}/products/x/01.webp`, width: 640 }, 'https://media.yordindia.com/'),
    ).toBe('https://media.yordindia.com/products/x/01.webp');
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
