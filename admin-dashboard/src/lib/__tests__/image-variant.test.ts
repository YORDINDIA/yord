import { describe, expect, it } from 'vitest';
import {
  VARIANT_MAX_WIDTH,
  variantDimensions,
  variantFileName,
} from '@/lib/image-variant';

/**
 * The variant policy is shared with the Python upload path
 * (`scripts/utils/r2_helpers.py`): one WebP object per image, at most 1600px
 * wide. These cases pin the arithmetic so a landscape photo, a portrait photo
 * and a thumbnail all behave predictably.
 */
describe('variantDimensions', () => {
  it('downscales wide images to the cap, preserving the aspect ratio', () => {
    expect(variantDimensions(3200, 1600)).toEqual({ width: VARIANT_MAX_WIDTH, height: 800 });
  });

  it('caps by width only, so tall portraits keep their full height', () => {
    expect(variantDimensions(4000, 6000)).toEqual({ width: 1600, height: 2400 });
    expect(variantDimensions(1200, 2000)).toEqual({ width: 1200, height: 2000 });
  });

  it('never upscales and never returns a zero height', () => {
    expect(variantDimensions(800, 600)).toEqual({ width: 800, height: 600 });
    expect(variantDimensions(2000, 1)).toEqual({ width: 1600, height: 1 });
  });

  it('returns zeroes for nonsense input rather than a broken canvas', () => {
    expect(variantDimensions(0, 100)).toEqual({ width: 0, height: 0 });
    expect(variantDimensions(Number.NaN, 100)).toEqual({ width: 0, height: 0 });
    expect(variantDimensions(-10, -10)).toEqual({ width: 0, height: 0 });
  });
});

describe('variantFileName', () => {
  it('replaces the extension with .webp', () => {
    expect(variantFileName('IMG_0467.png')).toBe('IMG_0467.webp');
    expect(variantFileName('close-up-male-tshirt-mockup.jpeg')).toBe(
      'close-up-male-tshirt-mockup.webp',
    );
  });

  it('handles names without an extension and dotted stems', () => {
    expect(variantFileName('photo')).toBe('photo.webp');
    expect(variantFileName('my.photo.v2.jpg')).toBe('my.photo.v2.webp');
  });
});
