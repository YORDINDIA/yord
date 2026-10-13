import { describe, expect, it } from 'vitest';
import {
  StorageNotConfiguredError,
  isStorageConfigured,
  keyWithExtension,
  publicUrlFor,
  r2Endpoint,
  uploadImageBuffer,
} from '@/lib/r2';

const FULL_ENV = {
  R2_ACCOUNT_ID: 'acct123',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'yord-media',
  R2_PUBLIC_BASE_URL: 'https://pub-abc.r2.dev/',
};

/**
 * The endpoint and public URL are the two things every stored URL depends on,
 * and configuration must stay lazy: the admin app builds without R2 variables
 * (CI supplies none), so a missing variable has to surface as a clear error on
 * the upload path — never at import time.
 */
describe('r2Endpoint', () => {
  it('derives the endpoint from the account id', () => {
    expect(r2Endpoint({ R2_ACCOUNT_ID: 'acct123' })).toBe(
      'https://acct123.r2.cloudflarestorage.com',
    );
  });

  it('inserts a jurisdiction when the bucket lives in one', () => {
    expect(
      r2Endpoint({ R2_ACCOUNT_ID: 'acct123', R2_JURISDICTION: 'eu' }),
    ).toBe('https://acct123.eu.r2.cloudflarestorage.com');
    // `default` is the same as no jurisdiction at all.
    expect(
      r2Endpoint({ R2_ACCOUNT_ID: 'acct123', R2_JURISDICTION: 'default' }),
    ).toBe('https://acct123.r2.cloudflarestorage.com');
  });

  it('prefers an explicit endpoint and strips the trailing slash', () => {
    expect(
      r2Endpoint({
        R2_ACCOUNT_ID: 'acct123',
        R2_ENDPOINT: 'https://custom.example.com/',
      }),
    ).toBe('https://custom.example.com');
  });

  it('returns an empty string when nothing is configured', () => {
    expect(r2Endpoint({})).toBe('');
  });
});

describe('publicUrlFor', () => {
  it('joins the base URL and encodes each path segment', () => {
    expect(publicUrlFor('products/premium-tee/01.webp', FULL_ENV)).toBe(
      'https://pub-abc.r2.dev/products/premium-tee/01.webp',
    );
    expect(publicUrlFor('products/café tee/01.webp', FULL_ENV)).toBe(
      'https://pub-abc.r2.dev/products/caf%C3%A9%20tee/01.webp',
    );
  });

  it('returns an empty string when the base URL is unset', () => {
    expect(publicUrlFor('a.webp', {})).toBe('');
  });
});

describe('keyWithExtension', () => {
  it('rewrites any existing extension to match the stored content type', () => {
    expect(keyWithExtension('admin/abc', 'image/webp')).toBe('admin/abc.webp');
    expect(keyWithExtension('admin/abc.png', 'image/webp')).toBe('admin/abc.webp');
    expect(keyWithExtension('/ai/123', 'image/png')).toBe('ai/123.png');
  });

  it('keeps the key untouched for an unknown content type', () => {
    expect(keyWithExtension('docs/report', 'application/pdf')).toBe('docs/report');
  });
});

describe('configuration gating', () => {
  it('reports configured only when every variable an upload needs is present', () => {
    expect(isStorageConfigured(FULL_ENV)).toBe(true);
    for (const key of [
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET',
      'R2_PUBLIC_BASE_URL',
    ]) {
      expect(isStorageConfigured({ ...FULL_ENV, [key]: '' })).toBe(false);
    }
    expect(isStorageConfigured({ ...FULL_ENV, R2_ACCOUNT_ID: '' })).toBe(false);
    // An explicit endpoint replaces the account id.
    expect(
      isStorageConfigured({
        ...FULL_ENV,
        R2_ACCOUNT_ID: '',
        R2_ENDPOINT: 'https://custom.example.com',
      }),
    ).toBe(true);
  });

  it('throws a clear error instead of uploading when unconfigured', async () => {
    const saved = { ...process.env };
    for (const key of [
      'R2_ACCOUNT_ID',
      'R2_ENDPOINT',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET',
      'R2_PUBLIC_BASE_URL',
    ]) {
      delete process.env[key];
    }
    await expect(
      uploadImageBuffer(Buffer.from('x'), { key: 'admin/x', contentType: 'image/webp' }),
    ).rejects.toBeInstanceOf(StorageNotConfiguredError);
    Object.assign(process.env, saved);
  });
});
