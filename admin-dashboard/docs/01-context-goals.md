# Context and Goals

## Background
YORD India migrated from Shopify to Supabase and is served via a Next.js storefront. The Admin Panel must provide Shopify-equivalent operations for managing catalog, collections, orders, customers, discounts, and content. The admin UI must connect directly to Supabase and be deployable on Netlify free plan.

## Goals
- Full CRUD and workflow management for Shopify-equivalent entities.
- Direct Supabase access with RLS and role-based permissions (no custom backend for standard CRUD).
- Human-in-the-loop AI workflows for content and growth.
- Clear, consistent UX for operations, bulk edits, and approvals.
- Auditability and safe change control.

## Non-goals (for initial release)
- Marketplace or multi-store support.
- Complex ERP-style accounting.
- Real-time warehouse automation or carrier integrations beyond manual fulfillment updates.

## Constraints
- Must use Supabase as the system of record.
- Must deploy on Netlify free plan (no long-running server processes).
- Sensitive keys must remain server-side (Supabase Edge Functions or Netlify Functions for AI).

## Success Metrics
- Admin can publish/update products and collections without Shopify.
- Orders can be fulfilled and refunded with status integrity.
- Blog content is fully editable, and new AI-assisted posts can be published with approvals.
- Audit log captures all destructive or AI-applied changes.
