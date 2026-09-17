# `@yord/supabase-clients` — dedup plan (STUB, not yet wired)

## What is duplicated today

- `frontend/src/lib/supabase/server.ts` — `createServerClient` (cookie-aware),
  `createServiceClient` (service role, no cookies), `createStaticClient`
  (anon, no cookies). Typed with `<Database>` from `@/types/database`.
- `admin-dashboard/src/lib/supabase/server.ts` — near-identical
  `createServerClient` + `createServiceClient`, but untyped (no `<Database>`
  generic) and **no** `createStaticClient`.
- `packages/auth/src/index.ts` already ships generic equivalents
  (`createServerSupabase`, `createStaticSupabase`, `createBrowserSupabase`)
  that take URL/keys/cookies as arguments instead of reading `process.env`.

## Target shape

One typed package exporting three factories:

- `createServerClient<Database>(cookies)` — cookie-aware SSR client
- `createServiceClient<Database>()` — service-role client, no cookies
- `createStaticClient<Database>()` — anon client for static generation

`Database` stays in the consuming app (`frontend/src/types/database.ts`)
and is passed as a generic, so this package takes no dependency on it.

## Cutover steps (tracked: https://github.com/YORDINDIA/yord/issues — "supabase-clients cutover")

1. Move the three factories here, generic over `Database`, reading keys
   from arguments (same style as `packages/auth`).
2. Point `@/*` `Database` imports at the call sites, not inside the package.
3. Rewire `frontend` imports, then `admin-dashboard` imports; keep both
   green with `npx tsc --noEmit` after each app.
4. Delete the two `lib/supabase/server.ts` files only when both apps pass
   typecheck + build on the package import.

Known drift (same issue): `frontend/src/types/database.ts` is the byte-copy
of `@yord/db-types`; `admin-dashboard/src/types/database.ts` is a
hand-maintained superset (extra admin/ai tables). Port the admin tables into
`packages/db-types` when convenient.

## Status

Stub only: `src/index.ts` exports a `SUPABASE_CLIENTS_CUTOVER_PENDING`
flag so the workspace resolves. No existing import has been rewired.
