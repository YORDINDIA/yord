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

-- Verify after applying — all six must be accepted, and an unknown type must
-- still be refused (proving the constraint is live, not merely absent):
--
--   insert into public.analytics_events (type, sid, path, props)
--   values ('quiz_viewed', gen_random_uuid(), '/quiz', '{}'::jsonb);  -- ok
--
--   insert into public.analytics_events (type, sid, path, props)
--   values ('not_a_real_event', gen_random_uuid(), '/', '{}'::jsonb); -- must fail
