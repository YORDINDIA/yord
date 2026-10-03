import { describe, expect, it } from 'vitest';
import { variantDetail } from '@/components/dashboard/variant-detail';

/**
 * The low-stock list's option line.
 *
 * Variant titles repeat the product title ("<product> - White / 3XL"), so the
 * list strips the prefix — but only when the remainder is actually an option
 * suffix (a separator follows) or nothing at all. Stripping at a bare prefix
 * match corrupted valid titles: product "Blue Shirt" against variant
 * "Blue Shirt Slim Fit" turned "Blue Shirt Slim Fit" into the fragment
 * "Slim Fit", which names no option anyone sells.
 */
describe('variantDetail', () => {
  it('strips the product prefix before an option separator', () => {
    expect(variantDetail('Classic Tee', 'Classic Tee - White / 3XL')).toBe('White / 3XL');
    expect(variantDetail('Classic Tee', 'Classic Tee: White')).toBe('White');
    expect(variantDetail('Classic Tee', 'Classic Tee / White')).toBe('White');
    expect(variantDetail('Classic Tee', 'Classic Tee — White')).toBe('White');
    expect(variantDetail('Classic Tee', 'Classic Tee | White')).toBe('White');
  });

  it('returns null when the title merely repeats the product name', () => {
    expect(variantDetail('Classic Tee', 'Classic Tee')).toBeNull();
    expect(variantDetail('Classic Tee', '  classic tee  ')).toBeNull();
    expect(variantDetail('Classic Tee', 'Classic Tee ')).toBeNull();
  });

  it('keeps the full title when the remainder is not an option suffix', () => {
    // The prefix match is a coincidence of naming: the variant title is a
    // longer name that starts with the product's, not an option list.
    expect(variantDetail('Blue Shirt', 'Blue Shirt Slim Fit')).toBe('Blue Shirt Slim Fit');
    expect(variantDetail('Tee', 'Teen Hoodie')).toBe('Teen Hoodie');
  });

  it('returns the variant title untouched when there is no prefix match', () => {
    expect(variantDetail('Classic Tee', 'Black / M')).toBe('Black / M');
  });

  it('handles missing titles', () => {
    expect(variantDetail('Classic Tee', null)).toBeNull();
    expect(variantDetail('Classic Tee', '   ')).toBeNull();
    expect(variantDetail('', 'White / M')).toBe('White / M');
  });

  it('collapses a separator-only remainder to null', () => {
    expect(variantDetail('Classic Tee', 'Classic Tee -')).toBeNull();
  });
});
