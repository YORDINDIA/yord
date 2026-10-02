-- 010_analytics_events.sql — first-party behavioral analytics.
--
-- Apply in numeric order (after 009). Idempotent: the table, indexes, and
-- functions all use IF NOT EXISTS / CREATE OR REPLACE.
--
-- Why this file exists
-- --------------------
-- The storefront kept carts and wishlists in localStorage and had no
-- behavioral analytics: the admin dashboard could see what sold but not what
-- shoppers looked at, searched for, or wished for. Events are captured
-- client-side, batched through `POST /api/analytics/events` (frontend), and
-- inserted with the service key. The admin reads rollups through the
-- `analytics_*` RPCs below via `lib/data/traffic.ts`.
--
-- Privacy: events carry no PII. `sid` is a random per-browser UUID, never
-- joined to `customers` or auth users. `path` is query-stripped and search
-- terms are the only free text (length-capped by the API schema).
--
-- Pre-flight checks (should return zero rows before applying):
--   select to_regclass('public.analytics_events');
-- The table must not exist yet; the RPCs are safe to re-apply.

-- ---------------------------------------------------------------------------
-- Append-only event log. RLS is enabled with NO policies: anon and
-- authenticated get nothing (pattern matches 009 — writes stay service-role
-- only), the API route uses the service key, and the rollup RPCs below are
-- SECURITY DEFINER granted to service_role.
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  type text not null check (type in (
    'page_viewed',
    'product_viewed',
    'search_performed',
    'add_to_cart',
    'remove_from_cart',
    'cart_viewed',
    'wishlist_added',
    'wishlist_removed',
    'checkout_started',
    'checkout_failed',
    'order_completed'
  )),
  sid uuid not null,
  path text not null check (char_length(path) <= 512),
  referrer text check (char_length(referrer) <= 256),
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at);

-- Every rollup filters by window first and type second; this index serves
-- all of them (the per-window scan is bounded by created_at).
create index if not exists analytics_events_type_created_at_idx
  on public.analytics_events (type, created_at);

alter table public.analytics_events enable row level security;

-- ---------------------------------------------------------------------------
-- KPI totals over a window, in one round trip. The checkout funnel reads top
-- to bottom: product_views → add_to_carts → checkout_started → orders.
-- ---------------------------------------------------------------------------
create or replace function public.analytics_kpis(p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'page_views', count(*) filter (where type = 'page_viewed'),
    'unique_sids', count(distinct sid) filter (where type = 'page_viewed'),
    'product_views', count(*) filter (where type = 'product_viewed'),
    'add_to_carts', count(*) filter (where type = 'add_to_cart'),
    'wishlist_adds', count(*) filter (where type = 'wishlist_added'),
    'searches', count(*) filter (where type = 'search_performed'),
    'checkout_started', count(*) filter (where type = 'checkout_started'),
    'order_completed', count(*) filter (where type = 'order_completed'),
    'order_value', coalesce(sum(
      (props ->> 'value')::numeric
    ) filter (where type = 'order_completed'), 0)
  )
  from public.analytics_events
  where created_at >= p_since;
$$;

