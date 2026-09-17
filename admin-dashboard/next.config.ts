import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages export raw TS; Next must transpile them.
  transpilePackages: ['@yord/ui', '@yord/db-types', '@yord/auth', '@yord/supabase-clients'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  }
};

export default nextConfig;
