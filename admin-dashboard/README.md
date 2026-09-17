# YORD Admin Dashboard

Admin panel for YORD India built with Next.js 16 + Supabase. Direct Supabase CRUD (no custom backend), OpenAI-assisted workflows, and Razorpay refunds. Designed for Netlify deployment.

## Setup

```bash
npm install
npm run dev    # localhost:3000
```

1. Create `.env.local` from `.env.example` and fill in Supabase + OpenAI + Razorpay keys.
2. Run SQL migrations in `admin-dashboard/sql/` (Supabase SQL editor), in order:
   - `001_admin_tables.sql`
   - `002_admin_next_id.sql`
   - `003_admin_rls.sql`
3. `003_admin_rls.sql` enables default-deny RLS on admin tables; all writes go through the service-role key server-side.

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
