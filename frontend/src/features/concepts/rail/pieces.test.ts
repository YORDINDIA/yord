import { afterEach, describe, expect, it, vi } from 'vitest';
import { toPieces } from './pieces';
import type { ConceptProduct } from '../loaders';

const R2 = 'https://pub-abc.r2.dev';

const product = (image: string | null): ConceptProduct => ({
  id: '1',
  handle: 'tee',
  title: 'Tee',
  artist: 'Coldplay',
  price: 999,
  compareAtPrice: null,
  image,
  badge: null,
  accentColor: 'var(--accent)',
});

const texture = (image: string | null) => toPieces([product(image)])[0].texture;

describe('rail texture URLs', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('proxies bucket product images at the 640 sibling', () => {
    vi.stubEnv('NEXT_PUBLIC_MEDIA_BASE_URL', '');
    vi.stubEnv('R2_PUBLIC_BASE_URL', R2);
    expect(texture(`${R2}/products/tee/01.webp`)).toBe('/rail-media/products/tee/01-640.webp');
  });

  it('follows the custom media domain when it is set', () => {
    vi.stubEnv('NEXT_PUBLIC_MEDIA_BASE_URL', 'https://media.example.com');
    vi.stubEnv('R2_PUBLIC_BASE_URL', R2);
    expect(texture(`${R2}/products/tee/01.webp`)).toBe('/rail-media/products/tee/01-640.webp');
  });

  it('keeps local files and drops hosts the proxy does not cover', () => {
    vi.stubEnv('R2_PUBLIC_BASE_URL', R2);
    expect(texture('/artists/coldplay-hero.webp')).toBe('/artists/coldplay-hero.webp');
    expect(texture('https://cdn.shopify.com/a.jpg')).toBeNull();
    expect(texture(`${R2}/artists/coldplay.webp`)).toBeNull();
    expect(texture(null)).toBeNull();
  });
});
