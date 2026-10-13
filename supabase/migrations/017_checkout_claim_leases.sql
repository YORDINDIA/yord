-- 017_checkout_claim_leases.sql
--
-- Replace the 016 one-shot adoption marker with an expiring owner lease and
-- durable, per-order stock operations. Finalization and compensation are each
-- single transactions, so a process crash can be retried without applying a
-- stock movement or inserting order rows twice.
--
-- Apply after 016 and before deploying the matching verify-payment route.
-- Safe to re-run. Existing incomplete claims are deliberately blocked: 016
-- did not persist enough information to know whether an earlier process
-- already decremented stock.

begin;

create table if not exists public.checkout_order_claims (
  order_id bigint primary key references public.orders(id),
  status text not null
    check (status in ('active', 'completed', 'compensated', 'legacy_blocked')),
  owner_token uuid,
  lease_expires_at timestamptz,
  total_price numeric(12, 2),
  line_items_snapshot jsonb,
  shipping_snapshot jsonb,
  failure_detail text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (
    (status = 'active' and owner_token is not null and lease_expires_at is not null)
    or status <> 'active'
  )
);

create table if not exists public.checkout_stock_operations (
  order_id bigint not null references public.orders(id),
  line_number integer not null check (line_number >= 0),
  variant_id bigint not null,
  quantity integer not null check (quantity > 0),
  decrement_state text not null default 'pending'
    check (decrement_state in ('pending', 'applied', 'unavailable')),
  restore_state text not null default 'pending'
    check (restore_state in ('pending', 'restored', 'missing')),
  created_at timestamptz not null default clock_timestamp(),
  primary key (order_id, line_number)
);

alter table public.checkout_order_claims enable row level security;
alter table public.checkout_stock_operations enable row level security;
revoke all on public.checkout_order_claims from public, anon, authenticated, service_role;
revoke all on public.checkout_stock_operations from public, anon, authenticated, service_role;

-- Claims predating this protocol cannot be safely adopted. A missing stock
-- ledger could mean zero, some, or all stock was already decremented.
insert into public.checkout_order_claims (order_id, status, total_price, failure_detail)
select o.id, 'legacy_blocked', o.total_price,
       'pre-017 incomplete order: stock history is unknown'
  from public.orders o
 where o.confirmation_number is not null
   and o.financial_status = 'paid'
   and o.cancelled_at is null
   and (
     not exists (select 1 from public.line_items li where li.order_id = o.id)
     or not exists (
       select 1 from public.order_shipping_addresses a where a.order_id = o.id
     )
   )
on conflict (order_id) do nothing;

