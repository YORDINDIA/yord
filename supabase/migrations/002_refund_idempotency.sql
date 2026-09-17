-- 002_refund_idempotency.sql — atomic refund reservation + partial-refund cap.
--
-- The refund API reserves a row via reserve_refund() BEFORE calling the Razorpay
-- gateway, so a concurrent or replayed submit can never issue a second gateway
-- refund. The earlier blunt unique index on refund_transactions(transaction_id)
-- is replaced: it made partial refunds impossible and could not express a
-- cumulative cap.
--
-- Apply via Supabase SQL editor. Pre-flight (expects zero rows):
--   select transaction_id, count(*)
--     from public.refund_transactions
--    group by 1 having count(*) > 1;
-- Rows here mean the deployment predates the reservation flow; reconcile before
-- applying. Refunds recorded before this migration have no `amount`, so those
-- transactions are treated as fully refunded and cannot be refunded again.

create table if not exists public.refund_transactions (
  refund_id bigint not null references public.refunds(id) on delete cascade,
  transaction_id bigint not null references public.transactions(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (refund_id, transaction_id)
);

drop index if exists public.refund_transactions_transaction_id_uidx;
drop index if exists public.refund_transactions_transaction_uniq;

alter table public.refunds add column if not exists amount integer;

-- Reserves a refund and returns the amount charged to the gateway (paise) plus
-- the cumulative refunded total for the transaction. The remaining balance is
-- refunded when p_amount is null. Raises TRANSACTION_NOT_FOUND / AMOUNT_UNKNOWN
-- / ALREADY_REFUNDED / EXCEEDS_REMAINING without touching money.
drop function if exists public.reserve_refund(bigint, bigint, integer);

create or replace function public.reserve_refund(
  p_refund_id bigint,
  p_transaction_id bigint,
  p_amount integer default null
) returns table (effective integer, cumulative integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id bigint;
  v_txn_amount integer;
  v_refunded integer;
  v_has_unknown boolean;
  v_remaining integer;
  v_effective integer;
begin
  select t.order_id, round(t.amount * 100)::integer
    into v_order_id, v_txn_amount
    from public.transactions t
   where t.id = p_transaction_id
     for update;
  if not found then
    raise exception 'TRANSACTION_NOT_FOUND';
  end if;

  select coalesce(sum(r.amount), 0), coalesce(bool_or(r.amount is null), false)
    into v_refunded, v_has_unknown
    from public.refund_transactions rt
    join public.refunds r on r.id = rt.refund_id
   where rt.transaction_id = p_transaction_id;

  if v_txn_amount is null or v_txn_amount <= 0 then
    raise exception 'AMOUNT_UNKNOWN';
  end if;
  if v_has_unknown or v_refunded >= v_txn_amount then
    raise exception 'ALREADY_REFUNDED';
  end if;

  v_remaining := v_txn_amount - v_refunded;
  v_effective := coalesce(p_amount, v_remaining);
  if v_effective <= 0 or v_effective > v_remaining then
    raise exception 'EXCEEDS_REMAINING';
  end if;

  insert into public.refunds (id, order_id, note, amount, created_at)
  values (p_refund_id, v_order_id, 'pending reservation - gateway refund not yet issued', v_effective, now());

  insert into public.refund_transactions (refund_id, transaction_id)
  values (p_refund_id, p_transaction_id);

  return query select v_effective, v_refunded + v_effective;
end;
$$;

revoke all on function public.reserve_refund(bigint, bigint, integer) from public;
grant execute on function public.reserve_refund(bigint, bigint, integer) to service_role;
