-- 005_positional_collection_products.sql — `set_collection_products` keeps the
-- caller's order.
--
-- Run in the Supabase SQL editor AFTER 004_atomic_writes.sql. Idempotent
-- (`create or replace`). Rollback: re-run the `set_collection_products`
-- definition from 004.
--
-- Why this exists
-- ---------------
-- The 004 body deduplicated through `select distinct p from unnest(...)` and
-- numbered `collects.position` with `row_number() over (order by t.product_id)`,
-- so the submitted array order was discarded twice over and every collection
-- ended up numbered by product id. The admin picker submits its display order
-- (the ↑/↓ controls) and the storefront's `manual` collection sort orders a
-- collection by `collects.position`, so both were silently broken: an admin
-- could reorder a list that was never stored, and no shopper could ever see a
-- curated order.
--
-- Behaviour preserved from 004: NULL and non-positive ids dropped, duplicates
-- collapsed (first occurrence wins, at the first occurrence's position), the
-- whole replace stays one transaction, `COLLECTION_NOT_FOUND` on a missing
-- collection, return value = rows inserted.
--
-- Pre-flight (should print the 004 body, i.e. `order by t.product_id`):
--   select prosrc from pg_proc where proname = 'set_collection_products';

-- ---------------------------------------------------------------------------

create or replace function public.set_collection_products(
  p_collection_id bigint,
  p_product_ids bigint[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
begin
  if exists (select 1 from public.collections where id = p_collection_id) is false then
    raise exception 'COLLECTION_NOT_FOUND';
  end if;

  -- Dedupe while preserving the caller's order: `with ordinality` carries the
  -- array index, `min(ord)` keeps the first occurrence of a duplicated id at
  -- that first position, and positions are assigned over that order instead of
  -- over product_id.
  create temporary table _yord_targets on commit drop as
    select p as product_id, min(ord) as ord
    from unnest(coalesce(p_product_ids, '{}'::bigint[])) with ordinality as t(p, ord)
    where p is not null and p > 0
    group by p;

  delete from public.collects where collection_id = p_collection_id;

  insert into public.collects (id, collection_id, product_id, position, created_at)
  select
    public.admin_next_id('collects'),
    p_collection_id,
    t.product_id,
    row_number() over (order by t.ord),
    now()
  from _yord_targets t;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;
