import { describe, expect, it } from 'vitest';
import {
  isAllowedImportUrl,
  legacyStorageHost,
  mediaHosts,
} from '@/lib/ai/import-hosts';

const PROJECT_HOST = 'project.supabase.co';
const R2_HOST = 'pub-abc123.r2.dev';

/**
 * The import allowlist is an SSRF boundary, not just a convenience check: the
 * route fetches whatever it allows. These cases pin the boundary down —
 * approved CDNs, the media bucket, the project's own public storage path, and
 * nothing else.
 */
describe('isAllowedImportUrl', () => {
  it('allows the Shopify CDNs', () => {
    expect(isAllowedImportUrl('https://cdn.shopify.com/s/files/1/a.jpg', null, [])).toBe(true);
    expect(isAllowedImportUrl('https://shopifycdn.com/a.jpg', null, [])).toBe(true);
    expect(isAllowedImportUrl('https://cdn.shopifycdn.net/a.jpg', null, [])).toBe(true);
  });

  it('allows the configured media bucket host', () => {
    const url = `https://${R2_HOST}/products/premium-tee/01.webp`;
    expect(isAllowedImportUrl(url, null, [R2_HOST])).toBe(true);
    // The same host is not allowed when it is not configured as the bucket.
    expect(isAllowedImportUrl(url, null, [])).toBe(false);
  });

  it('allows only the public object path on the project storage host', () => {
    const publicUrl = `https://${PROJECT_HOST}/storage/v1/object/public/products/1/2.webp`;
    expect(isAllowedImportUrl(publicUrl, PROJECT_HOST, [])).toBe(true);
    expect(isAllowedImportUrl(`https://${PROJECT_HOST}/rest/v1/products`, PROJECT_HOST, [])).toBe(
      false,
    );
    expect(
      isAllowedImportUrl(
        `https://${PROJECT_HOST}/storage/v1/object/private/1/2.webp`,
        PROJECT_HOST,
        [],
      ),
    ).toBe(false);
  });

  it('rejects other hosts, http, and URLs with credentials', () => {
    expect(isAllowedImportUrl('https://evil.example.com/a.jpg', PROJECT_HOST, [])).toBe(false);
    expect(isAllowedImportUrl('http://cdn.shopify.com/a.jpg', null, [])).toBe(false);
    expect(isAllowedImportUrl('https://user:pass@cdn.shopify.com/a.jpg', null, [])).toBe(false);
    expect(isAllowedImportUrl('not a url', null, [])).toBe(false);
  });

  it('rejects a lookalike host that only ends with an allowed name', () => {
    expect(isAllowedImportUrl('https://notshopifycdn.com/a.jpg', null, [])).toBe(false);
    // A host that merely contains the bucket host is not the bucket host.
    expect(isAllowedImportUrl(`https://${R2_HOST}.evil.com/a.webp`, null, [R2_HOST])).toBe(false);
  });
});

describe('legacyStorageHost', () => {
  it('reads the host from the public project URL', () => {
    expect(legacyStorageHost('https://project.supabase.co')).toBe(PROJECT_HOST);
  });

  it('returns null when the URL is missing or unparseable', () => {
    expect(legacyStorageHost(undefined)).toBeNull();
    expect(legacyStorageHost('')).toBeNull();
    expect(legacyStorageHost('not a url')).toBeNull();
  });
});

describe('mediaHosts', () => {
  it('reads both the bucket URL and a future custom domain', () => {
    expect(
      mediaHosts({
        R2_PUBLIC_BASE_URL: `https://${R2_HOST}`,
        NEXT_PUBLIC_MEDIA_BASE_URL: 'https://media.yordindia.com',
      }),
    ).toEqual([R2_HOST, 'media.yordindia.com']);
  });

  it('ignores unset and unparseable values instead of widening the allowlist', () => {
    expect(mediaHosts({ R2_PUBLIC_BASE_URL: 'not a url' })).toEqual([]);
    expect(mediaHosts({})).toEqual([]);
  });
});
