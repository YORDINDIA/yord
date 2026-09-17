# YORD India — Agent Guide

Monorepo: Shopify → Supabase migration + luxury concert-fashion e-commerce (Coldplay, Taylor Swift, Diljit Dosanjh, Linkin Park, The Weeknd).

## Layout

- `frontend/` — customer storefront (Next.js 16 App Router, React 19, TS). Deployed to Netlify, Node 20 required.
- `admin-dashboard/` — admin panel (Next.js 16, direct Supabase CRUD, OpenAI + Razorpay refunds). SQL in `admin-dashboard/sql/`.
- `scripts/` — Python Shopify → Supabase migration + audit tooling. Schema in `scripts/schema.sql`, patches in `scripts/schema_patches/`.
- `packages/` — shared workspace packages (`@yord/ui` tokens/CSS, `@yord/db-types`, `@yord/auth`, `@yord/supabase-clients`) consumed via npm workspaces; both Next configs list them in `transpilePackages` because they export raw TS.
- Root `package.json` holds the Remotion video deps and the `turbo` tasks (`turbo.json`); app code lives in the two sub-apps plus `packages/`.

## Commands

Each Next.js app runs from its own dir (`frontend/` or `admin-dashboard/`):

```bash
npm run dev    # dev server (localhost:3000), 4GB heap flag is built into the script
npm run build  # production build
npm run start  # start production server
npm run lint   # ESLint (eslint-config-next)
npm run clean  # rm -rf .next
```

A root `npm install` sets up the workspaces for both apps. Tests: `npm run test` (vitest) where a `vitest.config.ts` exists — currently checkout/pricing/refund-validation units. Do not add heavier test infrastructure unasked.

Python scripts (run from `scripts/`, ~5 min for venv setup first time):

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r ../requirements.txt   # requirements.txt lives at repo root
python migrate_via_rest.py --dry-run   # preview; use --execute to write
python verify_migration.py --quick     # use --full for details
python yord.py migrate --dry-run       # whole pipeline plan + env check; --execute to run
```

## Architecture

### Frontend (`frontend/src/`)
- `app/` — App Router pages + API routes (`api/` covers checkout, contact, newsletter, search); dynamic `[handle]/` routes for products/collections/artists.
- `components/` (`ui/`, `layout/`, `home/`, `product/`, …), `hooks/` (`useAuth`, `useRazorpay`), `providers/`.
- `lib/supabase/` — three clients in `client.ts` (browser) / `server.ts` (regular, service, static) + queries in `queries.ts`. `lib/stores/` — Zustand cart/wishlist with localStorage persistence (client-only).
- `types/database.ts` — Supabase schema types (byte-identical copy of `packages/db-types`; treat the package as canonical). Path alias `@/*` → `./src/*`. Design tokens live in `packages/ui/src/tokens.css`, imported at the top of `app/globals.css`.
- Server Components fetch via `queries.ts` by default; `'use client'` only for interactivity (cart, forms, modals).
- Auth: `src/proxy.ts` (Next 16's middleware) guards `/account/*` via Supabase SSR cookies; auth pages redirect logged-in users to `/account`.
- Stack: Supabase (Postgres + Auth), Razorpay payments, Tailwind 4 "Noir Luxe" theme (`src/app/globals.css`: `--noir-*` backgrounds, `--gold-*` accents, `--ivory-*` text, per-artist colors), PostHog analytics, framer-motion.

### Admin (`admin-dashboard/src/`)
- `app/` pages + API routes, `components/`, `providers/`, `middleware.ts`, `lib/` (`supabase/server.ts` anon + service clients, `utils/admin.ts` `requireAdmin`, `utils/ids.ts` `admin_next_id`, `ai/`, `utils/prompt.ts`, `utils/sanitize.ts`).
- API routes call `requireAdmin()` (service-role client). Page-level gates (`middleware.ts`, `(admin)/layout.tsx`) read `admin_users` with the anon client, so `sql/003_admin_rls.sql` must keep the `admin_users_self_read` policy or every admin sees "Access denied". Admin-only reads/writes (settings page) use the service client.
- Refunds reserve a row via `reserve_refund()` in `supabase/migrations/002_refund_idempotency.sql` before calling Razorpay, and support partial refunds up to the transaction total.
- Products/collections/discounts use BIGINT ids via `admin_next_id` (see `sql/001_admin_tables.sql`, `002_admin_next_id.sql`). `src/types/database.ts` here is a hand-maintained superset — port it into `packages/db-types` when convenient.
- AI endpoints use OpenAI Responses API + image edits (`OPENAI_API_KEY` required). Refunds run through Razorpay server-side.

### Scripts (`scripts/`)
- `utils/` shared layer: `shopify.py` (ShopifyClient, auto-pagination + retry), `supabase_helpers.py` (client + `batch_upsert`), `config.py` (`ARTIST_COLLECTIONS`, `TARGET_ARTISTS`), `logging_config.py`.
- Fresh-migration order: apply `schema.sql` → `migrate_via_rest.py --execute` → `migrate_media.py` → `migrate_blogs.py` → `populate_collections.py --mode=keyword --execute` → `verify_migration.py --full` → `optimize_images.py` (no `--execute` flag; it runs on invoke).
- Scripts write checkpoints (`*_checkpoint.json`, safe to delete for restart) and error logs (`media_migration_errors.json`, `optimization_errors.json`). `migrate_via_rest.py` only marks an entity checkpointed when the run logged zero record errors, and stores a Supabase/Shopify source fingerprint that `--resume` refuses to mix. `archive/` is deprecated reference only.

## Environment

- Never commit `.env` / `.env.local`. Templates: root `.env.example` (migration), `admin-dashboard/.env.example`.
- Frontend needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID/SECRET` + `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `NEXT_PUBLIC_APP_URL/NAME`, `NEXT_PUBLIC_POSTHOG_KEY/HOST`.
- Admin needs Supabase keys + `OPENAI_API_KEY` (+ `OPENAI_TEXT_MODEL`, `OPENAI_IMAGE_MODEL`) + Razorpay keys.
- Scripts need `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_STORE_NAME`, `SHOPIFY_ADMIN_API_ACCESS_TOKEN`, `SUPABASE_STORAGE_BUCKET=products`.
- DB migrations live in `supabase/migrations/` (apply in numeric order; each file documents its pre-flight checks). Admin SQL stays in `admin-dashboard/sql/`.
