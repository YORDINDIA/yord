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
```

No test framework is currently configured.

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

### Design System (Noir Luxe)
CSS variables defined in `src/app/globals.css`:
- **Noir palette**: `--noir-950` through `--noir-400` (dark backgrounds)
- **Gold accents**: `--gold-50` through `--gold-500` (luxury highlights)
- **Ivory text**: `--ivory-50` through `--ivory-400` (text hierarchy)
- **Artist colors**: Each artist has primary/secondary color variables
- **Semantic**: `--background`, `--foreground`, `--card`, `--border`, `--accent`, `--muted`

### Database Schema (Main Tables)
- `products` - Product catalog with status, handle (URL slug)
- `product_variants` - Size/color variants with pricing and inventory
- `product_images` - Images with `supabase_url` for storage
- `collections` / `collects` - Collections and product-collection mappings
- `customers` / `orders` / `line_items` - User and order data

## Environment Variables

Copy `.env.local.example` to `.env.local` and configure:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase public
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase server-only (never expose to client)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `NEXT_PUBLIC_RAZORPAY_KEY_ID` - Payments
- `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_APP_NAME` - App config

## Deployment

Deployed to Netlify (see `netlify.toml`). Node.js 20 is required.
