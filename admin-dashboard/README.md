# YORD Admin Dashboard

Admin panel for YORD India built with Next.js + Supabase. Designed for Netlify deployment and direct Supabase CRUD.

## Setup
1. Create `.env.local` from `.env.example` and fill in Supabase + OpenAI + Razorpay keys.
2. Run SQL migrations in `admin-dashboard/sql/` (Supabase SQL editor):
   - `001_admin_tables.sql`
   - `002_admin_next_id.sql`
3. Ensure Supabase RLS policies allow Admin users to read/write required tables.

## Scripts
```bash
npm install
npm run dev
```

## Notes
- Products/collections/discounts rely on BIGINT ids. `admin_next_id` provides safe id generation.
- AI endpoints use OpenAI Responses API + image edits. Ensure `OPENAI_API_KEY` is set.
- Refunds are executed via Razorpay using `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
