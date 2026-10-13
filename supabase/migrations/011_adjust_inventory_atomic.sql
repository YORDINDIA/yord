-- 011_adjust_inventory_atomic.sql — atomic inventory adjustment with a
-- truthful audit trail.
--
-- Apply in numeric order (after 010). Idempotent: CREATE OR REPLACE.
--
-- Why this file exists
-- --------------------
-- bulkAdjustInventoryAction (admin-dashboard/src/server/actions/inventory.ts)
-- read the selected variants' quantities with one query and wrote the new
-- value with a second. A concurrent save — another admin's save, or a checkout
-- decrement landing between the two — made the audit's `before` quantity
-- stale, so inventory history no longer showed the value that immediately
-- preceded the adjustment. This RPC locks the rows (SELECT ... FOR UPDATE in a
-- CTE), reads each previous quantity under the lock, applies the update, and
-- returns the locked `before` values so the action can audit truthfully. Rows
-- are locked in id order so two concurrent adjustments cannot deadlock.
--
-- Pre-flight checks (all should return zero rows before applying):
--   select proname from pg_proc
--    where proname = 'adjust_inventory_quantities'
--      and pronamespace = 'public'::regnamespace;
--   select id from public.product_variants where inventory_quantity < 0;
-- The first finds an existing function under the same name; the second finds
-- negative stock rows, which the update's floor guard would silently change.

create or replace function public.adjust_inventory_quantities(
  p_variants jsonb
)
returns table (
  id bigint,
  product_id bigint,
  previous_quantity integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Reject the whole batch when any row is malformed, rather than updating
  -- the subset that happens to parse (same convention as set_product_variants
  -- in 004). The caller validates first; this is the boundary a hand-built
  -- RPC call meets: ids must be positive integers and quantities non-negative
  -- integers.
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_variants, '[]'::jsonb)) as el
    where (el ->> 'id') !~ '^[0-9]+$'
       or coalesce((el ->> 'id')::numeric, 0) <= 0
       or (el ->> 'inventory_quantity') is null
       or (el ->> 'inventory_quantity')::text !~ '^[0-9]+$'
  ) then
    raise exception 'INVALID_VARIANT_ROWS';
  end if;

  return query
  with locked as (
    -- Lock first and read the previous quantity under the lock, in a stable
    -- id order. Everything downstream sees the value as of the lock, so a
    -- concurrent save can no longer land between the read and the write.
    select v.id, v.product_id, v.inventory_quantity
    from public.product_variants v
    where v.id in (
      select distinct ((el ->> 'id')::bigint)
      from jsonb_array_elements(p_variants) as el
    )
    order by v.id
    for update
  ),
  wanted as (
    -- One quantity per id (duplicate ids in the payload collapse to the
    -- smallest), floored and clamped to >= 0 like set_product_variants.
    select
      (el ->> 'id')::bigint as id,
      greatest(floor(min((el ->> 'inventory_quantity')::numeric)), 0)::integer as quantity
    from jsonb_array_elements(p_variants) as el
    group by 1
  ),
  updated as (
    update public.product_variants v
    set
      inventory_quantity = w.quantity,
      updated_at = now()
    from wanted w
    join locked l on l.id = w.id
    where v.id = w.id
    returning v.id
  )
  -- The locked, pre-update values: exactly what the audit should record.
  select l.id, l.product_id, l.inventory_quantity
  from locked l
  order by l.id;
end;
$$;

revoke all on function public.adjust_inventory_quantities(jsonb) from public;
grant execute on function public.adjust_inventory_quantities(jsonb) to service_role;