create or replace function public.create_checkout_claim(
  p_name text,
  p_order_number bigint,
  p_email text,
  p_phone text,
  p_currency text,
  p_total numeric,
  p_subtotal numeric,
  p_tax numeric,
  p_confirmation_number text,
  p_payment_order_id text,
  p_owner_token uuid,
  p_line_items jsonb,
  p_shipping jsonb,
  p_lease_seconds integer default 90
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id bigint;
  v_lease_seconds integer := greatest(30, least(coalesce(p_lease_seconds, 90), 300));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise insufficient_privilege using message = 'service_role required';
  end if;
  if p_owner_token is null
     or p_confirmation_number is null
     or jsonb_typeof(p_line_items) is distinct from 'array'
     or jsonb_typeof(p_shipping) is distinct from 'object' then
    raise exception 'invalid checkout claim payload';
  end if;
  if jsonb_array_length(p_line_items) = 0 then
    raise exception 'checkout claim requires line items';
  end if;

  insert into public.orders (
    name, order_number, email, phone, financial_status, fulfillment_status,
    currency, total_price, subtotal_price, total_tax, total_shipping_price,
    confirmation_number, token, processed_at
  ) values (
    p_name, p_order_number, p_email, p_phone, 'paid', 'unfulfilled',
    p_currency, p_total, p_subtotal, p_tax, 0,
    p_confirmation_number, p_payment_order_id, clock_timestamp()
  )
  on conflict (confirmation_number) where confirmation_number is not null
  do nothing
  returning id into v_order_id;

  -- A duplicate payment id belongs to the row already present. The route
  -- re-reads it and must obtain its lease before any stock operation.
  if v_order_id is null then
    return null;
  end if;

  insert into public.checkout_order_claims (
    order_id, status, owner_token, lease_expires_at, total_price,
    line_items_snapshot, shipping_snapshot
  ) values (
    v_order_id, 'active', p_owner_token,
    clock_timestamp() + make_interval(secs => v_lease_seconds),
    p_total, p_line_items, p_shipping
  );

  insert into public.checkout_stock_operations (
    order_id, line_number, variant_id, quantity
  )
  select v_order_id, (entry.ordinality - 1)::integer,
         (entry.item->>'variant_id')::bigint,
         (entry.item->>'quantity')::integer
    from jsonb_array_elements(p_line_items) with ordinality as entry(item, ordinality);

  return v_order_id;
end;
$$;

create or replace function public.acquire_checkout_claim(
  p_order_id bigint,
  p_owner_token uuid,
  p_cart_items jsonb,
  p_shipping jsonb,
  p_lease_seconds integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_claim public.checkout_order_claims%rowtype;
  v_lease_seconds integer := greatest(30, least(coalesce(p_lease_seconds, 90), 300));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise insufficient_privilege using message = 'service_role required';
  end if;
  if p_owner_token is null then
    raise exception 'owner token required';
  end if;

  select * into v_claim
    from public.checkout_order_claims
   where order_id = p_order_id
   for update;

  if not found then
    select * into v_order from public.orders where id = p_order_id for update;
    if not found then
      return jsonb_build_object('status', 'missing');
    end if;
    -- An old route may have inserted a bare order after the migration's
    -- backfill. Fail closed rather than guessing whether stock moved.
    insert into public.checkout_order_claims (
      order_id, status, total_price, failure_detail
    ) values (
      p_order_id, 'legacy_blocked', v_order.total_price,
      'claim has no 017 stock ledger'
    )
    on conflict (order_id) do nothing;
    return jsonb_build_object('status', 'legacy_blocked');
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  if v_claim.status = 'completed' then
    return jsonb_build_object('status', 'completed');
  elsif v_claim.status = 'compensated' then
    return jsonb_build_object('status', 'compensated');
  elsif v_claim.status = 'legacy_blocked' then
    return jsonb_build_object('status', 'legacy_blocked');
  end if;
  if v_claim.total_price is distinct from v_order.total_price then
    return jsonb_build_object('status', 'payload_mismatch');
  end if;

  if jsonb_typeof(p_cart_items) is distinct from 'array'
     or jsonb_typeof(p_shipping) is distinct from 'object' then
    return jsonb_build_object('status', 'invalid_payload');
  end if;

  if (
    select coalesce(jsonb_agg(jsonb_build_object(
      'variant_id', (entry.item->>'variant_id')::bigint,
      'quantity', (entry.item->>'quantity')::integer
    ) order by entry.ordinality), '[]'::jsonb)
      from jsonb_array_elements(v_claim.line_items_snapshot)
           with ordinality as entry(item, ordinality)
  ) is distinct from p_cart_items
     or v_claim.shipping_snapshot is distinct from p_shipping then
    return jsonb_build_object('status', 'payload_mismatch');
  end if;

  if v_order.cancelled_at is not null
     or v_order.financial_status is distinct from 'paid' then
    return jsonb_build_object('status', 'compensated');
  end if;

  if v_claim.lease_expires_at > clock_timestamp()
     and v_claim.owner_token is distinct from p_owner_token then
    return jsonb_build_object('status', 'busy');
  end if;

  update public.checkout_order_claims
     set owner_token = p_owner_token,
         lease_expires_at = clock_timestamp() + make_interval(secs => v_lease_seconds),
         updated_at = clock_timestamp()
   where order_id = p_order_id;

  return jsonb_build_object(
    'status', 'owned',
    'line_items', v_claim.line_items_snapshot,
    'shipping', v_claim.shipping_snapshot
  );
end;
$$;

create or replace function public.apply_checkout_stock(
  p_order_id bigint,
  p_owner_token uuid,
  p_line_number integer,
  p_lease_seconds integer default 90
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claim public.checkout_order_claims%rowtype;
  v_operation public.checkout_stock_operations%rowtype;
  v_inventory integer;
  v_lease_seconds integer := greatest(30, least(coalesce(p_lease_seconds, 90), 300));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise insufficient_privilege using message = 'service_role required';
  end if;

  select * into v_claim
    from public.checkout_order_claims
   where order_id = p_order_id
   for update;
  if not found
     or v_claim.status <> 'active'
     or v_claim.owner_token is distinct from p_owner_token
     or v_claim.lease_expires_at <= clock_timestamp() then
    return 'not_owner';
  end if;

  select * into v_operation
    from public.checkout_stock_operations
   where order_id = p_order_id and line_number = p_line_number
   for update;
  if not found then
    return 'invalid_line';
  elsif v_operation.decrement_state = 'applied' then
    update public.checkout_order_claims
       set lease_expires_at = clock_timestamp() + make_interval(secs => v_lease_seconds),
           updated_at = clock_timestamp()
     where order_id = p_order_id;
    return 'applied';
  elsif v_operation.decrement_state = 'unavailable' then
    return 'unavailable';
  end if;

  update public.product_variants
     set inventory_quantity = inventory_quantity - v_operation.quantity
   where id = v_operation.variant_id
     and inventory_quantity >= v_operation.quantity
  returning inventory_quantity into v_inventory;

  if not found then
    update public.checkout_stock_operations
       set decrement_state = 'unavailable'
     where order_id = p_order_id and line_number = p_line_number;
    return 'unavailable';
  end if;

  update public.checkout_stock_operations
     set decrement_state = 'applied'
   where order_id = p_order_id and line_number = p_line_number;
  update public.checkout_order_claims
     set lease_expires_at = clock_timestamp() + make_interval(secs => v_lease_seconds),
         updated_at = clock_timestamp()
   where order_id = p_order_id;
  return 'applied';
end;
$$;

create or replace function public.complete_checkout_order(
  p_order_id bigint,
  p_owner_token uuid,
  p_line_items jsonb,
  p_shipping jsonb
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claim public.checkout_order_claims%rowtype;
  v_inserted integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise insufficient_privilege using message = 'service_role required';
  end if;

  select * into v_claim
    from public.checkout_order_claims
   where order_id = p_order_id
   for update;
  if not found then
    return 'missing';
  elsif v_claim.status = 'completed' then
    return 'already_completed';
  elsif v_claim.status <> 'active'
     or v_claim.owner_token is distinct from p_owner_token
     or v_claim.lease_expires_at <= clock_timestamp() then
    return 'not_owner';
  end if;

  if v_claim.line_items_snapshot is distinct from p_line_items
     or v_claim.shipping_snapshot is distinct from p_shipping then
    return 'payload_mismatch';
  end if;
  if jsonb_typeof(p_line_items) is distinct from 'array'
     or jsonb_typeof(p_shipping) is distinct from 'object' then
    return 'payload_mismatch';
  end if;
  if jsonb_array_length(p_line_items) = 0 then
    return 'payload_mismatch';
  end if;
  if exists (select 1 from public.line_items li where li.order_id = p_order_id) then
    return 'preexisting_line_items';
  end if;
  if exists (
    select 1 from public.checkout_stock_operations op
     where op.order_id = p_order_id
       and op.decrement_state <> 'applied'
  ) then
    return 'stock_incomplete';
  end if;

  begin
    insert into public.line_items (
      order_id, product_id, variant_id, title, variant_title, price, quantity,
      requires_shipping, taxable, gift_card
    )
    select p_order_id, line.product_id, line.variant_id, line.title,
           line.variant_title, line.price, line.quantity,
           coalesce(line.requires_shipping, true), coalesce(line.taxable, true),
           coalesce(line.gift_card, false)
      from jsonb_to_recordset(p_line_items) as line(
        product_id bigint,
        variant_id bigint,
        title text,
        variant_title text,
        price numeric,
        quantity integer,
        requires_shipping boolean,
        taxable boolean,
        gift_card boolean
      );
    get diagnostics v_inserted = row_count;
    if v_inserted <> jsonb_array_length(p_line_items) then
      raise exception 'not all line items were persisted';
    end if;

    insert into public.order_shipping_addresses (
      order_id, first_name, last_name, address1, address2,
      city, province, country, zip, phone
    ) values (
      p_order_id,
      p_shipping->>'first_name',
      p_shipping->>'last_name',
      p_shipping->>'address1',
      p_shipping->>'address2',
      p_shipping->>'city',
      p_shipping->>'province',
      p_shipping->>'country',
      p_shipping->>'zip',
      p_shipping->>'phone'
    )
    on conflict (order_id) do nothing;

    if not exists (
      select 1 from public.order_shipping_addresses where order_id = p_order_id
    ) then
      raise exception 'shipping address was not persisted';
    end if;

    update public.orders
       set financial_status = 'paid',
           cancelled_at = null
     where id = p_order_id;
    update public.checkout_order_claims
       set status = 'completed',
           owner_token = null,
           lease_expires_at = null,
           updated_at = clock_timestamp()
     where order_id = p_order_id;
    return 'completed';
  exception when others then
    -- The exception block is a subtransaction: no partial line/address write
    -- survives. The caller can now run the idempotent stock compensation.
    return 'write_failed';
  end;
end;
$$;

create or replace function public.compensate_checkout_order(
  p_order_id bigint,
  p_owner_token uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claim public.checkout_order_claims%rowtype;
  v_operation public.checkout_stock_operations%rowtype;
  v_restored integer := 0;
  v_missing integer := 0;
  v_updated integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise insufficient_privilege using message = 'service_role required';
  end if;

  select * into v_claim
    from public.checkout_order_claims
   where order_id = p_order_id
   for update;
  if not found then
    return jsonb_build_object('status', 'missing');
  elsif v_claim.status = 'compensated' then
    return jsonb_build_object('status', 'compensated', 'restore_ok', true);
  elsif v_claim.status <> 'active'
     or v_claim.owner_token is distinct from p_owner_token
     or v_claim.lease_expires_at <= clock_timestamp() then
    return jsonb_build_object('status', 'not_owner');
  end if;

  for v_operation in
    select * from public.checkout_stock_operations
     where order_id = p_order_id
       and decrement_state = 'applied'
       and restore_state = 'pending'
     order by line_number
     for update
  loop
    update public.product_variants
       set inventory_quantity = inventory_quantity + v_operation.quantity
     where id = v_operation.variant_id;
    get diagnostics v_updated = row_count;
    if v_updated = 1 then
      update public.checkout_stock_operations
         set restore_state = 'restored'
       where order_id = p_order_id and line_number = v_operation.line_number;
      v_restored := v_restored + 1;
    else
      update public.checkout_stock_operations
         set restore_state = 'missing'
       where order_id = p_order_id and line_number = v_operation.line_number;
      v_missing := v_missing + 1;
    end if;
  end loop;

  update public.orders
     set cancelled_at = coalesce(cancelled_at, clock_timestamp()),
         note = right(concat_ws(
           E'\n',
           nullif(note, ''),
           format('[stock-compensation %s checkout-compensated] %s', clock_timestamp(), left(coalesce(p_reason, ''), 500)),
           case
             when coalesce(note, '') like '%[checkout-refund pending]%'
               or coalesce(note, '') like '%[checkout-refund failed]%'
               or coalesce(note, '') like '%[checkout-refund completed]%'
               then null
             else '[checkout-refund pending]'
           end
         ), 2000)
   where id = p_order_id;

  update public.checkout_order_claims
     set status = 'compensated',
         owner_token = null,
         lease_expires_at = null,
         failure_detail = case when v_missing > 0
           then format('stock restore missing for %s line(s)', v_missing)
           else left(coalesce(p_reason, ''), 500)
         end,
         updated_at = clock_timestamp()
   where order_id = p_order_id;

  return jsonb_build_object(
    'status', 'compensated',
    'restore_ok', v_missing = 0,
    'restored_lines', v_restored,
    'missing_lines', v_missing
  );
end;
$$;

-- Keep old route releases from bypassing the lease ledger. Old requests fail
-- their stock decrement and follow their existing refund path; they cannot
-- mutate inventory outside this migration's idempotency records.
create or replace function public.decrement_variant_stock(p_variant_id bigint, p_qty integer)
returns table (id bigint, inventory_quantity integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise insufficient_privilege using message = 'service_role required';
  end if;
  return;
end;
$$;

-- Preserve the 016 signature for an old route binary, but fail closed. Only
-- the token-bearing 017 RPC can lease or recover an incomplete claim.
create or replace function public.adopt_order_claim(p_order_id bigint, p_total numeric)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise insufficient_privilege using message = 'service_role required';
  end if;
  return false;
end;
$$;

revoke all on function public.create_checkout_claim(
  text, bigint, text, text, text, numeric, numeric, numeric, text, text, uuid, jsonb, jsonb, integer
) from public, anon, authenticated;
revoke all on function public.acquire_checkout_claim(bigint, uuid, jsonb, jsonb, integer)
  from public, anon, authenticated;
revoke all on function public.apply_checkout_stock(bigint, uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_checkout_order(bigint, uuid, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.compensate_checkout_order(bigint, uuid, text)
  from public, anon, authenticated;
revoke all on function public.decrement_variant_stock(bigint, integer)
  from public, anon, authenticated;
revoke all on function public.adopt_order_claim(bigint, numeric)
  from public, anon, authenticated;

grant execute on function public.create_checkout_claim(
  text, bigint, text, text, text, numeric, numeric, numeric, text, text, uuid, jsonb, jsonb, integer
) to service_role;
grant execute on function public.acquire_checkout_claim(bigint, uuid, jsonb, jsonb, integer)
  to service_role;
grant execute on function public.apply_checkout_stock(bigint, uuid, integer, integer)
  to service_role;
grant execute on function public.complete_checkout_order(bigint, uuid, jsonb, jsonb)
  to service_role;
grant execute on function public.compensate_checkout_order(bigint, uuid, text)
  to service_role;
grant execute on function public.decrement_variant_stock(bigint, integer)
  to service_role;
grant execute on function public.adopt_order_claim(bigint, numeric)
  to service_role;

commit;
