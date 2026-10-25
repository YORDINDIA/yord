# `@yord/supabase-clients`

Shared Supabase client factories for the YORD monorepo. Both `frontend` and
`admin-dashboard` import these instead of re-implementing the same clients.

## Entries

- `.` (`src/index.ts`) — four generic factories: `createServerSupabase`
  (cookie-aware SSR), `createServiceSupabase` (secret key), `createStaticSupabase`
  (publishable key, no cookies), `createBrowserSupabase`. All take URL/keys as
  **arguments**, never `process.env`, so a secret key cannot leak into a client
  bundle through this module. The `Database` generic comes from the caller
  (`@yord/db-types`), so the package depends on no app's schema types.
- `./server` (`src/server.ts`) — the env-bound convenience layer that reads
  `NEXT_PUBLIC_SUPABASE_URL` / keys and wraps the factories. Starts with
  `import 'server-only'`, so importing it from `'use client'` code is a build
  error rather than a leaked-key risk.

## History

This package began as a dedup plan (frontend and admin each carried
near-identical `lib/supabase/server.ts` client sets, plus an unused
`@yord/auth` experiment that duplicated the same factories); the cutover
completed and the duplicate per-app client code was deleted. The apps now keep
only thin wrappers here: `frontend/src/lib/supabase/{client,server}.ts` and
`admin-dashboard/src/lib/supabase/{client,server}.ts` — the browser wrapper
resolves env and falls back to a placeholder endpoint for backend-less builds,
then hands both keys to `createBrowserSupabase` rather than calling
`@supabase/ssr` itself.
