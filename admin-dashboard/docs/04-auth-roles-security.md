# Auth, Roles, and Security

## Auth Model
- Supabase Auth is the identity provider.
- Admin UI uses Supabase SSR + browser clients.

## Roles (phase 1)
- Admin: full access across all modules.

## Future roles (post‑MVP)
- Catalog Manager, Content Editor, Operations, Support, Analyst.

## Role Storage (proposed tables)
- `admin_users` (user_id, role, is_active, created_at)
- `admin_roles` (role_name, permissions_json)
- `admin_audit_log` (actor_id, action, entity, entity_id, before, after, created_at)

## RLS Strategy
- Default deny for all admin-relevant tables.
- Phase 1: single Admin role with full access.
- Future: role-based policies on `products`, `orders`, `articles`, etc.
- Avoid exposing service role key in the client.

## Secrets and AI
- AI providers must be called via Supabase Edge Functions or Netlify Functions.
- Store API keys in server-side env only.

## Audit and Safety
- Every destructive or AI-applied change logs to `admin_audit_log`.
- Soft delete where possible (use status flags over deletes).
