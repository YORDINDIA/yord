-- 019_analytics_event_types.sql — admit the quiz and promo events to
-- `analytics_events.type`. Apply after 018. Idempotent (drop-then-add).
--
-- Why this file exists
-- --------------------
-- `010_analytics_events.sql` wrote the event vocabulary as a CHECK constraint:
--
--   type text not null check (type in ('page_viewed', ... 'order_completed'))
--
-- That list is a **whitelist**, and nothing joins it to the zod schema the
-- client and the ingest route share. So the Diljit Aura quiz shipped six new
-- event types that the schema accepted, the route validated, and the database
-- then rejected — every insert failed the CHECK, the route answered 502
-- `Could not record events`, and `flushAnalytics` drops a failed batch by
-- design. The result was a quiz funnel that recorded **nothing at all**, with
-- no error anywhere a human would look: the client never surfaces a failed
-- flush, and the route's 502 is only in the worker log.
--
-- Found by posting each new event type to the live ingest route and checking
-- for a 204, which is the only check that distinguishes "validated" from
-- "stored" — a 400 would have meant the schema was wrong, and the schema was
-- the part that worked.
--
-- The constraint is kept rather than dropped. It is the last line of defence
-- for a hand-written insert or a future route that forgets to validate, and
-- widening it is cheap. The real fix for the drift is
-- `frontend/src/lib/__tests__/analytics-event-types.test.ts`, which derives the
-- type list from the zod schema and fails if any type is missing from these
-- migrations — so the next new event cannot ship into this trap.
--
-- Pre-flight (should return 6 — the types this migration adds):
--   select count(*) from pg_constraint
--   where conname = 'analytics_events_type_check'
--     and pg_get_constraintdef(oid) not like '%quiz_viewed%';
--
-- Widening a CHECK is safe and non-destructive: every existing row satisfies
-- the old list, which is a subset of the new one. No data is read or moved.
--
-- The drop and the add run inside one transaction: between them the table has
-- no constraint at all, and a failed apply at exactly that point (under the
-- documented `psql -v ON_ERROR_STOP=1 -f` deploy, where each statement
-- auto-commits) would leave analytics accepting *any* type, silently. DDL is
-- transactional in Postgres, so the block either lands whole or not at all.

begin;

alter table public.analytics_events
  drop constraint if exists analytics_events_type_check;

alter table public.analytics_events
  add constraint analytics_events_type_check check (type in (
    -- 010 — the original vocabulary.
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
    'order_completed',
    -- 019 — the quiz funnel and the promo field. `quiz_viewed` carries the
    -- trigger (`timer` | `scroll` | `direct`), so the pop-up and the `/quiz`
    -- URL read as one funnel; `quiz_completed` carries the tier percentage.
    'quiz_viewed',
    'quiz_started',
    'quiz_completed',
    'quiz_dismissed',
    'promo_applied',
    'promo_rejected'
  ));

commit;

-- Verify on every apply (this re-runs with the migration glob, so the probe
-- must leave nothing behind and must fail the file if either half is wrong):
-- each of the six new types is inserted and an unknown type is still refused,
-- all inside a transaction that rolls back, so the check proves the constraint
-- is live — not merely absent — without polluting analytics with probe rows.
-- The expected-violation halves are wrapped in nested BEGIN/EXCEPTION blocks
-- (subtransactions) so a *passing* unknown-type insert raises, while a
-- rejected one is absorbed and the check continues.

begin;

do $probe$
declare
  t text;
begin
  foreach t in array array[
    'quiz_viewed', 'quiz_started', 'quiz_completed',
    'quiz_dismissed', 'promo_applied', 'promo_rejected'
  ] loop
    begin
      insert into public.analytics_events (type, sid, path, props)
      values (t, gen_random_uuid(), '/probe', '{}'::jsonb);
    exception when check_violation then
      raise exception 'analytics_events_type_check rejected % — the constraint was not widened', t;
    end;
  end loop;

  begin
    insert into public.analytics_events (type, sid, path, props)
    values ('not_a_real_event', gen_random_uuid(), '/probe', '{}'::jsonb);
    raise exception 'analytics_events_type_check accepted an unknown type — the constraint is absent, not live';
  exception when check_violation then
    null;  -- the expected outcome
  end;
end
$probe$;

rollback;
