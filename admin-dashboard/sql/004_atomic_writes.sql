-- 004_atomic_writes.sql — atomic multi-row admin writes + analytics rollups.
--
-- Run in Supabase SQL editor AFTER 001_admin_tables.sql and
-- 002_admin_next_id.sql. Every function here is idempotent.
--
-- Why this file exists
-- --------------------
-- 1. `set_collection_products` — collections/[id] used to DELETE every
--    `collects` row for a collection and then re-INSERT them one at a time. A
--    failure part-way through left the collection with partial products and no
--    visible error, because the old inline action discarded its error. The
--    whole replace is now one transaction: either the collection ends up with
--    exactly the submitted product set, or nothing changes.
--
-- 2. `set_product_variants` — products/[id] used to `JSON.parse` a raw client
--    payload and UPDATE variants in a loop, so a mid-loop failure applied some
--    rows and not others. One statement, one transaction.
--
-- 3. `set_cover_image` — the old action set `position = 0` on the chosen image
--    and never demoted the previous cover, so two images held position 0. This
--    swaps: the previous cover is pushed to 1 and everything else is shifted
--    down to make room.
--
-- 4. `revenue_by_day` / `top_products_by_units` — dashboard and analytics used
--    to fetch `.limit(500)` order rows and sum them in JavaScript, so any
--    window with more than 500 orders under-reported, and the 14-day chart was
--    bucketed from that already-truncated set. The rollup runs in SQL over the
--    full window. `top_products_by_units` groups by `product_id`, so two
--    distinct products sharing a title are no longer merged into one row.
--
-- Pre-flight checks (all should return zero rows before applying):
--   select collection_id, count(*) from public.collects
--    group by 1 having count(distinct product_id) <> count(*);
--   select id, position from public.product_images
--    where product_id is not null group by 1, 2 having count(*) > 1;
-- The second query finds products that currently have two images at the same
-- position (the bug above). `set_cover_image` repairs them as they are
-- touched; renumber them in bulk if the storefront shows the wrong cover.

-- ---------------------------------------------------------------------------
-- Collections: replace the full product set atomically.
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

  -- Normalize: drop nulls/duplicates so the primary key cannot collide.
  create temporary table _yord_targets on commit drop as
    select distinct p as product_id
    from unnest(coalesce(p_product_ids, '{}'::bigint[])) as p
    where p is not null and p > 0;

  delete from public.collects where collection_id = p_collection_id;

  insert into public.collects (id, collection_id, product_id, position, created_at)
  select
    public.admin_next_id('collects'),
    p_collection_id,
    t.product_id,
    row_number() over (order by t.product_id),
    now()
  from _yord_targets t;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- ---------------------------------------------------------------------------
-- Products: apply a validated variant set in one transaction.
-- ---------------------------------------------------------------------------
create or replace function public.set_product_variants(
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  -- Reject the whole batch if any row is malformed, rather than updating the
  -- subset that happens to parse.
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as el
    where el ->> 'id' is null
       or (el ->> 'id') !~ '^[0-9]+$'
       or coalesce((el ->> 'price')::numeric, -1) < 0
       or coalesce((el ->> 'inventory_quantity')::numeric, -1) < 0
  ) then
    raise exception 'INVALID_VARIANT_ROWS';
  end if;

  update public.product_variants v
  set
    price = greatest(coalesce((el ->> 'price')::numeric, 0), 0),
    compare_at_price = case
      when el ->> 'compare_at_price' is null or el ->> 'compare_at_price' = ''
        then null
      else greatest((el ->> 'compare_at_price')::numeric, 0)
    end,
    inventory_quantity = greatest(floor(coalesce((el ->> 'inventory_quantity')::numeric, 0)), 0),
    updated_at = now()
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as el
  where v.id = (el ->> 'id')::bigint;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

-- ---------------------------------------------------------------------------
-- Products: make one image the cover, demoting the previous cover.
-- ---------------------------------------------------------------------------
create or replace function public.set_cover_image(p_image_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id bigint;
begin
  select product_id into v_product_id
  from public.product_images
  where id = p_image_id
  for update;

  if v_product_id is null then
    raise exception 'IMAGE_NOT_FOUND';
  end if;

  -- Shift everything down by one, then take slot 0. Net effect: exactly one
  -- image at position 0, no gaps among the rest.
  update public.product_images
  set position = position + 1
  where product_id = v_product_id
    and id <> p_image_id;

  update public.product_images
  set position = 0, updated_at = now()
  where id = p_image_id;

  return v_product_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Analytics: per-day INR revenue over a window (no row cap), net of refunds.
--
-- Gross counts only captured money: paid / partially_paid /
-- partially_refunded. Pending, authorized, failed, voided, and fully-refunded
-- orders never enter the sum. Completed gateway refunds (note carries
-- 'Razorpay refund <id>') are subtracted in paise/100 on the refund's day;
-- pending/failed/unknown reservations have moved no money and are excluded.
-- Legacy pre-reservation refunds have no amount and their orders sit in
-- 'refunded' status, so they net to zero through exclusion.
-- ---------------------------------------------------------------------------
create or replace function public.revenue_by_day(p_since timestamptz)
returns table (day date, total numeric)
language sql
stable
security definer
set search_path = public
as $$
  with gross as (
    select
      (o.created_at at time zone 'utc')::date as day,
      sum(o.total_price)::numeric as gross
    from public.orders o
    where o.created_at >= p_since
      and coalesce(o.currency, 'INR') = 'INR'
      and o.financial_status in ('paid', 'partially_paid', 'partially_refunded')
    group by 1
  ),
  refunded as (
    select
      (r.created_at at time zone 'utc')::date as day,
      sum(r.amount)::numeric / 100 as refunded
    from public.refunds r
    join public.orders o on o.id = r.order_id
    where r.created_at >= p_since
      and coalesce(o.currency, 'INR') = 'INR'
      and r.amount is not null
      and r.note like '%Razorpay refund%'
    group by 1
  ),
  days as (
    select day from gross
    union
    select day from refunded
  )
  select
    d.day,
    (coalesce(g.gross, 0) - coalesce(f.refunded, 0))::numeric as total
  from days d
  left join gross g using (day)
  left join refunded f using (day)
  order by 1;
$$;

-- ---------------------------------------------------------------------------
-- Analytics: units + revenue per product, keyed by id (not by title).
-- ---------------------------------------------------------------------------
create or replace function public.top_products_by_units(p_limit integer default 8)
returns table (
  product_id bigint,
  title text,
  quantity numeric,
  revenue numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    li.product_id,
    min(li.title) as title,
    sum(coalesce(li.quantity, 0))::numeric as quantity,
    sum(coalesce(li.quantity, 0) * coalesce(li.price, 0))::numeric as revenue
  from public.line_items li
  group by li.product_id
  order by quantity desc
  limit greatest(coalesce(p_limit, 8), 1);
$$;

revoke all on function public.set_collection_products(bigint, bigint[]) from public;
revoke all on function public.set_product_variants(jsonb) from public;
revoke all on function public.set_cover_image(bigint) from public;
revoke all on function public.revenue_by_day(timestamptz) from public;
revoke all on function public.top_products_by_units(integer) from public;

grant execute on function public.set_collection_products(bigint, bigint[]) to service_role;
grant execute on function public.set_product_variants(jsonb) to service_role;
grant execute on function public.set_cover_image(bigint) to service_role;
grant execute on function public.revenue_by_day(timestamptz) to service_role;
grant execute on function public.top_products_by_units(integer) to service_role;
