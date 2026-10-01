-- 004_order_confirmation_uidx.sql — close the verify double-submit race.
-- Two concurrent verify-payment calls for the same Razorpay payment both pass
-- the confirmation_number lookup, then both decrement stock and insert orders.
-- A unique constraint makes the loser fail with 23505, which the API catches
-- to restore stock and return the winner's order instead of a duplicate.
--
-- Pre-flight (expects zero rows; any row would fail the index with 23505):
--   select confirmation_number, count(*)
--     from public.orders
--    where confirmation_number is not null
--    group by 1 having count(*) > 1;
-- Duplicates are reconciled automatically by the DO block below, but review
-- its NOTICE output: every non-canonical row keeps its order, only its
-- confirmation_number is cleared (NULL = legacy, outside the partial index).
--
-- Apply via Supabase SQL editor, after 001-003. Confirm before running on
-- production. Re-runnable: the dedup keeps the earliest row per confirmation
-- number and the index uses IF NOT EXISTS.
--
-- Concurrency: the dedupe scan and the index build must not be interleaved
-- with checkout writes, or an order inserted between them re-creates a
-- duplicate and the migration dies with 23505. The whole file runs in one
-- transaction that takes SHARE ROW EXCLUSIVE on orders up front (blocks
-- INSERT/UPDATE/DELETE, allows reads); CREATE UNIQUE INDEX (non-concurrent)
-- already takes a strong lock, but only from its own statement onward — the
-- lock must be held across the dedupe too.

begin;

lock table public.orders in share row exclusive mode;

-- 1. Reconcile duplicate non-NULL confirmation numbers. Keeps the earliest
-- order (lowest id) per confirmation number as canonical; clears the number
-- on the rest instead of deleting them, and reports each group via NOTICE so
-- nothing is reconciled silently.
do $$
declare
  r record;
  v_canonical bigint;
  v_cleared integer;
begin
  for r in
    select confirmation_number
      from public.orders
     where confirmation_number is not null
     group by 1 having count(*) > 1
  loop
    select min(id) into v_canonical
      from public.orders
     where confirmation_number = r.confirmation_number;

    update public.orders
       set confirmation_number = null
     where confirmation_number = r.confirmation_number
       and id <> v_canonical;

    get diagnostics v_cleared = row_count;
    raise notice 'confirmation_number % duplicated: kept order id %, cleared % row(s)',
      r.confirmation_number, v_canonical, v_cleared;
  end loop;
end;
$$;

-- 2. Partial index: legacy/migrated rows with NULL confirmation_number are
-- unaffected (Postgres treats NULLs as distinct), and only real payment ids
-- participate in the constraint.
create unique index if not exists orders_confirmation_number_uidx
  on public.orders (confirmation_number)
  where confirmation_number is not null;

commit;
