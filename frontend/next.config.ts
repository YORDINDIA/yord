import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Workspace packages export raw TS; Next must transpile them.
  transpilePackages: ["@yord/ui", "@yord/db-types", "@yord/auth", "@yord/supabase-clients"],
  // Monorepo: trace files from the repo root so packages/* are included.
  outputFileTracingRoot: path.join(__dirname, "../"),
  images: {
    // Delivery runs straight from Cloudflare R2, not through Next's optimizer:
    // the bucket already holds one web-optimized WebP variant per image (see
    // `scripts/utils/r2_helpers.py`), so `src/lib/media-loader.ts` returns the
    // stored URL as-is and no image function ever runs on the host. A custom
    // loader owns every URL, which is why the optimizer-only settings
    // (`remotePatterns`, `formats`, `minimumCacheTTL`) are gone — URL policy
    // lives in `src/lib/media-loader.ts`. See `docs/deploy.md`.
    loader: "custom",
    loaderFile: "./src/lib/media-loader.ts",
  },
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
  tunnelRoute: "/monitoring",
});