-- ---------------------------------------------------------------------------
-- Page views per UTC day. Only days with traffic are returned (no rows on an
-- empty day); the caller zero-fills like `revenue_by_day`.
-- ---------------------------------------------------------------------------
create or replace function public.page_views_by_day(p_since timestamptz)
returns table (day date, views bigint, unique_sids bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (created_at at time zone 'utc')::date as day,
    count(*)::bigint as views,
    count(distinct sid)::bigint as unique_sids
  from public.analytics_events
  where created_at >= p_since
    and type = 'page_viewed'
  group by 1
  order by 1;
$$;

-- ---------------------------------------------------------------------------
-- Page views grouped by route template (`props.template`): home vs product vs
-- collection pages, regardless of which handle was visited.
-- ---------------------------------------------------------------------------
create or replace function public.page_views_by_template(p_since timestamptz)
returns table (template text, views bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(props ->> 'template', 'other') as template,
    count(*)::bigint as views
  from public.analytics_events
  where created_at >= p_since
    and type = 'page_viewed'
  group by 1
  order by views desc;
$$;

-- ---------------------------------------------------------------------------
-- Most-visited paths (query-stripped by the collector), so a hot product or
-- collection page surfaces by its own handle.
-- ---------------------------------------------------------------------------
create or replace function public.top_pages(p_since timestamptz, p_limit integer default 10)
returns table (path text, views bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    path,
    count(*)::bigint as views
  from public.analytics_events
  where created_at >= p_since
    and type = 'page_viewed'
  group by 1
  order by views desc
  limit greatest(coalesce(p_limit, 10), 1);
$$;

-- ---------------------------------------------------------------------------
-- Most-viewed products in the window, with how many distinct browsers.
-- Titles and covers are resolved by the caller (admin `products` read +
-- `coversForProducts`), matching the low-stock list pattern.
-- ---------------------------------------------------------------------------
create or replace function public.top_viewed_products(p_since timestamptz, p_limit integer default 8)
returns table (product_id bigint, views bigint, unique_sids bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (props ->> 'product_id')::bigint as product_id,
    count(*)::bigint as views,
    count(distinct sid)::bigint as unique_sids
  from public.analytics_events
  where created_at >= p_since
    and type = 'product_viewed'
    and props ->> 'product_id' is not null
  group by 1
  order by views desc
  limit greatest(coalesce(p_limit, 8), 1);
$$;

-- ---------------------------------------------------------------------------
-- Most add-to-cart'ed products in the window. `order_completed` anchors the
-- revenue end of the funnel; this is the demand signal.
-- ---------------------------------------------------------------------------
create or replace function public.top_cart_adds(p_since timestamptz, p_limit integer default 8)
returns table (product_id bigint, adds bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (props ->> 'product_id')::bigint as product_id,
    count(*)::bigint as adds
  from public.analytics_events
  where created_at >= p_since
    and type = 'add_to_cart'
    and props ->> 'product_id' is not null
  group by 1
  order by adds desc
  limit greatest(coalesce(p_limit, 8), 1);
$$;

-- ---------------------------------------------------------------------------
-- Most-wishlisted products in the window. Wishlists live only in
-- localStorage, so this event stream is the only record that they exist.
-- ---------------------------------------------------------------------------
create or replace function public.top_wishlisted(p_since timestamptz, p_limit integer default 8)
returns table (product_id bigint, adds bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (props ->> 'product_id')::bigint as product_id,
    count(*)::bigint as adds
  from public.analytics_events
  where created_at >= p_since
    and type = 'wishlist_added'
    and props ->> 'product_id' is not null
  group by 1
  order by adds desc
  limit greatest(coalesce(p_limit, 8), 1);
$$;

-- ---------------------------------------------------------------------------
-- Search terms in the window, case-folded and trimmed; `zero_results` counts
-- the searches that returned nothing — that column is the merchandising gap
-- list (shoppers want what the catalog does not carry).
-- ---------------------------------------------------------------------------
create or replace function public.top_search_terms(p_since timestamptz, p_limit integer default 10)
returns table (term text, searches bigint, zero_results bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(btrim(props ->> 'term')) as term,
    count(*)::bigint as searches,
    count(*) filter (where coalesce((props ->> 'results')::int, 0) = 0)::bigint as zero_results
  from public.analytics_events
  where created_at >= p_since
    and type = 'search_performed'
    and coalesce(btrim(props ->> 'term'), '') <> ''
  group by 1
  order by searches desc
  limit greatest(coalesce(p_limit, 10), 1);
$$;

-- ---------------------------------------------------------------------------
-- View-to-order conversion per product: window views against all-time units
-- sold (`line_items` has no windowed units rollup — see 004). A product with
-- many views and no units is a listing problem; units without views mean
-- traffic never reaches it.
-- ---------------------------------------------------------------------------
create or replace function public.product_view_to_order(p_since timestamptz, p_limit integer default 8)
returns table (product_id bigint, views bigint, units bigint)
language sql
stable
security definer
set search_path = public
as $$
  with views as (
    select
      (props ->> 'product_id')::bigint as product_id,
      count(*)::bigint as views
    from public.analytics_events
    where created_at >= p_since
      and type = 'product_viewed'
      and props ->> 'product_id' is not null
    group by 1
  ),
  units as (
    select li.product_id, sum(coalesce(li.quantity, 0))::bigint as units
    from public.line_items li
    where li.product_id is not null
    group by 1
  )
  select
    v.product_id,
    v.views,
    coalesce(u.units, 0) as units
  from views v
  left join units u on u.product_id = v.product_id
  order by v.views desc
  limit greatest(coalesce(p_limit, 8), 1);
$$;

-- ---------------------------------------------------------------------------
-- Retention: delete events older than the cutoff, return the rows removed.
-- The service role calls this (SQL editor or a scheduled script); without a
-- periodic purge the table grows unbounded. 180 days keeps every window the
-- analytics page serves plus slack.
-- ---------------------------------------------------------------------------
create or replace function public.purge_analytics_events(p_before timestamptz)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
begin
  delete from public.analytics_events
  where created_at < p_before;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.analytics_kpis(timestamptz) from public;
revoke all on function public.page_views_by_day(timestamptz) from public;
revoke all on function public.page_views_by_template(timestamptz) from public;
revoke all on function public.top_pages(timestamptz, integer) from public;
revoke all on function public.top_viewed_products(timestamptz, integer) from public;
revoke all on function public.top_cart_adds(timestamptz, integer) from public;
revoke all on function public.top_wishlisted(timestamptz, integer) from public;
revoke all on function public.top_search_terms(timestamptz, integer) from public;
revoke all on function public.product_view_to_order(timestamptz, integer) from public;
revoke all on function public.purge_analytics_events(timestamptz) from public;

-- Supabase default privileges grant EXECUTE to anon/authenticated at CREATE
-- FUNCTION time, so revoking only `public` is not enough: the per-role grants
-- survive and the RPCs stay callable through PostgREST. Revoke the roles
-- explicitly; service_role is re-granted below.
revoke all on function public.analytics_kpis(timestamptz) from anon, authenticated;
revoke all on function public.page_views_by_day(timestamptz) from anon, authenticated;
revoke all on function public.page_views_by_template(timestamptz) from anon, authenticated;
revoke all on function public.top_pages(timestamptz, integer) from anon, authenticated;
revoke all on function public.top_viewed_products(timestamptz, integer) from anon, authenticated;
revoke all on function public.top_cart_adds(timestamptz, integer) from anon, authenticated;
revoke all on function public.top_wishlisted(timestamptz, integer) from anon, authenticated;
revoke all on function public.top_search_terms(timestamptz, integer) from anon, authenticated;
revoke all on function public.product_view_to_order(timestamptz, integer) from anon, authenticated;
revoke all on function public.purge_analytics_events(timestamptz) from anon, authenticated;

grant execute on function public.analytics_kpis(timestamptz) to service_role;
grant execute on function public.page_views_by_day(timestamptz) to service_role;
grant execute on function public.page_views_by_template(timestamptz) to service_role;
grant execute on function public.top_pages(timestamptz, integer) to service_role;
grant execute on function public.top_viewed_products(timestamptz, integer) to service_role;
grant execute on function public.top_cart_adds(timestamptz, integer) to service_role;
grant execute on function public.top_wishlisted(timestamptz, integer) to service_role;
grant execute on function public.top_search_terms(timestamptz, integer) to service_role;
grant execute on function public.product_view_to_order(timestamptz, integer) to service_role;
grant execute on function public.purge_analytics_events(timestamptz) to service_role;
