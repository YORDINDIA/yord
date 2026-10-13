-- 016_adopt_order_claim.sql — the compare-and-swap adopt for a crashed
-- checkout claim. Apply after 015. Idempotent (`add column if not exists` +
-- CREATE OR REPLACE; the grants are re-runnable).
--
-- Why: `POST /api/checkout/verify-payment` can adopt an incomplete claim — an
-- orders row left 'paid' with no line items by a crashed attempt whose payment
-- was still captured. Adoption used to be a blind sequence: stamp an
-- `adopt-claim` note, then decrement stock and insert line items. The
-- re-decrement was called fail-safe (understated stock, never oversell), but
-- it is only fail-safe while the claim really is line-less and unclaimed. A
-- concurrent verify that lost the 23505 race adopts the same claim a moment
-- later and decrements the stock a second time — and if the first adopter's
-- compensation ran in between (its terminal stamp + stock restore land before
-- its refund call), the second adopter decrements stock the compensation had
-- just put back, for a payment whose money is already on its way to the
-- customer.
--
-- The fix is the write this function performs: one UPDATE that adopts the
-- claim only when EVERY precondition still holds at the instant of the write —
--
--   * `total_price` matches the total this attempt recomputed from the DB,
--   * the row is still 'paid', uncancelled and uncompensated,
--   * `claim_adopted_at` is still NULL (no other attempt adopted it first),
--   * the row still has no `line_items` (the winner did not finish after all).
--
-- The `NOT EXISTS` on `line_items` is the part PostgREST cannot express as an
-- update filter, which is why this is an RPC rather than a conditional
-- `.update()` from the route. `found` is the CAS answer: TRUE means this
-- attempt owns the claim and may decrement + insert line items; FALSE means
-- someone else moved first and the caller must re-read the resulting state and
-- answer from it without writing anything.
--
-- `claim_adopted_at` doubles as the once-only marker: a claim whose adoption
-- already happened is never re-adoptable, so a second crash after a successful
-- adopt (before line items committed) leaves the claim for reconciliation
-- instead of re-decrementing the first adopter's stock.
--
-- The note stamp mirrors the route's `persistCompensation` format
-- (`[stock-compensation <timestamp> adopt-claim] <detail>`, appended after a
-- newline to the existing `orders.note`), so an adopted claim reads the same
-- in reconciliation as every other money-path marker on the row.
--
-- Column and function names cross-checked against `scripts/schema.sql`
-- (`orders.note`, `orders.total_price`, `orders.financial_status`,
-- `orders.cancelled_at`, `orders.claim_adopted_at`, `line_items.order_id`) and
-- the route's own inserts in
-- `frontend/src/app/api/checkout/verify-payment/route.ts` — `total_price` is
-- DECIMAL(12,2) in rupees, the unit the route's server-computed `total` is in.
--
-- Deploy order: ship this file before (or with) the route change that calls
-- it. A route newer than the database finds the RPC missing, treats the adopt
-- as refused, answers 409 ORDER_INCOMPLETE and writes nothing — degraded but
-- never a double decrement. The reverse order (old route, new database)
-- changes nothing: the old route never calls this function.
--
-- Pre-flight checks (both should return zero rows before the first apply):
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'orders'
--      and column_name = 'claim_adopted_at';
--   select proname from pg_proc
--    where proname = 'adopt_order_claim'
--      and pronamespace = 'public'::regnamespace;
-- Rerunning after a first apply is a no-op by construction.

alter table public.orders add column if not exists claim_adopted_at timestamptz;

create or replace function public.adopt_order_claim(
  p_order_id bigint,
  p_total numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders o
     set claim_adopted_at = now(),
         note = case
                  when o.note is null or o.note = '' then
                    format(
                      '[stock-compensation %s adopt-claim] CAS adoption; stock re-decremented',
                      clock_timestamp()
                    )
                  else o.note || format(
                         E'\n[stock-compensation %s adopt-claim] CAS adoption; stock re-decremented',
                         clock_timestamp()
                       )
                end
   where o.id = p_order_id
     and o.total_price = p_total
     and o.financial_status = 'paid'
     and o.cancelled_at is null
     and o.claim_adopted_at is null
     and not exists (
           select 1
             from public.line_items li
            where li.order_id = o.id
         );
  return found;
end;
$$;

revoke all on function public.adopt_order_claim(bigint, numeric) from public;
grant execute on function public.adopt_order_claim(bigint, numeric) to service_role;
