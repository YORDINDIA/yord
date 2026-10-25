-- 018_quiz_codes.sql — single-use discount codes minted by the Diljit Aura
-- quiz pop-up. Apply after 017. Idempotent (`create table if not exists` +
-- `CREATE OR REPLACE`; the grants are re-runnable).
--
-- Why this file exists
-- --------------------
-- The storefront ran a quiz for the Diljit Dosanjh Aura India Tour stop in
-- Delhi (30 Oct 2026). A score picks a tier (10 / 20 / 40% off), the tier mints
-- one code, and the code reduces the amount Razorpay charges. Three shared
-- codes would have been simpler, but a shared 40% code leaks the moment one
-- person posts it, so each player gets their own single-use code instead.
--
-- Why not `price_rules` / `discount_codes`
-- ----------------------------------------
-- Those are the Shopify-shaped tables the admin discount page manages, and they
-- would fit a coupon. They are the wrong home for this one: `price_rules.id`
-- has no default and the admin mints ids from `admin_next_id`, which
-- `docs/deploy.md` applies *after* the migration glob (see
-- `015_orders_and_line_items_id_defaults.sql`), so a migration seeding rows
-- there would have to invent ids and could collide with the admin's counter.
-- The three percentages are a constant in
-- `frontend/src/features/quiz/config.ts` instead, and each minted code stores
-- the `percent` it was issued with, so codes already in a shopper's hands keep
-- the value they were promised even if the ladder changes.
--
-- The three `AURA-` codes that sell on the storefront still write
-- `order_discount_codes` + `discount_applications` at redemption, so the order
-- reads correctly in the admin and in any Shopify-shaped export.
--
-- Pre-flight check (should return zero rows before the first apply):
--   select to_regclass('public.quiz_codes');
--
-- Deploy order: apply this file before deploying the storefront change. A
-- storefront newer than the database finds the functions missing, answers
-- `CODE_UNAVAILABLE`, and sells at full price — degraded, never a bad discount.
-- The reverse order (new database, old storefront) changes nothing: nothing
-- reads the table.

-- ---------------------------------------------------------------------------
-- One row per minted code. `id` is an identity column on purpose: 015 was the
-- lesson that a BIGINT `id` with no default fails every insert with 23502, and
-- on a money path that failure lands *after* a capture.
--
-- RLS is enabled with NO policies: anon and authenticated get nothing, and
-- every read and write goes through the service key in the API routes. Same
-- shape as `analytics_events` (010).
-- ---------------------------------------------------------------------------
create table if not exists public.quiz_codes (
  id bigint generated always as identity primary key,
  code text not null unique check (code = upper(code)),
  -- The player's analytics session id (a random per-browser uuid, never joined
  -- to a customer). One code per browser, so a refresh returns the same code
  -- instead of minting another. Clearing localStorage earns a new one, which is
  -- intended — it is a game, and the rate limit is what bounds farming.
  sid uuid not null unique,
  percent integer not null check (percent in (10, 20, 40)),
  correct integer not null check (correct >= 0),
  -- Question count at mint time, so an old row still renders "8/10" after the
  -- question set changes.
  total integer not null check (total > 0),
  -- Razorpay order id this code is held for. `reserve_quiz_code` sets it and
  -- only the same payment can re-take it, which is what makes a verify retry
  -- idempotent without letting a second payment take a spent code.
  reserved_for text,
  reserved_at timestamptz,
  redeemed_at timestamptz,
  order_id bigint references public.orders(id) on delete set null,
  -- Recorded, not enforced: a hard per-customer cap would have to reject a
  -- payment that is already captured, and refunding a legitimate second order
  -- costs more trust than the double-dip costs margin. The admin page surfaces
  -- the column so a pattern is visible.
  redeemed_email text,
  created_at timestamptz not null default now()
);

-- The code lookup is the hot path (every promo field check, every create-order
-- and every verify). `unique` above already indexes it; this one covers the
-- admin's "show me redeemed codes" read.
create index if not exists quiz_codes_redeemed_at_idx
  on public.quiz_codes (redeemed_at);

alter table public.quiz_codes enable row level security;

