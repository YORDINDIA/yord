import type { NextConfig } from 'next';
import path from 'node:path';
import { withSentryConfig } from '@sentry/nextjs/config';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages export raw TS; Next must transpile them.
  transpilePackages: ['@yord/ui', '@yord/db-types', '@yord/auth', '@yord/supabase-clients'],
  // Monorepo: trace files from the repo root so packages/* are included.
  outputFileTracingRoot: path.join(__dirname, '../'),
  // Media uploads ride a Server Action (see media/uploader.tsx). The 1 MB
  // default body limit rejects even single valid images (up to
  // MAX_MEDIA_BYTES each, MAX_MEDIA_FILES per batch), so raise it to cover
  // the advertised maximum batch: 10 files x 10 MB plus multipart/field
  // overhead. Batches beyond this belong on a direct storage upload, not a
  // larger action body.
  experimental: {
    serverActions: { bodySizeLimit: '115mb' },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  }
};

export default withSentryConfig(nextConfig, {
  // Source maps upload only when the build environment provides all three
  // (Netlify/Cloudflare build env, or a local .env). Without them the plugin
  // stays silent and the build is unchanged — which is what CI does, since no
  // Sentry secrets are configured there. Runtime error capture is independent
  // of this and keyed off NEXT_PUBLIC_SENTRY_DSN (see src/sentry-options.ts).
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // Include dependency source maps so stack frames inside node_modules resolve.
  widenClientFileUpload: true,
  // Send client events through our own domain (/monitoring) so ad-blockers do
  // not drop them. If this 404s after a Workers deploy, delete this line.
  tunnelRoute: '/monitoring',
});
