import 'server-only';

import { AwsClient } from 'aws4fetch';

/**
 * Cloudflare R2 client for server-side uploads.
 *
 * Credentials are the S3-compatible pair from an R2 API token
 * (`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`) plus `R2_ACCOUNT_ID` (or an
 * explicit `R2_ENDPOINT`) and `R2_BUCKET`. Delivery URLs are built from
 * `R2_PUBLIC_BASE_URL` — the bucket's r2.dev URL today, a custom domain later.
 *
 * `aws4fetch` signs with WebCrypto and rides on `fetch`, so the same module
 * works on Node today and on Cloudflare Workers after the hosting move; no
 * native image tooling is involved. Configuration is lazy so `next build`
 * never needs the variables: an upload path returns a clear error instead of
 * throwing at import time.
 */
export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      'Image storage is not configured. Set R2_ACCOUNT_ID (or R2_ENDPOINT), ' +
        'R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and ' +
        'R2_PUBLIC_BASE_URL.',
    );
    this.name = 'StorageNotConfiguredError';
  }
}

/** Extension for a validated image content type. */
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * The environment keys this module reads. Declared explicitly so callers (and
 * tests) can pass a plain object: Next augments `ProcessEnv` with a required
 * `NODE_ENV` and no index signature, so a partial object is not assignable to
 * it and `process.env` is not assignable to this shape. The default parameter
 * casts once, at the boundary.
 */
export interface MediaEnv {
  R2_ACCOUNT_ID?: string;
  R2_ENDPOINT?: string;
  R2_JURISDICTION?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  R2_PUBLIC_BASE_URL?: string;
}

/**
 * S3 endpoint for the R2 bucket.
 *
 * `R2_ENDPOINT` wins when set (jurisdiction-specific or test endpoints);
 * otherwise it is derived from `R2_ACCOUNT_ID`, inserting `R2_JURISDICTION`
 * (`eu` / `fedramp` / `us`) when the bucket lives in one.
 */
export function r2Endpoint(env: MediaEnv = process.env as MediaEnv): string {
  const explicit = env.R2_ENDPOINT?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const accountId = env.R2_ACCOUNT_ID?.trim();
  if (!accountId) return '';
  const jurisdiction = (env.R2_JURISDICTION ?? '').trim().toLowerCase();
  const prefix = jurisdiction && jurisdiction !== 'default' ? `${jurisdiction}.` : '';
  return `https://${accountId}.${prefix}r2.cloudflarestorage.com`;
}

/** Public delivery base URL without a trailing slash ('' when unset). */
export function r2PublicBaseUrl(env: MediaEnv = process.env as MediaEnv): string {
  return (env.R2_PUBLIC_BASE_URL ?? '').trim().replace(/\/+$/, '');
}

/** True when every variable an upload needs is present. */
export function isStorageConfigured(env: MediaEnv = process.env as MediaEnv): boolean {
  return Boolean(
    r2Endpoint(env) &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET &&
      r2PublicBaseUrl(env),
  );
}

/** Replace (or add) a key's extension so it matches the stored content type. */
export function keyWithExtension(key: string, contentType: string): string {
  const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ?? '';
  const normalised = key.replace(/^\/+/, '');
  if (!extension) return normalised;
  const stem = normalised.replace(/\.[^./]{1,5}$/, '');
  return `${stem}${extension}`;
}

/** Public URL for an object key, with each path segment encoded. */
export function publicUrlFor(key: string, env: MediaEnv = process.env as MediaEnv): string {
  const base = r2PublicBaseUrl(env);
  if (!base) return '';
  const path = key
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${base}/${path}`;
}

let client: AwsClient | null = null;

function signer(): AwsClient {
  if (!isStorageConfigured()) throw new StorageNotConfiguredError();
  if (!client) {
    client = new AwsClient({
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
      service: 's3',
      region: 'auto',
      retries: 2,
    });
  }
  return client;
}

export interface UploadedObject {
  /** Public delivery URL (https), safe to store in the database. */
  url: string;
  /** Object key inside the bucket, extension included. */
  key: string;
}

/**
 * Upload an image buffer and return its public URL and object key.
 *
 * Media are immutable once written (the app never rewrites an object in
 * place), so uploads carry a one-year immutable cache header. `key` is the
 * full path without extension (e.g. `admin/<uuid>`); the extension is derived
 * from `contentType`, which the caller has already validated.
 */
export async function uploadImageBuffer(
  buffer: Buffer,
  options: { key: string; contentType: string },
): Promise<UploadedObject> {
  const aws = signer();
  const bucket = process.env.R2_BUCKET as string;
  const key = keyWithExtension(options.key, options.contentType);

  const response = await aws.fetch(`${r2Endpoint()}/${bucket}/${key}`, {
    method: 'PUT',
    body: new Uint8Array(buffer),
    headers: {
      'Content-Type': options.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`R2 upload failed (HTTP ${response.status}) ${detail}`.trim());
  }

  return { url: publicUrlFor(key), key };
}