-- ---------------------------------------------------------------------------
-- Read-only lookup: is this code usable, and what is it worth?
--
-- Shared by three callers that must agree — the promo field's validate route,
-- `create-order` (which needs the percent to charge) and `verify-payment`
-- (which needs it to re-check the captured amount) — so the definition of
-- "usable" lives in one place instead of three slightly different selects.
--
-- `p_ends_at` is a parameter rather than a literal because the campaign window
-- is a constant in `frontend/src/features/quiz/config.ts`; hardcoding a date
-- here would give the campaign two sources of truth.
--
-- Expiry reads the clock, not `created_at`: the window is the last moment a code
-- can be *applied*, which is what the result screen's "use it by" line promises.
--
-- `reason` is a stable machine token the routes map to copy:
--   not_found | redeemed | expired | held
-- `held` means another payment is mid-verify with this code right now; the
-- caller may retry, which is why it is distinct from `redeemed`.
--
-- The `right join` on a one-row anchor is what makes a miss return a row: the
-- plain subquery form returns zero rows for an unknown code, and the caller
-- would have to tell "no such code" from "query failed" by null-checking an
-- empty result set.
-- ---------------------------------------------------------------------------
create or replace function public.peek_quiz_code(
  p_code text,
  p_ends_at timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when qc.code is null then jsonb_build_object('ok', false, 'reason', 'not_found')
    when qc.redeemed_at is not null then jsonb_build_object('ok', false, 'reason', 'redeemed')
    when now() > p_ends_at then jsonb_build_object('ok', false, 'reason', 'expired')
    when qc.reserved_at is not null and qc.reserved_at > now() - interval '15 minutes'
      then jsonb_build_object('ok', false, 'reason', 'held')
    else jsonb_build_object(
      'ok', true,
      'percent', qc.percent,
      'correct', qc.correct,
      'total', qc.total
    )
  end
  from (select * from public.quiz_codes where code = upper(btrim(p_code))) qc
  right join (select 1) anchor on true;
$$;

-- ---------------------------------------------------------------------------
-- Compare-and-swap reservation, the `reserve_refund` pattern from
-- `admin-dashboard/sql/002_refund_idempotency.sql`.
--
-- The write happens only when the row is still spendable *at the instant of the
-- write*, which is what the previous peek cannot promise: two payments can pass
-- `peek` a millisecond apart and both charge the discount. The CAS closes that
-- window with two arms, and the grouping between them is load-bearing —
--
--   * **free and not under a live hold** — `reserved_for is null` *and* the
--     hold, if any, is older than the 15-minute lease. The lease arm is what
--     stops a crashed verify that never redeemed from locking a code out
--     forever.
--   * **or already held by this same payment** — `reserved_for = p_reservation`.
--     This arm is deliberately *not* lease-bounded: a retry seconds after the
--     first attempt must re-take its own hold, or the replay would find the code
--     `held`, drop the discount, and refund an order that was charged correctly.
--     An earlier version wrote the two arms as sibling `and` clauses, which
--     quietly made this one unreachable — `reserved_at` was always seconds old
--     on a retry, so the lease clause rejected every row the retry arm matched.
--     `migration 018`'s own checks in `docs/deploy.md` §8 catch it.
--
-- Returns `{ok: true, percent, correct, total}` on success and
-- `{ok: false, reason}` otherwise, with the same `reason` tokens as `peek`.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_quiz_code(
  p_code text,
  p_reservation text,
  p_ends_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.quiz_codes;
begin
  update public.quiz_codes
     set reserved_for = p_reservation,
         reserved_at = now()
   where code = upper(btrim(p_code))
     and redeemed_at is null
     and now() <= p_ends_at
     and (
       (
         reserved_for is null
         and (reserved_at is null or reserved_at < now() - interval '15 minutes')
       )
       or reserved_for = p_reservation
     )
  returning * into v_row;

  if v_row.code is null then
    -- Nothing was taken. Re-read to say *why*, so the caller can tell a spent
    -- code (refund) from a stale one (retry) without a second round trip.
    return public.peek_quiz_code(p_code, p_ends_at);
  end if;

  return jsonb_build_object(
    'ok', true,
    'percent', v_row.percent,
    'correct', v_row.correct,
    'total', v_row.total
  );
end;
$$;

revoke all on function public.peek_quiz_code(text, timestamptz) from public;
revoke all on function public.reserve_quiz_code(text, text, timestamptz) from public;

-- Supabase grants EXECUTE to anon/authenticated at CREATE FUNCTION time, so
-- revoking `public` alone leaves the per-role grants in place and the functions
-- callable through PostgREST. Revoke the roles explicitly; service_role is
-- re-granted below. Same correction as 010.
revoke all on function public.peek_quiz_code(text, timestamptz) from anon, authenticated;
revoke all on function public.reserve_quiz_code(text, text, timestamptz) from anon, authenticated;

grant execute on function public.peek_quiz_code(text, timestamptz) to service_role;
grant execute on function public.reserve_quiz_code(text, text, timestamptz) to service_role;
