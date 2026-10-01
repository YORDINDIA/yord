# YORD Admin Dashboard

Admin panel for YORD India built with Next.js 16 + Supabase. Direct Supabase CRUD (no custom backend), OpenAI-assisted workflows, and Razorpay refunds. Designed for Netlify deployment.

## Setup

```bash
npm install
npm run dev    # localhost:3000
```

1. Create `.env.local` from `.env.example` and fill in Supabase + OpenAI + Razorpay keys.
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
3. `003_admin_rls.sql` enables default-deny RLS on admin tables; all writes go through the service-role key server-side.

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

- `src/app/` — pages plus API routes; `src/components/`, `src/providers/`, `src/middleware.ts`
- `src/lib/` — Supabase clients (`supabase/`), OpenAI helpers (`ai/`), shared utils (`utils/`: `admin`, `audit`, `ids`, `format`, `sanitize`)
- `src/types/` — shared types
- `sql/` — `001_admin_tables.sql`, `002_admin_next_id.sql`, `003_admin_rls.sql`
- `docs/` — full technical spec (start at `docs/README.md`)

## Notes

- Products/collections/discounts use BIGINT ids. `admin_next_id` provides safe id generation.
- AI endpoints use the OpenAI Responses API + image edits. Requires `OPENAI_API_KEY` (`OPENAI_TEXT_MODEL`, `OPENAI_IMAGE_MODEL`).
- Refunds execute server-side via Razorpay (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).
- Deployed to Netlify (`netlify.toml`, Node.js 20).
