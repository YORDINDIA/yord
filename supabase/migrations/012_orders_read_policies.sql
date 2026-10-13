-- 012_orders_read_policies.sql — a signed-in shopper can read their own orders.
-- Apply after 011 (fresh or existing project; idempotent — the UPDATE is a
-- no-op once normalised, the index is IF NOT EXISTS, and both policies are
-- guarded with DROP POLICY IF EXISTS). Pre-flight: none, reads only.
--
-- Why: schema.sql creates `orders`/`line_items` with no policies, and Supabase
-- enables RLS on new tables by default — that is the same fact 009 was written
-- to work around for the catalog, and its header records the symptom (every
-- anon-key read returned zero rows). 009 covered products/variants/images/
-- options/collections/collects/blogs and stopped there, so the order tables
-- kept RLS on with zero policies.
--
-- Consequence, verified against the live project on 2026-10-05:
--   orders      → rls = on, policies = 0
--   line_items  → rls = on, policies = 0
-- The storefront's account pages read `orders` with the *signed-in user's*
-- client and treat RLS as the ownership backstop (see
-- app/(main)/account/orders/_lib/orders.ts and
-- app/(main)/account/orders/[id]/page.tsx), so every read returned zero rows:
-- /account showed no recent orders, /account/orders always rendered "No orders
-- yet", and /account/orders/[id] called notFound() for every order. The feature
-- was never broken *and* leaking — it was simply unreachable.
--
-- Ownership is the verified auth email, not a user id: migrated Shopify orders
-- carry `email` but many have `customer_id` NULL (the migration sets it
-- ON DELETE SET NULL, and 201 of 612 rows have no email at all — guest/POS
-- orders that correctly stay invisible). Supabase normalises auth emails to
-- lowercase and verify-payment already inserts
-- `orderData.email.toLowerCase().trim()`, so the 17 legacy rows holding an
-- uppercase address are normalised here too; otherwise the policy and the
-- app's own `.eq('email', …)` filter would disagree and hide them.
--
-- SELECT only. Writes stay service-role only — there is deliberately no
-- INSERT/UPDATE/DELETE policy here, exactly as in 009.
--
-- PRECONDITION — the ownership claim is only as strong as email verification.
-- This policy trusts that a session holding email X proved control of X, which
-- holds only while Auth requires confirmation. Verified 2026-10-05:
-- mailer_autoconfirm = false and mailer_allow_unverified_email_sign_ins = false.
-- Turning either on would make "sign up as the victim's address" possible and
-- this policy would then hand over their order history. If you ever enable
-- auto-confirm, replace the email test with a `customer_id` link first
-- (`auth.uid()` → `customers.user_id` → `orders.customer_id`); note that only
-- 411 of 612 orders carry an email at all, and those 201 are exactly the rows
-- with a NULL customer_id, so the email path is currently the only one that
-- covers real orders.

-- Legacy rows from the Shopify migration kept their original casing. Emails are
-- case-insensitive (RFC 5321), and the storefront filters on the raw value.
update public.orders
   set email = lower(email)
 where email is not null
   and email <> lower(email);

-- The policy and the app filter both match on the normalised value.
create index if not exists orders_email_lower_idx on public.orders (lower(email));

drop policy if exists orders_own_select on public.orders;
create policy orders_own_select on public.orders
  for select to authenticated
  using (email is not null and lower(email) = lower(auth.email()));

-- Line items are public to whoever owns the parent order. The subquery reads
-- `orders` as the invoking user, so it is itself filtered by
-- orders_own_select — the explicit email test is a second, independent
-- condition rather than the only one.
drop policy if exists line_items_own_select on public.line_items;
create policy line_items_own_select on public.line_items
  for select to authenticated
  using (exists (select 1 from public.orders o
                 where o.id = line_items.order_id
                   and o.email is not null
                   and lower(o.email) = lower(auth.email())));

-- Not covered on purpose: `customers`, `customer_addresses`,
-- `order_shipping_addresses`, `order_billing_addresses` and `transactions` all
-- have RLS on with no policies too, but no *storefront* route reads them — the
-- account order detail page reads only `orders` and `line_items`, and
-- verify-payment writes the address tables through the service client. Leaving
-- them unreadable to the publishable key is the correct default.
--
-- The admin dashboard does read `customers` and `transactions`, and it is
-- deliberately NOT fixed here: it reaches them through its own service client
-- (`admin-dashboard/src/lib/data/client.ts::reader`, which defaults to service
-- because the admin is gated by `middleware.ts` + `(admin)/layout.tsx` before
-- any of that runs). Do not add an admin policy for these tables — an operator
-- needs to see every row, not the ones a policy can express.
