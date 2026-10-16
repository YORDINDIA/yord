// Google Merchant Center feed builder tests. The builder is the only thing
// between the catalog and Google — an unescaped ampersand or a bad price
// string fails the whole scheduled fetch, and a wrong availability hides a
// sellable size. Every rule here is exercised against the real module.

import { describe, expect, it } from 'vitest';
import {
  buildMerchantFeed,
  escapeXml,
  feedCategory,
  feedImageUrl,
  feedPriceText,
  type MerchantFeedProduct,
  type MerchantFeedVariant,
} from '@/lib/feed/google-merchant';

const MEDIA_BASE = 'https://media.yordindia.com';

function variant(overrides: Partial<MerchantFeedVariant> = {}): MerchantFeedVariant {
  return {
    id: 11,
    title: 'M',
    option1: 'M',
    price: 1574,
    sku: null,
    barcode: null,
    inventory_quantity: 5,
    ...overrides,
  };
}

function product(overrides: Partial<MerchantFeedProduct> = {}): MerchantFeedProduct {
  return {
    id: 7,
    handle: 'coldplay-tee',
    title: 'Coldplay Music of the Spheres T-Shirt',
    body_html: '<p>Premium cotton tee.</p>',
    meta_description: 'Coldplay fan-made t-shirt in premium cotton.',
    product_type: 'T-Shirts',
    vendor: 'Coldplay',
    product_variants: [variant()],
    product_images: [
      { src: 'https://cdn.shopify.com/old.jpg', storage_url: 'https://pub-x.r2.dev/products/coldplay-tee/01.webp', position: 1 },
      { src: null, storage_url: 'https://pub-x.r2.dev/products/coldplay-tee/02.webp', position: 2 },
    ],
    ...overrides,
  };
}

function feedOf(products: MerchantFeedProduct[], mediaBaseUrl = MEDIA_BASE) {
  return buildMerchantFeed(products, { mediaBaseUrl });
}

function itemsOf(xml: string): string[] {
  return xml.split('<item>').slice(1).map((chunk) => `<item>${chunk}`);
}

