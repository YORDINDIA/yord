# YORD India — Agent Guide

Monorepo: Shopify → Supabase migration + luxury concert-fashion e-commerce (Coldplay, Taylor Swift, Diljit Dosanjh, Linkin Park, The Weeknd).

## Layout

- `frontend/` — customer storefront (Next.js 16 App Router, React 19, TS). Deployed to Netlify, Node 20 required.
- `admin-dashboard/` — admin panel (Next.js 16, layered data/action/UI, OpenAI + Razorpay refunds). SQL in `admin-dashboard/sql/`.
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

A root `npm install` sets up the workspaces for both apps. Tests: `npm run test` (vitest) where a `vitest.config.ts` exists — the frontend has checkout/pricing/error-model/sanitize suites, the admin has pagination/validation/sanitizer/action-state/route-coverage suites. Do not add heavier test infrastructure unasked.

Admin builds need the Supabase env vars present: every admin route is dynamic, and without `NEXT_PUBLIC_SUPABASE_URL` the build fails at prerender with "Missing NEXT_PUBLIC_SUPABASE_URL". CI supplies mock values (`.github/workflows/ci.yml`).

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
- `app/` — thin App Router routes + `error.tsx`/`loading.tsx`/`not-found.tsx` per segment; API routes (`api/` covers checkout, contact, newsletter, search, **products**); dynamic `[handle]/` routes for products/collections/artists.
- `features/` — feature slices (`catalog/`, `product/`, `artist/`, `collection/`, `cart/`, `checkout/`, `home/`, `layout/`, `ui/`, `auth/`, `support/`, `concerts/`, `blog/`). Routes fetch + render metadata; presentational/client work lives here. The one catalog grid is `features/catalog/CatalogGrid.tsx`.
- `hooks/` (`useAuth`, `useRazorpay`, `useProductsInfinite`, `useHydrated`), `providers/` (PostHog + React Query `QueryClientProvider`).
- `lib/supabase/` — three clients in `client.ts` (browser) / `server.ts` (regular, service, static) + queries in `queries.ts`. `lib/stores/` — Zustand cart/wishlist with localStorage persistence (client-only). Focused helpers: `lib/product.ts` (catalog logic + canonical `SortOption`), `lib/search.ts` (PostgREST escaping), `lib/sanitize.ts` (`sanitizeHtml`), `lib/text.ts`, `lib/errors.ts` + `lib/result.ts` (error model), `lib/catalog-url.ts` lives at `features/catalog/catalogUrl.ts`.
- Schema types come only from `@yord/db-types` (no local copy). Formatting (`cn`, `formatPrice`, `formatDate`, `truncate`, `stripHtml`) comes only from `@yord/ui`. Path alias `@/*` → `./src/*`. Design tokens live in `packages/ui/src/tokens.css`, imported at the top of `app/globals.css`.
- Server Components fetch via `queries.ts` by default; `'use client'` only for interactivity (cart, forms, modals).
- **Error model:** empty → `[]`, missing row → `null` (page calls `notFound()`), failed read → throws `DatabaseError` (nearest `error.tsx`). Optional sections use `queryOrDegrade`. Never render "no results" for a failed read.
- **Unconfigured Supabase (no URL/anon key):** reads degrade to empty so a backend-less `next build` prerenders; clients use a placeholder endpoint + warn. A *configured but unreachable* backend throws → error boundaries. CI builds with localhost mock values for these (`.github/workflows/ci.yml`), which is the supported way to build without real credentials.
- **Catalog pagination:** page 1 is SSR HTML; pages 2+ come from `GET /api/products` (zod params, 60/min IP limit) via `useInfiniteQuery`. `?sort=` navigates to fresh SSR; `?page=` syncs via `replaceState`.
- **Cart ownership:** guest carts are claimed on sign-in only after persist rehydration (`claimCartForUser`); actions selectors use `useShallow`. Gate persisted reads on `useCartHydrated`/`useWishlistHydrated` to avoid empty-flash.
- Auth: `src/proxy.ts` (Next 16's middleware) guards `/account/*` via Supabase SSR cookies; auth pages redirect logged-in users to `/account`.
- Tests: `npm run test` (vitest, `src/lib/__tests__/` + `src/**/*.test.ts`) — error-model, product-helper, search-filter, sanitize, checkout-gate and theme-contract suites (95 tests).
- **Theming (storefront): light is the default**, with Dark and System selectable from the header. `next-themes` writes `data-theme` on `<html>` pre-paint (`providers/ThemeProvider.tsx`, key `yord-storefront-theme`, namespaced because both apps serve :3000 in dev). Tokens live in `packages/ui/src/tokens.css` — `:root` is light ("Alabaster & Bronze"), `[data-theme="dark"]` is the original "Noir Luxe", values unchanged. `globals.css` maps them through `@theme inline`, which is load-bearing: without `inline` Tailwind emits `var(--color-x)` and the cascade cannot re-point it.
- **The token contract.** Components use semantic tokens only (`bg-surface-page/card/raised/inset`, `text-text-primary/secondary/muted/subtle`, `bg-accent`, `text-text-on-accent`, `border-border-default/strong`, `ring-focus-ring`). The `noir-*`/`gold-*`/`ivory-*` ramps are private to the token layer and are **not** mapped into `@theme`, so `bg-noir-950` does not compile and `theme.test.ts` fails the build on one. Four rules the tests enforce, each because breaking it fails silently: (1) every themed token must exist in *both* theme blocks, or the dark page silently renders light values; (2) `--text-subtle` is 3.04:1 and is for large/decorative text only — body copy uses `--text-muted`; (3) `--scrim`/`--text-on-media`/`--accent-on-media` are theme-invariant because the home hero is dark in *both* themes, so anything over a photo or video uses them and never flips; (4) artist brand colours are theme-invariant and bright, so a label on one uses `--text-on-brand` (dark ink in both themes) rather than the flipping `--text-on-accent`, and artist colour is never used as text on a page surface (a brand yellow is ~1.6:1 on light — use `--accent`). Light mode uses bronze rather than gold as the accent because the gold ramp only reaches ~3.9:1 on the light page; shadows invert from black-blur to light-lift. `manifest.ts` splash colours are light because a standalone window paints before any CSS loads.
- Stack: Supabase (Postgres + Auth), Razorpay payments, Tailwind 4 with the token system above, PostHog analytics, framer-motion.

### Admin (`admin-dashboard/src/`)
- **Layered, and the layering is the rule:** `lib/data/*` (all reads) → `server/actions/*` (all writes) → `app/(admin)/*` (thin routes) → `components/*` (rendering). No page or component may call `.from()` directly, and no component may import a Supabase client. Reads go through an entity module; writes go through an action.
- **Reads — `lib/data/`** (one module per entity: products, orders, collections, blogs, customers, inventory, discounts, media, settings, analytics; `client.ts` holds the shared helpers). `client.ts` marks the module `server-only`. Three outcomes are kept distinct, matching the frontend: empty → `[]`, missing row → `null` (page calls `notFound()`), failed read → throws `DatabaseError` → nearest `error.tsx`. **Never render "no results" for a failed read.** All list helpers take `{ q, page, pageSize }` and return `{ rows, count, page, pageSize }`; no list query may use a bare `.limit()`.
- **Writes — `server/actions/`** (products, collections, blogs, orders, inventory, discounts, settings, media, ai). Every action has the signature `(prev: ActionState, formData: FormData) => Promise<ActionState>` and runs inside `withAdmin()` in `_shared.ts`, which only authenticates (via `requireAdminAction()`) and converts any throw into a form-level error. Parsing, writing, and auditing happen in each action body around it: parse with `parseForm()` (zod schema, shared with the client), write via the service client, record with `audit()`. **No action returns `undefined`** — a silent success is the bug this structure exists to prevent. `audit()` is never fatal: a failed audit logs loudly and does not invalidate a committed write.
- **`ActionState`** (`lib/action-state.ts`) is the single mutation return shape: `status`, `message`, `data`, `formError`, `fieldErrors`. `useActionForm` / `ActionField` / `FormError` (`components/forms/`) give every form the same three feedback channels: banner, per-field message, and toast. New forms use these rather than raw `useActionState`.
- **Validation** is `lib/validation.ts` only (zod), shared by client and server. HTML written by an admin or a model (`body_html`, `summary_html`) is sanitized by `lib/utils/sanitize.ts` on the way in — it is rendered with `dangerouslySetInnerHTML` downstream.
- **Shared list UI** in `components/data/`: `DataTable` (always wraps in `.table-wrap`; `hide-mobile`/`hide-tablet` drop secondary columns at 768px/1024px), `Pagination`, `FilterBar`, `SearchInput`, `BulkActions`, `TableSkeleton`. A new list page composes these instead of writing a `<table>`; each `DataTable` gets `emptyTitle`/`emptyHint` so "no results" is never a bare empty table.
- **Route states:** `(admin)/error.tsx`, `loading.tsx`, `not-found.tsx` apply to every admin route. All admin routes are dynamic by design — they require a live session, so never make one statically prerenderable.
- **Providers** live in the root layout: `ToastProvider` (context, not `window.dispatchEvent`). The admin app has no React Query; client fetches go through `postJson` (`lib/utils/post-json.ts`).
- API routes call `requireAdmin()` (service-role client) and validate with the shared schemas. Page-level gates (`middleware.ts`, `(admin)/layout.tsx`) read `admin_users` with the anon client, so `sql/003_admin_rls.sql` must keep the `admin_users_self_read` policy or every admin sees "Access denied". Admin-only reads/writes (settings page) use the service client.
- `middleware.ts` has two route lists — `ADMIN_ROUTE_PREFIXES` (read at request time) and the `config.matcher` (Next parses it statically, so it cannot spread the constant). `src/lib/__tests__/routes.test.ts` asserts they agree with the real `src/app/(admin)/*` tree; keep all three in step when adding a page.
- Refunds reserve a row via `reserve_refund()` in `supabase/migrations/002_refund_idempotency.sql` before calling Razorpay, and support partial refunds up to the transaction total. The money path stays in `POST /api/refunds`; the UI (`orders/refund-panel.tsx`) pre-validates with the shared `refundSchema` for fast feedback, then posts through `postJson`. The route hand-validates its payload and is the boundary.
- Products/collections/discounts use BIGINT ids via `admin_next_id` (see `sql/001_admin_tables.sql`, `002_admin_next_id.sql`); `getNextId` memoizes one service client. Multi-row writes go through the RPCs in `sql/004_atomic_writes.sql` (`set_collection_products`, `set_product_variants`, `set_cover_image`) so a mid-loop failure cannot leave a partial set; analytics aggregate in SQL (`revenue_by_day`, `top_products_by_units`). The RPCs signal expected outcomes by raising (`IMAGE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `INVALID_VARIANT_ROWS`); actions map those to specific copy and keep a generic "nothing was changed" message for everything else. `updateVariantsAction` verifies every submitted variant id belongs to the submitted product, because the RPC is id-keyed and cannot check that itself.
- Forms that render an HTML checkbox must use `checkboxSchema`, not `z.coerce.boolean()`. An unchecked box is absent from `FormData` entirely, and `z.coerce.boolean()` turns the string `"false"` into `true`, so `z.coerce.boolean()` fails on the empty case and inverts the "on"/"off" case. New products have no status control and always start as `draft` via the schema default.
- HTML from a model is sanitized at render as well as on save: `sanitizeHtml` is dependency-free and safe in the client, and the AI studio previews render through it. Sanitizing only in the save action leaves the preview as a script-execution surface on the admin origin.
- Client `error.tsx` cannot `instanceof DatabaseError` — Next serializes only `message`/`digest` across the boundary — so `DatabaseError` prefixes its message with `Could not read <entity>:` and the boundary matches on that. Keep the format and the regex together.
- The focus ring is `--focus-ring`, set per theme. The saffron accent is ~10:1 on the dark panel but only ~1.6:1 on the light one, below the 3:1 non-text minimum; a single hardcoded accent would leave light-theme keyboard users with no visible focus.
- `SearchInput` resyncs to the URL by adjusting state during render, keyed on the last observed `q`. A `key` on its own returned element does nothing (keys only matter among siblings), and the `useEffect(() => setState(prop))` form is both a lint error and a fight with the debounce.
- Routes with two paginated tables (blogs + articles, product + article media) pass a distinct `pageParam` to each `Pagination`, so paging one table does not move the other.
- Inventory search resolves product-name matches in a second query and ORs the ids in. The two-query shape exists because the obvious one-liner silently dropped the product-name half: PostgREST cannot filter on an embedded resource's column without embedding it, and embedding would drop the `product_variants` filter (inner join). The id list is bounded (500) and an empty match falls back to the variant-title half alone, since PostgREST rejects an empty `in ()`.
- Schema types come only from `@yord/db-types` — the local `src/types/database.ts` copy is deleted.
- AI endpoints use OpenAI Responses API + image edits (`OPENAI_API_KEY` required). AI writes go through the same audited actions as the UI: `AiBlogStudio` calls `saveAiDraftAction` directly, and `/api/ai/listing/apply` delegates to its action. Refunds run through Razorpay server-side.
- Tests: `npm run test` (vitest, `src/lib/__tests__/`) — pagination/query-string, shared schemas (including checkbox regressions), `refundSchema` + partial-refund classification, sanitizer, `ActionState`, error-boundary message contract, and route coverage (97 tests). Tests import the real module; a test that re-implements the code as a local copy cannot fail when the code does, and a test that passes an extra field the form does not render will not catch a schema/form mismatch.

### Scripts (`scripts/`)
- `utils/` shared layer: `shopify.py` (ShopifyClient, auto-pagination + retry), `supabase_helpers.py` (client + `batch_upsert`), `config.py` (`ARTIST_COLLECTIONS`, `TARGET_ARTISTS`), `logging_config.py`.
- Fresh-migration order: apply `schema.sql` → `migrate_via_rest.py --execute` → `migrate_media.py` → `migrate_blogs.py` → `populate_collections.py --mode=keyword --execute` → `verify_migration.py --full` → `optimize_images.py` (no `--execute` flag; it runs on invoke).
- Scripts write checkpoints (`*_checkpoint.json`, safe to delete for restart) and error logs (`media_migration_errors.json`, `optimization_errors.json`). `migrate_via_rest.py` only marks an entity checkpointed when the run logged zero record errors, and stores a Supabase/Shopify source fingerprint that `--resume` refuses to mix. `archive/` is deprecated reference only.

## Environment

- One env file for the repo: copy root `.env.example` to root `.env` (gitignored, never commit). No per-app `.env*` files; both Next apps preload it via `dotenv -e ../.env --no-expand` in their `dev`/`build`/`start` scripts (a missing file is ignored, so CI/Netlify env vars keep working and always win over file values).
- Frontend needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID/SECRET` + `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `NEXT_PUBLIC_APP_URL/NAME`, `NEXT_PUBLIC_POSTHOG_KEY/HOST`.
- Admin needs the same Supabase/Razorpay/PostHog keys + `SUPABASE_STORAGE_BUCKET` + `OPENAI_API_KEY` (+ `OPENAI_TEXT_MODEL`, `OPENAI_IMAGE_MODEL`).
- Scripts read `SUPABASE_URL`, falling back to `NEXT_PUBLIC_SUPABASE_URL` (same project) via `utils/config.py::resolve_supabase_url`, plus `SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_STORE_NAME`, `SHOPIFY_ADMIN_API_ACCESS_TOKEN`, `SUPABASE_STORAGE_BUCKET=products`. Direct-DB work (`psql`) uses `DATABASE_URL` or the `SUPABASE_DB_*` vars.
- DB migrations live in `supabase/migrations/` (apply in numeric order; each file documents its pre-flight checks). Admin SQL stays in `admin-dashboard/sql/`.
