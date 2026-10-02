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

-- 3. Keep min_price fresh on variant writes. Handles product moves
-- (UPDATE ... SET product_id): both the old and the new product are
-- refreshed, otherwise the old product keeps a stale cached minimum.
create or replace function public.refresh_product_min_price()
returns trigger
language plpgsql
as $$
declare
  v_old_product_id bigint;
  v_new_product_id bigint;
begin
  v_old_product_id := case when tg_op = 'DELETE' then old.product_id else null end;
  v_new_product_id := case when tg_op = 'DELETE' then null else new.product_id end;
  if tg_op = 'UPDATE' then
    v_old_product_id := old.product_id;
  end if;

  if v_new_product_id is not null then
    update public.products p
    set min_price = (select min(price)
                     from public.product_variants
                     where product_id = v_new_product_id)
    where p.id = v_new_product_id;
  end if;

  if v_old_product_id is not null
     and (v_new_product_id is null or v_old_product_id <> v_new_product_id) then
    update public.products p
    set min_price = (select min(price)
                     from public.product_variants
                     where product_id = v_old_product_id)
    where p.id = v_old_product_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_refresh_product_min_price on public.product_variants;
create trigger trg_refresh_product_min_price
  after insert or update of price, product_id or delete on public.product_variants
  for each row execute function public.refresh_product_min_price();

-- 4. Collection membership with price, so collection/artist pages can
--    order in SQL instead of chunked .in() + client merge.
--    Wired into getProductsByCollection / getProductsByArtistHandle /
--    getProductsFiltered via products.min_price ordering (see queries.ts).
create or replace view public.collection_products as
  select c.collection_id,
         p.id as product_id,
         p.min_price,
         p.published_at,
         p.title
  from public.collects c
  join public.products p on p.id = c.product_id
  where p.status = 'active';

-- Price-sort index: product listing pages order active products by
-- (min_price, id) when min_price is backfilled; NULLS LAST keeps
-- un-backfilled legacy rows at the tail of price-asc sorts.
create index if not exists products_status_min_price_idx
  on public.products (status, min_price asc nulls last, id asc);
