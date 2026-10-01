// Product helper tests: sorting, pricing guards, badges, param parsing.
import { describe, expect, it } from 'vitest';
import {
  artistAccentColor,
  getFirstByPosition,
  getMinVariantPrice,
  getProductBadge,
  isPriceOnSale,
  parsePageParam,
  parseSortParam,
  sortByPosition,
  sortProductsByPrice,
} from '@/lib/product';
import type { ProductWithDetails, ProductVariant } from '@yord/db-types';

function variant(price: number | string, compareAt?: number | string | null): ProductVariant {
  return {
    id: 1,
    title: 'M',
    price: price as number,
    compare_at_price: (compareAt ?? null) as number | null,
    inventory_quantity: 10,
    position: 1,
  } as ProductVariant;
}

function product(overrides: Partial<ProductWithDetails> = {}): ProductWithDetails {
  return {
    id: 1,
    title: 'Tee',
    handle: 'tee',
    vendor: 'Coldplay',
    tags: '',
    published_at: '2024-01-01T00:00:00Z',
    product_variants: [variant(1000, 1500)],
    product_images: [],
    ...overrides,
  } as ProductWithDetails;
}

describe('parseSortParam', () => {
  it('accepts the four canonical sorts', () => {
    expect(parseSortParam('price-asc')).toBe('price-asc');
    expect(parseSortParam('title')).toBe('title');
  });

  it('falls back to newest (never featured)', () => {
    expect(parseSortParam('featured')).toBe('newest');
    expect(parseSortParam(undefined)).toBe('newest');
    expect(parseSortParam('DROP TABLE')).toBe('newest');
  });
});

describe('parsePageParam', () => {
  it('parses and clamps', () => {
    expect(parsePageParam('3')).toBe(3);
    expect(parsePageParam('0')).toBe(1);
    expect(parsePageParam('-2')).toBe(1);
    expect(parsePageParam('999')).toBe(100);
    expect(parsePageParam('abc')).toBe(1);
    expect(parsePageParam(undefined)).toBe(1);
  });
});

describe('isPriceOnSale', () => {
  it('compares numerically, tolerating DECIMAL-as-string values', () => {
    expect(isPriceOnSale(999, 1499)).toBe(true);
    // Lexicographic trap: '1000' < '999' is true as strings — must be false.
    expect(isPriceOnSale('1000', '999')).toBe(false);
    expect(isPriceOnSale('999', '1000')).toBe(true);
    expect(isPriceOnSale(null, 100)).toBe(false);
    expect(isPriceOnSale(100, null)).toBe(false);
    expect(isPriceOnSale(100, 100)).toBe(false);
  });
});

describe('price sorting', () => {
  const cheap = product({ id: 1, product_variants: [variant('500', '800')] });
  const pricey = product({ id: 2, product_variants: [variant('2000', '2500')] });

  it('sorts by lowest variant price both directions without mutating', () => {
    const input = [pricey, cheap];
    expect(sortProductsByPrice(input, 'asc').map((p) => p.id)).toEqual([1, 2]);
    expect(sortProductsByPrice(input, 'desc').map((p) => p.id)).toEqual([2, 1]);
    expect(input[0].id).toBe(2);
  });

  it('getMinVariantPrice tolerates string prices', () => {
    expect(getMinVariantPrice(cheap)).toBe(500);
    expect(getMinVariantPrice(product({ product_variants: [] }))).toBe(0);
  });
});

describe('getProductBadge', () => {
  it('prioritizes SALE over NEW/LIMITED', () => {
    const p = product({ published_at: new Date().toISOString(), tags: 'limited' });
    expect(getProductBadge(p)).toBe('SALE');
  });

  it('flags low stock, new arrivals, and tag badges', () => {
    expect(getProductBadge(product({ product_variants: [variant(100, 100)], published_at: '2020-01-01T00:00:00Z', tags: '' }, ))).toBeNull();
    const low = product({ product_variants: [{ ...variant(100, 100), inventory_quantity: 3 }], published_at: '2020-01-01T00:00:00Z' });
    expect(getProductBadge(low)).toBe('LIMITED');
    const fresh = product({ product_variants: [variant(100, 100)], published_at: new Date().toISOString() });
    expect(getProductBadge(fresh)).toBe('NEW');
    const tagged = product({ product_variants: [variant(100, 100)], published_at: '2020-01-01T00:00:00Z', tags: 'Bestseller pick' });
    expect(getProductBadge(tagged)).toBe('BESTSELLER');
  });
});

describe('position helpers', () => {
  it('sorts by position and returns the first', () => {
    const items = [{ position: 3 }, { position: 1 }, { position: 2 }];
    expect(sortByPosition(items).map((i) => i.position)).toEqual([1, 2, 3]);
    expect(getFirstByPosition(items)).toEqual({ position: 1 });
    expect(getFirstByPosition(undefined)).toBeNull();
    expect(getFirstByPosition([])).toBeNull();
  });
});

describe('artistAccentColor', () => {
  it('falls back to the theme accent for unknown/missing vendors', () => {
    // The fallback is painted as artist-badge text, so it has to resolve per
    // theme. A gold literal reaches only ~3.9:1 on the light page, which fails
    // AA; --accent is 5.48:1 on light and 14.49:1 on dark.
    expect(artistAccentColor(null)).toBe('var(--accent)');
    expect(artistAccentColor('Nobody')).toBe('var(--accent)');
  });
});
