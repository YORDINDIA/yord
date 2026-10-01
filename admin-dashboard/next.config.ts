import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages export raw TS; Next must transpile them.
  transpilePackages: ['@yord/ui', '@yord/db-types', '@yord/auth', '@yord/supabase-clients'],
  // Monorepo: trace files from the repo root so packages/* are included.
  outputFileTracingRoot: path.join(__dirname, '../'),
  // Media uploads ride a Server Action (see media/uploader.tsx). The 1 MB
  // default body limit rejects even single valid images (up to
  // MAX_MEDIA_BYTES each, MAX_MEDIA_FILES per batch), so raise it to cover
  // typical batches. Batches beyond this belong on a direct storage upload,
  // not a larger action body.
  experimental: {
    serverActions: { bodySizeLimit: '50mb' },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  }
};

export default nextConfig;
