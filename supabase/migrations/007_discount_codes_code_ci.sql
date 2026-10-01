-- 007_discount_codes_code_ci.sql — case-insensitive uniqueness for discount codes.
--
-- The admin discount action normalizes codes with toUpperCase() and pre-checks
-- with ilike, but without a database constraint two concurrent inserts (or a
-- migrated duplicate pair) can still create case-variant duplicates, and the
-- action's duplicate-error branch stays dead code. This index makes the
-- application normalization and the database agree.
--
-- Apply via Supabase SQL editor (after 001-006). Pre-flight (expects zero rows):
--   select upper(code) as code, count(*)
--     from public.discount_codes
--    group by 1 having count(*) > 1;
-- Normalize or remove duplicates before applying; this statement will fail on
-- existing case-variant dupes rather than silently picking a winner.

create unique index if not exists uq_discount_codes_code_ci
  on public.discount_codes (upper(code));
