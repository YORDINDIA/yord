-- 014_collections_handle_unique.sql — one collection per handle.
-- Apply after 013. Idempotent.
--
-- Why: `collections.handle` is the storefront route (`/collection/<handle>`) and
-- the admin derives it from the title, but the column carried no unique
-- constraint — only `products.handle` did. Two collections titled the same
-- therefore produced two rows sharing one handle, and the storefront resolves a
-- handle with `.maybeSingle()`, which PostgREST reports as **PGRST116** for both
-- "no rows" and "more than one row". `isPostgrestNotFound` reads that code as
-- "missing", so the page calls `notFound()`: `/collection/<handle>` 404s for
-- *both* collections and nothing is logged anywhere. The merchant sees a live
-- collection vanish with no error.
--
-- Pre-flight, verified against the live project on 2026-10-05:
--   * 39 collections, **zero duplicate handles**, zero NULL handles — so the
--     index can be created directly with no cleanup step. (A project that does
--     have duplicates must resolve them first; this migration will fail until
--     then, which is the intended behaviour — a silent skip would leave the bug
--     in place.)
--   * `handle` is nullable, hence the partial predicate. A NULL handle is a
--     collection no URL can reach, and the admin never writes one (it falls back
--     to `collection-<id>`), so the partial form only avoids failing on a row
--     that should not exist.
--   * `idx_collections_handle` already indexed this column, non-uniquely. The
--     unique index serves every `handle = …` lookup it served — Postgres uses a
--     partial index when the query implies its predicate, and `handle = 'x'`
--     implies `handle IS NOT NULL` — so the old index is dropped rather than
--     left as duplicate write overhead. To restore it:
--     `create index idx_collections_handle on public.collections (handle);`
--
-- The admin also refuses a taken handle with a field-level message on both the
-- create and the edit path (`admin-dashboard/src/server/actions/collections.ts`),
-- so the merchant gets a usable message rather than a raw 23505. This index is
-- the backstop behind that check, and the only guard that holds against two
-- concurrent creates.

create unique index if not exists collections_handle_key
  on public.collections (handle)
  where handle is not null;

drop index if exists public.idx_collections_handle;