describe('merchant feed: document shape', () => {
  it('emits an escaped RSS 2.0 document with the g: namespace', () => {
    const { xml, itemCount } = feedOf([product()]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">');
    expect(xml).toContain('<g:id>7-11</g:id>');
    expect(itemCount).toBe(1);
  });

  it('escapes XML metacharacters in every text field', () => {
    expect(escapeXml(`Tom & "Jerry" <b>it's</b>`)).toBe(
      'Tom &amp; &quot;Jerry&quot; &lt;b&gt;it&apos;s&lt;/b&gt;'
    );
    const { xml } = feedOf([
      product({ title: 'Rock & Roll "Best" <Tee>' }),
    ]);
    expect(xml).toContain('Rock &amp; Roll &quot;Best&quot; &lt;Tee&gt;');
    expect(xml).not.toMatch(/<g:title>[^<]*<(?!\/g:title)/);
  });
});

describe('merchant feed: items and variants', () => {
  it('writes one item per variant, grouped by product', () => {
    const { xml, itemCount } = feedOf([
      product({
        product_variants: [
          variant({ id: 11, title: 'S', option1: 'S' }),
          variant({ id: 12, title: 'M', option1: 'M', inventory_quantity: 0 }),
        ],
      }),
    ]);
    expect(itemCount).toBe(2);
    const items = itemsOf(xml);
    expect(items).toHaveLength(2);
    expect(items[0]).toContain('<g:id>7-11</g:id>');
    expect(items[1]).toContain('<g:id>7-12</g:id>');
    // Same group, different sizes, per-variant availability.
    expect(items[0]).toContain('<g:item_group_id>7</g:item_group_id>');
    expect(items[1]).toContain('<g:item_group_id>7</g:item_group_id>');
    expect(items[0]).toContain('<g:availability>in_stock</g:availability>');
    expect(items[1]).toContain('<g:availability>out_of_stock</g:availability>');
    expect(items[0]).toContain('<g:size>S</g:size>');
    expect(items[1]).toContain('<g:size>M</g:size>');
  });

  it('omits size and appends it to the title only when it is real', () => {
    const { xml } = feedOf([
      product({ product_variants: [variant({ title: 'Default Title', option1: 'Default Title' })] }),
    ]);
    expect(xml).toContain('<g:title>Coldplay Music of the Spheres T-Shirt</g:title>');
    expect(xml).not.toContain('<g:size>');
  });

  it('keeps titles within 150 characters with the size suffix', () => {
    const longTitle = 'A'.repeat(200);
    const { xml } = feedOf([product({ title: longTitle })]);
    const title = /<g:title>([^<]*)<\/g:title>/.exec(xml)?.[1] ?? '';
    expect(title.length).toBeLessThanOrEqual(150);
    expect(title.endsWith(' - M')).toBe(true);
  });

  it('skips products without an image or without a priced variant', () => {
    const missingImage = product({ id: 8, product_images: [] });
    const missingPrice = product({
      id: 9,
      product_variants: [variant({ price: null }), variant({ id: 13, price: '' })],
    });
    const { itemCount, skipped } = feedOf([product(), missingImage, missingPrice]);
    expect(itemCount).toBe(1);
    expect(skipped).toBe(2);
  });
});

describe('merchant feed: prices', () => {
  it('formats numbers and DECIMAL strings as `X.XX INR`', () => {
    expect(feedPriceText(1574)).toBe('1574.00 INR');
    expect(feedPriceText('1574.5')).toBe('1574.50 INR');
    expect(feedPriceText(0)).toBe('0.00 INR');
    expect(feedPriceText(null)).toBeNull();
    expect(feedPriceText('')).toBeNull();
    expect(feedPriceText('abc')).toBeNull();
    expect(feedPriceText(-5)).toBeNull();
  });

  it('submits the stored GST-inclusive price with no sale_price', () => {
    const { xml } = feedOf([product({ product_variants: [variant({ price: 1574 })] })]);
    expect(xml).toContain('<g:price>1574.00 INR</g:price>');
    expect(xml).not.toContain('sale_price');
  });
});

describe('merchant feed: image urls', () => {
  it('rewrites r2.dev origins to the media domain, mirroring media-loader', () => {
    expect(feedImageUrl('https://pub-x.r2.dev/products/a/01.webp', MEDIA_BASE)).toBe(
      'https://media.yordindia.com/products/a/01.webp'
    );
    // Already on the media domain: untouched.
    expect(feedImageUrl('https://media.yordindia.com/products/a/01.webp', MEDIA_BASE)).toBe(
      'https://media.yordindia.com/products/a/01.webp'
    );
    // No override configured: the stored URL is still crawlable.
    expect(feedImageUrl('https://pub-x.r2.dev/products/a/01.webp', undefined)).toBe(
      'https://pub-x.r2.dev/products/a/01.webp'
    );
    // Root-relative paths resolve against the store domain.
    expect(feedImageUrl('/brand/yord.webp', undefined)).toBe(
      'https://yordindia.com/brand/yord.webp'
    );
    expect(feedImageUrl('not-a-url', MEDIA_BASE)).toBeNull();
    expect(feedImageUrl('', MEDIA_BASE)).toBeNull();
  });

  it('orders images by position and caps at image_link + 10 additional', () => {
    const images = Array.from({ length: 13 }, (_, index) => ({
      src: null,
      storage_url: `https://pub-x.r2.dev/products/a/${String(index + 1).padStart(2, '0')}.webp`,
      position: index + 1,
    })).reverse(); // raw order 13..01; only the position sort puts 01 first
    const { xml } = feedOf([product({ product_images: images })]);
    expect(xml).toContain('<g:image_link>https://media.yordindia.com/products/a/01.webp</g:image_link>');
    expect(xml.match(/<g:additional_image_link>/g)).toHaveLength(10);
  });
});

describe('merchant feed: descriptions', () => {
  it('prefers meta_description and strips HTML from the body fallback', () => {
    const withMeta = feedOf([product()]).xml;
    expect(withMeta).toContain(
      '<g:description>Coldplay fan-made t-shirt in premium cotton.</g:description>'
    );

    const noMeta = feedOf([product({ meta_description: null })]).xml;
    expect(noMeta).toContain('<g:description>Premium cotton tee.</g:description>');
  });

  it('falls back to a templated description and collapses whitespace', () => {
    const html = feedOf([
      product({ meta_description: null, body_html: '<p>Line one\n\n   Line  two</p>' }),
    ]).xml;
    expect(html).toContain('<g:description>Line one Line two</g:description>');

    const empty = feedOf([product({ meta_description: null, body_html: null })]).xml;
    expect(empty).toMatch(/<g:description>Shop Coldplay Music of the Spheres T-Shirt from YORD India/);
  });
});

describe('merchant feed: identifiers and categories', () => {
  it('declares identifier_exists=no without a barcode, gtin when present', () => {
    const none = feedOf([product()]).xml;
    expect(none).toContain('<g:identifier_exists>no</g:identifier_exists>');
    expect(none).not.toContain('<g:gtin>');

    const withGtin = feedOf([product({ product_variants: [variant({ barcode: '8901234567890' })] })]).xml;
    expect(withGtin).toContain('<g:gtin>8901234567890</g:gtin>');
    expect(withGtin).not.toContain('identifier_exists');
  });

  it('carries the SKU as mpn when one exists', () => {
    const xml = feedOf([product({ product_variants: [variant({ sku: 'YORD-CP-M' })] })]).xml;
    expect(xml).toContain('<g:mpn>YORD-CP-M</g:mpn>');
  });

  it('maps real product types to Google categories and defaults safely', () => {
    expect(feedCategory('T-Shirts')).toBe('Apparel & Accessories > Clothing > Shirts & Tops');
    expect(feedCategory('Denim')).toBe('Apparel & Accessories > Clothing > Pants');
    expect(feedCategory('Refrigerator Magnets')).toBe('Home & Garden > Decor');
    expect(feedCategory('Collectibles')).toBe(
      'Arts & Entertainment > Hobbies & Creative Arts > Collectibles'
    );
    expect(feedCategory('Something New')).toBe('Apparel & Accessories > Clothing');
    expect(feedCategory(null)).toBe('Apparel & Accessories > Clothing');
  });

  it('adds gender/age_group for apparel only and keeps product_type raw', () => {
    const apparel = feedOf([product()]).xml;
    expect(apparel).toContain('<g:gender>unisex</g:gender>');
    expect(apparel).toContain('<g:age_group>adult</g:age_group>');
    expect(apparel).toContain('<g:product_type>T-Shirts</g:product_type>');

    const magnets = feedOf([product({ product_type: 'Refrigerator Magnets' })]).xml;
    expect(magnets).not.toContain('<g:gender>');
    expect(magnets).not.toContain('<g:age_group>');
  });

  it('always sells under the store brand, never the artist', () => {
    const { xml } = feedOf([product()]);
    expect(xml).toContain('<g:brand>YORD India</g:brand>');
    expect(xml).not.toContain('<g:brand>Coldplay</g:brand>');
  });
});
