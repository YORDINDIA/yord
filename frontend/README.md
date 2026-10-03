# YORD Frontend

Customer storefront for YORD India: luxury concert-fashion e-commerce built with Next.js 16 (App Router), React 19, and TypeScript.

## Stack

Supabase (Postgres + Auth with SSR cookies), Razorpay payments, Zustand cart/wishlist stores with localStorage persistence, Tailwind CSS 4 "Noir Luxe" dark theme, PostHog analytics.

## Setup

```bash
npm install
npm run dev    # localhost:3000
```

Copy the root `.env.example` to root `.env` and fill it in — `dev`/`build`/`start` load it automatically via dotenv-cli. This app reads:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-only, never expose to the client)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` (GA4; unset = no GA script)
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` (Search Console meta tag)
- `NEXT_PUBLIC_SENTRY_DSN` (+ build-only `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` for source maps)

## Commands

```bash
npm run dev    # dev server
npm run build  # production build
npm run start  # start production server
npm run lint   # ESLint
npm run clean  # rm -rf .next
```

No test framework is configured.

## Structure

- `src/app/` — pages plus API routes (`api/` covers checkout, contact, newsletter, search); dynamic `[handle]/` routes for products, collections, artists
- `src/components/` (`ui/`, `layout/`, `home/`, `product/`, …), `src/hooks/` (`useAuth`, `useRazorpay`), `src/providers/`
- `src/lib/supabase/` — `client.ts` (browser), `server.ts` (regular, service, static), `queries.ts` (all DB queries); `src/lib/stores/` — cart/wishlist
- `src/types/database.ts` — Supabase schema types; path alias `@/*` maps to `src/*`

Server Components fetch via `queries.ts` by default; `'use client'` only for interactivity. `src/middleware.ts` (re-exported via `src/proxy.ts`) guards `/account/*` through Supabase SSR sessions. Theme tokens (`--noir-*`, `--gold-*`, `--ivory-*`, per-artist colors) live in `src/app/globals.css`.

## Images

`next/image` runs a custom R2 loader (`src/lib/media-loader.ts`, wired in
`next.config.ts` as `images.loaderFile`), not the built-in optimizer. Media is
stored in Cloudflare R2 as one web-optimized WebP variant per image (max 1600px,
built on upload — see `scripts/utils/r2_helpers.py`), so there is nothing to
transform at request time: the loader returns stored URLs unchanged. It also
rewrites stored `*.r2.dev` origins to `NEXT_PUBLIC_MEDIA_BASE_URL` when that is
set, which moves delivery to a custom domain without touching the database.
Anything else — a Shopify CDN URL, a legacy Supabase URL, a local file such as
`/placeholder-product.png` — is returned unchanged.

Because a custom loader owns every URL, `images.remotePatterns` / `formats` /
`minimumCacheTTL` no longer apply and are intentionally absent: adding a host to
`next.config.ts` has no effect. Change URL policy in the loader and cover it in
`src/lib/__tests__/media-loader.test.ts`.

## Deploy

Netlify (`netlify.toml`, Node.js 20).
