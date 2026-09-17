-- 001_min_price.sql — server-side price sort foundation.
-- Apply via Supabase SQL editor. Confirm before running on production.
-- After applying: regenerate types into packages/db-types.

-- 1. Cached minimum variant price on products (avoids fetching up to
--    PRICE_SORT_FETCH_LIMIT rows + in-memory sort in queries.ts).
alter table public.products
  add column if not exists min_price numeric;

-- 2. Backfill from existing variants.
update public.products p
set min_price = v.min_price
from (select product_id, min(price) as min_price
      from public.product_variants
      group by product_id) v
where p.id = v.product_id
  and p.min_price is null;

-- 3. Keep min_price fresh on variant writes.
create or replace function public.refresh_product_min_price()
returns trigger
language plpgsql
as $$
begin
  update public.products p
  set min_price = (select min(price)
                   from public.product_variants
                   where product_id = coalesce(new.product_id, old.product_id))
  where p.id = coalesce(new.product_id, old.product_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_refresh_product_min_price on public.product_variants;
create trigger trg_refresh_product_min_price
  after insert or update of price, product_id or delete on public.product_variants
  for each row execute function public.refresh_product_min_price();

-- 4. Collection membership with price, so collection/artist pages can
--    order in SQL instead of chunked .in() + client merge.
create or replace view public.collection_products as
  select c.collection_id,
         p.id as product_id,
         p.min_price,
         p.published_at,
         p.title
  from public.collects c
  join public.products p on p.id = c.product_id
  where p.status = 'active';
