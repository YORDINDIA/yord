-- 004_order_confirmation_uidx.sql — close the verify double-submit race.
-- Two concurrent verify-payment calls for the same Razorpay payment both pass
-- the confirmation_number lookup, then both decrement stock and insert orders.
-- A unique constraint makes the loser fail with 23505, which the API catches
-- to restore stock and return the winner's order instead of a duplicate.
-- Apply via Supabase SQL editor. Confirm before running on production.

-- Partial index: legacy/migrated rows with NULL confirmation_number are
-- unaffected (Postgres treats NULLs as distinct), and only real payment ids
-- participate in the constraint.
create unique index if not exists orders_confirmation_number_uidx
  on public.orders (confirmation_number)
  where confirmation_number is not null;
