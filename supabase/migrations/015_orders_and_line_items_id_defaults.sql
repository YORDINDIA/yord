-- 015_orders_and_line_items_id_defaults.sql — give the two storefront-written
-- tables an id generator. Apply after 014. Idempotent.
--
-- Why: `orders.id` and `line_items.id` are BIGINT NOT NULL with no default and
-- no identity. The Shopify migration preserved the source ids instead of giving
-- the columns a generator, and every insert names its columns explicitly.
-- `POST /api/checkout/verify-payment` inserts neither table's `id`, so **both
-- inserts fail with 23502** (not-null violation) — and the `orders` one fails
-- AFTER the payment is captured. The route reads a failed claim as "order claim
-- failed after capture", compensates and refunds, and answers 500.
--
-- Verified against the live project on 2026-10-05:
--
--   * Running the route's exact `orders` column list (no `id`) inside a
--     rolled-back block returns
--     `23502 / null value in column "id" of relation "orders" violates not-null constraint`.
--     There is no trigger and no rule on `orders` that could have supplied one.
--   * No storefront order has ever been created, so this is not theoretical:
--     of 612 orders, **0** carry a `confirmation_number` (the Razorpay payment
--     id only this route writes), **0** sit in the id band the storefront would
--     produce, and **0** use the route's `YORD-<epoch>-<hex>` name. Every
--     checkout attempt has charged the customer, failed, and refunded.
--   * `line_items` holds 625 rows, all Shopify-migrated, none from this route.
--   * `order_shipping_addresses` has no `id` column at all, and
--     `analytics_events.id` is already an identity — so these two tables are the
--     whole blast radius of the fourth and final insert in the route.
--
-- Why a sequence rather than `admin_next_id('orders')`, the house allocator for
-- products/collections/discounts: that function is defined in
-- `admin-dashboard/sql/002_admin_next_id.sql`, which `docs/deploy.md` applies
-- *after* the `supabase/migrations/` glob — so a migration depending on it would
-- fail on a fresh build. A sequence also evaluates once per row, which is what a
-- multi-row `line_items` insert needs (the function allocates one id per call).
--
-- `setval(…, max(id) + 1, false)` starts each sequence just above the migrated
-- rows, so the next `nextval` cannot collide with a Shopify or admin-allocated
-- id, and a later `admin_next_id` call still continues from `MAX(id) + 1`.
--
-- Additive and safe for existing writers: an insert that names `id` explicitly
-- still wins over a column default, so the admin, the migration scripts and
-- `tidy_collections.py` are unaffected. Nothing is backfilled and no existing
-- row changes.

create sequence if not exists public.orders_id_seq;
create sequence if not exists public.line_items_id_seq;

alter sequence public.orders_id_seq owned by public.orders.id;
alter sequence public.line_items_id_seq owned by public.line_items.id;

-- `false` = the next `nextval` returns exactly this value, not this value + 1.
select setval('public.orders_id_seq', (select coalesce(max(id), 0) + 1 from public.orders), false);
select setval(
  'public.line_items_id_seq',
  (select coalesce(max(id), 0) + 1 from public.line_items),
  false
);

alter table public.orders alter column id set default nextval('public.orders_id_seq');
alter table public.line_items alter column id set default nextval('public.line_items_id_seq');
