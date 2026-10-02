-- 006_orders_order_number_bigint.sql — widen orders.order_number to BIGINT.
--
-- verify-payment builds order_number as epochSeconds * 65536 + a 16-bit hex
-- suffix (frontend/src/app/api/checkout/verify-payment/route.ts), so two
-- same-second checkouts stay unique for track-order lookups. Current epochs
-- (~1.76e9) produce values around 1.15e14, far above the INTEGER ceiling
-- 2,147,483,647, so the order insert fails and every paid checkout refunds.
--
-- Pre-flight:
--   select column_name, data_type
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name = 'orders'
--      and column_name = 'order_number';
-- Expect `integer` before / `bigint` after. No overflow check is needed:
-- every INTEGER value fits in BIGINT, so the rewrite cannot lose data.
--
-- Apply via Supabase SQL editor, after 001-005. Confirm before running on
-- production. Re-runnable: the ALTER runs only while the column is still
-- integer; on a re-run it reports skipping via NOTICE.
--
-- NOTE: scripts/schema.sql still declares order_number INTEGER for fresh
-- databases; widen it there too (or apply this file right after schema.sql)
-- so new environments match production.

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'orders'
       and column_name = 'order_number'
       and data_type = 'integer'
  ) then
    alter table public.orders alter column order_number type bigint;
    raise notice 'orders.order_number widened to BIGINT';
  else
    raise notice 'orders.order_number is already BIGINT, skipping';
  end if;
end;
$$;
