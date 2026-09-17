-- Atomic inventory decrement for checkout.
-- One RPC per line item, called via Promise.all; returns a row only when
-- enough stock exists, so concurrent checkouts cannot oversell.
create or replace function public.decrement_variant_stock(p_variant_id bigint, p_qty integer)
returns table (id bigint, inventory_quantity integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_qty is null or p_qty = 0 then
    raise exception 'quantity must be non-zero';
  end if;

  return query
  update public.product_variants as v
  set inventory_quantity = v.inventory_quantity - p_qty
  where v.id = p_variant_id
    and (p_qty < 0 or v.inventory_quantity >= p_qty)
  returning v.id, v.inventory_quantity;
end;
$$;

revoke all on function public.decrement_variant_stock(bigint, integer) from public;
grant execute on function public.decrement_variant_stock(bigint, integer) to service_role;
