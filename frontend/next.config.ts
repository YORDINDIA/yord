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
    // The widths `scripts/generate_image_variants.py` pre-generates for product
    // images (320/640/960/1280, plus the 1600 original). Matching them here
    // keeps the emitted `srcset` free of widths that only round to a neighbour:
    // `mediaLoader` maps each of these straight onto a stored sibling file.
    deviceSizes: [640, 960, 1280, 1600],
    imageSizes: [96, 160, 256, 384],
  },
  /**
   * Concept D (`/concepts/rail`) draws product photos as WebGL textures, and
   * WebGL needs CORS headers the bucket does not send. This same-origin proxy
   * exists only while the concepts are on (`features/concepts/gate.ts`), so a
   * production build without NEXT_PUBLIC_SHOW_CONCEPTS=1 has no proxy at all.
   */
  async rewrites() {
    const conceptsOn =
      process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SHOW_CONCEPTS === "1";
    const origin = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.R2_PUBLIC_BASE_URL)
      ?.trim()
      .replace(/\/+$/, "");
    if (!conceptsOn || !origin) return [];
    return [{ source: "/rail-media/products/:path*", destination: `${origin}/products/:path*` }];
  },
  /**
   * Security headers on the responses Next itself serves (the HTML documents).
   * Static assets get the same set from `public/_headers` (Cloudflare Workers
   * Static Assets) and `netlify.toml`; keep the three in step. The CSP ships
   * report-only: the storefront's HTML is ISR-cached and carries inline
   * bootstrap scripts, so a nonce-based policy would force per-request
   * rendering. Report-only collects violations (Razorpay, PostHog, GA) before
   * anything is enforced.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // `same-origin` would sever window.opener for Razorpay's popup
          // bank/UPI flows.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://media.yordindia.com https://*.r2.dev https://cdn.shopify.com https://www.google-analytics.com https://www.googletagmanager.com https://checkout.razorpay.com https://cdn.razorpay.com https://rojruflnuhclvkhipjxs.supabase.co; font-src 'self' data:; connect-src 'self' https://rojruflnuhclvkhipjxs.supabase.co https://us.i.posthog.com https://us-assets.i.posthog.com https://api.razorpay.com https://lumberjack.razorpay.com https://www.google-analytics.com https://*.analytics.google.com https://*.ingest.sentry.io; frame-src https://checkout.razorpay.com https://api.razorpay.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests",
          },
        ],
      },
    ];
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
