# Architecture

## High-Level Components
- Admin UI: Next.js App Router (recommended within existing `frontend/`), deployed to Netlify.
- Supabase: Postgres (data), Auth (users/roles), Storage (images), Edge Functions (AI jobs).
- OpenAI: text + image generation via server-side functions only.
- Optional Netlify Functions: For secrets-heavy tasks (AI and payment refunds) if not using Supabase Edge Functions.

## Data Flow (Core CRUD)
1. Admin user authenticates via Supabase Auth.
2. UI uses Supabase JS client with anon key.
3. RLS policies enforce access by role and table.
4. Admin actions write directly to Supabase tables and Storage.

## Data Flow (AI Workflows)
1. Admin triggers AI action from UI.
2. UI creates an AI job record in Supabase.
3. Edge Function processes job, writes suggestions to staging tables.
4. Admin reviews diff/preview and explicitly approves.
5. Approved changes write to production tables + audit log.

## Data Flow (Refunds)
1. Admin initiates refund from order detail.
2. Server-side function calls payment gateway (Razorpay) using secret key.
3. Update `transactions` + `refunds` tables and order financial status.
4. Log to `admin_audit_log`.

## Hosting and Deployment
- Netlify free plan hosts the Next.js app with Supabase public keys.
- Secrets (AI keys, service role) live in Supabase Edge Functions or Netlify Functions env vars.
- No serverful backend is required for CRUD if RLS is properly configured.

## Observability
- Admin audit log table for all mutations and AI approvals.
- Error tracking in UI (toast + persistent error log page).
- Optional Supabase logs / Netlify function logs for AI jobs.
