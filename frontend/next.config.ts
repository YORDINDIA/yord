import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages export raw TS; Next must transpile them.
  transpilePackages: ["@yord/ui", "@yord/db-types", "@yord/auth", "@yord/supabase-clients"],
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "zbxvholbndkgqgbdefzx.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.myshopify.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
