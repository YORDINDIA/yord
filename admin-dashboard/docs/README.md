# YORD India Admin Dashboard - Technical Spec

This document set defines the Admin Panel for managing YORD India data in Supabase and serving it via the existing Next.js frontend. It is feature-first and organized for implementation planning. No code is included.

## Scope Summary
- Manage all Shopify-equivalent operations now stored in Supabase (catalog, collections, inventory, orders, customers, discounts, blogs, media).
- Direct Supabase connection suitable for Netlify free plan hosting (no custom backend required for core CRUD).
- Add AI-assisted workflows with human approval (listing improvement, image enhancement, blog research/drafting, marketing automation).

## Source Context (from repo)
- Supabase schema: `scripts/schema.sql` and `backups/schema.sql`
- Migration audit: `scripts/MIGRATION_AUDIT_REPORT.md`
- Frontend stack: Next.js App Router + Supabase SSR client (`frontend/`)
- Data exports: `data/*.csv`

## Doc Map
- `admin-dashboard/docs/01-context-goals.md`
- `admin-dashboard/docs/02-architecture.md`
- `admin-dashboard/docs/03-data-model.md`
- `admin-dashboard/docs/04-auth-roles-security.md`
- `admin-dashboard/docs/05-ux-navigation.md`

Features:
- `admin-dashboard/docs/features/catalog.md`
- `admin-dashboard/docs/features/collections.md`
- `admin-dashboard/docs/features/inventory.md`
- `admin-dashboard/docs/features/orders-fulfillment.md`
- `admin-dashboard/docs/features/customers.md`
- `admin-dashboard/docs/features/discounts.md`
- `admin-dashboard/docs/features/blogs.md`
- `admin-dashboard/docs/features/media-library.md`
- `admin-dashboard/docs/features/analytics.md`
- `admin-dashboard/docs/features/settings-audit.md`

AI and growth:
- `admin-dashboard/docs/features/ai/README.md`
- `admin-dashboard/docs/features/ai/listing-improvement.md`
- `admin-dashboard/docs/features/ai/blog-research.md`
- `admin-dashboard/docs/features/ai/marketing-ops.md`
- `admin-dashboard/docs/features/marketing-growth.md`

Appendices:
- `admin-dashboard/docs/appendices/data-issues.md`
- `admin-dashboard/docs/appendices/open-questions.md`
