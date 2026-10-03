# YORD Admin Dashboard

Admin panel for YORD India built with Next.js 16 + Supabase. Direct Supabase CRUD (no custom backend), Agnes AI-assisted workflows, and Razorpay refunds. Designed for Netlify deployment.

## Setup

```bash
npm install
npm run dev    # localhost:3000
```

1. Copy the root `.env.example` to root `.env` and fill in Supabase + Agnes AI + Razorpay + Cloudflare R2 keys (`dev`/`build`/`start` load it automatically via dotenv-cli). Analytics/monitoring: `NEXT_PUBLIC_POSTHOG_KEY`/`_HOST` and `NEXT_PUBLIC_SENTRY_DSN` (+ build-only `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` for source maps); each is optional and unset means off.
2. Run SQL migrations in order (Supabase SQL editor). Refunds first: the
   `refund_transactions` table and `reserve_refund()` live in the root
   migration `supabase/migrations/002_refund_idempotency.sql` — apply it
   before the admin sequence, because `003_admin_rls.sql` creates policies
   on `refund_transactions` and fails if the table does not exist yet:
   - `supabase/migrations/002_refund_idempotency.sql` (root)
   - `admin-dashboard/sql/001_admin_tables.sql`
   - `admin-dashboard/sql/002_admin_next_id.sql`
   - `admin-dashboard/sql/003_admin_rls.sql`
   - `admin-dashboard/sql/004_atomic_writes.sql` (collection/variant writes + revenue analytics)
   - `admin-dashboard/sql/005_positional_collection_products.sql` (replaces
     004's `set_collection_products` so the picker's saved order — the
     `manual` collection sort — survives a write)
3. `003_admin_rls.sql` enables default-deny RLS on admin tables; all writes go through the Supabase secret key server-side.

## Commands

```bash
npm run dev    # dev server
npm run build  # production build
npm run start  # start production server
npm run lint   # ESLint
npm run test   # vitest (src/lib/__tests__/)
npm run clean  # rm -rf .next
```

## Structure

- `src/app/` — thin routes plus API routes; `src/middleware.ts` + `src/proxy.ts`
- `src/lib/data/` — **every read** (one module per entity: products, orders, collections, blogs, customers, inventory, discounts, media, settings, analytics, nav, search, covers)
- `src/server/actions/` — **every write**, all returning `ActionState`
- `src/components/` — `layout/` (shell, sidebar, topbar, command palette), `ui/` (PageHeader, StatCard, Avatar, Thumb, Tabs, ProgressBar, Tooltip, EmptyState, StatusBadge, ConfirmModal, ToastProvider), `charts/` (Recharts: ChartCard, AreaTrend, Bars, Donut, Sparkline), `data/` (DataTable, Pagination, FilterBar, SearchInput, BulkActions, TableSkeleton), `forms/` (ActionForm, ActionField, FormSection, FormActions), plus per-domain folders
- `src/lib/sections.ts` — the section map behind nav, breadcrumbs and per-section accent colours
- `sql/` — `001_admin_tables.sql`, `002_admin_next_id.sql`, `003_admin_rls.sql`, `004_atomic_writes.sql`, `005_positional_collection_products.sql`
- `docs/` — full technical spec (start at `docs/README.md`); the UI system is `docs/06-ui-system.md`

## UI

The admin runs on "Control Room" (`docs/06-ui-system.md`, tokens + classes in
`src/app/globals.css`): a 12px base with 34–40px table rows, a colour-token
system where each tone ships as a text/tint/border triplet, and a per-section
accent derived from the route. Pages compose the shared components above rather
than hand-rolling markup; new list pages use `DataTable` + `Pagination` +
`FilterBar` and every page starts with `PageHeader`.

## Notes

- Products/collections/discounts use BIGINT ids. `admin_next_id` provides safe id generation.
- AI endpoints use Agnes AI (Chat Completions + `POST /v1/images/generations` image edits). Requires `AGNES_AI_API_KEY` (`AGNES_TEXT_MODEL`, `AGNES_IMAGE_MODEL`, `AGNES_BASE_URL` optional).
- Refunds execute server-side via Razorpay (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).
- `/media` and `/settings` also need `SUPABASE_SECRET_KEY` (service-client reads of the audit log).
- Deployed to Netlify (`netlify.toml`, Node.js 20).
