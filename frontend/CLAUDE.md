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
npm run test     # Run vitest suites (src/lib/__tests__/ + src/**/*.test.ts)
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16.1.4 with App Router (`/src/app`)
- **Database/Auth**: Supabase (PostgreSQL + Auth with SSR cookies)
- **Payments**: Razorpay (Indian payment gateway)
- **State**: Zustand with localStorage persistence (cart, wishlist)
- **Styling**: Tailwind CSS 4 with custom "Noir Luxe" dark theme

### Key Directories
```
src/
├── app/                 # Next.js App Router pages and API routes
│   ├── api/             # API routes (checkout, contact, newsletter, search)
│   └── [handle]/        # Dynamic routes for products, collections, artists
├── components/          # React components (ui/, layout/, home/, product/, etc.)
├── hooks/               # Custom hooks (useAuth, useRazorpay)
├── lib/
│   ├── supabase/        # Supabase clients and query functions
│   │   ├── client.ts    # Browser client
│   │   ├── server.ts    # Server clients (regular, service, static)
│   │   └── queries.ts   # Database query functions
│   └── stores/          # Zustand stores (cartStore, wishlistStore)
└── types/database.ts    # TypeScript types for Supabase schema
```

### Path Alias
Use `@/*` which maps to `./src/*` (e.g., `import { Button } from '@/components/ui/Button'`).

### Server vs Client Components
- Server Components are the default for data fetching via `lib/supabase/queries.ts`
- Client Components (`'use client'`) are used for interactivity (cart, forms, modals)
- Zustand stores are client-side only with localStorage persistence

### Authentication Flow
- Middleware (`src/middleware.ts`) protects `/account/*` routes
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
- `product_images` - Images with `supabase_url` for storage
- `collections` / `collects` - Collections and product-collection mappings
- `customers` / `orders` / `line_items` - User and order data

## Environment Variables

Copy the root `.env.example` to root `.env` and configure (loaded automatically via dotenv-cli):
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase public
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase server-only (never expose to client)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `NEXT_PUBLIC_RAZORPAY_KEY_ID` - Payments
- `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_APP_NAME` - App config

## Deployment

Deployed to Netlify (see `netlify.toml`). Node.js 20 is required.
