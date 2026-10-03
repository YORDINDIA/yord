# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YORD India is a luxury concert fashion e-commerce frontend built with Next.js 16 (App Router), React 19, and TypeScript. It features artists like Coldplay, Taylor Swift, Diljit Dosanjh, Linkin Park, and The Weeknd.

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
npm run typecheck # tsc --noEmit
npm run clean    # rm -rf .next
npm run test     # Run vitest suites (src/lib/__tests__/ + src/**/*.test.ts)
```

`dev`/`build`/`start` load the repo-root `.env` via `dotenv -e ../.env --no-expand`
(see the root `.env.example`); there are no per-app env files.

## Architecture

### Tech Stack
- **Framework**: Next.js 16.1.4 with App Router (`/src/app`)
- **Database/Auth**: Supabase (PostgreSQL + Auth with SSR cookies)
- **Payments**: Razorpay (Indian payment gateway)
- **State**: Zustand with localStorage persistence (cart, wishlist)
- **Styling**: Tailwind CSS 4 driven by the design tokens in
  `packages/ui/src/tokens.css` (light "Alabaster & Bronze" is the default,
  dark "Noir Luxe" is selectable) — see the design-system section below

### Key Directories
```
src/
├── app/                 # Next.js App Router routes and API handlers
│   ├── api/             # API routes (checkout, contact, newsletter, products, search, health)
│   └── (main)/          # product/[handle], collection/[handle], artist/[handle], catalog, blog, account, …
├── features/            # feature slices (catalog, product, artist, collection, cart,
│                        # checkout, home, layout, ui, auth, support, concerts, blog)
├── hooks/               # useAuth, useRazorpay, useProductsInfinite, useHydrated, useReportError
├── lib/
│   ├── data/            # autoCollections.ts (computed collections)
│   ├── supabase/        # client.ts / server.ts (regular, service, static) + queries.ts
│   └── stores/          # Zustand stores (cartStore, wishlistStore)
├── providers/           # ThemeProvider, PostHog/React Query providers
└── proxy.ts             # Next 16 middleware: guards /account/*
```

Schema types come from `@yord/db-types` — there is no local `types/database.ts`.

### Path Alias
Use `@/*` which maps to `./src/*` (e.g., `import { Button } from '@/components/ui/Button'`).

### Server vs Client Components
- Server Components are the default for data fetching via `lib/supabase/queries.ts`
- Client Components (`'use client'`) are used for interactivity (cart, forms, modals)
- Zustand stores are client-side only with localStorage persistence

### Authentication Flow
- Middleware (`src/proxy.ts` — Next 16's renamed `middleware.ts`) protects `/account/*` routes
- Uses Supabase Auth with SSR cookie-based sessions
- Auth pages redirect authenticated users to `/account`

### Design System

See "Design System — Alabaster & Bronze / Noir Luxe" below for the token
contract. Tokens are defined in `packages/ui/src/tokens.css` and mapped into
Tailwind from `src/app/globals.css`.

### Design System — "Alabaster & Bronze" (light) / "Noir Luxe" (dark)

**Light is the default theme.** Users pick Light / Dark / System from the header
(`features/ui/ThemeToggle.tsx`); the choice persists under
`yord-storefront-theme` and is applied by `next-themes` as `data-theme` on
`<html>` before first paint, so there is no flash of the wrong theme.

Tokens live in `packages/ui/src/tokens.css` — **not** in `globals.css`, which
only maps them into Tailwind. `:root` holds light; `[data-theme="dark"]` holds
the original Noir Luxe values, unchanged.

| Role | Token | Light | Dark |
|---|---|---|---|
| Page shell | `--surface-page` | `#F4F4F2` | `#0A0A0A` |
| Card | `--surface-card` | `#FBFBFA` | `#111111` |
| Raised / hover | `--surface-raised` | `#FFFFFF` | `#1A1A1A` |
| Input | `--surface-input` | `#FFFFFF` | `#111111` |
| Gold tint panel | `--accent-tint` | `#EAE6DA` | `rgba(255,217,102,0.08)` |
| Primary text | `--text-primary` | `#14161A` | `#FAFAF8` |
| Secondary text | `--text-secondary` | `#3C4250` | `#F5F5F0` |
| Muted text | `--text-muted` | `#5F6570` | `#9A9A94` |
| Decorative text only | `--text-subtle` | `#868D98` | `#C4C4BC` |
| Accent | `--accent` | `#7C5E1E` | `#FFD966` |
| Text on accent | `--text-on-accent` | `#FBFBFA` | `#0A0A0A` |
| Border (hairline) | `--border-default` | `#DCDDDE` | `#262626` |
| Border (input edge) | `--border-strong` | `#8B8271` | `#636363` |
| Focus ring | `--focus-ring` | `#6B5019` | `#FFD966` |

Rules that are easy to break:

- **Use a semantic token, never a raw ramp.** `--noir-*`, `--gold-*` and
  `--ivory-*` are private to the token layer and are deliberately **not**
  mapped into `@theme`, so `bg-noir-950` does not compile. `theme.test.ts`
  fails the build if a component reaches for one.
- **The gold ramp cannot be text on light.** Gold is ~14.5:1 on near-black but
  only ~3.9:1 on the light page, so light mode uses bronze `--accent`. The
  accent is bronze/gold, never bright gold, as readable text.
- **On-media text never flips.** The home hero *and* the artist hero are dark in
  *both* themes, so `--scrim`, `--text-on-media`, `--text-on-media-muted` and
  `--accent-on-media` are theme-invariant by design. Use them for anything over
  a photo or video. A hero that falls back to `bg-surface-page` puts the light
  page colour under ivory text and the header disappears.
- **The header follows the media routes, not just `/`.** It is transparent until
  scrolled, so it must take the on-media palette on every full-bleed media
  route — currently `/` and `/artist/[handle]`. A new full-viewport hero means
  adding that route to `onMedia` in `Header.tsx`.
- **Never build a colour by appending a hex alpha to a token.** `` `${c}20` `` is
  only valid for a hex; with `c = 'var(--accent)'` the declaration is dropped and
  the element vanishes. Use `color-mix(in srgb, ${c} 20%, transparent)`, which
  accepts both.
- **Artist brand colours are theme-invariant too.** They are bright, so a label
  sitting on one uses `--text-on-brand` (dark ink in both themes), not
  `--text-on-accent` (which flips). Never paint artist colour as *text* on a
  page surface — a brand yellow is ~1.6:1 on the light page; use `--accent`.
- **Shadows invert.** Light uses light-lift (low alpha, wide spread), dark uses
  black-blur. Never hardcode a shadow; use `--shadow-sm/md/lg/xl/depth`.
- `@theme inline` is load-bearing. Without `inline`, Tailwind emits
  `var(--color-x)`, which it owns, so the cascade cannot re-point it and the
  theme would not switch.

The header picks its own palette from the route: transparent over the home and
artist heroes (`onMedia`), theme-following everywhere else and once scrolled.

`theme.test.ts` guards all of the above: it fails on a raw ramp class, on a
theme-following text token inside a media hero, on a media hero that paints the
page surface, on the header losing a media route, and on a hex alpha
concatenated onto a token.

### Database Schema (Main Tables)
- `products` - Product catalog with status, handle (URL slug)
- `product_variants` - Size/color variants with pricing and inventory
- `product_images` - Images with `storage_url` (R2 public URL) and `src` (original)
- `collections` / `collects` - Collections and product-collection mappings.
  `new-arrivals` and `all` are computed, not stored: `lib/data/autoCollections.ts`
  answers them from `products` (active, newest first, same sorts and paging as any
  other collection), because both are linked from the header/footer and a stored
  list would go empty or stale. This app ignores their `collects` rows, so seeding
  them is unnecessary and `scripts/tidy_collections.py` clears them on its next
  `--execute`. Interim rows may exist in the database as a stopgap for a deployed
  build that predates the auto path — do not treat them as the source of truth, and
  do not delete them without checking which build is live. A collection's
  `sort_order` is used as the default order when the shopper passes no `?sort=`;
  `manual` means the admin picker's saved order (`collects.position`, written by
  the `set_collection_products()` RPC): the id-list fetch reads the ids in
  position order and preserves them in JS, and it is never a shopper dropdown
  choice (the grid shows "Curated" when active). The auto collections have no
  `collects` rows, so they treat `manual` as `newest`.
  `newest` sorts on `products.published_at`.
- `customers` / `orders` / `line_items` - User and order data

### Images
Delivery runs through Cloudflare R2, not Next's optimizer:
`src/lib/media-loader.ts` is wired as `images.loaderFile` in `next.config.ts`.
R2 stores one web-optimized WebP variant per image (max 1600px, built on upload),
so the loader returns stored URLs unchanged and rewrites stored `*.r2.dev`
origins to `NEXT_PUBLIC_MEDIA_BASE_URL` when it is set; every other source
(Shopify CDN, legacy Supabase, local `/public` files such as
`/placeholder-product.png`) passes through untouched. `remotePatterns` is
deliberately absent — a custom loader owns all URLs, so add hosts or rewrites in
the loader, with tests in `src/lib/__tests__/media-loader.test.ts`.

## Environment Variables

Copy the root `.env.example` to root `.env` and configure (loaded automatically via dotenv-cli):
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Supabase public
- `SUPABASE_SECRET_KEY` - Supabase server-only (never expose to client)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `NEXT_PUBLIC_RAZORPAY_KEY_ID` - Payments
- `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_APP_NAME` - App config (not read by code yet)
- `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` - Analytics
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` - GA4 stream id; unset = no GA script (root layout)
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` - Search Console meta tag; unset = tag omitted
- `NEXT_PUBLIC_SENTRY_DSN` (+ build-only `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`) - Sentry errors only; see `src/sentry-options.ts`
- `NEXT_PUBLIC_MEDIA_BASE_URL` - optional; rewrites stored `*.r2.dev` image URLs to a custom domain (see Images)
- `NEXT_PUBLIC_SHOW_CONCEPTS` - `true` enables the `/concepts/*` design routes; leave unset in production

## Deployment

Deployed to Netlify (see `netlify.toml`). Node.js 20 is required.
