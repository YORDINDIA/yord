# YORD Frontend

Customer storefront for YORD India: luxury concert-fashion e-commerce built with Next.js 16 (App Router), React 19, and TypeScript.

## Stack

Supabase (Postgres + Auth with SSR cookies), Razorpay payments, Zustand cart/wishlist stores with localStorage persistence, Tailwind CSS 4 "Noir Luxe" dark theme, PostHog analytics.

## Setup

```bash
npm install
npm run dev    # localhost:3000
```

Create `.env.local` with:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose to the client)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`

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

## Deploy

Netlify (`netlify.toml`, Node.js 20).
